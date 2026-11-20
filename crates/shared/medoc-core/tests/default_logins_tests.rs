//! A real practice database never receives the demo logins (`password123`).

use medoc_core::infrastructure::database::connection;

#[tokio::test]
async fn a_fresh_practice_file_has_no_demo_logins() {
    std::env::remove_var("MEDOC_DEV_SEED");
    let dir = std::env::temp_dir().join(format!("medoc-no-demo-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("tmpdir");
    let pool = connection::init_db_headless(&dir).await.expect("init");
    let demo: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM staff WHERE id IN ('seed-physician-001', 'seed-rez-001')",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(demo, 0, "demo accounts must not exist in a practice file");

    // Emptying the staff table must not bring them back on the next launch.
    pool.close().await;
    let pool = connection::reopen_app_pool(&dir).await.expect("reopen");
    let demo: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staff")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(demo, 0);
}

#[tokio::test]
async fn an_in_memory_test_pool_still_gets_them() {
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    let demo: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM staff WHERE id = 'seed-physician-001'")
            .fetch_one(&pool)
            .await
            .expect("count");
    assert_eq!(demo, 1);
}
