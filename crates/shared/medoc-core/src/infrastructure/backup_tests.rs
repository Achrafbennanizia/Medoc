use super::*;

#[test]
fn metadata_listing_reports_not_checked_instead_of_bad() {
    let dir = std::env::temp_dir().join(format!("medoc-backup-list-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = dir.join("medoc-20261122T100000Z.db");
    std::fs::write(&db, b"not really a database").unwrap();
    std::fs::write(sig_path(&db), "0000\n").unwrap(); // wrong signature
    std::env::set_var("MEDOC_BACKUP_DIR", &dir);

    let full = list().unwrap();
    let meta = list_metadata().unwrap();

    std::env::remove_var("MEDOC_BACKUP_DIR");
    let _ = std::fs::remove_dir_all(&dir);
    assert_eq!(full.len(), 1);
    assert_eq!(
        full[0].signature_ok,
        Some(false),
        "Ops listing must catch the bad signature"
    );
    assert_eq!(meta[0].size_bytes, 21);
    assert_eq!(
        meta[0].signature_ok, None,
        "About listing does not check, so it must not say bad"
    );
}
