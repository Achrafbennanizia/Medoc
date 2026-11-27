//! Author / device / doctor columns (editions-plan.md §4.1) and the device on audit entries.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::audit as audit_repo;

async fn pool() -> sqlx::SqlitePool {
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    let dir = std::env::temp_dir().join("medoc-edition-columns-test-audit");
    let _ = std::fs::create_dir_all(&dir);
    audit_repo::init_audit_hmac_key(&dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    pool
}

async fn has_column(pool: &sqlx::SqlitePool, table: &str, column: &str) -> bool {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2")
        .bind(table)
        .bind(column)
        .fetch_one(pool)
        .await
        .unwrap()
        > 0
}

#[tokio::test]
async fn migrations_add_the_columns_and_are_repeatable() {
    let pool = pool().await;
    for (t, c) in [
        ("patient", "treating_staff_id"),
        ("treatment", "responsible_staff_id"),
        ("payment", "collected_by"),
        ("prescription", "signed_by_staff_id"),
        ("purchase_order", "paid_by_staff_id"),
        ("audit_log", "device_id"),
    ] {
        assert!(has_column(&pool, t, c).await, "{t}.{c}");
    }
    run_migrations(&pool).await.expect("second run is a no-op");
}

#[tokio::test]
async fn audit_entries_carry_the_device() {
    let pool = pool().await;
    sqlx::query(
        "INSERT OR REPLACE INTO app_kv (key, value) VALUES ('sync.device_id.v1', 'dev-42')",
    )
    .execute(&pool)
    .await
    .unwrap();
    audit_repo::create(&pool, "u1", "CREATE", "Patient", Some("p1"), None)
        .await
        .unwrap();
    let device: Option<String> =
        sqlx::query_scalar("SELECT device_id FROM audit_log WHERE entity_id = 'p1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(device.as_deref(), Some("dev-42"));
}
