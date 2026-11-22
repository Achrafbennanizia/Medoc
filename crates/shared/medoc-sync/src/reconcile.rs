//! Hourly replica digest reconcile against the main device.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::recorded_write::json_object_sql;
use medoc_core::infrastructure::database::sync_registry::{deny_app_kv_key, synced_tables};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::deployment::DeviceRole;
use crate::merge::force_apply_payload;
use crate::repo::{ensure_local_device, list_pending_outbox, load_deployment};

pub const LAST_RUN_KV: &str = "sync.reconcile.last_run.v1";
pub const LAST_RESULT_KV: &str = "sync.reconcile.last_result.v1";
const REPAIR_KV: &str = "sync.repair.required.v1";
const MAX_ROWS: usize = 500;
const HOUR_SECS: i64 = 3600;

static IN_FLIGHT: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn in_flight() -> &'static Mutex<HashSet<String>> {
    IN_FLIGHT.get_or_init(|| Mutex::new(HashSet::new()))
}

pub fn try_begin_reconcile(device_id: &str) -> bool {
    in_flight()
        .lock()
        .map(|mut set| set.insert(device_id.to_string()))
        .unwrap_or(false)
}

pub fn end_reconcile(device_id: &str) {
    if let Ok(mut set) = in_flight().lock() {
        set.remove(device_id);
    }
}

pub struct ReconcileGuard(String);

impl ReconcileGuard {
    pub fn acquire(device_id: &str) -> Option<Self> {
        if try_begin_reconcile(device_id) {
            Some(Self(device_id.to_string()))
        } else {
            None
        }
    }
}

impl Drop for ReconcileGuard {
    fn drop(&mut self) {
        end_reconcile(&self.0);
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileReport {
    pub buckets_checked: u32,
    pub rows_fetched: u32,
    pub applied: u32,
    pub queued: u32,
    pub skipped: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigestResponse {
    pub buckets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowHash {
    pub table: String,
    pub id: String,
    pub hash: String,
    #[serde(default)]
    pub tombstone: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RowHashesRequest {
    pub buckets: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RowsRequest {
    pub ids: Vec<RowId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowId {
    pub table: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowBody {
    pub table: String,
    pub id: String,
    pub op: String,
    pub payload_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowHashesBody {
    pub rows: Vec<RowHash>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowsBody {
    pub rows: Vec<RowBody>,
}

pub fn hash_row_json(json: &str) -> String {
    let parsed: serde_json::Value = serde_json::from_str(json).unwrap_or(serde_json::Value::Null);
    let canonical = serde_json::to_string(&sort_value(parsed)).unwrap_or_else(|_| json.to_string());
    sha256_hex(canonical.as_bytes())
}

fn sort_value(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let ordered: serde_json::Map<String, serde_json::Value> = map
                .into_iter()
                .map(|(k, v)| (k, sort_value(v)))
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .collect();
            serde_json::Value::Object(ordered)
        }
        serde_json::Value::Array(items) => {
            serde_json::Value::Array(items.into_iter().map(sort_value).collect())
        }
        other => other,
    }
}

pub fn id_bucket(id: &str) -> u8 {
    Sha256::digest(id.as_bytes())[0]
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex_encode(&Sha256::digest(bytes))
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

async fn table_exists(pool: &SqlitePool, table: &str) -> bool {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
    )
    .bind(table)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
        > 0
}

async fn snapshot_row(
    pool: &SqlitePool,
    table: &str,
    id: &str,
) -> Result<Option<String>, AppError> {
    if table == "app_kv" && deny_app_kv_key(id) {
        return Ok(None);
    }
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    if cols.is_empty() {
        return Ok(None);
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    let expr = json_object_sql(table, &cols);
    let sql = format!("SELECT {expr} FROM \"{table}\" WHERE {key} = ?1");
    sqlx::query_scalar(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)
}

/// One-transaction read of live rows + tombstones for digest buckets.
pub async fn compute_digest(pool: &SqlitePool) -> Result<DigestResponse, AppError> {
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let hashes = collect_row_hashes(&mut tx, None).await?;
    tx.commit().await.map_err(AppError::Database)?;
    let mut buckets = vec![Vec::<u8>::new(); 256];
    for row in &hashes {
        let b = id_bucket(&row.id) as usize;
        buckets[b].extend_from_slice(row.hash.as_bytes());
        buckets[b].extend_from_slice(row.id.as_bytes());
        buckets[b].extend_from_slice(row.table.as_bytes());
    }
    Ok(DigestResponse {
        buckets: buckets.into_iter().map(|b| sha256_hex(&b)).collect(),
    })
}

pub async fn compute_row_hashes(
    pool: &SqlitePool,
    buckets: &[u8],
) -> Result<Vec<RowHash>, AppError> {
    let filter: HashSet<u8> = buckets.iter().copied().collect();
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let hashes = collect_row_hashes(&mut tx, Some(&filter)).await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(hashes)
}

async fn collect_row_hashes(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    buckets: Option<&HashSet<u8>>,
) -> Result<Vec<RowHash>, AppError> {
    let mut out = Vec::new();
    for table in synced_tables() {
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .bind(table)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;
        if exists == 0 {
            continue;
        }
        let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
        let cols: Vec<String> =
            sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
                .fetch_all(&mut **tx)
                .await
                .map_err(AppError::Database)?;
        if cols.is_empty() {
            continue;
        }
        let expr = json_object_sql(table, &cols);
        let sql = format!("SELECT CAST({key} AS TEXT), {expr} FROM \"{table}\"");
        let rows: Vec<(String, Option<String>)> = sqlx::query_as(&sql)
            .fetch_all(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        for (id, json) in rows {
            if buckets.is_some_and(|set| !set.contains(&id_bucket(&id))) {
                continue;
            }
            if table == "app_kv" && deny_app_kv_key(&id) {
                continue;
            }
            let Some(json) = json else { continue };
            out.push(RowHash {
                table: table.to_string(),
                id,
                hash: hash_row_json(&json),
                tombstone: false,
            });
        }
    }
    let tombs: Vec<(String, String, String)> =
        sqlx::query_as("SELECT entity_table, entity_id, deleted_at FROM sync_tombstone")
            .fetch_all(&mut **tx)
            .await
            .map_err(AppError::Database)?;
    for (table, id, deleted_at) in tombs {
        if buckets.is_some_and(|set| !set.contains(&id_bucket(&id))) {
            continue;
        }
        let payload =
            serde_json::json!({ "tombstone": true, "deleted_at": deleted_at }).to_string();
        out.push(RowHash {
            table,
            id,
            hash: hash_row_json(&payload),
            tombstone: true,
        });
    }
    Ok(out)
}

pub async fn fetch_rows(pool: &SqlitePool, ids: &[RowId]) -> Result<Vec<RowBody>, AppError> {
    if ids.len() > MAX_ROWS {
        return Err(AppError::Validation(format!(
            "reconcile rows request exceeds {MAX_ROWS}"
        )));
    }
    let mut out = Vec::with_capacity(ids.len());
    for row in ids {
        if !table_exists(pool, &row.table).await {
            continue;
        }
        if let Some(json) = snapshot_row(pool, &row.table, &row.id).await? {
            out.push(RowBody {
                table: row.table.clone(),
                id: row.id.clone(),
                op: "UPDATE".into(),
                payload_json: json,
            });
            continue;
        }
        let deleted: Option<String> = sqlx::query_scalar(
            "SELECT deleted_at FROM sync_tombstone WHERE entity_table = ?1 AND entity_id = ?2",
        )
        .bind(&row.table)
        .bind(&row.id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
        if deleted.is_some() {
            out.push(RowBody {
                table: row.table.clone(),
                id: row.id.clone(),
                op: "DELETE".into(),
                payload_json: serde_json::json!({ "id": row.id }).to_string(),
            });
        }
    }
    Ok(out)
}

async fn pending_empty(pool: &SqlitePool) -> Result<bool, AppError> {
    let deployment = load_deployment(pool).await?;
    let local = ensure_local_device(pool, &deployment.device_label).await?;
    Ok(list_pending_outbox(pool, &local, 1).await?.is_empty())
}

async fn repair_required(pool: &SqlitePool) -> bool {
    medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, REPAIR_KV)
        .await
        .ok()
        .flatten()
        .is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
}

async fn last_run_too_recent(pool: &SqlitePool) -> bool {
    let Some(raw) =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, LAST_RUN_KV)
            .await
            .ok()
            .flatten()
    else {
        return false;
    };
    let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&raw) else {
        return false;
    };
    let age = chrono::Utc::now().signed_duration_since(ts.with_timezone(&chrono::Utc));
    age.num_seconds() < HOUR_SECS
}

/// Automatic hourly pass after a caught-up replica cycle.
pub async fn maybe_hourly(
    pool: &SqlitePool,
    pulled: u32,
    sync_error: Option<&str>,
) -> Result<Option<ReconcileReport>, AppError> {
    let deployment = load_deployment(pool).await?;
    if deployment.role != DeviceRole::Replica {
        return Ok(None);
    }
    if sync_error.is_some()
        || pulled >= 500
        || !pending_empty(pool).await?
        || repair_required(pool).await
    {
        return Ok(None);
    }
    if last_run_too_recent(pool).await {
        return Ok(None);
    }
    Ok(Some(run_against_master(pool).await?))
}

/// Operator-triggered reconcile (`ops.system`).
pub async fn run_now(pool: &SqlitePool) -> Result<ReconcileReport, AppError> {
    let deployment = load_deployment(pool).await?;
    if deployment.role != DeviceRole::Replica {
        return Err(AppError::Validation(
            "reconcile runs on a replica only".into(),
        ));
    }
    if repair_required(pool).await {
        return Err(AppError::Validation("re-pair required".into()));
    }
    if !pending_empty(pool).await? {
        return Err(AppError::Validation(
            "reconcile waits until the outbox is empty".into(),
        ));
    }
    run_against_master(pool).await
}

async fn run_against_master(pool: &SqlitePool) -> Result<ReconcileReport, AppError> {
    let deployment = load_deployment(pool).await?;
    let local = ensure_local_device(pool, &deployment.device_label).await?;
    let Some(_guard) = ReconcileGuard::acquire(&local) else {
        return Ok(ReconcileReport {
            skipped: true,
            error: Some("reconcile already running".into()),
            ..Default::default()
        });
    };
    let mut report = ReconcileReport::default();
    if deployment.master_base_url.is_empty() || deployment.activation_token.is_empty() {
        report.error = Some("master URL or activation token missing".into());
        persist_result(pool, &report).await?;
        return Ok(report);
    }
    let client = crate::engine::master_http_client_for_reconcile(pool, &deployment).await?;
    let base = deployment.master_base_url.trim_end_matches('/');
    let token = &deployment.activation_token;

    let local_digest = compute_digest(pool).await?;
    let remote_digest: DigestResponse = post_json(
        &client,
        &crate::paths::api_url(base, crate::paths::SYNC_DIGEST),
        token,
        &serde_json::json!({}),
    )
    .await?;
    let mut mismatch = Vec::new();
    for (i, (local, remote)) in local_digest
        .buckets
        .iter()
        .zip(remote_digest.buckets.iter())
        .enumerate()
    {
        if local != remote {
            mismatch.push(i as u8);
        }
    }
    report.buckets_checked = mismatch.len() as u32;
    if mismatch.is_empty() {
        persist_result(pool, &report).await?;
        return Ok(report);
    }

    let remote_wrap: RowHashesBody = post_json(
        &client,
        &crate::paths::api_url(base, crate::paths::SYNC_ROW_HASHES),
        token,
        &RowHashesRequest {
            buckets: mismatch.clone(),
        },
    )
    .await?;
    let remote_hashes = remote_wrap.rows;
    let local_hashes = compute_row_hashes(pool, &mismatch).await?;
    let remote_map: HashMap<(String, String), &RowHash> = remote_hashes
        .iter()
        .map(|r| ((r.table.clone(), r.id.clone()), r))
        .collect();
    let local_map: HashMap<(String, String), &RowHash> = local_hashes
        .iter()
        .map(|r| ((r.table.clone(), r.id.clone()), r))
        .collect();

    let mut fetch_ids = Vec::new();
    let mut keys = HashSet::new();
    for key in remote_map.keys().chain(local_map.keys()) {
        keys.insert(key.clone());
    }
    for key in keys {
        let remote = remote_map.get(&key);
        let local = local_map.get(&key);
        match (local, remote) {
            (Some(l), Some(r)) if l.hash == r.hash => {}
            _ => fetch_ids.push(RowId {
                table: key.0,
                id: key.1,
            }),
        }
        if fetch_ids.len() >= MAX_ROWS {
            break;
        }
    }

    if !fetch_ids.is_empty() {
        let rows_wrap: RowsBody = post_json(
            &client,
            &crate::paths::api_url(base, crate::paths::SYNC_ROWS),
            token,
            &RowsRequest {
                ids: fetch_ids.clone(),
            },
        )
        .await?;
        let rows = rows_wrap.rows;
        report.rows_fetched = rows.len() as u32;
        for row in rows {
            force_apply_payload(pool, &row.table, &row.id, &row.op, &row.payload_json).await?;
            report.applied += 1;
        }
        for id in fetch_ids {
            if remote_map.get(&(id.table.clone(), id.id.clone())).is_none() {
                if snapshot_row(pool, &id.table, &id.id).await?.is_some() {
                    force_apply_payload(
                        pool,
                        &id.table,
                        &id.id,
                        "DELETE",
                        &serde_json::json!({ "id": id.id }).to_string(),
                    )
                    .await?;
                    report.applied += 1;
                }
            }
        }
    }

    persist_result(pool, &report).await?;
    let _ = medoc_core::infrastructure::database::repos::admin::audit::create(
        pool,
        "system",
        "RECONCILE",
        "sync",
        Some(&local),
        Some(&serde_json::to_string(&report).unwrap_or_default()),
    )
    .await;
    Ok(report)
}

async fn persist_result(pool: &SqlitePool, report: &ReconcileReport) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    medoc_core::infrastructure::database::repos::admin::app_kv::set(pool, LAST_RUN_KV, &now)
        .await?;
    medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        LAST_RESULT_KV,
        &serde_json::to_string(report).unwrap_or_default(),
    )
    .await?;
    Ok(())
}

async fn post_json<T: serde::de::DeserializeOwned, B: Serialize>(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    body: &B,
) -> Result<T, AppError> {
    let resp = client
        .post(url)
        .bearer_auth(token)
        .json(body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("reconcile http: {e}")))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "reconcile http status {status}: {body}"
        )));
    }
    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("reconcile json: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable_across_key_order() {
        let a = r#"{"b":1,"a":2}"#;
        let b = r#"{"a":2,"b":1}"#;
        assert_eq!(hash_row_json(a), hash_row_json(b));
    }

    #[test]
    fn buckets_span_full_byte() {
        let mut seen = HashSet::new();
        for i in 0..1024u32 {
            seen.insert(id_bucket(&format!("id-{i}")));
        }
        assert!(seen.len() > 8);
    }
}
