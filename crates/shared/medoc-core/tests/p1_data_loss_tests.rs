//! P1 data-loss stops: a wrong key, a rekey, a failed migration, a restore,
//! and a staff delete each leave the original rows in place.

use std::sync::Mutex;

use medoc_core::infrastructure::backup;
use medoc_core::infrastructure::database::connection;
use medoc_core::infrastructure::database::migrations::run_english_schema_upgrade;
use medoc_core::infrastructure::database::repos::admin::audit as audit_repo;
use medoc_core::infrastructure::database::repos::admin::staff as staff_repo;
use medoc_core::infrastructure::database::sqlcipher;
use sqlx::SqlitePool;
use zeroize::Zeroizing;

const RIGHT_KEY_HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const WRONG_KEY_HEX: &str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

fn right_key() -> [u8; 32] {
    hex_key(RIGHT_KEY_HEX)
}

fn hex_key(hex: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).unwrap();
    }
    out
}

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("medoc-p1-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("scratch dir");
    dir
}

fn lock_keys() -> std::sync::MutexGuard<'static, ()> {
    static LOCK: Mutex<()> = Mutex::new(());
    let guard = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    std::env::set_var("MEDOC_DB_KEY", RIGHT_KEY_HEX);
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    std::env::set_var(
        "MEDOC_VENDOR_PUBKEY",
        "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
    );
    guard
}

async fn marker_value(pool: &SqlitePool) -> String {
    sqlx::query_scalar("SELECT v FROM p1_marker")
        .fetch_one(pool)
        .await
        .expect("marker row")
}

async fn write_marker(pool: &SqlitePool, value: &str) {
    sqlx::query("CREATE TABLE IF NOT EXISTS p1_marker (v TEXT NOT NULL)")
        .execute(pool)
        .await
        .expect("create marker");
    sqlx::query("DELETE FROM p1_marker")
        .execute(pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO p1_marker (v) VALUES (?1)")
        .bind(value)
        .execute(pool)
        .await
        .unwrap();
}

#[tokio::test]
async fn wrong_key_leaves_the_database_file_and_its_rows() {
    let _guard = lock_keys();
    let dir = scratch("wrong-key");
    let db_path = dir.join("medoc.db");
    let key = Zeroizing::new(right_key().to_vec());
    let pool = sqlcipher::open_encrypted_pool(&db_path, key, true)
        .await
        .expect("create encrypted db");
    write_marker(&pool, "keep-me").await;
    pool.close().await;

    std::env::set_var("MEDOC_DB_KEY", WRONG_KEY_HEX);
    let opened = connection::open_pool_with_migrations(&dir).await;
    assert!(
        opened.is_err(),
        "a wrong key must not open the practice database"
    );
    assert!(db_path.exists(), "a wrong key must not quarantine medoc.db");

    let pool =
        sqlcipher::open_encrypted_pool(&db_path, Zeroizing::new(right_key().to_vec()), false)
            .await
            .expect("original key still opens the file");
    assert_eq!(marker_value(&pool).await, "keep-me");
    pool.close().await;
    std::env::set_var("MEDOC_DB_KEY", RIGHT_KEY_HEX);
}

#[tokio::test]
async fn activation_rekey_keeps_existing_rows() {
    let _guard = lock_keys();
    let dir = scratch("rekey");
    let db_path = dir.join("medoc.db");
    let old = right_key();
    let new = hex_key(WRONG_KEY_HEX);
    let pool = sqlcipher::open_encrypted_pool(&db_path, Zeroizing::new(old.to_vec()), true)
        .await
        .expect("create");
    write_marker(&pool, "before-activation").await;
    pool.close().await;

    sqlcipher::rekey_database_file(&db_path, &old, &new)
        .await
        .expect("activation rekey");
    assert!(db_path.exists(), "rekey must not delete medoc.db");
    assert!(
        !sqlcipher::opens_with_sqlcipher_key(&db_path, &old).await,
        "the old key must stop working"
    );
    let pool = sqlcipher::open_encrypted_pool(&db_path, Zeroizing::new(new.to_vec()), false)
        .await
        .expect("new key opens the same file");
    assert_eq!(marker_value(&pool).await, "before-activation");
    pool.close().await;
}

#[tokio::test]
async fn plaintext_backup_is_removed_after_encryption() {
    let _guard = lock_keys();
    let dir = scratch("plain");
    let db_path = dir.join("medoc.db");
    let opts = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .expect("plaintext db");
    write_marker(&pool, "plain-row").await;
    pool.close().await;

    sqlcipher::migrate_plaintext_to_sqlcipher(&db_path, &right_key())
        .await
        .expect("encrypt");
    let backup = db_path.with_extension("db.plain-backup");
    assert!(
        !backup.exists(),
        "plaintext sibling must be deleted after encryption"
    );
    let pool =
        sqlcipher::open_encrypted_pool(&db_path, Zeroizing::new(right_key().to_vec()), false)
            .await
            .expect("encrypted file opens");
    assert_eq!(marker_value(&pool).await, "plain-row");
    pool.close().await;
}

#[tokio::test]
async fn validate_open_accepts_only_the_practice_key() {
    let _guard = lock_keys();
    let dir = scratch("validate");
    let db_path = dir.join("medoc.db");
    let pool = sqlcipher::open_encrypted_pool(&db_path, Zeroizing::new(right_key().to_vec()), true)
        .await
        .unwrap();
    write_marker(&pool, "sealed").await;
    pool.close().await;

    assert!(backup::validate_open(&db_path, &right_key()).await.unwrap());
    assert!(!backup::validate_open(&db_path, &hex_key(WRONG_KEY_HEX))
        .await
        .unwrap());
}

#[tokio::test]
async fn failed_migration_leaves_existing_rows_and_foreign_keys_on() {
    let _guard = lock_keys();
    std::env::set_var("MEDOC_DEV_SEED", "1");
    let dir = scratch("fk");
    let pool = connection::init_db_headless(&dir).await.expect("init");
    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staff")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(before > 0, "seed staff");

    let mut conn = pool.acquire().await.unwrap();
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO sick_leave_certificate
            (id, staff_id, document_ref, date_from, created_by, created_at)
         VALUES ('orphan-leave', 'no-such-staff', 'doc', '2026-01-01', 'no-such-staff', '2026-01-01')",
    )
    .execute(&mut *conn)
    .await
    .expect("orphan insert while foreign keys are off");
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *conn)
        .await
        .unwrap();
    drop(conn);

    let err = run_english_schema_upgrade(&pool)
        .await
        .expect_err("foreign_key_check must fail while the orphan row exists");
    assert!(
        err.to_string().contains("foreign_key_check"),
        "unexpected error: {err}"
    );
    let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staff")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(before, after, "a failed migration must keep the staff rows");
    let fk: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(fk, 1, "foreign keys stay on after the failed check");
    pool.close().await;
    std::env::remove_var("MEDOC_DEV_SEED");
}

#[tokio::test]
async fn restore_reopen_in_process_keeps_the_backup_rows() {
    let _guard = lock_keys();
    let dir = scratch("restore");
    let backups = dir.join("backups");
    std::env::set_var("MEDOC_BACKUP_DIR", &backups);
    let pool = connection::init_db_headless(&dir).await.expect("init");
    sqlx::query(
        "INSERT INTO app_kv (key, value) VALUES ('p1-restore', 'from-backup')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .execute(&pool)
    .await
    .unwrap();
    let snapshot = backup::create(&pool).await.expect("backup");

    sqlx::query("UPDATE app_kv SET value = 'live-edit' WHERE key = 'p1-restore'")
        .execute(&pool)
        .await
        .unwrap();
    backup::restore_from_backup(&pool, &dir, &snapshot)
        .await
        .expect("restore");
    let reopened = connection::reopen_app_pool(&dir).await.expect("reopen");
    let value: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'p1-restore'")
        .fetch_one(&reopened)
        .await
        .expect("restored row");
    assert_eq!(value, "from-backup");
    reopened.close().await;
}

#[tokio::test]
async fn staff_delete_keeps_another_staff_members_sick_leave() {
    let _guard = lock_keys();
    std::env::set_var("MEDOC_DEV_SEED", "1");
    let dir = scratch("staff");
    let pool = connection::init_db_headless(&dir).await.expect("init");
    let subject: String = sqlx::query_scalar("SELECT id FROM staff ORDER BY id LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("seed staff");
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota triggers");
    let removed = "p1-reception-author";
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES (?1, 'P1 Reception', 'p1-reception@practice.test', 'hash', 'RECEPTION')",
    )
    .bind(removed)
    .execute(&pool)
    .await
    .expect("reception author");

    sqlx::query(
        "INSERT INTO sick_leave_certificate
            (id, staff_id, document_ref, date_from, created_by, created_at)
         VALUES ('keep-leave', ?1, 'doc', '2026-01-01', ?2, '2026-01-01')",
    )
    .bind(&subject)
    .bind(&removed)
    .execute(&pool)
    .await
    .expect("sick leave for the other staff member");

    staff_repo::delete(&pool, &removed)
        .await
        .expect("delete the author");
    let kept: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sick_leave_certificate WHERE id = 'keep-leave'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        kept, 1,
        "sick leave owned by another staff member must stay"
    );
    pool.close().await;
    std::env::remove_var("MEDOC_DEV_SEED");
}

#[tokio::test]
async fn audit_repair_archives_the_tail_instead_of_dropping_it() {
    let _guard = lock_keys();
    let dir = scratch("audit");
    let pool = connection::init_db_headless(&dir).await.expect("init");
    sqlx::query(
        "INSERT INTO audit_log (id, user_id, action, entity, hmac)
         VALUES ('p1-keep', 'user', 'READ', 'patient', 'aa'),
                ('p1-tail', 'user', 'READ', 'patient', 'bb')",
    )
    .execute(&pool)
    .await
    .unwrap();
    let moved = audit_repo::truncate_audit_chain_from(&pool, "p1-tail")
        .await
        .expect("archive");
    assert!(moved >= 1);
    let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_log WHERE id = 'p1-keep'")
        .fetch_one(&pool)
        .await
        .unwrap();
    let archived: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM audit_log_archive WHERE id = 'p1-tail'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(kept, 1);
    assert_eq!(archived, 1);
    pool.close().await;
}
