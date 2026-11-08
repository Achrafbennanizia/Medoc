//! Persistence for the BalanceSheet wizard snapshots.
use crate::domain::entities::balance_sheet_snapshot::{
    BalanceSheetSnapshot, CreateBalanceSheetSnapshot,
};
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn list(pool: &SqlitePool) -> Result<Vec<BalanceSheetSnapshot>, AppError> {
    let rows = sqlx::query_as::<_, BalanceSheetSnapshot>(
        "SELECT id, created_by, period, kind, label, income_cents, expenses_cents,
                balance_cents, payload, created_at
           FROM balance_sheet_snapshot
          ORDER BY created_at DESC, id DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<BalanceSheetSnapshot, AppError> {
    sqlx::query_as::<_, BalanceSheetSnapshot>("SELECT * FROM balance_sheet_snapshot WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("BalanceSheetSnapshot".into()))
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreateBalanceSheetSnapshot,
    created_by: &str,
) -> Result<BalanceSheetSnapshot, AppError> {
    if data.period.trim().is_empty() {
        return Err(AppError::Validation("Period required".into()));
    }
    if data.label.trim().is_empty() {
        return Err(AppError::Validation("Label required".into()));
    }
    let balance = data.income_cents - data.expenses_cents;
    let payload_str = serde_json::to_string(&data.payload)
        .map_err(|e| AppError::Internal(format!("Snapshot payload not serializable: {e}")))?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO balance_sheet_snapshot
            (id, created_by, period, kind, label, income_cents, expenses_cents, balance_cents, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(&id)
    .bind(created_by)
    .bind(data.period.trim())
    .bind(data.kind.trim())
    .bind(data.label.trim())
    .bind(data.income_cents)
    .bind(data.expenses_cents)
    .bind(balance)
    .bind(&payload_str)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "balance_sheet_snapshot",
        &id,
        "INSERT",
    )
    .await?;
    tx.commit().await?;
    get(pool, &id).await
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "balance_sheet_snapshot",
        id,
        "DELETE",
    )
    .await?;
    let r = sqlx::query("DELETE FROM balance_sheet_snapshot WHERE id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("BalanceSheetSnapshot".into()));
    }
    Ok(())
}
