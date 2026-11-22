use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::number_sequence::allocate_number;

#[tokio::test]
async fn two_allocators_never_get_the_same_number() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    let a = allocate_number(&pool, "RE", "2026-11-07").await.expect("a");
    let b = allocate_number(&pool, "RE", "2026-11-07").await.expect("b");
    assert_ne!(a, b);
    assert!(a.starts_with("RE-2026-"));
    assert!(b.starts_with("RE-2026-"));
}

#[tokio::test]
async fn concurrent_allocators_are_unique() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    let p1 = pool.clone();
    let p2 = pool.clone();
    let (a, b) = tokio::join!(
        allocate_number(&p1, "PO", "2026-03-01"),
        allocate_number(&p2, "PO", "2026-03-01"),
    );
    let a = a.expect("a");
    let b = b.expect("b");
    assert_ne!(a, b);
}

mod styled {
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    use medoc_core::infrastructure::database::number_sequence::{allocate_styled, NumberStyle};

    #[tokio::test]
    async fn daily_invoice_numbers_keep_format_and_continue_legacy_counter() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        sqlx::query("INSERT OR REPLACE INTO app_kv (key, value) VALUES ('finance.document_counters.v1', ?1)")
            .bind(r#"{"version":1,"days":{"2026-11-07":{"re":41,"br":0,"qu":2}}}"#)
            .execute(&pool)
            .await
            .unwrap();
        let a = allocate_styled(&pool, "RE", "2026-11-07", NumberStyle::Daily)
            .await
            .unwrap();
        let b = allocate_styled(&pool, "RE", "2026-11-07", NumberStyle::Daily)
            .await
            .unwrap();
        let q = allocate_styled(&pool, "QU", "2026-11-07", NumberStyle::Daily)
            .await
            .unwrap();
        let next_day = allocate_styled(&pool, "RE", "2026-11-08", NumberStyle::Daily)
            .await
            .unwrap();
        assert_eq!(a, "RE-20261107-000042");
        assert_eq!(b, "RE-20261107-000043");
        assert_eq!(q, "QU-20261107-000003");
        assert_eq!(next_day, "RE-20261108-000001");
    }

    #[tokio::test]
    async fn monthly_order_numbers_start_after_existing_orders() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO purchase_order (id, order_number, supplier, item, status, quantity, unit, created_by)
             VALUES ('po-1', 'B-2026-11-0007', 'S', 'I', 'OPEN', 1, 'Stk', 'seed-admin-001')",
        )
        .execute(&pool)
        .await
        .unwrap();
        let n = allocate_styled(&pool, "B", "2026-11-20", NumberStyle::Monthly)
            .await
            .unwrap();
        assert_eq!(n, "B-2026-11-0008");
    }

    #[tokio::test]
    async fn concurrent_allocations_never_repeat() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        let mut handles = Vec::new();
        for _ in 0..20 {
            let p = pool.clone();
            handles.push(tokio::spawn(async move {
                allocate_styled(&p, "BR", "2026-11-07", NumberStyle::Daily)
                    .await
                    .unwrap()
            }));
        }
        let mut all = Vec::new();
        for h in handles {
            all.push(h.await.unwrap());
        }
        all.sort();
        all.dedup();
        assert_eq!(all.len(), 20);
    }
}
