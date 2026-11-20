use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InAppNotification {
    pub id: String,
    pub user_id: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    pub payload_json: Option<String>,
    pub read_at: Option<String>,
    pub created_at: String,
}

pub async fn insert(
    pool: &SqlitePool,
    user_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    payload_json: Option<&str>,
) -> Result<(), AppError> {
    let id = insert_row(pool, user_id, kind, title, body, payload_json).await?;
    if let Ok(row) = sqlx::query_as::<_, InAppNotification>(
        "SELECT id, user_id, kind, title, body, payload_json, read_at, created_at
         FROM in_app_notification WHERE id = ?1",
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    {
        let mut payload = serde_json::to_value(&row).unwrap_or_else(|_| serde_json::json!({}));
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("updated_at".into(), row.created_at.clone().into());
        }
        let body = payload.to_string();
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "in_app_notification",
            &id,
            "INSERT",
            &body,
        )
        .await?;
    }
    Ok(())
}

/// Local-only insert used when filling a sync gap (do not re-outbox).
pub async fn insert_local_gap_fill(
    pool: &SqlitePool,
    user_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    payload_json: Option<&str>,
) -> Result<(), AppError> {
    let _ = insert_row(pool, user_id, kind, title, body, payload_json).await?;
    Ok(())
}

async fn insert_row(
    pool: &SqlitePool,
    user_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    payload_json: Option<&str>,
) -> Result<String, AppError> {
    let staff_ok: Option<i64> = sqlx::query_scalar("SELECT 1 FROM staff WHERE id = ?1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    if staff_ok.is_none() {
        return Err(AppError::Validation(
            "Notification user is not a staff account on this device.".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO in_app_notification (id, user_id, kind, title, body, payload_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(user_id)
    .bind(kind)
    .bind(title)
    .bind(body)
    .bind(payload_json)
    .execute(pool)
    .await?;
    Ok(id)
}

/// True when this user already has a PRACTICE_TASK_ASSIGNED row for `task_id`.
pub async fn exists_assigned_for_task(
    pool: &SqlitePool,
    user_id: &str,
    task_id: &str,
) -> Result<bool, AppError> {
    let needle = format!("%\"taskId\":\"{task_id}\"%");
    let n: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM in_app_notification
         WHERE user_id = ?1
           AND kind = 'PRACTICE_TASK_ASSIGNED'
           AND payload_json LIKE ?2
         LIMIT 1",
    )
    .bind(user_id)
    .bind(&needle)
    .fetch_optional(pool)
    .await?;
    Ok(n.is_some())
}

/// F99: notification insert inside the caller's transaction (recorded).
/// The recipient must already be a local staff account (checked by the caller).
pub async fn insert_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    user_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    payload_json: Option<&str>,
) -> Result<(), AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO in_app_notification (id, user_id, kind, title, body, payload_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(user_id)
    .bind(kind)
    .bind(title)
    .bind(body)
    .bind(payload_json)
    .execute(&mut **tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        tx,
        "in_app_notification",
        &id,
        "INSERT",
    )
    .await?;
    Ok(())
}

pub async fn list_for_user(
    pool: &SqlitePool,
    user_id: &str,
    limit: i64,
) -> Result<Vec<InAppNotification>, AppError> {
    let rows = sqlx::query_as::<_, InAppNotification>(
        "SELECT id, user_id, kind, title, body, payload_json, read_at, created_at
         FROM in_app_notification
         WHERE user_id = ?1
         ORDER BY (read_at IS NOT NULL) ASC, datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn count_unread(pool: &SqlitePool, user_id: &str) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM in_app_notification WHERE user_id = ?1 AND read_at IS NULL",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn mark_read(
    pool: &SqlitePool,
    notification_id: &str,
    user_id: &str,
) -> Result<u64, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let n =
        sqlx::query(
            "UPDATE in_app_notification SET read_at = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?2 AND user_id = ?3",
        )
            .bind(&now)
            .bind(notification_id)
            .bind(user_id)
            .execute(pool)
            .await?
            .rows_affected();
    if n > 0 {
        let payload = format!(
            "{{\"id\":\"{notification_id}\",\"user_id\":\"{user_id}\",\"read_at\":\"{now}\"}}"
        );
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "in_app_notification",
            notification_id,
            "UPDATE",
            &payload,
        )
        .await?;
    }
    Ok(n)
}

/// Mark unread rows of the given kinds as read for one user (re-scan after schedule edits).
pub async fn mark_unread_kinds_read(
    pool: &SqlitePool,
    user_id: &str,
    kinds: &[String],
) -> Result<u64, AppError> {
    if kinds.is_empty() {
        return Ok(0);
    }
    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = pool.begin().await?;
    let mut total = 0u64;
    for kind in kinds {
        let ids: Vec<String> = sqlx::query_scalar(
            "UPDATE in_app_notification
             SET read_at = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE user_id = ?2 AND kind = ?3 AND read_at IS NULL
             RETURNING id",
        )
        .bind(&now)
        .bind(user_id)
        .bind(kind)
        .fetch_all(&mut *tx)
        .await?;
        for id in &ids {
            crate::infrastructure::database::recorded_write::record_in_tx(
                &mut tx,
                "in_app_notification",
                id,
                "UPDATE",
            )
            .await?;
        }
        total += ids.len() as u64;
    }
    tx.commit().await?;
    Ok(total)
}

pub async fn mark_all_read(pool: &SqlitePool, user_id: &str) -> Result<u64, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = pool.begin().await?;
    let ids: Vec<String> = sqlx::query_scalar(
        "UPDATE in_app_notification
         SET read_at = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE user_id = ?2 AND read_at IS NULL
         RETURNING id",
    )
    .bind(&now)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;
    for id in &ids {
        crate::infrastructure::database::recorded_write::record_in_tx(
            &mut tx,
            "in_app_notification",
            id,
            "UPDATE",
        )
        .await?;
    }
    let n = ids.len() as u64;
    tx.commit().await?;
    Ok(n)
}
