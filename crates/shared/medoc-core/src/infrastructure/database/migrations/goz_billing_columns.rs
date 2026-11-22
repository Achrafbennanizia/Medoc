//! GOZ billing data on treatments and the treatment catalog.
//!
//! Without fee number, points and factor a dental invoice cannot follow
//! GOZ § 10 / Anlage 2, and the server cannot recompute the fee.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

async fn add_column_if_missing(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    ddl: &str,
) -> Result<(), AppError> {
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2")
        .bind(table)
        .bind(column)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    if n == 0 {
        sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

pub(super) async fn ensure_goz_billing_columns(pool: &SqlitePool) -> Result<(), AppError> {
    for (column, ddl) in [
        // 'goz' | 'goae' | 'material' | 'lab' | 'other'
        ("fee_schedule", "TEXT"),
        ("goz_nr", "TEXT"),
        ("points", "INTEGER"),
        ("factor", "REAL"),
        ("factor_reason", "TEXT"),
        ("quantity", "INTEGER NOT NULL DEFAULT 1"),
        ("analog_of", "TEXT"),
        ("agreement_ref", "TEXT"),
    ] {
        add_column_if_missing(pool, "treatment", column, ddl).await?;
    }
    for (column, ddl) in [
        ("fee_schedule", "TEXT"),
        ("goz_nr", "TEXT"),
        ("points", "INTEGER"),
    ] {
        add_column_if_missing(pool, "treatment_catalog", column, ddl).await?;
    }
    Ok(())
}
