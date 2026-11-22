//! One-shot full copy for a replica that has never stored a master cursor.
//!
//! The main device queues a single snapshot and remembers how far the
//! requester has pulled. The replica skips push, drops its own practice rows
//! once, and applies pages until its cursor reaches that snapshot.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::database::sync_registry::{SyncClass, TABLES};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use super::types::InitialCopyProgress;
use crate::deployment::{DeviceRole, SyncDeploymentConfig};
use crate::repo::{enqueue_snapshot_for, recent_snapshot_end, InitialCopyStatus};

const MASTER_KEY: &str = "sync.initial_copy.master.v1";
const REPLICA_KEY: &str = "sync.initial_copy.replica.v1";
const CLEARED_KEY: &str = "sync.initial_copy.cleared.v1";
const CATCHUP_KEY: &str = "sync.replica.catchup.done.v1";
const LIVE_SEQ_KEY: &str = "sync.initial_copy.live_seq.v1";

const SNAPSHOT_MIN_INTERVAL: std::time::Duration = std::time::Duration::from_secs(300);

type SnapshotTimes = std::sync::Mutex<std::collections::HashMap<String, std::time::Instant>>;
static LAST_SNAPSHOT: std::sync::OnceLock<SnapshotTimes> = std::sync::OnceLock::new();

/// `true` when a full snapshot may be queued for `requester` now (and records it).
fn snapshot_allowed(requester: &str) -> bool {
    let map = LAST_SNAPSHOT.get_or_init(Default::default);
    let mut map = match map.lock() {
        Ok(m) => m,
        Err(poisoned) => poisoned.into_inner(),
    };
    let now = std::time::Instant::now();
    match map.get(requester) {
        Some(last) if now.duration_since(*last) < SNAPSHOT_MIN_INTERVAL => false,
        _ => {
            if map.len() > 1024 {
                map.retain(|_, t| now.duration_since(*t) < SNAPSHOT_MIN_INTERVAL);
            }
            map.insert(requester.to_string(), now);
            true
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct MasterBook {
    copies: Vec<MasterCopy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MasterCopy {
    device_id: String,
    label: String,
    total: i64,
    through_seq: i64,
    end_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReplicaProgress {
    total: i64,
    through_seq: i64,
    end_seq: i64,
}

/// Every replicated table except `app_kv` (cleared key by key in
/// [`delete_synced_parameters`]).
///
/// Admin tables (service catalogue, templates, suppliers, absences, access
/// profiles) are included: they arrive in the main device's copy. Kept, this
/// device's own seed rows — and their queued outbox entries — were pushed once
/// the copy finished and could overwrite the main device's catalogue.
fn practice_tables() -> impl Iterator<Item = &'static str> {
    TABLES
        .iter()
        .filter(|(name, class)| {
            *name != "app_kv"
                // Access profiles only ever come from the main device; keeping
                // them avoids a window where logins fall back to role defaults.
                && !medoc_core::infrastructure::database::sync_registry::is_master_only_table(name)
                && matches!(
                    class,
                    SyncClass::Admin | SyncClass::Shared | SyncClass::Numbered | SyncClass::Files
                )
        })
        .map(|(name, _)| *name)
}

async fn kv_get(pool: &SqlitePool, key: &str) -> Result<Option<String>, AppError> {
    app_kv_repo::get(pool, key).await
}

async fn catchup_open(pool: &SqlitePool) -> Result<bool, AppError> {
    Ok(kv_get(pool, CATCHUP_KEY).await?.as_deref() != Some("1"))
}

async fn load_book(pool: &SqlitePool) -> Result<MasterBook, AppError> {
    let Some(raw) = kv_get(pool, MASTER_KEY).await? else {
        return Ok(MasterBook::default());
    };
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

async fn save_book(pool: &SqlitePool, book: &MasterBook) -> Result<(), AppError> {
    if book.copies.is_empty() {
        app_kv_repo::delete(pool, MASTER_KEY).await?;
        return Ok(());
    }
    let raw = serde_json::to_string(book).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(pool, MASTER_KEY, &raw).await
}

async fn load_replica(pool: &SqlitePool) -> Result<Option<ReplicaProgress>, AppError> {
    let Some(raw) = kv_get(pool, REPLICA_KEY).await? else {
        return Ok(None);
    };
    Ok(serde_json::from_str(&raw).ok())
}

async fn save_replica(pool: &SqlitePool, progress: &ReplicaProgress) -> Result<(), AppError> {
    let raw = serde_json::to_string(progress).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(pool, REPLICA_KEY, &raw).await
}

async fn max_seq(pool: &SqlitePool, device_id: &str) -> Result<i64, AppError> {
    let seq: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(seq), 0) FROM sync_outbox WHERE device_id = ?1")
            .bind(device_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(seq)
}

async fn replica_label(pool: &SqlitePool, device_id: &str) -> String {
    let from_pairing: Option<String> = sqlx::query_scalar(
        "SELECT slave_label FROM pairing_request WHERE device_id = ?1 AND TRIM(slave_label) != ''",
    )
    .bind(device_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    if let Some(label) = from_pairing {
        return label;
    }
    let from_device: Option<String> = sqlx::query_scalar(
        "SELECT display_name FROM sync_device WHERE device_id = ?1 AND TRIM(display_name) != ''",
    )
    .bind(device_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    from_device.unwrap_or_else(|| device_id.to_string())
}

/// Queue one snapshot for a first pull and return the span both devices show.
pub(crate) async fn note_master_pull(
    pool: &SqlitePool,
    requester_id: &str,
    since_seq: i64,
    local_device_id: &str,
) -> Result<Option<InitialCopyProgress>, AppError> {
    let mut book = load_book(pool).await?;
    if let Some(existing) = book
        .copies
        .iter()
        .find(|copy| copy.device_id == requester_id)
        .cloned()
    {
        if since_seq >= existing.end_seq {
            book.copies.retain(|copy| copy.device_id != requester_id);
            save_book(pool, &book).await?;
            return Ok(None);
        }
        let through = since_seq.min(existing.end_seq);
        if let Some(copy) = book
            .copies
            .iter_mut()
            .find(|copy| copy.device_id == requester_id)
        {
            copy.through_seq = through;
        }
        save_book(pool, &book).await?;
        return Ok(Some(InitialCopyProgress {
            total: existing.total,
            through_seq: through,
            end_seq: existing.end_seq,
            device_label: Some(existing.label),
        }));
    }
    if since_seq > 0 {
        return Ok(None);
    }
    // Pairing already queued a copy for this device: reuse it instead of
    // writing the whole practice into the outbox a second time.
    let reuse = recent_snapshot_end(pool, local_device_id, requester_id).await?;
    if reuse.is_none() && snapshot_allowed(requester_id) {
        enqueue_snapshot_for(pool, Some(requester_id)).await?;
    }
    let end_seq = max_seq(pool, local_device_id).await?;
    if end_seq <= 0 {
        return Ok(Some(InitialCopyProgress {
            total: 0,
            through_seq: 0,
            end_seq: 0,
            device_label: None,
        }));
    }
    let label = replica_label(pool, requester_id).await;
    book.copies.push(MasterCopy {
        device_id: requester_id.to_string(),
        label: label.clone(),
        total: end_seq,
        through_seq: 0,
        end_seq,
    });
    save_book(pool, &book).await?;
    Ok(Some(InitialCopyProgress {
        total: end_seq,
        through_seq: 0,
        end_seq,
        device_label: Some(label),
    }))
}

/// Skip the replica push only while its own seed rows are still in place.
/// After those rows are cleared, edits made on this device go to the main
/// device even if the rest of the snapshot is still copying.
pub(crate) async fn should_skip_push(pool: &SqlitePool) -> Result<bool, AppError> {
    if !catchup_open(pool).await? {
        return Ok(false);
    }
    if kv_get(pool, CLEARED_KEY).await?.as_deref() == Some("1") {
        return Ok(false);
    }
    if load_replica(pool).await?.is_some() {
        return Ok(true);
    }
    Ok(master_cursor(pool).await? == 0)
}

pub(crate) async fn live_seq(pool: &SqlitePool) -> Result<i64, AppError> {
    let raw = kv_get(pool, LIVE_SEQ_KEY).await?.unwrap_or_default();
    Ok(raw.parse::<i64>().unwrap_or(0))
}

pub(crate) async fn save_live_seq(pool: &SqlitePool, seq: i64) -> Result<(), AppError> {
    let prev = live_seq(pool).await?;
    if seq <= prev {
        return Ok(());
    }
    app_kv_repo::set(pool, LIVE_SEQ_KEY, &seq.to_string()).await
}

async fn master_cursor(pool: &SqlitePool) -> Result<i64, AppError> {
    let deployment = crate::repo::load_deployment(pool).await?;
    let id = if !deployment.master_device_id.is_empty() {
        deployment.master_device_id
    } else {
        let remote: Option<String> = sqlx::query_scalar(
            "SELECT device_id FROM sync_device WHERE role = 'MASTER' AND is_local = 0 LIMIT 1",
        )
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
        match remote {
            Some(id) => id,
            None => return Ok(0),
        }
    };
    let seq: i64 = sqlx::query_scalar(
        "SELECT COALESCE((SELECT seq FROM sync_vector WHERE device_id = ?1), 0)",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(seq)
}

/// Drop synced practice rows once, before the first snapshot page is applied.
pub(crate) async fn clear_practice_once(pool: &SqlitePool) -> Result<(), AppError> {
    if kv_get(pool, CLEARED_KEY).await?.as_deref() == Some("1") {
        return Ok(());
    }
    if let Some(table) = retained_records(pool).await? {
        // Issued documents, the cash book, day closes, reminders and paid
        // bookings must be kept for 10 years (GoBD, § 147 AO). Their delete
        // triggers also abort the clear, so the first copy could never start
        // on such a device. Keep everything and merge: the main device's copy
        // arrives with normal conflict rules, and these records are pushed.
        tracing::warn!(
            target: "medoc::sync",
            event = "INITIAL_COPY_MERGE_RETAINED_RECORDS",
            table,
            hint = "this device holds legally retained records; merging instead of clearing"
        );
        return app_kv_repo::set(pool, CLEARED_KEY, "1").await;
    }
    clear_practice_rows(pool).await?;
    app_kv_repo::set(pool, CLEARED_KEY, "1").await
}

/// First table that holds records the law requires us to keep, if any.
async fn retained_records(pool: &SqlitePool) -> Result<Option<&'static str>, AppError> {
    const RETAINED: &[&str] = &[
        "issued_document",
        "cash_movement",
        "day_close_protocol",
        "balance_sheet_snapshot",
        "payment_reminder",
    ];
    for table in RETAINED {
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .bind(table)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if exists == 0 {
            continue;
        }
        let n: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{table}\""))
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
        if n > 0 {
            return Ok(Some(table));
        }
    }
    // A booking with money received keeps its receipts (trigger on payment).
    let paid: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'payment_receipt'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if paid > 0 {
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM (SELECT payment_id FROM payment_receipt
              GROUP BY payment_id HAVING SUM(amount_cents) <> 0)",
        )
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if n > 0 {
            return Ok(Some("payment"));
        }
    }
    Ok(None)
}

pub(crate) async fn clear_practice_rows(pool: &SqlitePool) -> Result<(), AppError> {
    let mut conn = pool.acquire().await.map_err(AppError::Database)?;
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    // One transaction: a crash halfway no longer leaves some tables emptied
    // and others still holding this device's rows.
    let cleared = async {
        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *conn)
            .await
            .map_err(AppError::Database)?;
        match clear_practice_tables(&mut conn).await {
            Ok(()) => {
                sqlx::query("COMMIT")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::Database)?;
                Ok(())
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;
                Err(e)
            }
        }
    }
    .await;
    crate::merge::finish_foreign_keys(conn, cleared).await
}

async fn clear_practice_tables(conn: &mut sqlx::SqliteConnection) -> Result<(), AppError> {
    let outbox: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sync_outbox'",
    )
    .fetch_one(&mut *conn)
    .await
    .map_err(AppError::Database)?;
    let tombstone: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sync_tombstone'",
    )
    .fetch_one(&mut *conn)
    .await
    .map_err(AppError::Database)?;
    for table in practice_tables() {
        delete_practice_table(&mut *conn, table, outbox > 0, tombstone > 0).await?;
    }
    delete_synced_parameters(&mut *conn, outbox > 0, tombstone > 0).await?;
    Ok(())
}

/// Drop practice and system settings so the admin snapshot is the first copy.
/// Device-local keys (sync, license, theme, LAN) stay on this replica.
async fn delete_synced_parameters(
    conn: &mut sqlx::SqliteConnection,
    outbox: bool,
    tombstone: bool,
) -> Result<(), AppError> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'app_kv'",
    )
    .fetch_one(&mut *conn)
    .await
    .map_err(AppError::Database)?;
    if exists == 0 {
        return Ok(());
    }
    let predicate =
        medoc_core::infrastructure::database::sync_registry::synced_app_kv_predicate("key");
    sqlx::query(&format!("DELETE FROM app_kv WHERE {predicate}"))
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    let id_predicate =
        medoc_core::infrastructure::database::sync_registry::synced_app_kv_predicate("entity_id");
    if outbox {
        sqlx::query(&format!(
            "DELETE FROM sync_outbox WHERE entity_table = 'app_kv' AND delivered_at IS NULL AND {id_predicate}"
        ))
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    }
    if tombstone {
        sqlx::query(&format!(
            "DELETE FROM sync_tombstone WHERE entity_table = 'app_kv' AND {id_predicate}"
        ))
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    }
    Ok(())
}

async fn delete_practice_table(
    conn: &mut sqlx::SqliteConnection,
    table: &str,
    outbox: bool,
    tombstone: bool,
) -> Result<(), AppError> {
    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .bind(table)
            .fetch_one(&mut *conn)
            .await
            .map_err(AppError::Database)?;
    if exists == 0 {
        return Ok(());
    }
    sqlx::query(&format!("DELETE FROM \"{table}\""))
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    if outbox {
        sqlx::query("DELETE FROM sync_outbox WHERE entity_table = ?1 AND delivered_at IS NULL")
            .bind(table)
            .execute(&mut *conn)
            .await
            .map_err(AppError::Database)?;
    }
    if tombstone {
        sqlx::query("DELETE FROM sync_tombstone WHERE entity_table = ?1")
            .bind(table)
            .execute(&mut *conn)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

pub(crate) async fn record_replica_progress(
    pool: &SqlitePool,
    span: &InitialCopyProgress,
    applied_through: i64,
) -> Result<(), AppError> {
    let prev = load_replica(pool).await?;
    let mut through = applied_through.max(span.through_seq);
    if let Some(prev) = &prev {
        through = through.max(prev.through_seq);
    }
    if span.end_seq > 0 {
        through = through.min(span.end_seq);
    }
    save_replica(
        pool,
        &ReplicaProgress {
            total: span.total,
            through_seq: through,
            end_seq: span.end_seq,
        },
    )
    .await
}

/// `true` while a stored snapshot span is not fully applied yet.
pub async fn replica_initial_copy_blocks_catchup(pool: &SqlitePool) -> Result<bool, AppError> {
    Ok(matches!(
        load_replica(pool).await?,
        Some(progress) if progress.through_seq < progress.end_seq
    ))
}

pub async fn finish_replica_initial_copy(pool: &SqlitePool) -> Result<(), AppError> {
    app_kv_repo::delete(pool, REPLICA_KEY).await?;
    app_kv_repo::delete(pool, CLEARED_KEY).await?;
    app_kv_repo::delete(pool, LIVE_SEQ_KEY).await?;
    Ok(())
}

pub(crate) async fn status_for(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<Option<InitialCopyStatus>, AppError> {
    if deployment.role == DeviceRole::Replica {
        let Some(progress) = load_replica(pool).await? else {
            return Ok(None);
        };
        if progress.end_seq <= 0 || progress.through_seq >= progress.end_seq {
            return Ok(None);
        }
        return Ok(Some(InitialCopyStatus {
            side: "replica".into(),
            device_label: String::new(),
            done: progress.through_seq,
            total: progress.total,
        }));
    }
    let book = load_book(pool).await?;
    let Some(copy) = book
        .copies
        .iter()
        .find(|copy| copy.through_seq < copy.end_seq)
    else {
        return Ok(None);
    };
    Ok(Some(InitialCopyStatus {
        side: "master".into(),
        device_label: copy.label.clone(),
        done: copy.through_seq,
        total: copy.total,
    }))
}
