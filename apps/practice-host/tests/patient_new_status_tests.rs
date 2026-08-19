//! FA-PAT-03: NEW patient status expires when the first appointment is completed.

use medoc_lib::domain::entities::appointment::{CreateAppointment, UpdateAppointment};
use medoc_lib::domain::enums::{AppointmentKind, AppointmentStatus};
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::{patient_repo, appointment_repo};

#[tokio::test]
async fn new_patient_stays_new_after_create_appointment() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-new-1', 'Neu Test', '1990-01-01', 'MALE', 'V-NEW-1', 'NEW')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    appointment_repo::create(
        &pool,
        &CreateAppointment {
            date: "2030-07-01".into(),
            time: "10:00".into(),
            kind: AppointmentKind::Examination,
            patient_id: "p-new-1".into(),
            physician_id: "seed-physician-001".into(),
            notes: None,
            chief_complaint: None,
        },
    )
    .await
    .expect("create appointment");

    let p = patient_repo::find_by_id(&pool, "p-new-1")
        .await
        .expect("load")
        .expect("patient");
    assert_eq!(p.status, "NEW");
}

#[tokio::test]
async fn new_patient_becomes_active_when_first_appointment_completed() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-new-2', 'Neu Test 2', '1990-01-01', 'MALE', 'V-NEW-2', 'NEW')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    let t = appointment_repo::create(
        &pool,
        &CreateAppointment {
            date: "2030-07-02".into(),
            time: "11:00".into(),
            kind: AppointmentKind::Examination,
            patient_id: "p-new-2".into(),
            physician_id: "seed-physician-001".into(),
            notes: None,
            chief_complaint: None,
        },
    )
    .await
    .expect("create appointment");

    appointment_repo::update(
        &pool,
        &t.id,
        &UpdateAppointment {
            date: None,
            time: None,
            kind: None,
            status: Some(AppointmentStatus::Completed),
            notes: None,
            chief_complaint: None,
            physician_id: None,
        },
    )
    .await
    .expect("complete appointment");

    let promoted = patient_repo::expire_new_status_after_completed_appointment(&pool, "p-new-2")
        .await
        .expect("promote");
    assert!(promoted);

    let p = patient_repo::find_by_id(&pool, "p-new-2")
        .await
        .expect("load")
        .expect("patient");
    assert_eq!(p.status, "ACTIVE");
}
