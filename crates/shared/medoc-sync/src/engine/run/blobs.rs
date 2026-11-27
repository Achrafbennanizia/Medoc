//! Attachment blobs during sync: missing-blob list, upload attempts, put and fetch (split from `run.rs`).

use super::*;

pub(super) const MISSING_BLOBS_KV: &str = "sync.missing_blobs.v1";
pub(super) const BLOB_ATTEMPTS_KV: &str = "sync.blob_put_attempts.v1";

pub(super) struct BlobPutOutcome {
    pub(super) held: std::collections::HashSet<String>,
    pub(super) gave_up: std::collections::HashSet<String>,
}

pub(super) fn payload_sha256(payload_json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(payload_json).ok()?;
    value
        .get("sha256")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_ascii_lowercase())
}

pub(super) async fn load_missing_blobs(pool: &SqlitePool) -> Vec<String> {
    let raw =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, MISSING_BLOBS_KV)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "[]".into());
    serde_json::from_str(&raw).unwrap_or_default()
}

pub(super) async fn store_missing_blobs(pool: &SqlitePool, shas: &[String]) {
    let _ = medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        MISSING_BLOBS_KV,
        &serde_json::to_string(shas).unwrap_or_else(|_| "[]".into()),
    )
    .await;
}

pub(super) async fn remember_missing_blob(pool: &SqlitePool, sha: &str) {
    let mut list = load_missing_blobs(pool).await;
    if !list.iter().any(|s| s == sha) {
        list.push(sha.to_string());
        store_missing_blobs(pool, &list).await;
    }
}

pub(super) async fn forget_missing_blob(pool: &SqlitePool, sha: &str) {
    let list = load_missing_blobs(pool).await;
    let next: Vec<String> = list.into_iter().filter(|s| s != sha).collect();
    store_missing_blobs(pool, &next).await;
}

/// Drop entries whose file will never arrive, then stop at the first entry
/// that is still waiting for a retry. Rows after a retry stay pending.
pub(super) fn page_ready_to_send(
    page: &[crate::repo::OutboxEntry],
    held: &std::collections::HashSet<String>,
    gave_up: &std::collections::HashSet<String>,
) -> Vec<crate::repo::OutboxEntry> {
    page.iter()
        .filter(|entry| !gave_up.contains(&entry.id))
        .take_while(|entry| !held.contains(&entry.id))
        .cloned()
        .collect()
}

/// Last sequence of the longest prefix of `offered` that was actually posted.
/// A missing file in the middle stops the mesh watermark so later rows in the
/// same page do not hide it.
pub(super) fn contiguous_prefix_seq(
    offered: &[crate::repo::OutboxEntry],
    sent: &[crate::repo::OutboxEntry],
) -> i64 {
    let sent_ids: std::collections::HashSet<&str> =
        sent.iter().map(|entry| entry.id.as_str()).collect();
    let mut through = 0i64;
    for entry in offered {
        if !sent_ids.contains(entry.id.as_str()) {
            break;
        }
        through = entry.seq;
    }
    through
}

pub(super) async fn requeue_blob_rows_with_bytes(pool: &SqlitePool) -> Result<u32, AppError> {
    let rows: Vec<(String, String, String, i64)> = sqlx::query_as(
        "SELECT id, payload_json, device_id, seq FROM sync_outbox
         WHERE fail_reason = 'BLOB_MISSING' AND delivered_at IS NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut ready = 0u32;
    for (id, payload, device_id, seq) in rows {
        let Some(sha) = payload_sha256(&payload) else {
            continue;
        };
        let bytes = medoc_core::infrastructure::database::sync_blob::get_bytes(pool, &sha).await;
        let Ok(bytes) = bytes else {
            continue;
        };
        if bytes.is_empty() {
            continue;
        }
        sqlx::query("UPDATE sync_outbox SET fail_reason = NULL WHERE id = ?1")
            .bind(&id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        forget_blob_attempt(pool, &id).await;
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE sync_peer_vector SET through_seq = ?1, updated_at = ?2
             WHERE source_device_id = ?3 AND through_seq >= ?4",
        )
        .bind(seq.saturating_sub(1))
        .bind(&now)
        .bind(&device_id)
        .bind(seq)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        ready += 1;
    }
    if ready > 0 {
        tracing::info!(
            target: "medoc::sync",
            event = "SYNC_BLOB_REQUEUED",
            rows = ready
        );
    }
    Ok(ready)
}

pub(super) async fn put_attachment_blobs(
    client: &reqwest::Client,
    base: &str,
    token: &str,
    pool: &SqlitePool,
    page: &[crate::repo::OutboxEntry],
) -> BlobPutOutcome {
    let mut held = std::collections::HashSet::new();
    let mut gave_up = std::collections::HashSet::new();
    for entry in page {
        if entry.entity_table != "chart_attachment" || entry.op == "DELETE" {
            continue;
        }
        let Some(sha) = payload_sha256(&entry.payload_json) else {
            continue;
        };
        let bytes =
            match medoc_core::infrastructure::database::sync_blob::get_bytes(pool, &sha).await {
                Ok(b) if !b.is_empty() => b,
                _ => {
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "SYNC_BLOB_PUT_MISSING",
                        id = %entry.id,
                        sha = %sha
                    );
                    remember_missing_blob(pool, &sha).await;
                    note_blob_attempt(pool, &entry.id, &mut held, &mut gave_up).await;
                    continue;
                }
            };
        match client
            .put(crate::paths::blob_url(base, &sha))
            .bearer_auth(token)
            .body(bytes)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                forget_missing_blob(pool, &sha).await;
                forget_blob_attempt(pool, &entry.id).await;
            }
            Ok(resp) => {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "SYNC_BLOB_PUT_FAILED",
                    id = %entry.id,
                    sha = %sha,
                    status = %resp.status()
                );
                remember_missing_blob(pool, &sha).await;
                note_blob_attempt(pool, &entry.id, &mut held, &mut gave_up).await;
            }
            Err(error) => {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "SYNC_BLOB_PUT_FAILED",
                    id = %entry.id,
                    sha = %sha,
                    error = %error
                );
                remember_missing_blob(pool, &sha).await;
                note_blob_attempt(pool, &entry.id, &mut held, &mut gave_up).await;
            }
        }
    }
    BlobPutOutcome { held, gave_up }
}

pub(super) async fn note_blob_attempt(
    pool: &SqlitePool,
    entry_id: &str,
    held: &mut std::collections::HashSet<String>,
    gave_up: &mut std::collections::HashSet<String>,
) {
    let attempts = bump_blob_attempts(pool, entry_id).await;
    if attempts >= PULL_ROW_RETRY_LIMIT {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_BLOB_GAVE_UP",
            id = %entry_id,
            attempts
        );
        gave_up.insert(entry_id.to_string());
        forget_blob_attempt(pool, entry_id).await;
    } else {
        held.insert(entry_id.to_string());
    }
}

pub(super) async fn bump_blob_attempts(pool: &SqlitePool, entry_id: &str) -> i64 {
    let mut map = load_blob_attempts(pool).await;
    let next = map
        .get(entry_id)
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
        .saturating_add(1);
    map.insert(entry_id.to_string(), serde_json::Value::from(next));
    store_blob_attempts(pool, &map).await;
    next
}

pub(super) async fn forget_blob_attempt(pool: &SqlitePool, entry_id: &str) {
    let mut map = load_blob_attempts(pool).await;
    if map.remove(entry_id).is_some() {
        store_blob_attempts(pool, &map).await;
    }
}

pub(super) async fn load_blob_attempts(
    pool: &SqlitePool,
) -> serde_json::Map<String, serde_json::Value> {
    let raw =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, BLOB_ATTEMPTS_KV)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "{}".into());
    serde_json::from_str(&raw).unwrap_or_default()
}

pub(super) async fn store_blob_attempts(
    pool: &SqlitePool,
    map: &serde_json::Map<String, serde_json::Value>,
) {
    let _ = medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        BLOB_ATTEMPTS_KV,
        &serde_json::to_string(map).unwrap_or_else(|_| "{}".into()),
    )
    .await;
}

pub(super) async fn fetch_attachment_blobs(
    client: &reqwest::Client,
    base: &str,
    token: &str,
    pool: &SqlitePool,
    entries: &[crate::repo::OutboxEntry],
) {
    let mut shas: Vec<String> = entries
        .iter()
        .filter(|e| e.entity_table == "chart_attachment" && e.op != "DELETE")
        .filter_map(|e| payload_sha256(&e.payload_json))
        .collect();
    shas.extend(load_missing_blobs(pool).await);
    shas.sort();
    shas.dedup();
    for sha in shas {
        if medoc_core::infrastructure::database::sync_blob::get_bytes(pool, &sha)
            .await
            .is_ok()
        {
            forget_missing_blob(pool, &sha).await;
            continue;
        }
        let url = crate::paths::blob_url(base, &sha);
        let Some(bytes) = crate::blob_resume::fetch(client, &url, token, pool, &sha).await else {
            remember_missing_blob(pool, &sha).await;
            continue;
        };
        crate::blob_resume::forget(pool, &sha).await;
        match medoc_core::infrastructure::database::sync_blob::put_verified(pool, &sha, &bytes)
            .await
        {
            Ok(()) => forget_missing_blob(pool, &sha).await,
            Err(_) => remember_missing_blob(pool, &sha).await,
        }
    }
}
