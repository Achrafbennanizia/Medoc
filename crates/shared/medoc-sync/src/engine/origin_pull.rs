//! Pull by origin vector (T4.1, docs/architecture/editions-plan.md §4.4.1, mode O).
//!
//! In mode O the device that made a change pushes it to every peer it reaches. A device that was
//! off at that moment would otherwise wait for the origin's retries or the primary's return. So in
//! Group builds every replica keeps a copy of each signed change pushed to it by another replica
//! (`sync_origin_copy`), and serves "entries of origin X after seq N" to any paired peer.
//!
//! Forwarding is safe because each entry carries its origin's own Ed25519 signature: the receiver
//! checks it against the origin's pinned key exactly as if the origin had pushed it, and drops
//! entries it already applied (`sync_applied`). Unsigned entries are never kept for forwarding.
//! Copies older than [`KEEP_DAYS`] are pruned; by then the primary has relayed everything.

use std::collections::{BTreeMap, HashMap};

use medoc_core::error::AppError;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::deployment::DeviceRole;
use crate::entry_signature::{EntrySignature, SignedBatch};
use crate::repo::OutboxEntry;

pub const KEEP_DAYS: i64 = 30;
/// Entries per answer, over all origins.
pub const PAGE_LIMIT: i64 = 500;

async fn ensure_table(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_origin_copy (
            origin_device_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            entry_json TEXT NOT NULL,
            signer TEXT NOT NULL,
            sig TEXT NOT NULL,
            received_at TEXT NOT NULL,
            PRIMARY KEY (origin_device_id, seq)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Only Group replicas keep copies: the primary relays through its own outbox instead.
async fn keeps_copies(pool: &SqlitePool) -> bool {
    if !super::route::routing_enabled() {
        return false;
    }
    matches!(crate::repo::load_deployment(pool).await, Ok(d) if d.role == DeviceRole::Replica)
}

/// Keep the signed entries of `origin` that were just verified and applied.
pub async fn keep(
    pool: &SqlitePool,
    origin: &str,
    entries: &[OutboxEntry],
    batch: &SignedBatch,
) -> Result<u32, AppError> {
    let Some(signer) = batch.signer.as_deref().filter(|s| !s.trim().is_empty()) else {
        return Ok(0);
    };
    if entries.is_empty() || !keeps_copies(pool).await {
        return Ok(0);
    }
    ensure_table(pool).await?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut kept = 0u32;
    for entry in entries.iter().filter(|e| e.device_id == origin) {
        let Some(sig) = batch.signatures.iter().find(|s| s.id == entry.id) else {
            continue;
        };
        let json = serde_json::to_string(entry)
            .map_err(|e| AppError::Internal(format!("origin copy encode: {e}")))?;
        let done = sqlx::query(
            "INSERT OR IGNORE INTO sync_origin_copy
                (origin_device_id, seq, entry_json, signer, sig, received_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(origin)
        .bind(entry.seq)
        .bind(json)
        .bind(signer)
        .bind(&sig.sig)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        kept += done.rows_affected() as u32;
    }
    let cutoff = (chrono::Utc::now() - chrono::Duration::days(KEEP_DAYS)).to_rfc3339();
    sqlx::query("DELETE FROM sync_origin_copy WHERE received_at < ?1")
        .bind(cutoff)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(kept)
}

/// One origin's entries with that origin's signatures.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginBatch {
    pub device_id: String,
    pub entries: Vec<OutboxEntry>,
    #[serde(flatten)]
    pub batch: SignedBatch,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginPullBody {
    /// Highest seq the caller applied, per origin. Origins not listed start at 0.
    #[serde(default)]
    pub vector: BTreeMap<String, i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginPullPage {
    pub origins: Vec<OriginBatch>,
}

/// Copies after the caller's vector, oldest first per origin; `exclude` is the caller itself.
pub async fn serve(
    pool: &SqlitePool,
    body: &OriginPullBody,
    exclude: &str,
) -> Result<OriginPullPage, AppError> {
    ensure_table(pool).await?;
    let rows: Vec<(String, i64, String, String, String)> = sqlx::query_as(
        "SELECT origin_device_id, seq, entry_json, signer, sig FROM sync_origin_copy
         WHERE origin_device_id != ?1 ORDER BY origin_device_id, seq",
    )
    .bind(exclude)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut by_origin: BTreeMap<String, OriginBatch> = BTreeMap::new();
    let mut total = 0i64;
    for (origin, seq, json, signer, sig) in rows {
        if seq <= body.vector.get(&origin).copied().unwrap_or(0) {
            continue;
        }
        if total >= PAGE_LIMIT {
            break;
        }
        let Ok(entry) = serde_json::from_str::<OutboxEntry>(&json) else {
            continue;
        };
        let group = by_origin.entry(origin.clone()).or_insert_with(|| OriginBatch {
            device_id: origin.clone(),
            entries: Vec::new(),
            batch: SignedBatch {
                signer: Some(signer.clone()),
                signatures: Vec::new(),
            },
        });
        // A device signs with one key; a copy under another key is left out rather than mixed in.
        if group.batch.signer.as_deref() != Some(signer.as_str()) {
            continue;
        }
        group.batch.signatures.push(EntrySignature {
            id: entry.id.clone(),
            sig,
        });
        group.entries.push(entry);
        total += 1;
    }
    Ok(OriginPullPage {
        origins: by_origin.into_values().collect(),
    })
}

/// Highest applied seq per origin on this device.
pub async fn local_vector(pool: &SqlitePool) -> Result<BTreeMap<String, i64>, AppError> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT source_device_id, MAX(source_seq) FROM sync_applied GROUP BY source_device_id",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().collect())
}

/// Verify and apply a page from a peer; returns how many entries were applied.
/// Each origin is checked against its own pinned key; a bad origin is skipped, not the page.
pub async fn apply_page(
    pool: &SqlitePool,
    local_id: &str,
    page: &OriginPullPage,
) -> Result<(u32, HashMap<String, String>), AppError> {
    let mut applied = 0u32;
    let mut refused = HashMap::new();
    for group in &page.origins {
        if group.device_id == local_id
            || group.entries.iter().any(|e| e.device_id != group.device_id)
        {
            continue;
        }
        if let Err(e) = crate::entry_signature::verify_batch(
            pool,
            &group.device_id,
            &group.entries,
            &group.batch,
        )
        .await
        {
            refused.insert(group.device_id.clone(), e.to_string());
            continue;
        }
        let result =
            super::SyncEngine::ingest_push(pool, &group.device_id, &group.entries).await?;
        applied = applied.saturating_add(result.accepted);
        // Keep them too, so a third device can fetch them from here.
        keep(pool, &group.device_id, &group.entries, &group.batch).await?;
    }
    Ok((applied, refused))
}
