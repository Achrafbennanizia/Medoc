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
    let (page, total) = patient_repo::find_paginated(
        &pool,
        50,
        0,
        Some("Needle Unique"),
        false,
        None,
        None,
        true,
        Default::default(),
    )
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
    let rows = patient_repo::find_all_matching(
        &pool,
        Some("Export Match"),
        false,
        None,
        None,
        true,
        Default::default(),
    )
    .await
    .expect("all");
    assert_eq!(rows.len(), 60);
}

/// Each list tab is filtered in SQL: the paged list total equals the tab count, and an unknown
/// tab name is refused (it is built into SQL).
#[tokio::test]
async fn patient_tabs_filter_on_the_server_like_the_counts() {
    let pool = pool().await;
    for (i, status) in ["NEW", "ACTIVE", "ACTIVE", "VALIDATED", "READONLY", "ACTIVE"]
        .iter()
        .enumerate()
    {
        let id = format!("tab-p{i}");
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
             VALUES (?1, ?1, '1990-01-01', 'FEMALE', ?1, ?2)",
        )
        .bind(&id)
        .bind(status)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES (?1, ?2, ?3)")
            .bind(format!("tab-c{i}"))
            .bind(&id)
            .bind(if i % 2 == 0 {
                "IN_PROGRESS"
            } else {
                "VALIDATED"
            })
            .execute(&pool)
            .await
            .unwrap();
    }
    for id in ["tab-p1", "tab-p4"] {
        sqlx::query("INSERT INTO payment (id, patient_id, amount, payment_method, status) VALUES (?1, ?2, 50, 'CASH', 'OUTSTANDING')")
            .bind(format!("pay-{id}"))
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    let counts = patient_repo::filter_counts(&pool, false, true)
        .await
        .unwrap();
    let total = |tab: &'static str, invoices: bool| {
        let pool = pool.clone();
        async move {
            patient_repo::find_paginated(
                &pool,
                50,
                0,
                None,
                false,
                None,
                Some(tab),
                invoices,
                Default::default(),
            )
            .await
            .unwrap()
            .1
        }
    };
    assert_eq!(total("IN_TREATMENT", true).await, counts.in_treatment);
    assert_eq!(total("NEW_PATIENT", true).await, counts.new_patient);
    assert_eq!(total("CLOSED", true).await, counts.closed);
    assert_eq!(total("INVOICE_OPEN", true).await, counts.invoice_open);
    assert_eq!(total("CHART_OPEN", true).await, counts.chart_open);
    assert_eq!(
        (
            counts.in_treatment,
            counts.closed,
            counts.invoice_open,
            counts.chart_open
        ),
        (3, 2, 2, 3)
    );
    // Without payment rights the invoice tab is empty, like its count.
    assert_eq!(total("INVOICE_OPEN", false).await, 0);
    assert!(patient_repo::find_paginated(
        &pool,
        50,
        0,
        None,
        false,
        None,
        Some("1=1 OR"),
        true,
        Default::default()
    )
    .await
    .is_err());
}
