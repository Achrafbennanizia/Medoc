//! FA-AKTE-14/15 — validation queue list/count/validate + forward enqueue.

use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::chart_repo;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn seed_patient_with_chart(pool: &sqlx::SqlitePool, patient_id: &str, status: &str) -> String {
    let insurance_number = format!("V-QUEUE-{patient_id}");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Queue Pat', '1990-01-01', 'MALE', ?2)",
    )
    .bind(patient_id)
    .bind(&insurance_number)
    .execute(pool)
    .await
    .expect("patient");
    let chart_id = format!("{patient_id}-chart");
    sqlx::query(
        "INSERT INTO patient_chart (id, patient_id, status) VALUES (?1, ?2, ?3)",
    )
    .bind(&chart_id)
    .bind(patient_id)
    .bind(status)
    .execute(pool)
    .await
    .expect("chart");
    chart_id
}

#[tokio::test]
async fn list_and_count_pending_validation_queue() {
    let pool = migrated_pool().await;
    seed_patient_with_chart(&pool, "q-pat-draft", "DRAFT").await;
    seed_patient_with_chart(&pool, "q-pat-bearb", "IN_PROGRESS").await;
    seed_patient_with_chart(&pool, "q-pat-done", "VALIDATED").await;

    let rows = chart_repo::list_charts_to_validate(&pool).await.expect("list");
    assert_eq!(rows.len(), 2, "DRAFT + IN_PROGRESS only");
    let ids: Vec<_> = rows.iter().map(|r| r.patient_id.as_str()).collect();
    assert!(ids.contains(&"q-pat-draft"));
    assert!(ids.contains(&"q-pat-bearb"));
    assert!(!ids.contains(&"q-pat-done"));

    let count = chart_repo::count_charts_to_validate(&pool)
        .await
        .expect("count");
    assert_eq!(count, 2);
    for row in &rows {
        assert!(!row.updated_at.is_empty(), "updated_at serialized for IPC");
    }
}

#[tokio::test]
async fn validate_patient_chart_sets_validated_and_leaves_queue() {
    let pool = migrated_pool().await;
    seed_patient_with_chart(&pool, "q-pat-validate", "DRAFT").await;

    let updated = chart_repo::validate_patient_chart_status(&pool, "q-pat-validate")
        .await
        .expect("validate");
    assert_eq!(updated.status, "VALIDATED");

    let count = chart_repo::count_charts_to_validate(&pool)
        .await
        .expect("count after validate");
    assert_eq!(count, 0);
}

#[tokio::test]
async fn forward_marks_validated_chart_in_processing_for_queue() {
    let pool = migrated_pool().await;
    seed_patient_with_chart(&pool, "q-pat-forward", "VALIDATED").await;

    let before = chart_repo::count_charts_to_validate(&pool)
        .await
        .expect("count before");
    assert_eq!(before, 0);

    let updated = chart_repo::mark_chart_for_physician_review(&pool, "q-pat-forward")
        .await
        .expect("mark review");
    assert_eq!(updated.status, "IN_PROGRESS");

    let count = chart_repo::count_charts_to_validate(&pool)
        .await
        .expect("count after forward");
    assert_eq!(count, 1);
}
