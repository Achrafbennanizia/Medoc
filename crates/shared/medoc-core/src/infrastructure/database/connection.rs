//! Local SQLite (`medoc.db`, WAL) via **SQLCipher** (NFA-SEC-08).
//!
//! Pool lifecycle lives here; schema evolution is in [`super::migrations`].
//!
//! The Tauri-bound desktop entry point lives in
//! [`crate::commands::db_setup_commands::init_db_from_app`] and resolves
//! `app_data_dir` from the `AppHandle` before delegating to [`init_db_headless`].

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::database::db_key;
use crate::infrastructure::database::migrations;
use crate::infrastructure::database::sqlcipher;

/// Initialise the on-disk SQLCipher store at `app_data_dir/medoc.db`,
/// running schema + Rust-only migrations and seeding the audit-HMAC key.
///
/// Both the desktop binary (via `commands::db_setup_commands::init_db_from_app`)
/// and the headless `medoc-server` binary call this — `app_data_dir`
/// **must match** the desktop app's data directory so LAN clients and the
/// GUI share one database.
pub async fn init_db_headless(app_data_dir: &std::path::Path) -> Result<SqlitePool, AppError> {
    std::fs::create_dir_all(app_data_dir).map_err(|e| {
        AppError::Internal(format!(
            "App-Datenverzeichnis konnte nicht angelegt werden: {e}"
        ))
    })?;

    audit_repo::init_audit_hmac_key(app_data_dir).map_err(|e| {
        AppError::Internal(format!(
            "Audit-HMAC-Schlüssel konnte nicht initialisiert werden: {e}"
        ))
    })?;

    open_pool_with_migrations(app_data_dir).await
}

async fn open_pool_with_migrations(app_dir: &std::path::Path) -> Result<SqlitePool, AppError> {
    let db_path = app_dir.join("medoc.db");
    maybe_migrate_plaintext_db(app_dir, &db_path).await?;
    let key = resolve_sqlcipher_key(app_dir)?;
    let pool = sqlcipher::open_encrypted_pool(&db_path, key.clone(), true).await?;
    run_migrations(&pool).await?;
    pool.close().await;
    if sqlcipher::is_plaintext_sqlite_file(&db_path) {
        sqlcipher::migrate_plaintext_to_sqlcipher(&db_path, &key).await?;
    }
    sqlcipher::open_encrypted_pool(&db_path, key, true).await
}

async fn maybe_migrate_plaintext_db(
    app_dir: &std::path::Path,
    db_path: &std::path::Path,
) -> Result<(), AppError> {
    if !db_path.exists() || !sqlcipher::is_plaintext_sqlite_file(db_path) {
        return Ok(());
    }
    let key = resolve_sqlcipher_key(app_dir)?;
    sqlcipher::migrate_plaintext_to_sqlcipher(db_path, &key).await
}

fn resolve_sqlcipher_key(
    app_dir: &std::path::Path,
) -> Result<zeroize::Zeroizing<Vec<u8>>, AppError> {
    if db_key::wrap_path(app_dir).exists()
        && db_key::env_override_key().is_none()
        && db_key::try_keyring_key().is_none()
    {
        return Err(AppError::Validation(
            "Datenbank ist gesperrt — Passphrase zum Entsperren eingeben.".into(),
        ));
    }
    db_key::ensure_sqlcipher_key(app_dir, true)
}

/// Encrypted in-memory pool for integration tests (`MEDOC_DB_KEY` or fixed test key).
pub async fn test_memory_pool() -> Result<SqlitePool, AppError> {
    let key = db_key::test_pool_key_material()?;
    sqlcipher::open_memory_pool(&key).await
}

/// Applies full schema DDL, forward `ALTER`s, and default seed staff when `personal` is empty.
/// Public for integration tests (`cargo test`) and tooling; production callers use [`init_db_headless`].
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='patient'",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    if existing > 0 {
        return migrations::run_legacy_embedded_migrations(pool).await;
    }
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| AppError::Internal(format!("SQL-Migration: {e}")))?;
    migrations::run_rust_only_migrations(pool).await?;
    migrations::run_post_migration_seed(pool).await?;
    Ok(())
}
