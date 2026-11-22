use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::clinical::patient as patient_repo;

async fn pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn insert_named(pool: &sqlx::SqlitePool, name: &str, insurance: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES (?1, ?2, '1990-01-01', 'MALE', ?3, 'ACTIVE')",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(name)
    .bind(insurance)
    .execute(pool)
    .await
    .expect("insert");
}

#[tokio::test]
async fn patient_search_finds_row_beyond_first_page() {
    let pool = pool().await;
    for i in 0..55 {
        insert_named(&pool, &format!("Z-F57-{i:03}"), &format!("INS-F57-{i:03}")).await;
    }
    insert_named(&pool, "Needle Unique", "NEEDLE-F57").await;
    let (page, total) =
        patient_repo::find_paginated(&pool, 50, 0, Some("Needle Unique"), false, None, Default::default())
            .await
            .expect("search");
    assert!(total >= 1);
    assert!(page.iter().any(|p| p.name == "Needle Unique"), "{page:?}");
    assert!(page.len() <= 50);
}

#[tokio::test]
async fn export_contains_all_matching_rows() {
    let pool = pool().await;
    for i in 0..60 {
        insert_named(
            &pool,
            &format!("Export Match {i:03}"),
            &format!("EX-{i:03}"),
        )
        .await;
    }
    insert_named(&pool, "Other", "NO-MATCH").await;
    let rows = patient_repo::find_all_matching(&pool, Some("Export Match"), false, None, Default::default())
        .await
        .expect("all");
    assert_eq!(rows.len(), 60);
}
