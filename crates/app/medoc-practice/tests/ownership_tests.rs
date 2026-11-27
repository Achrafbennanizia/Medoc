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
    assert_eq!(
        signing_doctor(&pool, &dr_a, "p1", Some("dr-b"))
            .await
            .as_deref(),
        Some("dr-a")
    );
    assert_eq!(
        signing_doctor(&pool, &desk, "p1", Some("dr-a"))
            .await
            .as_deref(),
        Some("dr-a")
    );
    assert_eq!(
        signing_doctor(&pool, &desk, "p1", None).await.as_deref(),
        Some("dr-b")
    );

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
    stamp_created(&pool, &desk, "appointment", "a1", Some("dr-a"))
        .await
        .unwrap();
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
    stamp_created(&pool, &desk, "appointment", "a2", Some("dr-b"))
        .await
        .unwrap();
    let treating: Option<String> =
        sqlx::query_scalar("SELECT treating_staff_id FROM patient WHERE id = 'p2'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(treating.as_deref(), Some("dr-a"));
}

async fn staff(pool: &sqlx::SqlitePool, id: &str, role: &str) {
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, available)
         VALUES (?1, ?1, ?1 || '@x', 'x', ?2, 1)",
    )
    .bind(id)
    .bind(role)
    .execute(pool)
    .await
    .unwrap();
}

async fn task_owner(
    pool: &sqlx::SqlitePool,
    id: &str,
    created_by: &str,
    assignee: Option<&str>,
) -> Option<String> {
    sqlx::query("INSERT INTO practice_task (id, title, created_by, assignee_user_id) VALUES (?1, ?1, ?2, ?3)")
        .bind(id)
        .bind(created_by)
        .bind(assignee)
        .execute(pool)
        .await
        .unwrap();
    sqlx::query_scalar("SELECT doctor_id FROM practice_task WHERE id = ?1")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

/// T5.4: a task belongs to the dentist who wrote it, else to the dentist it is assigned to.
/// The desk is never an owner (regression: a reception task assigned to another
/// receptionist used to name that receptionist as its doctor).
#[tokio::test]
async fn task_owner_is_always_a_dentist() {
    if !medoc_core::edition::CORE_CAPS.multi_doctor {
        return;
    }
    let pool = support::fresh_pool().await;
    for (id, role) in [
        ("dr-a", "PHYSICIAN"),
        ("dr-b", "PHYSICIAN"),
        ("desk", "RECEPTION"),
        ("desk2", "RECEPTION"),
    ] {
        staff(&pool, id, role).await;
    }
    let dr_a = session("dr-a", "PHYSICIAN");
    let desk = session("desk", "RECEPTION");

    let _ = task_owner(&pool, "t-own", "dr-a", Some("dr-b")).await;
    stamp_created(&pool, &dr_a, "practice_task", "t-own", Some("dr-b"))
        .await
        .unwrap();
    let get = |id: &'static str| {
        let pool = pool.clone();
        async move {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT doctor_id FROM practice_task WHERE id = ?1",
            )
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap()
        }
    };
    assert_eq!(
        get("t-own").await.as_deref(),
        Some("dr-a"),
        "writer dentist owns it"
    );

    let _ = task_owner(&pool, "t-desk-dr", "desk", Some("dr-b")).await;
    stamp_created(&pool, &desk, "practice_task", "t-desk-dr", Some("dr-b"))
        .await
        .unwrap();
    assert_eq!(
        get("t-desk-dr").await.as_deref(),
        Some("dr-b"),
        "assigned dentist owns it"
    );

    let _ = task_owner(&pool, "t-desk-desk2", "desk", Some("desk2")).await;
    stamp_created(&pool, &desk, "practice_task", "t-desk-desk2", Some("desk2"))
        .await
        .unwrap();
    assert_eq!(
        get("t-desk-desk2").await,
        None,
        "a receptionist is not an owner"
    );

    let _ = task_owner(&pool, "t-desk-none", "desk", None).await;
    stamp_created(&pool, &desk, "practice_task", "t-desk-none", None)
        .await
        .unwrap();
    assert_eq!(
        get("t-desk-none").await,
        None,
        "no dentist, no owner: shared with everyone"
    );
}

/// T5.4: an order is for the doctor the form named, else the dentist who placed it; the desk's
/// own orders have no doctor. An existing value is never overwritten.
#[tokio::test]
async fn order_is_for_the_placing_dentist() {
    if !medoc_core::edition::CORE_CAPS.multi_doctor {
        return;
    }
    let pool = support::fresh_pool().await;
    for (id, role) in [
        ("dr-a", "PHYSICIAN"),
        ("dr-b", "PHYSICIAN"),
        ("desk", "RECEPTION"),
    ] {
        staff(&pool, id, role).await;
    }
    for id in ["o-dr", "o-desk", "o-form"] {
        sqlx::query("INSERT INTO purchase_order (id, supplier, item) VALUES (?1, 'S', 'gloves')")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    let dr_a = session("dr-a", "PHYSICIAN");
    let desk = session("desk", "RECEPTION");
    stamp_created(&pool, &dr_a, "purchase_order", "o-dr", None)
        .await
        .unwrap();
    stamp_created(&pool, &desk, "purchase_order", "o-desk", None)
        .await
        .unwrap();
    stamp_created(&pool, &desk, "purchase_order", "o-form", Some("dr-b"))
        .await
        .unwrap();
    stamp_created(&pool, &dr_a, "purchase_order", "o-form", None)
        .await
        .unwrap();
    let rows: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, ordered_for_staff_id FROM purchase_order WHERE id LIKE 'o-%' ORDER BY id",
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(
        rows,
        [
            ("o-desk".to_string(), None),
            ("o-dr".to_string(), Some("dr-a".to_string())),
            ("o-form".to_string(), Some("dr-b".to_string())),
        ]
    );
}
