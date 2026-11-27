//! Group: new records name their doctor (editions-plan §4.1) and documents their signing doctor
//! (§5.1: issuing dentist, else the doctor chosen at request, else the patient's treating doctor).

mod support;

use medoc_core::application::auth_service::Session;
use medoc_practice::commands::ownership::{signing_doctor, stamp_created};

fn session(id: &str, role: &str) -> Session {
    Session {
        user_id: id.into(),
        name: id.into(),
        email: format!("{id}@x"),
        role: role.into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

#[tokio::test]
async fn signing_doctor_follows_who_issues_and_who_was_chosen() {
    if !medoc_core::edition::CORE_CAPS.multi_doctor {
        return;
    }
    let pool = support::fresh_pool().await;
    for id in ["dr-a", "dr-b"] {
        sqlx::query(
            "INSERT INTO staff (id, name, email, password_hash, role, available)
             VALUES (?1, ?1, ?1 || '@x', 'x', 'PHYSICIAN', 1)",
        )
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    }
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at, treating_staff_id)
         VALUES ('p1', 'Salma', '1990-01-01', 'FEMALE', 'V-1', 'ACTIVE', 'now', 'now', 'dr-b')",
    )
    .execute(&pool)
    .await
    .unwrap();
    let dr_a = session("dr-a", "PHYSICIAN");
    let desk = session("desk", "RECEPTION");
    assert_eq!(signing_doctor(&pool, &dr_a, "p1", Some("dr-b")).await.as_deref(), Some("dr-a"));
    assert_eq!(signing_doctor(&pool, &desk, "p1", Some("dr-a")).await.as_deref(), Some("dr-a"));
    assert_eq!(signing_doctor(&pool, &desk, "p1", None).await.as_deref(), Some("dr-b"));

    // A first booking names the treating doctor of a patient that has none.
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at)
         VALUES ('p2', 'Omar', '1990-01-01', 'MALE', 'V-2', 'ACTIVE', 'now', 'now')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO appointment (id, patient_id, physician_id, date, time, kind, status, created_at, updated_at)
         VALUES ('a1', 'p2', 'dr-a', '2026-12-01', '10:00', 'CHECKUP', 'PLANNED', 'now', 'now')",
    )
    .execute(&pool)
    .await
    .unwrap();
    stamp_created(&pool, &desk, "appointment", "a1", Some("dr-a")).await.unwrap();
    let treating: Option<String> =
        sqlx::query_scalar("SELECT treating_staff_id FROM patient WHERE id = 'p2'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(treating.as_deref(), Some("dr-a"));
    // It is never overwritten by a later booking with another doctor.
    sqlx::query(
        "INSERT INTO appointment (id, patient_id, physician_id, date, time, kind, status, created_at, updated_at)
         VALUES ('a2', 'p2', 'dr-b', '2026-12-02', '10:00', 'CHECKUP', 'PLANNED', 'now', 'now')",
    )
    .execute(&pool)
    .await
    .unwrap();
    stamp_created(&pool, &desk, "appointment", "a2", Some("dr-b")).await.unwrap();
    let treating: Option<String> =
        sqlx::query_scalar("SELECT treating_staff_id FROM patient WHERE id = 'p2'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(treating.as_deref(), Some("dr-a"));
}
