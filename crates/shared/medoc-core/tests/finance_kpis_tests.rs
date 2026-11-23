//! Finance "vs last month": month-to-date against the same days of last month.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::billing::payment as payment_repo;

#[tokio::test]
async fn previous_month_counts_only_the_same_days() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    sqlx::query("INSERT INTO patient (id, name, date_of_birth, sex, insurance_number) VALUES ('p', 'P', '1990-01-01', 'FEMALE', 'I')")
        .execute(&pool)
        .await
        .unwrap();
    let pay = |id: &'static str, amount: f64, when: &'static str| {
        let pool = pool.clone();
        async move {
            sqlx::query(&format!(
                "INSERT INTO payment (id, patient_id, amount, payment_method, status, created_at)
                 VALUES (?1, 'p', ?2, 'CASH', 'PAID', datetime({when}))"
            ))
            .bind(id)
            .bind(amount)
            .execute(&pool)
            .await
            .unwrap();
        }
    };
    // First day of last month: always inside the comparison window.
    pay(
        "a",
        100.0,
        "date('now','localtime','start of month','-1 month')",
    )
    .await;
    // Last day of last month: outside it, unless today is that late in the month.
    pay(
        "b",
        900.0,
        "date('now','localtime','start of month','-1 day')",
    )
    .await;
    pay("c", 50.0, "'now','localtime'").await;

    let k = payment_repo::finance_kpis(&pool).await.unwrap();
    assert_eq!(k.income_mtd, 50.0);
    let day: i64 = sqlx::query_scalar("SELECT CAST(strftime('%d','now','localtime') AS INTEGER)")
        .fetch_one(&pool)
        .await
        .unwrap();
    if day < 28 {
        assert_eq!(
            k.income_prev_mtd, 100.0,
            "end of last month is not 'the same days'"
        );
    } else {
        assert!(k.income_prev_mtd >= 100.0);
    }
}
