//! Removing a patient row must not hit SQLITE_CONSTRAINT_FOREIGNKEY (787).

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::patient_repo;

#[tokio::test]
async fn delete_seed_patient_with_appointments_and_payments_does_not_fk_fail() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");

    patient_repo::delete(&pool, "seed-pat-002")
        .await
        .expect("delete patient with restrict FK children");

    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE id = 'seed-pat-002'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);

    let apts: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM appointment WHERE patient_id = 'seed-pat-002'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(apts, 0);

    let pays: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM payment WHERE patient_id = 'seed-pat-002'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(pays, 0);
}

#[tokio::test]
async fn delete_missing_patient_is_ok() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    patient_repo::delete_row(&pool, "no-such-patient")
        .await
        .expect("missing patient");
}
