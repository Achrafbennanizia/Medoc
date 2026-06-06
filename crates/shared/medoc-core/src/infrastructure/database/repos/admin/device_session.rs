//! Browser / Desktop-Geräte-Sitzungen pro Personal (Team-Ansicht in Einstellungen).
use crate::error::AppError;
use serde::Serialize;
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSessionRow {
    pub id: String,
    pub user_id: String,
    pub device_label: String,
    pub user_agent: Option<String>,
    pub created_at: String,
    pub last_seen_at: String,
    pub is_current: bool,
}

pub async fn insert(
    pool: &SqlitePool,
    id: &str,
    user_id: &str,
    device_label: &str,
    user_agent: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO device_session (id, user_id, device_label, user_agent, created_at, last_seen_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'), NULL)",
    )
    .bind(id)
    .bind(user_id)
    .bind(device_label)
    .bind(user_agent)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn touch(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE device_session SET last_seen_at = datetime('now') WHERE id = ?1 AND ended_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn end(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE device_session SET ended_at = datetime('now') WHERE id = ?1 AND ended_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Aktive Sitzungen (ended_at IS NULL) neueste zuerst.
pub async fn list_active_for_user(
    pool: &SqlitePool,
    user_id: &str,
    current_id: Option<&str>,
) -> Result<Vec<DeviceSessionRow>, AppError> {
    let rows = sqlx::query(
        "SELECT id, user_id, device_label, user_agent, created_at, last_seen_at
         FROM device_session
         WHERE user_id = ?1 AND ended_at IS NULL
         ORDER BY last_seen_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let id: String = r.try_get("id").map_err(AppError::Database)?;
        let uid: String = r.try_get("user_id").map_err(AppError::Database)?;
        let device_label: String = r.try_get("device_label").map_err(AppError::Database)?;
        let user_agent: Option<String> = r.try_get("user_agent").ok();
        let created_at: String = r.try_get("created_at").map_err(AppError::Database)?;
        let last_seen_at: String = r.try_get("last_seen_at").map_err(AppError::Database)?;
        out.push(DeviceSessionRow {
            is_current: current_id.map(|c| c == id.as_str()).unwrap_or(false),
            id,
            user_id: uid,
            device_label,
            user_agent,
            created_at,
            last_seen_at,
        });
    }
    Ok(out)
}

pub async fn end_other_than(
    pool: &SqlitePool,
    user_id: &str,
    keep_id: &str,
) -> Result<u64, AppError> {
    let r = sqlx::query(
        "UPDATE device_session SET ended_at = datetime('now')
         WHERE user_id = ?1 AND ended_at IS NULL AND id != ?2",
    )
    .bind(user_id)
    .bind(keep_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(r.rows_affected())
}
