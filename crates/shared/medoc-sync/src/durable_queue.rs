//! Crash-safe update queue around `sync_outbox` (store-and-forward).
//!
//! Two encrypted cache files (`medoc_core::infrastructure::durable_cache`) close the gaps the
//! database alone leaves:
//!
//! * **Spool** (`sync-spool`): a change the outbox could not take (database busy or locked,
//!   disk error) is written here instead of being dropped, and moved into the outbox on the
//!   next sync cycle or at start.
//! * **Send journal** (`sync-send-push`, `sync-send-exchange`): the entries of a request are
//!   written here before they go out. The file is deleted only after the receiver answers 2xx.
//!   At start, any journaled entry missing from the outbox (lost with the database on a power
//!   cut) is put back and sent again; the receiver drops duplicates (`sync_applied`).

use medoc_core::error::AppError;
use medoc_core::infrastructure::durable_cache;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::repo::OutboxEntry;

const SPOOL: &str = "sync-spool";

/// Which request a send journal belongs to (push and exchange can run side by side).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SendChannel {
    Push,
    Exchange,
}

impl SendChannel {
    const ALL: [SendChannel; 2] = [SendChannel::Push, SendChannel::Exchange];

    fn file(self) -> &'static str {
        match self {
            SendChannel::Push => "sync-send-push",
            SendChannel::Exchange => "sync-send-exchange",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpooledChange {
    pub entity_table: String,
    pub entity_id: String,
    pub op: String,
    pub payload_json: String,
    pub queued_at: String,
}

/// Record a change in the outbox; if that fails, keep it in the spool file instead.
pub async fn record_or_spool(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<(), AppError> {
    match crate::repo::sync_record_or_noop(pool, entity_table, entity_id, op, payload_json).await {
        // The database takes writes again: older spooled changes go in right behind this one.
        Ok(()) => drain_spool(pool).await.map(|_| ()),
        Err(e) => {
            tracing::warn!(target: "medoc::sync", event = "SYNC_CHANGE_SPOOLED", entity_table, entity_id, error = %e);
            spool_change(SpooledChange {
                entity_table: entity_table.into(),
                entity_id: entity_id.into(),
                op: op.into(),
                payload_json: payload_json.into(),
                queued_at: chrono::Utc::now().to_rfc3339(),
            })
        }
    }
}

pub fn spool_change(change: SpooledChange) -> Result<(), AppError> {
    if !durable_cache::enabled() {
        return Err(AppError::Internal(
            "change could not be queued and no cache folder is set".into(),
        ));
    }
    let mut list: Vec<SpooledChange> = durable_cache::read(SPOOL)?.unwrap_or_default();
    list.push(change);
    durable_cache::write(SPOOL, &list)
}

/// Move spooled changes into the outbox. Returns how many are still waiting.
pub async fn drain_spool(pool: &SqlitePool) -> Result<usize, AppError> {
    if !durable_cache::enabled() {
        return Ok(0);
    }
    let list: Vec<SpooledChange> = durable_cache::read(SPOOL)?.unwrap_or_default();
    if list.is_empty() {
        return Ok(0);
    }
    let mut left = Vec::new();
    for c in list {
        let ok = crate::repo::sync_record_or_noop(
            pool,
            &c.entity_table,
            &c.entity_id,
            &c.op,
            &c.payload_json,
        )
        .await
        .is_ok();
        if !ok {
            left.push(c);
        }
    }
    if left.is_empty() {
        durable_cache::clear(SPOOL)?;
    } else {
        durable_cache::write(SPOOL, &left)?;
    }
    Ok(left.len())
}

/// Before a request goes out: keep its entries on disk.
pub fn journal_send(channel: SendChannel, entries: &[OutboxEntry]) {
    if !durable_cache::enabled() || entries.is_empty() {
        return;
    }
    if let Err(e) = durable_cache::write(channel.file(), &entries) {
        tracing::warn!(target: "medoc::sync", event = "SYNC_SEND_JOURNAL_FAILED", error = %e);
    }
}

/// The receiver answered 2xx: the journal is no longer needed.
pub fn confirm_send(channel: SendChannel) {
    if !durable_cache::enabled() {
        return;
    }
    if let Err(e) = durable_cache::clear(channel.file()) {
        tracing::warn!(target: "medoc::sync", event = "SYNC_SEND_JOURNAL_CLEAR_FAILED", error = %e);
    }
}

/// At start: put back journaled entries the outbox no longer has, then drain the spool.
/// Returns how many entries were restored.
pub async fn recover(pool: &SqlitePool) -> Result<u32, AppError> {
    if !durable_cache::enabled() {
        return Ok(0);
    }
    crate::schema::ensure_sync_tables(pool).await?;
    let mut restored = 0u32;
    for channel in SendChannel::ALL {
        let entries: Vec<OutboxEntry> = durable_cache::read(channel.file())?.unwrap_or_default();
        for e in &entries {
            let done = sqlx::query(
                "INSERT OR IGNORE INTO sync_outbox
                    (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )
            .bind(&e.id)
            .bind(&e.device_id)
            .bind(e.seq)
            .bind(&e.entity_table)
            .bind(&e.entity_id)
            .bind(&e.op)
            .bind(&e.payload_json)
            .bind(&e.created_at)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
            restored += done.rows_affected() as u32;
        }
        durable_cache::clear(channel.file())?;
    }
    let waiting = drain_spool(pool).await?;
    tracing::info!(target: "medoc::sync", event = "SYNC_QUEUE_RECOVERED", restored, spool_waiting = waiting);
    Ok(restored)
}
