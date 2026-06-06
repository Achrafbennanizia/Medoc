use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use medoc_lib::infrastructure::retention::enforce;

fn touch(path: &PathBuf, age_secs: u64) {
    fs::write(path, "x").unwrap();
    let mtime = SystemTime::now() - Duration::from_secs(age_secs);
    let ft = filetime::FileTime::from_system_time(mtime);
    filetime::set_file_mtime(path, ft).unwrap();
}

#[test]
fn deletes_old_app_log_keeps_audit() {
    let tmp = std::env::temp_dir().join(format!("medoc-retention-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).unwrap();

    let old_app = tmp.join("app.log.2025-01-01");
    let fresh_app = tmp.join("app.log");
    let old_audit = tmp.join("audit.log.2010-01-01");
    let old_security = tmp.join("security.log.old");

    touch(&old_app, 60 * 24 * 3600); // 60 days — exceeds 30
    touch(&fresh_app, 3600); // 1h — fresh
    touch(&old_audit, 5000 * 24 * 3600); // 13 years — keep (no retention)
    touch(&old_security, 120 * 24 * 3600); // 120 days — exceeds 90

    let report = enforce(&tmp).unwrap();
    assert_eq!(report.scanned, 4);
    assert!(report.deleted.iter().any(|n| n.starts_with("app.log.2025")));
    assert!(report.deleted.iter().any(|n| n.starts_with("security")));
    assert!(!report.deleted.iter().any(|n| n.starts_with("audit")));
    assert!(fresh_app.exists());
    assert!(old_audit.exists());
    assert!(!old_app.exists());
    assert!(!old_security.exists());

    fs::remove_dir_all(&tmp).ok();
}
