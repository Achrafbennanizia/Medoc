use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn patient_status_accepts_archived() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-arch', 'A', '1990-01-01', 'MALE', 'INS-ARCH', 'ARCHIVED')",
    )
    .execute(&pool)
    .await
    .expect("ARCHIVED must pass CHECK");
}

#[tokio::test]
async fn chart_status_accepts_declined() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-d', 'A', '1990-01-01', 'MALE', 'INS-D', 'NEW')",
    )
    .execute(&pool)
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO patient_chart (id, patient_id, status)
         VALUES ('c-d', 'p-d', 'DECLINED')",
    )
    .execute(&pool)
    .await
    .expect("DECLINED must pass CHECK");
}

#[tokio::test]
async fn appointment_status_accepts_in_progress() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-a', 'A', '1990-01-01', 'MALE', 'INS-A', 'NEW')",
    )
    .execute(&pool)
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id)
         VALUES ('a-1', '2026-11-07', '09:00', 'EXAMINATION', 'IN_PROGRESS', 'p-a', 'seed-physician-001')",
    )
    .execute(&pool)
    .await
    .expect("IN_PROGRESS must pass CHECK");
}

/// F144: an install created by the legacy schema keeps its rows and gains the
/// new status values after `run_migrations`.
#[tokio::test]
async fn legacy_database_gets_widened_status_checks_and_keeps_rows() {
    use medoc_core::infrastructure::database::migrations::run_legacy_embedded_migrations;
    let pool = test_memory_pool().await.expect("pool");
    run_legacy_embedded_migrations(&pool).await.expect("legacy schema");
    let old_sql: String =
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE name = 'patient'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(!old_sql.contains("ARCHIVED"), "precondition: legacy CHECK lacks ARCHIVED");

    for sql in [
        "INSERT INTO staff (id, name, email, password_hash, role) VALUES ('st-1','Doc','doc@x.de','h','PHYSICIAN')",
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status) VALUES ('p-1','A','1990-01-01','MALE','INS-1','ACTIVE')",
        "INSERT INTO patient_chart (id, patient_id, status) VALUES ('c-1','p-1','DRAFT')",
        "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id) VALUES ('a-1','2026-11-10','09:00','CHECKUP','PLANNED','p-1','st-1')",
    ] {
        sqlx::query(sql).execute(&pool).await.expect(sql);
    }

    run_migrations(&pool).await.expect("upgrade");

    sqlx::query("UPDATE patient SET status = 'ARCHIVED' WHERE id = 'p-1'")
        .execute(&pool)
        .await
        .expect("ARCHIVED after upgrade");
    sqlx::query("UPDATE patient_chart SET status = 'DECLINED' WHERE id = 'c-1'")
        .execute(&pool)
        .await
        .expect("DECLINED after upgrade");
    sqlx::query("UPDATE appointment SET status = 'IN_PROGRESS' WHERE id = 'a-1'")
        .execute(&pool)
        .await
        .expect("IN_PROGRESS after upgrade");

    let fks: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_foreign_key_list('appointment')")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(fks >= 2, "appointment keeps its foreign keys");
    let orphan = sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id)
         VALUES ('a-bad','2026-11-10','10:00','CHECKUP','PLANNED','missing','st-1')",
    )
    .execute(&pool)
    .await;
    assert!(orphan.is_err(), "foreign keys still enforced after the rebuild");
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM appointment WHERE id = 'a-1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(rows, 1);
    let bad_status = sqlx::query("UPDATE patient SET status = 'NONSENSE' WHERE id = 'p-1'")
        .execute(&pool)
        .await;
    assert!(bad_status.is_err(), "CHECK still rejects unknown values");
}

#[tokio::test]
async fn payment_status_rejects_unknown_value_and_reopening() {
    use medoc_core::infrastructure::database::payment_repo;
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-pay','A','1990-01-01','MALE','INS-PAY','ACTIVE')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status)
         VALUES ('pay-1','p-pay',10.0,'CASH','OUTSTANDING')",
    )
    .execute(&pool)
    .await
    .unwrap();
    assert!(payment_repo::update_status(&pool, "pay-1", "WHATEVER").await.is_err());
    payment_repo::update_status(&pool, "pay-1", "PAID").await.expect("OUTSTANDING -> PAID");
    assert!(
        payment_repo::update_status(&pool, "pay-1", "OUTSTANDING").await.is_err(),
        "PAID cannot be reopened"
    );
}

#[test]
fn patient_status_is_forward_only_except_archive() {
    use medoc_core::domain::status::PatientStatus;
    assert!(PatientStatus::require_transition("NEW", "ACTIVE").is_ok());
    assert!(PatientStatus::require_transition("VALIDATED", "ACTIVE").is_err());
    assert!(PatientStatus::require_transition("READONLY", "ARCHIVED").is_ok());
    assert!(PatientStatus::require_transition("ARCHIVED", "ACTIVE").is_ok());
    assert!(PatientStatus::require_transition("ACTIVE", "BOGUS").is_err());
}

#[tokio::test]
async fn partially_paid_payment_cannot_be_deleted() {
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    let pool = test_memory_pool().await.unwrap();
    run_migrations(&pool).await.unwrap();
    sqlx::query("INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status) VALUES ('pp-1','P','1980-01-01','MALE','PP-1','ACTIVE')")
        .execute(&pool).await.unwrap();
    for (id, st) in [("pay-open", "OUTSTANDING"), ("pay-part", "PARTIALLY_PAID")] {
        sqlx::query("INSERT INTO payment (id, patient_id, amount, payment_method, status) VALUES (?1,'pp-1',50,'CASH',?2)")
            .bind(id).bind(st).execute(&pool).await.unwrap();
    }
    use medoc_core::infrastructure::database::repos::billing::payment as pay;
    assert!(pay::delete_if_pending(&pool, "pay-part").await.is_err());
    pay::delete_if_pending(&pool, "pay-open").await.expect("open payment deletes");
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM payment WHERE id IN ('pay-open','pay-part')")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(left, 1);
}

#[tokio::test]
async fn unknown_product_delete_is_not_found() {
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    let pool = test_memory_pool().await.unwrap();
    run_migrations(&pool).await.unwrap();
    let err = medoc_core::infrastructure::database::repos::practice::product::delete(&pool, "no-such-product")
        .await
        .expect_err("unknown product");
    assert!(matches!(err, medoc_core::error::AppError::NotFound(_)));
}
