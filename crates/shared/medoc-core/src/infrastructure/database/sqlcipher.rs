//! SQLCipher connect helpers + plaintext → encrypted migration.

use std::path::{Path, PathBuf};
use std::time::Duration;

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
    // Never replace the original before the encrypted copy is proven readable.
    if !opens_with_sqlcipher_key(&tmp, key).await {
        let _ = std::fs::remove_file(&tmp);
        return Err(AppError::Internal(
            "SQLCipher migrate: encrypted copy does not open with the key".into(),
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
    // Keep the plaintext backup until the swapped file is verified; restore
    // it if the final file does not open.
    if !opens_with_sqlcipher_key(db_path, key).await {
        let _ = std::fs::copy(&backup, db_path);
        return Err(AppError::Internal(
            "SQLCipher migrate: final database does not open; original restored".into(),
        ));
    }
    // The backup is an unencrypted copy of patient data: overwrite, then delete.
    if let Ok(meta) = std::fs::metadata(&backup) {
        let _ = std::fs::write(&backup, vec![0u8; meta.len() as usize]);
    }
    let _ = std::fs::remove_file(&backup);
    Ok(())
}

pub async fn open_encrypted_pool(
    db_path: &Path,
    key: Zeroizing<Vec<u8>>,
    create_if_missing: bool,
) -> Result<SqlitePool, AppError> {
    // Prefer `.filename(...)` over `sqlite:C:\...` URLs — Windows drive-letter
    // paths break URL parsing and fail intermittently under cargo test.
    open_encrypted_pool_limited(
        db_path,
        key,
        create_if_missing,
        POOL_MAX_CONNECTIONS,
        POOL_ACQUIRE_TIMEOUT,
    )
    .await
}

const POOL_MAX_CONNECTIONS: u32 = 10;
const POOL_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(10);

async fn open_encrypted_pool_limited(
    db_path: &Path,
    key: Zeroizing<Vec<u8>>,
    create_if_missing: bool,
    max_connections: u32,
    acquire_timeout: Duration,
) -> Result<SqlitePool, AppError> {
    let key_pragma = db_key::pragma_key_value(&key);
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(8))
        .create_if_missing(create_if_missing)
        .pragma("key", key_pragma);

    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .acquire_timeout(acquire_timeout)
        .after_connect(|conn, _| {
            Box::pin(async move {
                // The key pragma has already run. Set the busy wait here so a
                // practice-sync write does not fail with SQLITE_BUSY (code 5)
                // while startup or another command still holds the file.
                sqlx::query("PRAGMA busy_timeout = 20000")
                    .execute(&mut *conn)
                    .await?;
                sqlx::query("PRAGMA journal_mode = WAL")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
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
    // One connection only: `PRAGMA rekey` re-encrypts through the connection
    // it runs on; other pooled connections would keep the old key. Rollback
    // journal mode: opening checkpoints any WAL into the main file first, and
    // rekey must not run against a live WAL.
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .busy_timeout(Duration::from_secs(8))
        .create_if_missing(false)
        .pragma("key", db_key::pragma_key_value(old_key));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(AppError::Database)?;
    let mut conn = pool.acquire().await.map_err(AppError::Database)?;
    sqlx::query("SELECT count(*) FROM sqlite_master")
        .fetch_one(&mut *conn)
        .await
        .map_err(|_| AppError::Validation("rekey: old key does not open the database".into()))?;
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    sqlx::query("PRAGMA journal_mode = DELETE")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    let new_pragma = db_key::pragma_key_value(new_key);
    sqlx::query(&format!("PRAGMA rekey = {new_pragma}"))
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    drop(conn);
    pool.close().await;

    // Verify before callers store the new key anywhere.
    if !opens_with_sqlcipher_key(db_path, new_key).await {
        return Err(AppError::Internal(
            "rekey: database does not open with the new key".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[tokio::test]
    async fn extra_connection_stops_at_the_acquire_timeout() {
        assert_eq!(POOL_MAX_CONNECTIONS, 10);
        assert_eq!(POOL_ACQUIRE_TIMEOUT, Duration::from_secs(10));
        let dir = std::env::temp_dir().join(format!(
            "medoc-pool-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("medoc.db");
        let key = Zeroizing::new(vec![0x11; 32]);
        let pool = open_encrypted_pool_limited(&path, key, true, 1, Duration::from_millis(200))
            .await
            .expect("open");
        let held = pool.acquire().await.expect("first connection");
        let started = Instant::now();
        let err = pool.acquire().await.expect_err("second connection waits");
        let waited = started.elapsed();
        drop(held);
        pool.close().await;
        let _ = std::fs::remove_dir_all(&dir);
        assert!(
            waited >= Duration::from_millis(150) && waited < Duration::from_secs(2),
            "waited {waited:?}, error {err}"
        );
        assert!(
            err.to_string().to_lowercase().contains("timed out"),
            "{err}"
        );
    }
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
