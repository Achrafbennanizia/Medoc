//! Day-close protocols (finance / cash drawer).
use crate::domain::entities::day_close_protocol::{
    CreateDayCloseProtocol, DayCloseProtocol,
};
use crate::error::AppError;
use chrono::NaiveDate;
use sqlx::SqlitePool;

fn validate_as_of_date(s: &str) -> Result<(), AppError> {
    let t = s.trim();
    if t.is_empty() {
        return Err(AppError::Validation("Cut-off date required".into()));
    }
    NaiveDate::parse_from_str(t, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Cut-off date must be YYYY-MM-DD".into()))?;
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<DayCloseProtocol>, AppError> {
    let rows = sqlx::query_as::<_, DayCloseProtocol>(
        "SELECT id, as_of_date, counted_eur, system_cash_eur, system_income_eur, variance_eur,
                cash_matches, day_payment_count, cash_verified_count, all_payments_verified, note, recorded_at
           FROM day_close_protocol
          ORDER BY recorded_at DESC, id DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<DayCloseProtocol, AppError> {
    sqlx::query_as::<_, DayCloseProtocol>(
        "SELECT id, as_of_date, counted_eur, system_cash_eur, system_income_eur, variance_eur,
                cash_matches, day_payment_count, cash_verified_count, all_payments_verified, note, recorded_at
           FROM day_close_protocol
          WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("DayCloseProtocol".into()))
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreateDayCloseProtocol,
) -> Result<DayCloseProtocol, AppError> {
    validate_as_of_date(&data.as_of_date)?;
    if !data.system_cash_eur.is_finite() || !data.system_income_eur.is_finite() {
        return Err(AppError::Validation("Invalid amounts".into()));
    }
    if let Some(g) = data.counted_eur {
        if !g.is_finite() {
            return Err(AppError::Validation("Invalid counted amount".into()));
        }
    }
    if let Some(a) = data.variance_eur {
        if !a.is_finite() {
            return Err(AppError::Validation("Invalid variance".into()));
        }
    }
    if data.day_payment_count < 0
        || data.cash_verified_count < 0
        || (data.cash_matches != 0 && data.cash_matches != 1)
        || (data.all_payments_verified != 0 && data.all_payments_verified != 1)
    {
        return Err(AppError::Validation("Invalid metrics".into()));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let note = data
        .note
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    sqlx::query(
        "INSERT INTO day_close_protocol
            (id, as_of_date, counted_eur, system_cash_eur, system_income_eur, variance_eur,
             cash_matches, day_payment_count, cash_verified_count, all_payments_verified, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(&id)
    .bind(data.as_of_date.trim())
    .bind(data.counted_eur)
    .bind(data.system_cash_eur)
    .bind(data.system_income_eur)
    .bind(data.variance_eur)
    .bind(data.cash_matches)
    .bind(data.day_payment_count)
    .bind(data.cash_verified_count)
    .bind(data.all_payments_verified)
    .bind(note)
    .execute(pool)
    .await?;
    get(pool, &id).await
}

pub async fn delete_row(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM day_close_protocol WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("DayCloseProtocol".into()));
    }
    Ok(())
}
