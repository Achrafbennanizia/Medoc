//! Company server API key hashing + schema migration.

use medoc_lib::infrastructure::company_host::db::init_company_db;

const DEMO_KEY: &str = "sk_demo_company_practice_key";

#[tokio::test]
async fn demo_api_key_hashes_and_plaintext_column_removed() {
    let dir = std::env::temp_dir().join(format!("medoc-company-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("company.db");
    let pool = init_company_db(&db_path).await.expect("init company db");

    let hash: (String,) =
        sqlx::query_as("SELECT api_key_hash FROM practice WHERE slug = 'demo-praxis'")
            .fetch_one(&pool)
            .await
            .expect("demo row");
    assert!(hash.0.starts_with("$argon2"));
    assert!(medoc_lib::infrastructure::company_host::api_key::verify_api_key(DEMO_KEY, &hash.0));
    assert!(!medoc_lib::infrastructure::company_host::api_key::verify_api_key("wrong", &hash.0));

    let plain_col: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pragma_table_info('practice') WHERE name = 'api_key'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(plain_col.0, 0, "plaintext api_key column must be dropped");

    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn migrates_legacy_plaintext_api_key_column() {
    let dir = std::env::temp_dir().join(format!("medoc-company-migrate-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("company.db");

    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .connect(&db_url)
        .await
        .unwrap();
    sqlx::query(
        "CREATE TABLE practice (
            slug TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            api_key TEXT NOT NULL UNIQUE,
            plan_name TEXT NOT NULL
        )",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO practice (slug, display_name, api_key, plan_name)
         VALUES ('legacy', 'Legacy', 'sk_legacy_test_key', 'Pro')",
    )
    .execute(&pool)
    .await
    .unwrap();
    drop(pool);

    let pool = init_company_db(&db_path).await.expect("migrate on init");
    let hash: (String,) = sqlx::query_as("SELECT api_key_hash FROM practice WHERE slug = 'legacy'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(
        medoc_lib::infrastructure::company_host::api_key::verify_api_key(
            "sk_legacy_test_key",
            &hash.0
        )
    );

    let _ = std::fs::remove_dir_all(&dir);
}
