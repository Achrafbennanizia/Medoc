//! FA-PERS-08 — Rezeption → Arzt: strukturierte Tickets pro Patient.
use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PraxisTicket {
    pub id: String,
    pub patient_id: String,
    pub from_user_id: String,
    pub to_arzt_id: String,
    pub body: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn insert(
    pool: &SqlitePool,
    patient_id: &str,
    from_user_id: &str,
    to_arzt_id: &str,
    body: &str,
) -> Result<PraxisTicket, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO praxis_ticket (id, patient_id, from_user_id, to_arzt_id, body, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'OFFEN')",
    )
    .bind(&id)
    .bind(patient_id)
    .bind(from_user_id)
    .bind(to_arzt_id)
    .bind(body)
    .execute(pool)
    .await?;
    find_by_id(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("praxis_ticket insert".into()))
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PraxisTicket>, AppError> {
    sqlx::query_as::<_, PraxisTicket>("SELECT * FROM praxis_ticket WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)
}

/// Tickets an den eingeloggten Arzt (offen + in Bearbeitung zuerst).
pub async fn list_for_arzt(
    pool: &SqlitePool,
    arzt_id: &str,
    limit: i64,
) -> Result<Vec<PraxisTicket>, AppError> {
    let rows = sqlx::query_as::<_, PraxisTicket>(
        "SELECT * FROM praxis_ticket
         WHERE to_arzt_id = ?1
         ORDER BY
           CASE status WHEN 'OFFEN' THEN 0 WHEN 'IN_BEARBEITUNG' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(arzt_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Von der Rezeption erstellte Tickets (Übersicht).
pub async fn list_created_by(
    pool: &SqlitePool,
    from_user_id: &str,
    limit: i64,
) -> Result<Vec<PraxisTicket>, AppError> {
    let rows = sqlx::query_as::<_, PraxisTicket>(
        "SELECT * FROM praxis_ticket
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

pub async fn count_open_for_arzt(pool: &SqlitePool, arzt_id: &str) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_ticket
         WHERE to_arzt_id = ?1 AND status IN ('OFFEN','IN_BEARBEITUNG')",
    )
    .bind(arzt_id)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    to_arzt_id: &str,
    status: &str,
) -> Result<PraxisTicket, AppError> {
    let n = sqlx::query(
        "UPDATE praxis_ticket SET status = ?1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?2 AND to_arzt_id = ?3",
    )
    .bind(status)
    .bind(id)
    .bind(to_arzt_id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Ticket".into()));
    }
    find_by_id(pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Ticket".into()))
}
