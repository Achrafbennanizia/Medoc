//! Slice 5 — auto outbox hook coverage tests.
//!
//! Each test enables `serverless_peer` mode through `app_kv`, performs one
//! write on a hooked repository, and confirms that exactly **one** row was
//! appended to `sync_outbox`. Tables not on the allow-list must produce zero
//! rows.
//!
//! These tests intentionally exercise the public repository API rather than
//! `record_or_noop` directly so we catch the wiring at call sites.

use chrono::NaiveDate;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::entities::practice_task::CreatePracticeTask;
use medoc_core::domain::entities::prescription::CreatePrescription;
use medoc_core::domain::entities::appointment::{CreateAppointment, UpdateAppointment};
use medoc_core::domain::enums::{Sex, AppointmentKind};
use medoc_core::infrastructure::database::{
    chart_repo, app_kv_repo, connection, patient_repo, practice_task_repo, practice_ticket_repo,
    prescription_repo, appointment_repo, payment_repo,
};
use sqlx::SqlitePool;

async fn fresh_pool() -> SqlitePool {
    let pool = connection::test_memory_pool().await.expect("memory pool");
    connection::run_migrations(&pool).await.expect("migrations");
    pool
}

async fn enable_serverless(pool: &SqlitePool) {
    app_kv_repo::set(
        pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Tester"}"#,
    )
    .await
    .expect("enable serverless");
}

async fn outbox_count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity_table = ?1")
        .bind(table)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn sample_patient(name: &str) -> CreatePatient {
    CreatePatient {
        name: name.into(),
        date_of_birth: NaiveDate::from_ymd_opt(1990, 1, 1).unwrap(),
        sex: Sex::Male,
        insurance_number: format!("V-{}", name),
        phone: None,
        email: None,
        address: None,
    }
}

#[tokio::test]
async fn patient_create_emits_one_outbox_row_per_table() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("alpha"))
        .await
        .expect("create patient");

    assert_eq!(outbox_count(&pool, "patient").await, 1);
    assert_eq!(outbox_count(&pool, "patient_chart").await, 1);
    // `anamnesis_form` is Tier-1 allow-listed but patient create inserts inline without outbox hook.
    assert_eq!(outbox_count(&pool, "anamnesis_form").await, 0);
    // `staff` is not on SYNCED_TABLES.
    assert_eq!(outbox_count(&pool, "staff").await, 0);

    let _ = p.id;
}

#[tokio::test]
async fn patient_update_and_delete_each_record_one_row() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("beta"))
        .await
        .expect("create patient");

    patient_repo::update(
        &pool,
        &p.id,
        &medoc_core::domain::entities::patient::UpdatePatient {
            name: Some("beta-updated".into()),
            phone: None,
            email: None,
            address: None,
            status: None,
        },
    )
    .await
    .expect("update");

    patient_repo::delete(&pool, &p.id).await.expect("delete");

    // 1 INSERT + 1 UPDATE + 1 DELETE = 3 rows on `patient`.
    assert_eq!(outbox_count(&pool, "patient").await, 3);
}

#[tokio::test]
async fn no_outbox_rows_when_mode_is_practice_desktop() {
    let pool = fresh_pool().await;

    let _p = patient_repo::create(&pool, &sample_patient("gamma"))
        .await
        .expect("create patient");

    assert_eq!(outbox_count(&pool, "patient").await, 0);
    assert_eq!(outbox_count(&pool, "patient_chart").await, 0);
}

#[tokio::test]
async fn appointment_lifecycle_emits_three_outbox_rows() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    // Need a patient for the FK on appointment (the create handler computes
    // patient label via JOIN — but the create_appointment function only needs
    // the patient id to exist).
    let p = patient_repo::create(&pool, &sample_patient("delta"))
        .await
        .expect("create patient");

    // Seed a `staff` row so the `physician_id` FK resolves.
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('physician-1', 'Dr. Test', 'physician@test', 'x', 'PHYSICIAN')",
    )
    .execute(&pool)
    .await
    .ok();

    let create = CreateAppointment {
        patient_id: p.id.clone(),
        date: "2099-01-01".into(),
        time: "09:00".into(),
        kind: AppointmentKind::Checkup,
        notes: None,
        chief_complaint: None,
        physician_id: "physician-1".into(),
    };
    let t = appointment_repo::create(&pool, &create).await.expect("create");

    appointment_repo::update(
        &pool,
        &t.id,
        &UpdateAppointment {
            date: Some("2099-01-02".into()),
            time: None,
            kind: None,
            status: None,
            notes: None,
            chief_complaint: None,
            physician_id: None,
        },
    )
    .await
    .expect("update");

    appointment_repo::delete(&pool, &t.id).await.expect("delete");

    assert_eq!(outbox_count(&pool, "appointment").await, 3);
}

#[tokio::test]
async fn practice_task_insert_and_status_emit_two_rows() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("epsilon"))
        .await
        .expect("create patient");

    // Seed a `staff` row so the `created_by` FK resolves.
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('rez-1', 'Frau Test', 'rez@test', 'x', 'RECEPTION')",
    )
    .execute(&pool)
    .await
    .ok();

    let task = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(p.id.clone()),
            kind: "BILLING".into(),
            title: "Test".into(),
            body: Some("Test body".into()),
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "rez-1",
    )
    .await
    .expect("insert task");

    practice_task_repo::update_status(
        &pool,
        &task.id,
        "DONE_RECEPTION",
        Some("done"),
        None,
        None,
    )
    .await
    .expect("update status");

    assert_eq!(outbox_count(&pool, "practice_task").await, 2);
}

#[tokio::test]
async fn app_kv_set_excludes_internal_sync_keys_but_records_practice_settings() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    // Genuine practice setting → recorded.
    app_kv_repo::set(&pool, "practice.workschedule.v1", r#"{"foo":"bar"}"#)
        .await
        .expect("set");
    assert_eq!(outbox_count(&pool, "app_kv").await, 1);

    // Internal sync key → must NOT be recorded.
    app_kv_repo::set(&pool, "sync.heartbeat.v1", "{}")
        .await
        .expect("set sync key");
    assert_eq!(outbox_count(&pool, "app_kv").await, 1);

    // License internals also skipped.
    app_kv_repo::set(&pool, "license.v2", "{}")
        .await
        .expect("set license key");
    assert_eq!(outbox_count(&pool, "app_kv").await, 1);
}

#[tokio::test]
async fn payment_lifecycle_emits_outbox_rows() {
    use medoc_core::domain::entities::payment::CreatePayment;
    use medoc_core::domain::enums::PaymentMethod;

    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("zeta"))
        .await
        .expect("create patient");

    let z = payment_repo::create(
        &pool,
        &CreatePayment {
            patient_id: p.id.clone(),
            amount: 50.0,
            payment_method: PaymentMethod::Cash,
            service_item_id: None,
            description: Some("Test".into()),
            treatment_id: None,
            examination_id: None,
            amount_expected: None,
        },
    )
    .await
    .expect("create payment");

    payment_repo::update_status(&pool, &z.id, "PAID")
        .await
        .expect("update status");

    // INSERT + UPDATE = 2 rows on `payment`.
    assert_eq!(outbox_count(&pool, "payment").await, 2);

    // Chart side-effect: each B/U-less Payment does not trigger chart writes.
    let _ = chart_repo::find_chart_by_patient(&pool, &p.id).await.ok();
}

#[tokio::test]
async fn prescription_create_emits_one_outbox_row() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("prescription-hook"))
        .await
        .expect("create patient");

    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('physician-prescription', 'Dr. Prescription', 'prescription@test', 'x', 'PHYSICIAN')",
    )
    .execute(&pool)
    .await
    .ok();

    prescription_repo::create(
        &pool,
        &CreatePrescription {
            patient_id: p.id.clone(),
            physician_id: "physician-prescription".into(),
            medication: "Ibuprofen 600mg".into(),
            active_ingredient: Some("Ibuprofen".into()),
            dosage: "1-0-1".into(),
            duration: "5 Tage".into(),
            instructions: None,
            pzn: None,
            dosage_form: None,
            pack_size: None,
            quantity: None,
            aut_idem: Some(true),
            prescription_type: None,
            icd10_code: None,
            prescribing_physician_id: None,
        },
    )
    .await
    .expect("create prescription");

    assert_eq!(outbox_count(&pool, "prescription").await, 1);
}

#[tokio::test]
async fn practice_ticket_insert_emits_one_outbox_row() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("ticket-hook"))
        .await
        .expect("create patient");

    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('rez-ticket', 'Frau Reception', 'rez@test', 'x', 'RECEPTION'),
               ('physician-ticket', 'Dr. Ticket', 'physician@test', 'x', 'PHYSICIAN')",
    )
    .execute(&pool)
    .await
    .ok();

    practice_ticket_repo::insert(
        &pool,
        &p.id,
        "rez-ticket",
        "physician-ticket",
        "Port hook ticket",
    )
    .await
    .expect("insert ticket");

    assert_eq!(outbox_count(&pool, "practice_ticket").await, 1);
}
