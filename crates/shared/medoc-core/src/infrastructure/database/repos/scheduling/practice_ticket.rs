//! FA-PERS-08 — Reception → Physician: strukturierte Tickets pro Patient.
use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PracticeTicket {
    pub id: String,
    pub patient_id: String,
    pub from_user_id: String,
    pub to_physician_id: String,
    pub body: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn insert(
    pool: &SqlitePool,
    patient_id: &str,
    from_user_id: &str,
    to_physician_id: &str,
    body: &str,
) -> Result<PracticeTicket, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO practice_ticket (id, patient_id, from_user_id, to_physician_id, body, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'OPEN')",
    )
    .bind(&id)
    .bind(patient_id)
    .bind(from_user_id)
    .bind(to_physician_id)
    .bind(body)
    .execute(pool)
    .await?;
    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("practice_ticket insert".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "practice_ticket",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PracticeTicket>, AppError> {
    sqlx::query_as::<_, PracticeTicket>("SELECT * FROM practice_ticket WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)
}

/// Tickets for the logged-in doctor (open + in progress first).
pub async fn list_for_physician(
    pool: &SqlitePool,
    physician_id: &str,
    limit: i64,
) -> Result<Vec<PracticeTicket>, AppError> {
    let rows = sqlx::query_as::<_, PracticeTicket>(
        "SELECT * FROM practice_ticket
         WHERE to_physician_id = ?1
         ORDER BY
           CASE status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(physician_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Tickets created by reception (overview).
pub async fn list_created_by(
    pool: &SqlitePool,
    from_user_id: &str,
    limit: i64,
) -> Result<Vec<PracticeTicket>, AppError> {
    let rows = sqlx::query_as::<_, PracticeTicket>(
        "SELECT * FROM practice_ticket
         WHERE from_user_id = ?1
         ORDER BY datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(from_user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn count_open_for_physician(pool: &SqlitePool, physician_id: &str) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_ticket
         WHERE to_physician_id = ?1 AND status IN ('OPEN','IN_PROGRESS')",
    )
    .bind(physician_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    to_physician_id: &str,
    status: &str,
) -> Result<PracticeTicket, AppError> {
    let n = sqlx::query(
        "UPDATE practice_ticket SET status = ?1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?2 AND to_physician_id = ?3",
    )
    .bind(status)
    .bind(id)
    .bind(to_physician_id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Ticket".into()));
    }
    let updated = find_by_id(pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Ticket".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "practice_ticket",
        id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}
