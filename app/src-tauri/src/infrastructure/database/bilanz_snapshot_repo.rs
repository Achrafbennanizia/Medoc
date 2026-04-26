//! Persistence for the Bilanz wizard snapshots.
use crate::domain::entities::bilanz_snapshot::{BilanzSnapshot, CreateBilanzSnapshot};
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn list(pool: &SqlitePool) -> Result<Vec<BilanzSnapshot>, AppError> {
    let rows = sqlx::query_as::<_, BilanzSnapshot>(
        "SELECT id, created_by, zeitraum, typ, label, einnahmen_cents, ausgaben_cents,
                saldo_cents, payload, created_at
           FROM bilanz_snapshot
          ORDER BY created_at DESC, id DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<BilanzSnapshot, AppError> {
    sqlx::query_as::<_, BilanzSnapshot>("SELECT * FROM bilanz_snapshot WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("BilanzSnapshot".into()))
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreateBilanzSnapshot,
    created_by: &str,
) -> Result<BilanzSnapshot, AppError> {
    if data.zeitraum.trim().is_empty() {
        return Err(AppError::Validation("Zeitraum erforderlich".into()));
    }
    if data.label.trim().is_empty() {
        return Err(AppError::Validation("Label erforderlich".into()));
    }
    let saldo = data.einnahmen_cents - data.ausgaben_cents;
    let payload_str = serde_json::to_string(&data.payload)
        .map_err(|e| AppError::Internal(format!("Snapshot-Payload nicht serialisierbar: {e}")))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO bilanz_snapshot
            (id, created_by, zeitraum, typ, label, einnahmen_cents, ausgaben_cents, saldo_cents, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(&id)
    .bind(created_by)
    .bind(data.zeitraum.trim())
    .bind(data.typ.trim())
    .bind(data.label.trim())
    .bind(data.einnahmen_cents)
    .bind(data.ausgaben_cents)
    .bind(saldo)
    .bind(&payload_str)
    .execute(pool)
    .await?;
    get(pool, &id).await
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM bilanz_snapshot WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("BilanzSnapshot".into()));
    }
    Ok(())
}
