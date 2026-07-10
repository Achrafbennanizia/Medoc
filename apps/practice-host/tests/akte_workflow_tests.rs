//! FA-AKTE-14/15 — validation queue list/count/validate + forward enqueue.

use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::akte_repo;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn seed_patient_with_akte(pool: &sqlx::SqlitePool, patient_id: &str, status: &str) -> String {
    let versicherungsnummer = format!("V-QUEUE-{patient_id}");
    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Queue Pat', '1990-01-01', 'MAENNLICH', ?2)",
    )
    .bind(patient_id)
    .bind(&versicherungsnummer)
    .execute(pool)
    .await
    .expect("patient");
    let akte_id = format!("{patient_id}-akte");
    sqlx::query(
        "INSERT INTO patientenakte (id, patient_id, status) VALUES (?1, ?2, ?3)",
    )
    .bind(&akte_id)
    .bind(patient_id)
    .bind(status)
    .execute(pool)
    .await
    .expect("akte");
    akte_id
}

#[tokio::test]
async fn list_and_count_pending_validation_queue() {
    let pool = migrated_pool().await;
    seed_patient_with_akte(&pool, "q-pat-entwurf", "ENTWURF").await;
    seed_patient_with_akte(&pool, "q-pat-bearb", "IN_BEARBEITUNG").await;
    seed_patient_with_akte(&pool, "q-pat-done", "VALIDIERT").await;

    let rows = akte_repo::list_akten_zu_validieren(&pool).await.expect("list");
    assert_eq!(rows.len(), 2, "ENTWURF + IN_BEARBEITUNG only");
    let ids: Vec<_> = rows.iter().map(|r| r.patient_id.as_str()).collect();
    assert!(ids.contains(&"q-pat-entwurf"));
    assert!(ids.contains(&"q-pat-bearb"));
    assert!(!ids.contains(&"q-pat-done"));

    let count = akte_repo::count_akten_zu_validieren(&pool)
        .await
        .expect("count");
    assert_eq!(count, 2);
    for row in &rows {
        assert!(!row.updated_at.is_empty(), "updated_at serialized for IPC");
    }
}

#[tokio::test]
async fn validate_patientenakte_sets_validiert_and_leaves_queue() {
    let pool = migrated_pool().await;
    seed_patient_with_akte(&pool, "q-pat-validate", "ENTWURF").await;

    let updated = akte_repo::validate_patientenakte_status(&pool, "q-pat-validate")
        .await
        .expect("validate");
    assert_eq!(updated.status, "VALIDIERT");

    let count = akte_repo::count_akten_zu_validieren(&pool)
        .await
        .expect("count after validate");
    assert_eq!(count, 0);
}

#[tokio::test]
async fn forward_marks_validated_akte_in_bearbeitung_for_queue() {
    let pool = migrated_pool().await;
    seed_patient_with_akte(&pool, "q-pat-forward", "VALIDIERT").await;

    let before = akte_repo::count_akten_zu_validieren(&pool)
        .await
        .expect("count before");
    assert_eq!(before, 0);

    let updated = akte_repo::mark_akte_for_physician_review(&pool, "q-pat-forward")
        .await
        .expect("mark review");
    assert_eq!(updated.status, "IN_BEARBEITUNG");

    let count = akte_repo::count_akten_zu_validieren(&pool)
        .await
        .expect("count after forward");
    assert_eq!(count, 1);
}
