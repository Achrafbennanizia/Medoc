//! Backup HMAC sidecars and GFS retention (TASK 2.6).

use chrono::{Datelike, Duration, Utc};
use medoc_lib::infrastructure::backup::{enforce_retention_at, parse_backup_timestamp, sign_file};
use medoc_lib::infrastructure::database::audit_repo;
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
    sqlx::query("CREATE TABLE IF NOT EXISTS restore_marker (v TEXT NOT NULL)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO restore_marker (v) VALUES ('before')")
        .execute(&pool)
        .await
        .unwrap();

    let backup_dir = temp_backup_dir("restore-target");
    let backup_path = medoc_lib::infrastructure::backup::create(&pool)
        .await
        .expect("vacuum backup");

    sqlx::query("UPDATE restore_marker SET v = 'mutated'")
        .execute(&pool)
        .await
        .unwrap();

    // `MEDOC_DB_KEY` is process-global and may be overridden by parallel tests;
    // re-assert it immediately before restore/reopen to avoid key drift flakes.
    std::env::set_var(
        "MEDOC_DB_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    medoc_lib::infrastructure::backup::restore_from_backup(&pool, &dir, &backup_path)
        .await
        .expect("restore");

    std::env::set_var(
        "MEDOC_DB_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    let pool2 = medoc_lib::infrastructure::database::connection::init_db_headless(&dir)
        .await
        .expect("reopen db");
    let row: (String,) = sqlx::query_as("SELECT v FROM restore_marker")
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
fn backup_retention_keeps_daily_weekly_and_drops_ancient() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    let _lock = rt.block_on(BACKUP_TEST_LOCK.lock());
    init_audit();
    let dir = temp_backup_dir("retention");
    let now = Utc::now();

    let fresh = dir.join(ts_name(now - Duration::days(5)));
    // Pin the weekly anchor to Wednesday of its ISO week so the anchor and the
    // anchor-minus-one-day both land in the same ISO week regardless of which
    // day-of-week `now` falls on. (Previously `now` on Mon/Sun shifted the pair
    // across an ISO-week boundary and broke the XOR assertion below.)
    let week_anchor_raw = now - Duration::weeks(8);
    let weekday_iso = week_anchor_raw.weekday().number_from_monday() as i64;
    let week_anchor = week_anchor_raw + Duration::days(3 - weekday_iso);
    let old_week_a = dir.join(ts_name(week_anchor - Duration::days(1)));
    let old_week_b = dir.join(ts_name(week_anchor));
    let monthly = dir.join(ts_name(now - Duration::days(200)));
    let ancient = dir.join(ts_name(now - Duration::days(400)));

    for p in [&fresh, &old_week_a, &old_week_b, &monthly, &ancient] {
        std::fs::write(p, b"x").expect("touch file");
        assert!(
            parse_backup_timestamp(p).is_some(),
            "parseable backup name: {}",
            p.display()
        );
    }

    let daily_cutoff = now - Duration::days(30);
    let ts = parse_backup_timestamp(&fresh).unwrap();
    assert!(
        ts >= daily_cutoff,
        "fresh ts {ts} should be >= daily cutoff {daily_cutoff}"
    );

    enforce_retention_at(&dir, now).expect("retention");

    assert!(fresh.exists(), "daily window keeps 5-day backup");
    assert!(monthly.exists(), "monthly tier keeps ~200d backup");
    assert!(
        !ancient.exists(),
        "backups older than 12 months must be removed"
    );
    assert!(
        old_week_a.exists() ^ old_week_b.exists(),
        "weekly tier keeps one representative per ISO week"
    );

    std::fs::remove_dir_all(&dir).ok();
}
