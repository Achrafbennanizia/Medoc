use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::migration::import_patients;
use std::path::PathBuf;

fn temp_csv(bytes: &[u8]) -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "medoc-csv-import-{}-{}.csv",
        std::process::id(),
        uuid::Uuid::new_v4()
    ));
    std::fs::write(&path, bytes).expect("write csv");
    path
}

async fn pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

#[tokio::test]
async fn csv_import_latin1_quoted_semicolon() {
    let pool = pool().await;
    // Windows-1252: "Müller; Jr" quoted, ü = 0xFC
    let mut bytes = b"name;date_of_birth;sex;insurance_number\n\"".to_vec();
    bytes.extend_from_slice(b"M");
    bytes.push(0xFC);
    bytes.extend_from_slice(b"ller; Jr\";1990-01-15;M;INS-LATIN-1\n");
    let path = temp_csv(&bytes);
    let report = import_patients(&pool, &path, false).await.expect("import");
    assert_eq!(report.imported, 1, "{:?}", report.errors);
    let name: String =
        sqlx::query_scalar("SELECT name FROM patient WHERE insurance_number = 'INS-LATIN-1'")
            .fetch_one(&pool)
            .await
            .expect("row");
    assert!(name.contains(';'), "{name}");
    assert!(name.contains("ller"), "{name}");
}

#[tokio::test]
async fn csv_import_creates_chart_and_outbox() {
    let pool = pool().await;
    app_kv_repo::set(
        &pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Tester"}"#,
    )
    .await
    .expect("serverless");
    let path =
        temp_csv(b"name;date_of_birth;sex;insurance_number\nChart Pat;1991-02-02;M;INS-CHART-1\n");
    let report = import_patients(&pool, &path, false).await.expect("import");
    assert_eq!(report.imported, 1);
    let pid: String =
        sqlx::query_scalar("SELECT id FROM patient WHERE insurance_number = 'INS-CHART-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let status: String = sqlx::query_scalar("SELECT status FROM patient WHERE id = ?1")
        .bind(&pid)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "NEW");
    let charts: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM patient_chart WHERE patient_id = ?1")
            .bind(&pid)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(charts, 1);
    let outbox: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE entity_table = 'patient' AND entity_id = ?1",
    )
    .bind(&pid)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(outbox >= 1, "patient INSERT must be recorded");
}

#[tokio::test]
async fn csv_import_skips_duplicate_name_dob() {
    let pool = pool().await;
    let path = temp_csv(
        b"name;date_of_birth;sex;insurance_number\nDup Pat;1992-03-03;M;INS-A\n dup pat ;1992-03-03;W;INS-B\n",
    );
    let report = import_patients(&pool, &path, false).await.expect("import");
    assert_eq!(report.imported, 1);
    assert_eq!(report.skipped_duplicates, 1);
}

#[tokio::test]
async fn csv_import_missing_insurance_is_null() {
    let pool = pool().await;
    let path = temp_csv(b"name;date_of_birth;sex;insurance_number\nNo Vn;1993-04-04;M;\n");
    let report = import_patients(&pool, &path, false).await.expect("import");
    assert_eq!(report.imported, 1, "{:?}", report.errors);
    let is_null: i64 =
        sqlx::query_scalar("SELECT insurance_number IS NULL FROM patient WHERE name = 'No Vn'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(is_null, 1);
}
