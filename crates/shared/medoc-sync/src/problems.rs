//! Sync problems an admin must see: changes that could not be applied or sent.
//!
//! Before, an entry that failed `PULL_ROW_RETRY_LIMIT` times was skipped with a
//! log line only, so a clinical edit could vanish without anyone noticing.
//! Every such case now lands here, with the full payload, until an admin
//! retries or dismisses it. The table is local to each device.

use medoc_core::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

use crate::merge::{apply_remote_entry_phased, ConflictPolicy};
use crate::repo::{ensure_local_device, load_deployment, OutboxEntry};

/// Why a change is stuck.
pub mod kind {
    /// An incoming change kept failing and was skipped so newer ones could flow.
    pub const GAVE_UP: &str = "GAVE_UP";
    /// An incoming row clashes with a different local row on a unique column
    /// (e.g. the same insurance number registered on two devices).
    pub const UNIQUE_CONFLICT: &str = "UNIQUE_CONFLICT";
    /// A local change this device could not send (too large, attachment missing).
    pub const NOT_SENT: &str = "NOT_SENT";
    /// Two devices changed the same field without seeing each other's edit (T3.3). The newer
    /// value was kept; the payload holds the other one. Retry takes the other value.
    pub const FIELD_CONFLICT: &str = "FIELD_CONFLICT";
}

const TABLE_SQL: &str = "CREATE TABLE IF NOT EXISTS sync_problem (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    incoming INTEGER NOT NULL,
    from_main INTEGER NOT NULL DEFAULT 0,
    source_device_id TEXT NOT NULL,
    source_seq INTEGER NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    outbox_id TEXT,
    error TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution TEXT,
    UNIQUE (source_device_id, source_seq, kind)
)";

async fn ensure(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(TABLE_SQL)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SyncProblem {
    pub id: String,
    pub kind: String,
    pub incoming: bool,
    pub from_main: bool,
    pub source_device_id: String,
    pub source_seq: i64,
    pub entity_table: String,
    pub entity_id: String,
    pub op: String,
    pub payload_json: String,
    pub outbox_id: Option<String>,
    pub error: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
    pub resolved_by: Option<String>,
    pub resolution: Option<String>,
}

/// An incoming change that was skipped. Never fails the sync run.
pub async fn record_incoming(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    kind: &str,
    from_main: bool,
    error: &str,
) {
    if let Err(e) = insert(pool, entry, kind, true, from_main, None, error).await {
        tracing::error!(
            target: "medoc::sync",
            event = "SYNC_PROBLEM_RECORD_FAILED",
            table = %entry.entity_table,
            id = %entry.entity_id,
            error = %e
        );
    }
}

/// A local outbox row this device could not send.
pub async fn record_outgoing(pool: &SqlitePool, entry: &OutboxEntry, error: &str) {
    if let Err(e) = insert(
        pool,
        entry,
        kind::NOT_SENT,
        false,
        false,
        Some(&entry.id),
        error,
    )
    .await
    {
        tracing::error!(
            target: "medoc::sync",
            event = "SYNC_PROBLEM_RECORD_FAILED",
            table = %entry.entity_table,
            id = %entry.entity_id,
            error = %e
        );
    }
}

async fn insert(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    kind: &str,
    incoming: bool,
    from_main: bool,
    outbox_id: Option<&str>,
    error: &str,
) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query(
        "INSERT INTO sync_problem
            (id, kind, incoming, from_main, source_device_id, source_seq, entity_table,
             entity_id, op, payload_json, outbox_id, error, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(source_device_id, source_seq, kind) DO UPDATE SET
            error = excluded.error, resolved_at = NULL, resolved_by = NULL, resolution = NULL",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(kind)
    .bind(incoming)
    .bind(from_main)
    .bind(&entry.device_id)
    .bind(entry.seq)
    .bind(&entry.entity_table)
    .bind(&entry.entity_id)
    .bind(&entry.op)
    .bind(&entry.payload_json)
    .bind(outbox_id)
    .bind(error.chars().take(2000).collect::<String>())
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    tracing::warn!(
        target: "medoc::sync",
        event = "SYNC_PROBLEM_RECORDED",
        kind,
        table = %entry.entity_table,
        id = %entry.entity_id,
    );
    Ok(())
}

pub async fn open_count(pool: &SqlitePool) -> Result<i64, AppError> {
    ensure(pool).await?;
    sqlx::query_scalar("SELECT COUNT(*) FROM sync_problem WHERE resolved_at IS NULL")
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)
}

/// Open problems first, newest first; `include_resolved` adds the history.
pub async fn list(pool: &SqlitePool, include_resolved: bool) -> Result<Vec<SyncProblem>, AppError> {
    ensure(pool).await?;
    let sql = if include_resolved {
        "SELECT * FROM sync_problem ORDER BY resolved_at IS NOT NULL, created_at DESC LIMIT 500"
    } else {
        "SELECT * FROM sync_problem WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 500"
    };
    sqlx::query_as::<_, SyncProblem>(sql)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
}

async fn load_open(pool: &SqlitePool, id: &str) -> Result<SyncProblem, AppError> {
    ensure(pool).await?;
    sqlx::query_as::<_, SyncProblem>(
        "SELECT * FROM sync_problem WHERE id = ?1 AND resolved_at IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("sync problem".into()))
}

async fn resolve(pool: &SqlitePool, id: &str, by: &str, resolution: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE sync_problem SET resolved_at = ?2, resolved_by = ?3, resolution = ?4
         WHERE id = ?1 AND resolved_at IS NULL",
    )
    .bind(id)
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(by)
    .bind(resolution)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Try the change again (after the admin fixed the cause, e.g. merged a
/// duplicate patient). Incoming: applied now. Outgoing: queued for sending.
/// The problem stays open, with the new error, if it fails again.
pub async fn retry(pool: &SqlitePool, id: &str, by: &str) -> Result<(), AppError> {
    let p = load_open(pool, id).await?;
    if p.kind == kind::FIELD_CONFLICT {
        take_other_value(pool, &p).await?;
        return resolve(pool, id, by, "TOOK_OTHER").await;
    }
    if !p.incoming {
        if let Some(outbox_id) = p.outbox_id.as_deref() {
            sqlx::query("UPDATE sync_outbox SET fail_reason = NULL WHERE id = ?1")
                .bind(outbox_id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
        return resolve(pool, id, by, "RETRIED").await;
    }
    // A conflict was reported as handled (so it did not block the queue) and
    // therefore marked applied. Clear that mark, or the retry is a no-op.
    sqlx::query("DELETE FROM sync_applied WHERE source_device_id = ?1 AND source_seq = ?2")
        .bind(&p.source_device_id)
        .bind(p.source_seq)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    let deployment = load_deployment(pool).await?;
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let entry = OutboxEntry {
        id: format!("problem-{}", p.id),
        device_id: p.source_device_id.clone(),
        seq: p.source_seq,
        entity_table: p.entity_table.clone(),
        entity_id: p.entity_id.clone(),
        op: p.op.clone(),
        payload_json: p.payload_json.clone(),
        created_at: p.created_at.clone(),
    };
    let local_is_master = deployment.role == crate::deployment::DeviceRole::Master;
    match apply_remote_entry_phased(
        pool,
        &local_id,
        local_is_master,
        p.from_main,
        ConflictPolicy::LastWriteWins,
        &entry,
    )
    .await
    {
        Ok(_) => resolve(pool, id, by, "RETRIED").await,
        Err(e) => {
            sqlx::query("UPDATE sync_problem SET error = ?2 WHERE id = ?1")
                .bind(id)
                .bind(e.to_string())
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
            Err(e)
        }
    }
}

/// Writes the value that lost a field conflict as a new local edit, so it reaches every device.
async fn take_other_value(pool: &SqlitePool, p: &SyncProblem) -> Result<(), AppError> {
    use medoc_core::infrastructure::database::{field_hlc, recorded_write, sync_registry};
    if !field_hlc::is_field_lww(&p.entity_table) {
        return Err(AppError::Validation("not a field conflict table".into()));
    }
    let values: serde_json::Map<String, serde_json::Value> = serde_json::from_str(&p.payload_json)
        .map_err(|e| AppError::Validation(format!("conflict payload: {e}")))?;
    let known: Vec<String> = sqlx::query_scalar(&format!(
        "SELECT name FROM pragma_table_info('{}')",
        p.entity_table
    ))
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let fields: Vec<(&String, &serde_json::Value)> = values
        .iter()
        .filter(|(k, _)| k.as_str() != "id" && known.contains(k))
        .collect();
    if fields.is_empty() {
        return Ok(());
    }
    let sets = fields
        .iter()
        .enumerate()
        .map(|(i, (k, _))| format!("\"{k}\" = ?{}", i + 1))
        .collect::<Vec<_>>()
        .join(", ");
    let key = sync_registry::key_expr(&p.entity_table);
    let sql = format!(
        "UPDATE \"{}\" SET {sets} WHERE {key} = ?{}",
        p.entity_table,
        fields.len() + 1
    );
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let mut q = sqlx::query(&sql);
    for (_, v) in &fields {
        q = match v {
            serde_json::Value::Null => q.bind(None::<String>),
            serde_json::Value::String(s) => q.bind(Some(s.clone())),
            other => q.bind(Some(other.to_string())),
        };
    }
    q.bind(&p.entity_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    recorded_write::record_in_tx(&mut tx, &p.entity_table, &p.entity_id, "UPDATE").await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

/// The admin decided the change is not needed (e.g. the duplicate was merged by hand).
pub async fn dismiss(pool: &SqlitePool, id: &str, by: &str) -> Result<(), AppError> {
    load_open(pool, id).await?;
    resolve(pool, id, by, "DISMISSED").await
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    fn entry() -> OutboxEntry {
        OutboxEntry {
            id: "e1".into(),
            device_id: "replica-x".into(),
            seq: 7,
            entity_table: "patient".into(),
            entity_id: "p-1".into(),
            op: "UPDATE".into(),
            payload_json: "{}".into(),
            created_at: "2099-01-01T00:00:00Z".into(),
        }
    }

    #[tokio::test]
    async fn a_skipped_change_is_listed_until_dismissed() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        crate::schema::ensure_sync_tables(&pool).await.unwrap();
        record_incoming(&pool, &entry(), kind::GAVE_UP, false, "boom").await;
        record_incoming(&pool, &entry(), kind::GAVE_UP, false, "boom again").await;
        let open = list(&pool, false).await.unwrap();
        assert_eq!(open.len(), 1, "the same change is listed once");
        assert_eq!(open[0].error, "boom again");
        assert_eq!(open_count(&pool).await.unwrap(), 1);
        dismiss(&pool, &open[0].id, "admin").await.unwrap();
        assert_eq!(open_count(&pool).await.unwrap(), 0);
        assert_eq!(list(&pool, true).await.unwrap().len(), 1);
    }
}
