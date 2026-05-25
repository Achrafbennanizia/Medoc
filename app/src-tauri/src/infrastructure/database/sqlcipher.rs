//! SQLCipher connect helpers + plaintext → encrypted migration.

use std::path::Path;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::str::FromStr;
use zeroize::Zeroizing;

use crate::error::AppError;
use crate::infrastructure::database::db_key;

/// Connect options for a legacy **unencrypted** `SQLite format 3` file via SQLCipher.
fn plain_connect_options(plain_url: &str) -> Result<SqliteConnectOptions, AppError> {
    Ok(SqliteConnectOptions::from_str(plain_url)
        .map_err(AppError::Database)?
        .pragma("cipher_plaintext_header", "1"))
}

pub fn is_plaintext_sqlite_file(path: &Path) -> bool {
    let mut head = [0u8; 16];
    let Ok(mut f) = std::fs::File::open(path) else {
        return false;
    };
    use std::io::Read;
    matches!(f.read_exact(&mut head), Ok(())) && &head[..15] == b"SQLite format 3"
}

/// True when `medoc.db` opens with the SQLCipher key (already encrypted).
pub async fn opens_with_sqlcipher_key(db_path: &Path, key: &[u8]) -> bool {
    let key = Zeroizing::new(key.to_vec());
    match open_encrypted_pool(db_path, key, false).await {
        Ok(pool) => {
            let ok = sqlx::query("SELECT count(*) FROM sqlite_master")
                .fetch_one(&pool)
                .await
                .is_ok();
            pool.close().await;
            ok
        }
        Err(_) => false,
    }
}

pub async fn migrate_plaintext_to_sqlcipher(db_path: &Path, key: &[u8]) -> Result<(), AppError> {
    let backup = db_path.with_extension("db.plain-backup");
    std::fs::copy(db_path, &backup)
        .map_err(|e| AppError::Internal(format!("Backup vor SQLCipher-Migration: {e}")))?;

    let tmp = db_path.with_extension("db.enc-migrate-tmp");
    let _ = std::fs::remove_file(&tmp);

    let key_pragma = db_key::pragma_key_value(key);
    let plain_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let plain_opts = plain_connect_options(&plain_url)?;

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(plain_opts)
        .await
        .map_err(AppError::Database)?;

    let tmp_escaped = tmp.display().to_string().replace('\'', "''");
    let sql = format!(
        "ATTACH DATABASE '{tmp_escaped}' AS encrypted KEY {key_pragma}; \
         SELECT sqlcipher_export('encrypted'); \
         DETACH DATABASE encrypted;",
        key_pragma = key_pragma
    );
    sqlx::query(&sql)
        .execute(&pool)
        .await
        .map_err(AppError::Database)?;
    pool.close().await;

    std::fs::rename(&tmp, db_path)
        .map_err(|e| AppError::Internal(format!("SQLCipher-Migration rename: {e}")))?;
    Ok(())
}

pub async fn open_encrypted_pool(
    db_path: &Path,
    key: Zeroizing<Vec<u8>>,
    create_if_missing: bool,
) -> Result<SqlitePool, AppError> {
    let key_pragma = db_key::pragma_key_value(&key);
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(AppError::Database)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .create_if_missing(create_if_missing)
        .pragma("key", key_pragma);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(AppError::Database)?;

    sqlx::query("SELECT count(*) FROM sqlite_master")
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            AppError::Validation(
                "Datenbank konnte nicht mit SQLCipher geöffnet werden (Passphrase prüfen).".into(),
            )
        })?;

    Ok(pool)
}

pub async fn open_memory_pool(key: &[u8]) -> Result<SqlitePool, AppError> {
    let key_pragma = db_key::pragma_key_value(key);
    let options = SqliteConnectOptions::from_str("sqlite::memory:")
        .map_err(AppError::Database)?
        .pragma("key", key_pragma);
    SqlitePoolOptions::new()
        .max_connections(2)
        .connect_with(options)
        .await
        .map_err(AppError::Database)
}
