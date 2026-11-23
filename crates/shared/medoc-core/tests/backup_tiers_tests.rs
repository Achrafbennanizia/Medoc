//! Tiered backup rotation and the compressed `.mdbk` format.

use std::path::PathBuf;
use std::sync::Mutex;

use chrono::{DateTime, Local, NaiveDate, TimeZone, Utc};
use medoc_core::infrastructure::backup::{self, BackupTier};
use medoc_core::infrastructure::database::connection;

static ENV_LOCK: Mutex<()> = Mutex::new(());

fn keys() -> std::sync::MutexGuard<'static, ()> {
    let g = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    std::env::set_var(
        "MEDOC_DB_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    std::env::set_var(
        "MEDOC_VENDOR_PUBKEY",
        "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
    );
    g
}

fn scratch(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("medoc-bk-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&d).unwrap();
    d
}

/// Noon UTC keeps the local calendar day the same in every time zone from UTC−11 to UTC+11.
fn at(y: i32, m: u32, d: u32) -> DateTime<Utc> {
    Utc.from_utc_datetime(
        &NaiveDate::from_ymd_opt(y, m, d)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap(),
    )
}

fn name(t: DateTime<Utc>) -> PathBuf {
    PathBuf::from(format!("medoc-{}.mdbk", t.format("%Y%m%dT%H%M%SZ")))
}

#[test]
fn keeps_three_days_last_week_and_last_half_year() {
    // Monday 23 Nov 2026.
    let now = Local
        .from_local_datetime(
            &NaiveDate::from_ymd_opt(2026, 11, 23)
                .unwrap()
                .and_hms_opt(14, 0, 0)
                .unwrap(),
        )
        .unwrap();
    let dates = [
        at(2026, 11, 23),
        at(2026, 11, 22),
        at(2026, 11, 21),
        at(2026, 11, 20),
        at(2026, 11, 19),
        at(2026, 6, 30),
        at(2026, 5, 1),
        at(2025, 12, 1),
    ];
    let files: Vec<_> = dates.iter().map(|t| (name(*t), *t)).collect();
    let kept = backup::classify(&files, now);

    let tiers = |t: DateTime<Utc>| kept.get(&name(t)).cloned().unwrap_or_default();
    assert_eq!(tiers(at(2026, 11, 23)), vec![BackupTier::Daily]);
    assert_eq!(tiers(at(2026, 11, 21)), vec![BackupTier::Daily]);
    // Sunday 22 Nov: a daily, and the last backup of the previous ISO week.
    assert!(tiers(at(2026, 11, 22)).contains(&BackupTier::Daily));
    assert!(tiers(at(2026, 11, 22)).contains(&BackupTier::Weekly));
    // 30 June: the last backup of the previous half-year.
    assert_eq!(tiers(at(2026, 6, 30)), vec![BackupTier::HalfYear]);
    for gone in [
        at(2026, 11, 20),
        at(2026, 11, 19),
        at(2026, 5, 1),
        at(2025, 12, 1),
    ] {
        assert!(!kept.contains_key(&name(gone)), "{gone} should rotate out");
    }
    assert_eq!(kept.len(), 4);
}

#[test]
fn a_new_practice_keeps_its_oldest_backup_until_the_tiers_fill() {
    let now = Local
        .from_local_datetime(
            &NaiveDate::from_ymd_opt(2026, 11, 26)
                .unwrap()
                .and_hms_opt(14, 0, 0)
                .unwrap(),
        )
        .unwrap();
    // Installed on Monday 23 Nov: no backup in the previous week or half-year yet.
    let dates = [
        at(2026, 11, 26),
        at(2026, 11, 25),
        at(2026, 11, 24),
        at(2026, 11, 23),
    ];
    let files: Vec<_> = dates.iter().map(|t| (name(*t), *t)).collect();
    let kept = backup::classify(&files, now);
    let first = kept
        .get(&name(at(2026, 11, 23)))
        .cloned()
        .unwrap_or_default();
    assert!(first.contains(&BackupTier::Weekly) && first.contains(&BackupTier::HalfYear));
    assert_eq!(kept.len(), 4);
}

#[test]
fn rotation_deletes_old_backups_with_their_sidecars() {
    let _g = keys();
    let dir = scratch("rotate");
    let now = Local
        .from_local_datetime(
            &NaiveDate::from_ymd_opt(2026, 11, 23)
                .unwrap()
                .and_hms_opt(14, 0, 0)
                .unwrap(),
        )
        .unwrap();
    for t in [
        at(2026, 11, 23),
        at(2026, 11, 22),
        at(2026, 11, 21),
        at(2026, 11, 20),
        at(2026, 6, 30),
        at(2026, 3, 3),
    ] {
        let p = dir.join(name(t));
        std::fs::write(&p, b"x").unwrap();
        std::fs::write(PathBuf::from(format!("{}.sig", p.display())), b"sig").unwrap();
        std::fs::write(
            PathBuf::from(format!("{}.db-key.wrap", p.display())),
            b"wrap",
        )
        .unwrap();
    }
    let report = backup::enforce_retention_at(&dir, now).unwrap();
    assert_eq!(report.kept, 4, "{report:?}");
    let left: Vec<String> = std::fs::read_dir(&dir)
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    assert!(
        !left
            .iter()
            .any(|f| f.starts_with("medoc-20261120") || f.starts_with("medoc-20260303")),
        "{left:?}"
    );
    assert_eq!(
        left.len(),
        4 * 3,
        "each kept backup keeps its two sidecars: {left:?}"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn compressed_backup_is_small_restores_and_refuses_tampering() {
    let _g = keys();
    std::env::set_var("MEDOC_DEV_SEED", "1");
    let dir = scratch("mdbk");
    let backups = dir.join("backups");
    std::env::set_var("MEDOC_BACKUP_DIR", &backups);
    let pool = connection::init_db_headless(&dir).await.expect("init");
    sqlx::query("INSERT INTO app_kv (key, value) VALUES ('bk-test', 'in-backup') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .execute(&pool)
        .await
        .unwrap();

    // Old format for comparison (encrypted pages do not compress).
    let legacy = backup::create(&pool).await.expect("legacy backup");
    let archive = backup::create_compressed(&pool, &dir)
        .await
        .expect("compressed backup");
    let (legacy_b, archive_b) = (
        std::fs::metadata(&legacy).unwrap().len(),
        std::fs::metadata(&archive).unwrap().len(),
    );
    println!(
        "legacy .db {legacy_b} B, compressed .mdbk {archive_b} B ({:.0} %)",
        archive_b as f64 * 100.0 / legacy_b as f64
    );
    assert!(
        archive_b * 3 < legacy_b,
        "compressed {archive_b} B should be under a third of {legacy_b} B"
    );
    // Never a plain SQLite file on disk.
    assert!(!std::fs::read(&archive)
        .unwrap()
        .starts_with(b"SQLite format 3"));

    // A changed byte breaks the signature: refused, live data untouched.
    let tampered = backups.join("medoc-20260101T120000Z.mdbk");
    let mut bytes = std::fs::read(&archive).unwrap();
    let mid = bytes.len() / 2;
    bytes[mid] ^= 0xff;
    std::fs::write(&tampered, &bytes).unwrap();
    std::fs::copy(
        format!("{}.sig", archive.display()),
        format!("{}.sig", tampered.display()),
    )
    .unwrap();
    assert!(backup::restore_from_backup(&pool, &dir, &tampered)
        .await
        .is_err());
    let _ = std::fs::remove_file(&tampered);

    sqlx::query("UPDATE app_kv SET value = 'after-backup' WHERE key = 'bk-test'")
        .execute(&pool)
        .await
        .unwrap();
    backup::restore_from_backup(&pool, &dir, &archive)
        .await
        .expect("restore");
    let reopened = connection::reopen_app_pool(&dir).await.expect("reopen");
    let v: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'bk-test'")
        .fetch_one(&reopened)
        .await
        .unwrap();
    assert_eq!(v, "in-backup");
    assert!(
        !dir.join("medoc-restore-unpacked.db").exists(),
        "working copy removed"
    );
    reopened.close().await;
    std::env::remove_var("MEDOC_DEV_SEED");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn delete_one_removes_a_backup_with_its_sidecars_and_keeps_the_last() {
    let _g = keys();
    let dir = scratch("delete");
    std::env::set_var("MEDOC_BACKUP_DIR", &dir);
    let (a, b) = (
        dir.join(name(at(2026, 11, 22))),
        dir.join(name(at(2026, 11, 23))),
    );
    for p in [&a, &b] {
        std::fs::write(p, b"x").unwrap();
        std::fs::write(format!("{}.sig", p.display()), b"sig").unwrap();
    }

    // Outside the backup folder: refused, file untouched.
    let outside = std::env::temp_dir().join(format!("medoc-outside-{}.mdbk", uuid::Uuid::new_v4()));
    std::fs::write(&outside, b"x").unwrap();
    let e = backup::delete_one(&outside).unwrap_err();
    assert_eq!(e.wire_code(), "error.backup.outside_folder");
    assert!(outside.exists());
    let _ = std::fs::remove_file(&outside);
    // A path that climbs out of the folder is refused too.
    let climb = dir.join("..").join(outside.file_name().unwrap());
    assert!(backup::delete_one(&climb).is_err());
    // Missing file.
    assert_eq!(
        backup::delete_one(&dir.join("medoc-20200101T000000Z.mdbk"))
            .unwrap_err()
            .wire_code(),
        "error.backup.file_not_found"
    );

    let deleted = backup::delete_one(&a).expect("delete");
    assert_eq!(deleted, a.file_name().unwrap().to_string_lossy());
    assert!(!a.exists() && !PathBuf::from(format!("{}.sig", a.display())).exists());
    // The last one stays.
    assert_eq!(
        backup::delete_one(&b).unwrap_err().wire_code(),
        "error.backup.keep_last"
    );
    assert!(b.exists());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn only_one_backup_operation_at_a_time() {
    let first = backup::begin_operation().expect("free");
    assert_eq!(
        backup::begin_operation().unwrap_err().wire_code(),
        "error.backup.busy"
    );
    drop(first);
    assert!(backup::begin_operation().is_ok());
}

#[tokio::test]
async fn an_archive_from_another_key_or_not_an_archive_gets_its_own_code() {
    let _g = keys();
    std::env::set_var("MEDOC_DEV_SEED", "0");
    let dir = scratch("codes");
    std::env::set_var("MEDOC_BACKUP_DIR", dir.join("backups"));
    let pool = connection::init_db_headless(&dir).await.expect("init");
    let archive = dir.join("a.mdbk");
    backup::write_compressed(&pool, &[7u8; 32], &archive)
        .await
        .expect("seal with a foreign key");
    let out = dir.join("out.db");
    let e = backup::unpack_to_encrypted_db(&archive, &[9u8; 32], &out)
        .await
        .unwrap_err();
    assert_eq!(e.wire_code(), "error.backup.decrypt_failed");
    std::fs::write(&archive, b"not a backup at all").unwrap();
    let e = backup::unpack_to_encrypted_db(&archive, &[9u8; 32], &out)
        .await
        .unwrap_err();
    assert_eq!(e.wire_code(), "error.backup.not_an_archive");
    // A read failure carries a log reference.
    let e = backup::unpack_to_encrypted_db(&dir.join("missing.mdbk"), &[9u8; 32], &out)
        .await
        .unwrap_err();
    assert!(
        e.wire_code().starts_with("error.backup.read_failed|ref="),
        "{}",
        e.wire_code()
    );
    pool.close().await;
    std::env::remove_var("MEDOC_DEV_SEED");
    let _ = std::fs::remove_dir_all(&dir);
}
