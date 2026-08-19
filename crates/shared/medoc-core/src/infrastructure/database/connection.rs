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
            "Could not create app data directory: {e}"
        ))
    })?;

    audit_repo::init_audit_hmac_key(app_data_dir).map_err(|e| {
        AppError::Internal(format!(
            "Could not initialise audit HMAC key: {e}"
        ))
    })?;

    open_pool_with_migrations(app_data_dir).await
}

/// Re-open `medoc.db` after SQLCipher rekey (caller must have closed the prior pool).
pub async fn reopen_app_pool(app_data_dir: &std::path::Path) -> Result<SqlitePool, AppError> {
    open_pool_with_migrations(app_data_dir).await
}

pub async fn open_pool_with_migrations(app_dir: &std::path::Path) -> Result<SqlitePool, AppError> {
    let db_path = app_dir.join("medoc.db");
    maybe_migrate_plaintext_db(app_dir, &db_path).await?;
    let key = resolve_sqlcipher_key(app_dir)?;

    if db_path.exists() && !sqlcipher::is_plaintext_sqlite_file(&db_path) {
        let pool = sqlcipher::open_encrypted_pool(&db_path, key.clone(), true).await?;
        // Always re-run (idempotent): existing installs must pick up the English
        // table/column/enum upgrade even when `patient` already exists.
        run_migrations(&pool).await?;
        return Ok(pool);
    }

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
            "Database is locked — enter passphrase to unlock.".into(),
        ));
    }
    db_key::ensure_sqlcipher_key(app_dir, true)
}

/// Encrypted in-memory pool for integration tests (`MEDOC_DB_KEY` or fixed test key).
pub async fn test_memory_pool() -> Result<SqlitePool, AppError> {
    let key = db_key::test_pool_key_material()?;
    sqlcipher::open_memory_pool(&key).await
}

/// Applies full schema DDL, forward `ALTER`s, and default seed staff when `staff` is empty.
/// Public for integration tests (`cargo test`) and tooling; production callers use [`init_db_headless`].
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    // Rename leftover German / camelCase tables+columns+enum wires before any
    // CREATE IF NOT EXISTS, so we never create an empty English twin beside
    // a populated German table.
    migrations::run_english_schema_upgrade(pool).await?;
    if migrations::schema_already_present(pool).await? {
        migrations::run_legacy_embedded_migrations(pool).await?;
        migrations::run_rust_only_migrations(pool).await?;
    } else {
        sqlx::migrate!("./migrations")
            .run(pool)
            .await
            .map_err(|e| AppError::Internal(format!("SQL migration: {e}")))?;
        migrations::run_rust_only_migrations(pool).await?;
        migrations::run_post_migration_seed(pool).await?;
    }
    // Install staff-quota triggers after bootstrap/seed inserts (demo seed must not trip 1-PHYSICIAN cap).
    crate::mvp_security::ensure_staff_quota_db_triggers(pool).await?;
    Ok(())
}
