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
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO in_app_notification (id, user_id, kind, title, body, payload_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(kind)
    .bind(title)
    .bind(body)
    .bind(payload_json)
    .execute(pool)
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
        sqlx::query("UPDATE in_app_notification SET read_at = ?1 WHERE id = ?2 AND user_id = ?3")
            .bind(&now)
            .bind(notification_id)
            .bind(user_id)
            .execute(pool)
            .await?
            .rows_affected();
    Ok(n)
}

pub async fn mark_all_read(pool: &SqlitePool, user_id: &str) -> Result<u64, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let n = sqlx::query(
        "UPDATE in_app_notification SET read_at = ?1 WHERE user_id = ?2 AND read_at IS NULL",
    )
    .bind(&now)
    .bind(user_id)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(n)
}
