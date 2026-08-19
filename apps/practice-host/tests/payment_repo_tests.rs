// Payment repo: Soll/offen parity with frontend (`roundMoney2`, `PAYMENT_EUR_EPS`) and update caps.

use medoc_lib::domain::entities::payment::{CreatePayment, UpdatePayment};
use medoc_lib::domain::enums::PaymentMethod;
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::payment_repo;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn seed_patient_treatment_100(pool: &sqlx::SqlitePool) -> (String, String) {
    let patient_id = "t-payment-pat-1".to_string();
    let chart_id = "t-payment-chart-1".to_string();
    let beh_id = "t-payment-bh-1".to_string();

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Payment Test', '1990-01-01', 'MALE', 'V-ZR-1')",
    )
    .bind(&patient_id)
    .execute(pool)
    .await
    .expect("insert patient");

    sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES (?1, ?2, 'DRAFT')")
        .bind(&chart_id)
        .bind(&patient_id)
        .execute(pool)
        .await
        .expect("insert chart");

    sqlx::query(
        "INSERT INTO treatment (
            id, chart_id, kind, description, category, service_name, treatment_number,
            session_number, treatment_status, total_cost, appointment_required, treatment_date
        ) VALUES (
            ?1, ?2, 'Test', 'Test', 'Test', 'Test', 'T-1',
            1, 'COMPLETED', 100.0, 0, '2026-01-01'
        )",
    )
    .bind(&beh_id)
    .bind(&chart_id)
    .execute(pool)
    .await
    .expect("insert treatment");

    sqlx::query(
        "UPDATE treatment SET released_by_physician_id = 'seed-physician-001', released_at = datetime('now') WHERE id = ?1",
    )
    .bind(&beh_id)
    .execute(pool)
    .await
    .expect("freigabe seed");

    (patient_id, beh_id)
}

fn create_payload(patient_id: &str, treatment_id: &str, amount: f64) -> CreatePayment {
    CreatePayment {
        patient_id: patient_id.into(),
        amount,
        payment_method: PaymentMethod::Cash,
        service_item_id: None,
        description: None,
        treatment_id: Some(treatment_id.into()),
        examination_id: None,
        amount_expected: None,
    }
}

#[tokio::test]
async fn create_rejects_over_open_even_with_float_noise() {
    let pool = migrated_pool().await;
    let (patient_id, beh_id) = seed_patient_treatment_100(&pool).await;

    payment_repo::create(&pool, &create_payload(&patient_id, &beh_id, 33.33))
        .await
        .expect("first payment");

    // open = round_money2(100 - 33.33) = round(66.67) = 66.67
    let open = 66.67_f64;
    let over = open + 0.006;
    let err = payment_repo::create(&pool, &create_payload(&patient_id, &beh_id, over))
        .await
        .expect_err("over open");
    match err {
        AppError::ValidationCode(msg) => assert!(
            msg.contains("error.payment.overpayment"),
            "{msg}"
        ),
        AppError::Validation(msg) => assert!(
            msg.contains("exceeds") || msg.contains("open"),
            "{msg}"
        ),
        e => panic!("expected overpayment validation, got {e:?}"),
    }

    // Within EPS slack vs recomputed open on server
    let ok_amt = open + 0.004;
    payment_repo::create(&pool, &create_payload(&patient_id, &beh_id, ok_amt))
        .await
        .expect("within tolerance");
}

#[tokio::test]
async fn ensure_open_booking_for_billable_treatment_sets_release_and_outstanding() {
    let pool = migrated_pool().await;
    let patient_id = "t-leist06-pat".to_string();
    let chart_id = "t-leist06-chart".to_string();
    let beh_id = "t-leist06-bh".to_string();
    let physician_id = "seed-physician-001";

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Leist06', '1990-01-01', 'MALE', 'V-L6')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("patient");

    sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES (?1, ?2, 'DRAFT')")
        .bind(&chart_id)
        .bind(&patient_id)
        .execute(&pool)
        .await
        .expect("chart");

    sqlx::query(
        "INSERT INTO treatment (
            id, chart_id, kind, description, category, service_name, treatment_number,
            session_number, treatment_status, total_cost, appointment_required, treatment_date
        ) VALUES (
            ?1, ?2, 'Füllung', 'Füllung', 'Konservierend', 'Füllung', 'L6-1',
            1, 'COMPLETED', 80.0, 0, '2026-05-21'
        )",
    )
    .bind(&beh_id)
    .bind(&chart_id)
    .execute(&pool)
    .await
    .expect("treatment");

    payment_repo::ensure_open_booking_for_billable_treatment(&pool, &beh_id, physician_id)
        .await
        .expect("open booking");

    let released: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT released_by_physician_id, released_at FROM treatment WHERE id = ?1",
    )
    .bind(&beh_id)
    .fetch_one(&pool)
    .await
    .expect("read freigabe");
    assert!(released.0.as_deref().is_some_and(|s| !s.is_empty()));
    assert!(released.1.as_deref().is_some_and(|s| !s.is_empty()));

    let z: (String, f64, String) =
        sqlx::query_as("SELECT status, amount, description FROM payment WHERE treatment_id = ?1")
            .bind(&beh_id)
            .fetch_one(&pool)
            .await
            .expect("payment row");
    assert_eq!(z.0, "OUTSTANDING");
    assert!(z.1 <= 0.005);
    assert!(z.2.contains("FA-LEIST-06"));
}

#[tokio::test]
async fn ensure_open_booking_for_billable_examination_sets_release_and_outstanding() {
    let pool = migrated_pool().await;
    let patient_id = "t-leist07-pat".to_string();
    let chart_id = "t-leist07-chart".to_string();
    let unter_id = "t-leist07-u".to_string();
    let physician_id = "seed-physician-001";

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Leist07', '1990-01-01', 'MALE', 'V-L7')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("patient");

    sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES (?1, ?2, 'DRAFT')")
        .bind(&chart_id)
        .bind(&patient_id)
        .execute(&pool)
        .await
        .expect("chart");

    sqlx::query(
        "INSERT INTO examination (
            id, chart_id, chief_complaint, results, diagnosis, examination_number,
            category, service_name, total_cost
        ) VALUES (
            ?1, ?2, 'Beschwerde', NULL, 'Diag', 'U-L7-1',
            'Diagnostik', 'Checkup', 45.0
        )",
    )
    .bind(&unter_id)
    .bind(&chart_id)
    .execute(&pool)
    .await
    .expect("examination");

    payment_repo::ensure_open_booking_for_billable_examination(&pool, &unter_id, physician_id)
        .await
        .expect("open booking");

    let released: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT released_by_physician_id, released_at FROM examination WHERE id = ?1",
    )
    .bind(&unter_id)
    .fetch_one(&pool)
    .await
    .expect("read freigabe");
    assert!(released.0.as_deref().is_some_and(|s| !s.is_empty()));
    assert!(released.1.as_deref().is_some_and(|s| !s.is_empty()));

    let z: (String, f64, Option<f64>) = sqlx::query_as(
        "SELECT status, amount, amount_expected FROM payment WHERE examination_id = ?1",
    )
    .bind(&unter_id)
    .fetch_one(&pool)
    .await
    .expect("payment row");
    assert_eq!(z.0, "OUTSTANDING");
    assert!(z.1 <= 0.005);
    assert_eq!(z.2, Some(45.0));
}

#[tokio::test]
async fn create_rejects_treatment_without_physician_release() {
    let pool = migrated_pool().await;
    let patient_id = "t-payment-pat-norel".to_string();
    let chart_id = "t-payment-chart-norel".to_string();
    let beh_id = "t-payment-bh-norel".to_string();

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'No Release', '1990-01-01', 'MALE', 'V-NR')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("insert patient");

    sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES (?1, ?2, 'DRAFT')")
        .bind(&chart_id)
        .bind(&patient_id)
        .execute(&pool)
        .await
        .expect("insert chart");

    sqlx::query(
        "INSERT INTO treatment (
            id, chart_id, kind, description, category, service_name, treatment_number,
            session_number, treatment_status, total_cost, appointment_required, treatment_date
        ) VALUES (
            ?1, ?2, 'Test', 'Test', 'Test', 'Test', 'T-NR',
            1, 'COMPLETED', 50.0, 0, '2026-01-01'
        )",
    )
    .bind(&beh_id)
    .bind(&chart_id)
    .execute(&pool)
    .await
    .expect("insert treatment without freigabe");

    let err = payment_repo::create(&pool, &create_payload(&patient_id, &beh_id, 10.0))
        .await
        .expect_err("must fail without FA-LEIST-05 release");
    match err {
        AppError::ValidationCode(msg) => assert!(
            msg.contains("error.billing.not_released"),
            "{msg}"
        ),
        AppError::Validation(msg) => assert!(
            msg.contains("FA-LEIST-05") || msg.contains("freigegeben") || msg.contains("released"),
            "{msg}"
        ),
        e => panic!("expected not-released validation, got {e:?}"),
    }
}

#[tokio::test]
async fn update_fields_caps_replacement_amount_against_other_rows() {
    let pool = migrated_pool().await;
    let (patient_id, beh_id) = seed_patient_treatment_100(&pool).await;

    let z1 = payment_repo::create(&pool, &create_payload(&patient_id, &beh_id, 30.0))
        .await
        .expect("z1");
    payment_repo::create(&pool, &create_payload(&patient_id, &beh_id, 20.0))
        .await
        .expect("z2");

    assert!(
        z1.status == "PARTIALLY_PAID" || z1.status == "PAID",
        "unexpected status {}",
        z1.status
    );

    // Others sum = 20 → max for row z1 = round(100 - 20) = 80; 85 must fail
    let bad = UpdatePayment {
        id: z1.id.clone(),
        amount: 85.0,
        payment_method: PaymentMethod::Cash,
        service_item_id: None,
        description: None,
    };
    let err = payment_repo::update_fields(&pool, &bad)
        .await
        .expect_err("too high");
    match err {
        AppError::ValidationCode(msg) => assert!(
            msg.contains("error.payment.overpayment"),
            "{msg}"
        ),
        AppError::Validation(msg) => assert!(
            msg.contains("exceeds") || msg.contains("open") || msg.contains("limit"),
            "{msg}"
        ),
        e => panic!("expected Validation, got {e:?}"),
    }

    let ok = UpdatePayment {
        id: z1.id,
        amount: 79.0,
        payment_method: PaymentMethod::Cash,
        service_item_id: None,
        description: None,
    };
    payment_repo::update_fields(&pool, &ok)
        .await
        .expect("within cap");
}
