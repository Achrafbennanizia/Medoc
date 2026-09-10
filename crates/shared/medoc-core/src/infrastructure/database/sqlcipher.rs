//! SQLCipher connect helpers + plaintext → encrypted migration.

use std::path::{Path, PathBuf};

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::str::FromStr;
use zeroize::Zeroizing;

use crate::error::AppError;
use crate::infrastructure::database::db_key;

/// Connect options for a legacy **unencrypted** `SQLite format 3` file via SQLCipher.
///
/// Stock plaintext DBs open without a key; `cipher_plaintext_header` is only for
/// SQLCipher files that intentionally expose a plaintext header.
fn plain_connect_options(db_path: &Path) -> Result<SqliteConnectOptions, AppError> {
    Ok(SqliteConnectOptions::new()
        .filename(db_path)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Delete)
        .create_if_missing(false))
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
///
/// Uses DELETE journal mode and a single connection so leftover `*-wal` / `*-shm`
/// from a previous live DB cannot poison the probe (common on Windows CI).
pub async fn opens_with_sqlcipher_key(db_path: &Path, key: &[u8]) -> bool {
    let key = Zeroizing::new(key.to_vec());
    let key_pragma = db_key::pragma_key_value(&key);
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Delete)
        .create_if_missing(false)
        .pragma("key", key_pragma);

    match SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
    {
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
        .map_err(|e| AppError::Internal(format!("Backup before SQLCipher migration: {e}")))?;

    // Short sibling name — `Path::with_extension("db.enc-…")` yields awkward multi-dot paths
    // that SQLCipher ATTACH has rejected with SQLITE_CANTOPEN on CI.
    let tmp = db_path
        .parent()
        .map(|p| p.join("medoc-migrate-enc.db"))
        .unwrap_or_else(|| PathBuf::from("medoc-migrate-enc.db"));
    let _ = std::fs::remove_file(&tmp);

    // Create the destination as a normal SQLCipher DB first (proves path + key work),
    // then overwrite it via sqlcipher_export from the plaintext source.
    {
        let enc = open_encrypted_pool(&tmp, Zeroizing::new(key.to_vec()), true).await?;
        enc.close().await;
    }

    let plain_opts = plain_connect_options(db_path)?;
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(plain_opts)
        .await
        .map_err(AppError::Database)?;

    // One connection + one statement each — sqlx::query cannot reliably run
    // ATTACH / sqlcipher_export / DETACH as a multi-statement prepare (sqlx 0.8).
    let mut conn = pool.acquire().await.map_err(AppError::Database)?;
    let tmp_escaped = tmp.to_string_lossy().replace('\\', "/").replace('\'', "''");
    // ATTACH KEY must match sqlx `.pragma("key", …)` / open_encrypted_pool formatting.
    let key_hex: String = key.iter().map(|b| format!("{b:02x}")).collect();
    sqlx::query(&format!(
        "ATTACH DATABASE '{tmp_escaped}' AS encrypted KEY \"x'{key_hex}'\""
    ))
    .execute(&mut *conn)
    .await
    .map_err(|e| AppError::Internal(format!("SQLCipher migrate ATTACH failed: {e}")))?;
    sqlx::query("SELECT sqlcipher_export('encrypted')")
        .execute(&mut *conn)
        .await
        .map_err(|e| {
            AppError::Internal(format!("SQLCipher migrate sqlcipher_export failed: {e}"))
        })?;
    sqlx::query("DETACH DATABASE encrypted")
        .execute(&mut *conn)
        .await
        .map_err(|e| AppError::Internal(format!("SQLCipher migrate DETACH failed: {e}")))?;
    drop(conn);
    pool.close().await;

    if !tmp.exists() {
        return Err(AppError::Internal(
            "SQLCipher migrate produced no encrypted temp file".into(),
        ));
    }

    // Windows: rename over an existing path often fails; prefer replace via remove+rename, then copy.
    if db_path.exists() {
        let _ = std::fs::remove_file(db_path);
    }
    if let Err(e) = std::fs::rename(&tmp, db_path) {
        std::fs::copy(&tmp, db_path).map_err(|copy_err| {
            AppError::Internal(format!(
                "SQLCipher migration replace failed (rename: {e}; copy: {copy_err})"
            ))
        })?;
        let _ = std::fs::remove_file(&tmp);
    }
    Ok(())
}

pub async fn open_encrypted_pool(
    db_path: &Path,
    key: Zeroizing<Vec<u8>>,
    create_if_missing: bool,
) -> Result<SqlitePool, AppError> {
    let key_pragma = db_key::pragma_key_value(&key);
    // Prefer `.filename(...)` over `sqlite:C:\...` URLs — Windows drive-letter
    // paths break URL parsing and fail intermittently under cargo test.
    let options = SqliteConnectOptions::new()
        .filename(db_path)
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
                "Could not open database with SQLCipher (check passphrase).".into(),
            )
        })?;

    Ok(pool)
}

/// Re-encrypt `medoc.db` from `old_key` to `new_key` (standalone connection; pool must be closed).
pub async fn rekey_database_file(
    db_path: &Path,
    old_key: &[u8],
    new_key: &[u8],
) -> Result<(), AppError> {
    let pool = open_encrypted_pool(db_path, Zeroizing::new(old_key.to_vec()), false).await?;
    let new_pragma = db_key::pragma_key_value(new_key);
    sqlx::query(&format!("PRAGMA rekey = {new_pragma}"))
        .execute(&pool)
        .await
        .map_err(AppError::Database)?;
    pool.close().await;
    Ok(())
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
