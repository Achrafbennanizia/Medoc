//! SQLCipher at-rest: encrypted DB requires correct key.

use medoc_lib::infrastructure::database::connection::init_db_headless;
use medoc_lib::infrastructure::database::connection::test_memory_pool;
use medoc_lib::infrastructure::database::db_key;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;

const HEX_KEY: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

fn hex_key_bytes() -> Vec<u8> {
    let mut out = Vec::with_capacity(32);
    for i in (0..64).step_by(2) {
        out.push(u8::from_str_radix(&HEX_KEY[i..i + 2], 16).expect("HEX_KEY"));
    }
    out
}

#[tokio::test]
async fn encrypted_file_db_requires_correct_key() {
    let dir = std::env::temp_dir().join(format!("medoc-sqlcipher-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    std::env::set_var("MEDOC_DB_KEY", HEX_KEY);

    let pool = init_db_headless(&dir).await.expect("init encrypted db");
    sqlx::query("CREATE TABLE IF NOT EXISTS cipher_probe (id INTEGER PRIMARY KEY)")
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;

    let db_path = dir.join("medoc.db");
    // Use fixed bytes — parallel tests may clear `MEDOC_DB_KEY` between init and reopen.
    let correct = db_key::pragma_key_value(&hex_key_bytes());
    let url = format!("sqlite:{}?mode=ro", db_path.display());
    let good_opts = SqliteConnectOptions::from_str(&url)
        .expect("url")
        .pragma("key", correct);
    let good_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(good_opts)
        .await
        .expect("open with correct key");
    sqlx::query("SELECT 1")
        .fetch_one(&good_pool)
        .await
        .expect("read with correct key");
    good_pool.close().await;

    let wrong = db_key::pragma_key_value(&[0u8; 32]);
    let bad_opts = SqliteConnectOptions::from_str(&url)
        .expect("url")
        .pragma("key", wrong);
    if let Ok(bad_pool) = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(bad_opts)
        .await
    {
        let q = sqlx::query("SELECT name FROM sqlite_master WHERE type='table'")
            .fetch_all(&bad_pool)
            .await;
        assert!(q.is_err(), "wrong key must not read encrypted db schema");
        bad_pool.close().await;
    }

    let no_key_opts = SqliteConnectOptions::from_str(&url).expect("url");
    let no_key = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(no_key_opts)
        .await;
    match no_key {
        Err(_) => {}
        Ok(pool) => {
            let q = sqlx::query("SELECT name FROM sqlite_master WHERE type='table'")
                .fetch_all(&pool)
                .await;
            assert!(
                q.is_err() || q.as_ref().is_ok_and(|rows| rows.is_empty()),
                "opening encrypted db without PRAGMA key must not expose schema"
            );
            pool.close().await;
        }
    }

    std::env::remove_var("MEDOC_DB_KEY");
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn memory_pool_uses_sqlcipher_pragma() {
    let pool = test_memory_pool().await.expect("memory pool");
    let ver: (String,) = sqlx::query_as("PRAGMA cipher_version")
        .fetch_one(&pool)
        .await
        .expect("cipher_version");
    assert!(!ver.0.is_empty(), "SQLCipher must be active: {:?}", ver.0);
}

#[tokio::test]
async fn migrate_plaintext_file_to_sqlcipher() {
    let dir = std::env::temp_dir().join(format!("medoc-plain-mig-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("medoc.db");
    let status = std::process::Command::new("sqlite3")
        .arg(&db_path)
        .arg("CREATE TABLE plain_probe (id INTEGER PRIMARY KEY); INSERT INTO plain_probe VALUES (1);")
        .status()
        .expect("sqlite3 CLI");
    assert!(status.success(), "sqlite3 must be available for migration test");
    assert!(medoc_lib::infrastructure::database::sqlcipher::is_plaintext_sqlite_file(
        &db_path
    ));

    std::env::set_var("MEDOC_DB_KEY", HEX_KEY);
    let key = db_key::env_override_key().expect("MEDOC_DB_KEY");
    medoc_lib::infrastructure::database::sqlcipher::migrate_plaintext_to_sqlcipher(
        &db_path, &key,
    )
    .await
    .expect("migrate plaintext → SQLCipher");

    assert!(!medoc_lib::infrastructure::database::sqlcipher::is_plaintext_sqlite_file(
        &db_path
    ));
    let pool = init_db_headless(&dir).await.expect("open migrated db");
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM plain_probe")
        .fetch_one(&pool)
        .await
        .expect("read after migration");
    assert_eq!(count.0, 1);
    pool.close().await;

    std::env::remove_var("MEDOC_DB_KEY");
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn provision_wrap_and_unlock_roundtrip() {
    let dir = std::env::temp_dir().join(format!("medoc-dbkey-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    db_key::provision_user_passphrase(&dir, "test-passphrase-12chars").expect("provision");
    assert!(db_key::wrap_path(&dir).exists());
    let unlocked = db_key::unlock_with_passphrase(&dir, "test-passphrase-12chars").expect("unlock");
    assert_eq!(unlocked.len(), 32);
    let _ = std::fs::remove_dir_all(&dir);
}
