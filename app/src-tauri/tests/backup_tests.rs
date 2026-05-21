//! Backup HMAC sidecars and GFS retention (TASK 2.6).

use chrono::{Duration, Utc};
use medoc_lib::infrastructure::backup::{
    enforce_retention_at, parse_backup_timestamp, sign_file,
};
use medoc_lib::infrastructure::database::audit_repo;
use std::path::PathBuf;
use std::sync::{Mutex, Once};

static INIT_AUDIT: Once = Once::new();
/// `MEDOC_BACKUP_DIR` is process-global; serialise backup integration tests.
static BACKUP_TEST_LOCK: Mutex<()> = Mutex::new(());

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
    let _lock = BACKUP_TEST_LOCK.lock().expect("backup test lock");
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

#[test]
fn backup_retention_keeps_daily_weekly_and_drops_ancient() {
    let _lock = BACKUP_TEST_LOCK.lock().expect("backup test lock");
    init_audit();
    let dir = temp_backup_dir("retention");
    let now = Utc::now();

    let fresh = dir.join(ts_name(now - Duration::days(5)));
    let week_anchor = now - Duration::weeks(8);
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
    assert!(!ancient.exists(), "backups older than 12 months must be removed");
    assert!(
        old_week_a.exists() ^ old_week_b.exists(),
        "weekly tier keeps one representative per ISO week"
    );

    std::fs::remove_dir_all(&dir).ok();
}
