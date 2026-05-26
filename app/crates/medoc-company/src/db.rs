//! Eigenes SQLite für das **MeDoc Hersteller-Portal** (getrennt von Praxis-`medoc.db`).

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::str::FromStr;

use medoc_core::error::AppError;

use crate::api_key;

const DEMO_SLUG: &str = "demo-praxis";
const DEMO_API_KEY: &str = "sk_demo_company_practice_key";

pub async fn init_company_db(path: &std::path::Path) -> Result<SqlitePool, AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("company data dir: {e}")))?;
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

    migrate_plaintext_api_keys(&pool).await?;
    ensure_practice_table(&pool).await?;

    let demo_hash = api_key::hash_api_key(DEMO_API_KEY)
        .map_err(|e| AppError::Internal(format!("demo api key hash: {e}")))?;
    sqlx::query(
        "INSERT OR IGNORE INTO practice (slug, display_name, api_key_hash, plan_name)
         VALUES (?1, 'Demo Praxis GmbH', ?2, 'MeDoc Praxis Pro')",
    )
    .bind(DEMO_SLUG)
    .bind(&demo_hash)
    .execute(&pool)
    .await
    .map_err(AppError::Database)?;

    Ok(pool)
}

async fn table_exists(pool: &SqlitePool, name: &str) -> Result<bool, AppError> {
    let (n,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .bind(name)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(n > 0)
}

async fn ensure_practice_table(pool: &SqlitePool) -> Result<(), AppError> {
    if table_exists(pool, "practice").await? {
        return Ok(());
    }
    sqlx::query(
        "CREATE TABLE practice (
            slug TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            api_key_hash TEXT NOT NULL UNIQUE,
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
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

async fn column_exists(pool: &SqlitePool, name: &str) -> Result<bool, AppError> {
    let (n,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pragma_table_info('practice') WHERE name = ?1")
            .bind(name)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(n > 0)
}

async fn migrate_plaintext_api_keys(pool: &SqlitePool) -> Result<(), AppError> {
    if !column_exists(pool, "api_key").await? {
        return Ok(());
    }

    if !column_exists(pool, "api_key_hash").await? {
        sqlx::query("ALTER TABLE practice ADD COLUMN api_key_hash TEXT")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }

    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT slug, api_key FROM practice WHERE api_key IS NOT NULL AND api_key != ''",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    for (slug, raw) in rows {
        let hash = api_key::hash_api_key(&raw).map_err(AppError::Internal)?;
        sqlx::query("UPDATE practice SET api_key_hash = ?1 WHERE slug = ?2")
            .bind(&hash)
            .bind(&slug)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }

    rebuild_practice_without_plaintext_key(pool).await?;
    Ok(())
}

/// SQLite cannot `DROP COLUMN` on a `UNIQUE` column — rebuild via rename + copy.
async fn rebuild_practice_without_plaintext_key(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query("ALTER TABLE practice RENAME TO practice_legacy")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

    sqlx::query(
        "CREATE TABLE practice (
            slug TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            api_key_hash TEXT NOT NULL UNIQUE,
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
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "INSERT INTO practice (
            slug, display_name, api_key_hash, plan_name,
            monthly_fee_cents, next_billing_iso, max_users, active_users,
            storage_gb, storage_used_gb, erezept_month_used, erezept_month_quota
        )
        SELECT
            slug, display_name, api_key_hash, plan_name,
            18900, '2026-06-01', 8, 4, 100, 12.4, 142, -1
        FROM practice_legacy
        WHERE api_key_hash IS NOT NULL AND api_key_hash != ''",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query("DROP TABLE practice_legacy")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}
