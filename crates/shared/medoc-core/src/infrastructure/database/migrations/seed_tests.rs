use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn demo_seed_inserts_named_pending_approval_charts() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM patient_chart
         WHERE id IN ('seed-chart-009','seed-chart-010','seed-chart-011','seed-chart-012')
           AND status IN ('DRAFT','IN_PROGRESS')",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(n.0, 4);
}
