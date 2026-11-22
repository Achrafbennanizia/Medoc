//! Contract activation columns (`active`, `deactivated_at`), added to existing databases.

use sqlx::SqlitePool;

use crate::error::AppError;

/// Contracts can be deactivated: `active` (default 1 for existing rows) + `deactivated_at` (YYYY-MM-DD).
/// Costs are counted only up to `deactivated_at` (period report, contracts page).
pub(super) async fn ensure_contract_activation_columns(pool: &SqlitePool) -> Result<(), AppError> {
    let table: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'contract'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if table == 0 {
        return Ok(());
    }
    for (col, ddl) in [
        (
            "active",
            "ALTER TABLE contract ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
        ),
        (
            "deactivated_at",
            "ALTER TABLE contract ADD COLUMN deactivated_at TEXT",
        ),
    ] {
        let n: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM pragma_table_info('contract') WHERE name = '{col}'"
        ))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if n == 0 {
            sqlx::query(ddl)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
    }
    Ok(())
}
