//! Eigenes SQLite für das **MeDoc Hersteller-Portal** (getrennt von Praxis-`medoc.db`).

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::str::FromStr;

use crate::error::AppError;

pub async fn init_company_db(path: &std::path::Path) -> Result<SqlitePool, AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Internal(format!("company data dir: {e}")))?;
    }
    let db_url = format!("sqlite:{}?mode=rwc", path.display());
    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(AppError::Database)?
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS practice (
            slug TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            api_key TEXT NOT NULL UNIQUE,
            plan_name TEXT NOT NULL,
            monthly_fee_cents INTEGER NOT NULL DEFAULT 18900,
            next_billing_iso TEXT NOT NULL DEFAULT '2026-06-01',
            max_users INTEGER NOT NULL DEFAULT 8,
            active_users INTEGER NOT NULL DEFAULT 4,
            storage_gb INTEGER NOT NULL DEFAULT 100,
            storage_used_gb REAL NOT NULL DEFAULT 12.4,
            erezept_month_used INTEGER NOT NULL DEFAULT 142,
            erezept_month_quota INTEGER NOT NULL DEFAULT -1
        )",
    )
    .execute(&pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "INSERT OR IGNORE INTO practice (slug, display_name, api_key, plan_name)
         VALUES ('demo-praxis', 'Demo Praxis GmbH', 'sk_demo_company_practice_key', 'MeDoc Praxis Pro')",
    )
    .execute(&pool)
    .await
    .map_err(AppError::Database)?;
    Ok(pool)
}
