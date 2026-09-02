//! Regression: `MEDOC_DEV_SEED=1` first init must not trip staff-quota triggers.

use medoc_core::infrastructure::database::connection;

#[tokio::test]
async fn dev_seed_fresh_init_succeeds() {
    let dir = std::env::temp_dir().join(format!("medoc-dev-init-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("tmpdir");
    std::env::set_var("MEDOC_DEV_SEED", "1");
    connection::init_db_headless(&dir)
        .await
        .expect("init_db_headless with MEDOC_DEV_SEED");
    std::env::remove_var("MEDOC_DEV_SEED");
}

#[tokio::test]
async fn corrupt_db_file_recreates_fresh_database() {
    let dir = std::env::temp_dir().join(format!("medoc-corrupt-db-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("tmpdir");
    let db_path = dir.join("medoc.db");
    std::fs::write(&db_path, b"not a real sqlite file").expect("write fake db");

    connection::init_db_headless(&dir)
        .await
        .expect("corrupted medoc.db should be recreated");

    assert!(db_path.exists(), "fresh database file was created");
}
