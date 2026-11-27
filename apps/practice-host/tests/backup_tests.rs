//! Backup HMAC sidecars and GFS retention (TASK 2.6).

use chrono::{Datelike, Duration, Utc};
use medoc_lib::infrastructure::backup::{enforce_retention_at, parse_backup_timestamp, sign_file};
use medoc_lib::infrastructure::database::repos::admin::audit as audit_repo;
use std::path::PathBuf;
use std::sync::Once;
use tokio::sync::Mutex;

static INIT_AUDIT: Once = Once::new();
/// `MEDOC_BACKUP_DIR` is process-global; serialise backup integration tests.
static BACKUP_TEST_LOCK: Mutex<()> = Mutex::const_new(());

fn init_audit() {
    INIT_AUDIT.call_once(|| {
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        let base = std::env::temp_dir().join("medoc-backup-tests");
        std::fs::create_dir_all(&base).expect("tmpdir");
        audit_repo::init_audit_hmac_key(&base).expect("audit key");
    });
}

fn ts_name(dt: chrono::DateTime<Utc>) -> String {
    format!("medoc-{}.db", dt.format("%Y%m%dT%H%M%SZ"))
}

fn temp_backup_dir(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("medoc-backup-{}-{}", std::process::id(), label));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("mkdir");
    std::env::set_var("MEDOC_BACKUP_DIR", dir.to_string_lossy().as_ref());
    dir
}

#[test]
fn backup_hmac_sidecar_roundtrip_and_detects_tamper() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    let _lock = rt.block_on(BACKUP_TEST_LOCK.lock());
    init_audit();
    let dir = temp_backup_dir("hmac");
    let db = dir.join("medoc-20250519T120000Z.db");
    std::fs::write(&db, b"SQLite format 3\0fake").expect("write");

    sign_file(&db).expect("sign");
    let sig = std::fs::read_to_string(PathBuf::from(format!("{}.sig", db.display()))).unwrap();
    assert!(audit_repo::verify_file_hmac(&db, &sig).unwrap());

    std::fs::write(&db, b"tampered").expect("tamper");
    assert!(!audit_repo::verify_file_hmac(&db, &sig).unwrap());

    std::fs::remove_dir_all(&dir).ok();
}

/// G2: restoring a file snapshot replaces live `medoc.db` (pool must be reopened by the app).
#[tokio::test]
async fn restore_from_backup_replaces_live_db_file() {
    let _lock = BACKUP_TEST_LOCK.lock().await;
    init_audit();

    let dir = std::env::temp_dir().join(format!("medoc-restore-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    std::env::set_var(
        "MEDOC_DB_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let pool = medoc_lib::infrastructure::database::connection::init_db_headless(&dir)
        .await
        .expect("init db");
    sqlx::query("CREATE TABLE IF NOT EXISTS restore_marker (version TEXT NOT NULL)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO restore_marker (version) VALUES ('before')")
        .execute(&pool)
        .await
        .unwrap();

    let backup_dir = temp_backup_dir("restore-target");
    // Flush WAL so VACUUM INTO / file replace are not racing Windows locks.
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(&pool)
        .await;
    let backup_path = medoc_lib::infrastructure::backup::create(&pool)
        .await
        .expect("vacuum backup");

    sqlx::query("UPDATE restore_marker SET version = 'mutated'")
        .execute(&pool)
        .await
        .unwrap();
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(&pool)
        .await;

    medoc_lib::infrastructure::backup::restore_from_backup(&pool, &dir, &backup_path)
        .await
        .expect("restore");

    let pool2 = medoc_lib::infrastructure::database::connection::init_db_headless(&dir)
        .await
        .expect("reopen db");
    let row: (String,) = sqlx::query_as("SELECT version FROM restore_marker")
        .fetch_one(&pool2)
        .await
        .expect("read marker");
    assert_eq!(row.0, "before");

    pool2.close().await;
    std::fs::remove_dir_all(&dir).ok();
    let _ = backup_dir;
}

/// G2b: `VACUUM INTO` from SQLCipher must not be treated as plaintext-only (same file header).
#[tokio::test]
async fn vacuum_backup_from_encrypted_db_opens_with_sqlcipher_key() {
    let _lock = BACKUP_TEST_LOCK.lock().await;
    init_audit();

    let dir = std::env::temp_dir().join(format!("medoc-backup-open-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    std::env::set_var(
        "MEDOC_DB_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let _backup_dir = temp_backup_dir("encrypted-open");
    let pool = medoc_lib::infrastructure::database::connection::init_db_headless(&dir)
        .await
        .expect("init db");
    let backup_path = medoc_lib::infrastructure::backup::create(&pool)
        .await
        .expect("vacuum backup");
    pool.close().await;

    let key =
        medoc_lib::infrastructure::database::db_key::env_override_key().expect("MEDOC_DB_KEY");
    assert!(
        medoc_lib::infrastructure::database::sqlcipher::opens_with_sqlcipher_key(
            &backup_path,
            &key
        )
        .await,
        "backup snapshot must open with the live DB key"
    );

    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn backup_retention_keeps_daily_weekly_and_half_year_tiers() {
    // Policy (infrastructure::backup module comment): newest backup of each of the last 3 days
    // that have one,
    // last backup of the previous ISO week, last backup of the previous half-year; the rest goes.
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    let _lock = rt.block_on(BACKUP_TEST_LOCK.lock());
    init_audit();
    let dir = temp_backup_dir("retention");
    // Fixed "now" (Wednesday 17 June 2026, noon) so the ISO week and half-year are known.
    let at = |y, m, d| {
        chrono::NaiveDate::from_ymd_opt(y, m, d)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap()
            .and_utc()
    };
    let now = at(2026, 6, 17);
    assert_eq!(now.weekday(), chrono::Weekday::Wed);

    let today = dir.join(ts_name(at(2026, 6, 17) - Duration::hours(4)));
    let yesterday = dir.join(ts_name(at(2026, 6, 16)));
    let two_days_ago = dir.join(ts_name(at(2026, 6, 15)));
    let prev_week_early = dir.join(ts_name(at(2026, 6, 9)));
    let prev_week_last = dir.join(ts_name(at(2026, 6, 13)));
    let prev_half_early = dir.join(ts_name(at(2025, 9, 1)));
    let prev_half_last = dir.join(ts_name(at(2025, 11, 20)));
    let ancient = dir.join(ts_name(at(2024, 1, 1)));
    let all = [
        &today,
        &yesterday,
        &two_days_ago,
        &prev_week_early,
        &prev_week_last,
        &prev_half_early,
        &prev_half_last,
        &ancient,
    ];
    for p in all {
        std::fs::write(p, b"x").expect("touch file");
        assert!(
            parse_backup_timestamp(p).is_some(),
            "parseable: {}",
            p.display()
        );
    }

    enforce_retention_at(&dir, now.with_timezone(&chrono::Local)).expect("retention");

    for p in [&today, &yesterday, &two_days_ago] {
        assert!(
            p.exists(),
            "daily tier keeps the last 3 days: {}",
            p.display()
        );
    }
    assert!(
        prev_week_last.exists(),
        "weekly tier keeps the last backup of the previous ISO week"
    );
    assert!(
        !prev_week_early.exists(),
        "only one backup per previous week"
    );
    assert!(
        prev_half_last.exists(),
        "half-year tier keeps the last backup of the previous half-year"
    );
    assert!(
        !prev_half_early.exists(),
        "only one backup per previous half-year"
    );
    assert!(!ancient.exists(), "older backups are removed");

    std::fs::remove_dir_all(&dir).ok();
}
