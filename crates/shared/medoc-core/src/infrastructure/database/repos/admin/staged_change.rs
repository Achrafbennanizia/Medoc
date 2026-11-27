//! Guest proposals waiting for the admin (Solo guest inbox, docs/architecture/editions-plan.md §4.2).
//!
//! One row per proposed change: the command it would run, its arguments, a summary for the inbox
//! list, and the admin's decision. The original proposal is never edited, so the record keeps what
//! the guest asked for even after the admin added a changed version (BGB § 630f).

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

use crate::error::AppError;

pub const STATUS_PENDING: &str = "PENDING";
pub const STATUS_ADDED: &str = "ADDED";
pub const STATUS_DISMISSED: &str = "DISMISSED";

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct StagedChange {
    pub id: String,
    /// IPC command the change runs when added (allow-listed, `application::guest`).
    pub command: String,
    /// Arguments of that command, as the guest sent them.
    pub args_json: String,
    /// Title / description / warnings for the inbox (built by the client).
    pub summary_json: String,
    pub created_by: String,
    pub created_at: String,
    pub status: String,
    pub decided_by: Option<String>,
    pub decided_at: Option<String>,
    pub reason: Option<String>,
    /// Id of the record the added change created or changed, when known.
    pub result_id: Option<String>,
}

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS staged_change (
            id TEXT PRIMARY KEY,
            command TEXT NOT NULL,
            args_json TEXT NOT NULL,
            summary_json TEXT NOT NULL DEFAULT '{}',
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ADDED','DISMISSED')),
            decided_by TEXT,
            decided_at TEXT,
            reason TEXT,
            result_id TEXT
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_staged_change_status ON staged_change (status, created_at)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert(
    pool: &SqlitePool,
    command: &str,
    args_json: &str,
    summary_json: &str,
    created_by: &str,
) -> Result<StagedChange, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO staged_change (id, command, args_json, summary_json, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&id)
    .bind(command)
    .bind(args_json)
    .bind(summary_json)
    .bind(created_by)
    .execute(pool)
    .await?;
    get(pool, &id)
        .await?
        .ok_or(AppError::NotFound("staged_change".into()))
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<Option<StagedChange>, AppError> {
    Ok(sqlx::query_as("SELECT * FROM staged_change WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

/// Newest first. `status` and `created_by` narrow the list when given.
pub async fn list(
    pool: &SqlitePool,
    status: Option<&str>,
    created_by: Option<&str>,
) -> Result<Vec<StagedChange>, AppError> {
    Ok(sqlx::query_as(
        "SELECT * FROM staged_change
         WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR created_by = ?2)
         ORDER BY created_at DESC, id DESC
         LIMIT 500",
    )
    .bind(status)
    .bind(created_by)
    .fetch_all(pool)
    .await?)
}

pub async fn count_pending(pool: &SqlitePool) -> Result<i64, AppError> {
    Ok(
        sqlx::query_scalar("SELECT COUNT(*) FROM staged_change WHERE status = 'PENDING'")
            .fetch_one(pool)
            .await?,
    )
}

/// Records the admin's decision. Only a pending change can be decided (no double add).
pub async fn decide(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    decided_by: &str,
    reason: Option<&str>,
    result_id: Option<&str>,
) -> Result<(), AppError> {
    let done = sqlx::query(
        "UPDATE staged_change
         SET status = ?2, decided_by = ?3, reason = ?4, result_id = ?5,
             decided_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?1 AND status = 'PENDING'",
    )
    .bind(id)
    .bind(status)
    .bind(decided_by)
    .bind(reason)
    .bind(result_id)
    .execute(pool)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::validation_code("error.guest.already_decided"));
    }
    Ok(())
}
