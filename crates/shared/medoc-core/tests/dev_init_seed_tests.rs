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
