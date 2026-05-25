//! FA-AUFG-01/06 — praxis_aufgabe IPC + status machine + ticket migration.

use medoc_lib::application::rbac::Role;
use medoc_lib::domain::entities::praxis_aufgabe::CreatePraxisAufgabe;
use medoc_lib::domain::services::workflow_transitions;
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::praxis_aufgabe_repo;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn seed_patient(pool: &sqlx::SqlitePool) -> String {
    let id = "t-aufg-pat".to_string();
    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Aufgabe Pat', '1990-01-01', 'MAENNLICH', 'V-AUFG')",
    )
    .bind(&id)
    .execute(pool)
    .await
    .expect("patient");
    id
}

#[tokio::test]
async fn migrate_praxis_ticket_to_aufgabe() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;
    sqlx::query(
        "INSERT INTO praxis_ticket (id, patient_id, from_user_id, to_arzt_id, body, status)
         VALUES ('t-mig-ticket', ?1, 'seed-rez-001', 'seed-arzt-001', 'Bitte Röntgen prüfen', 'OFFEN')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("ticket");

    sqlx::query(
        r#"INSERT INTO praxis_aufgabe (
            id, patient_id, typ, titel, body, assignee_user_id, created_by, status,
            legacy_ticket_id, created_at, updated_at
        )
        SELECT
            t.id, t.patient_id, 'SONSTIGES',
            CASE WHEN length(t.body) > 80 THEN substr(t.body, 1, 80) || '…' ELSE t.body END,
            t.body, t.to_arzt_id, t.from_user_id,
            CASE t.status WHEN 'ERLEDIGT' THEN 'VALIDIERT' WHEN 'IN_BEARBEITUNG' THEN 'IN_BEARBEITUNG' ELSE 'OFFEN' END,
            t.id, t.created_at, t.updated_at
        FROM praxis_ticket t WHERE t.id = 't-mig-ticket'
          AND NOT EXISTS (SELECT 1 FROM praxis_aufgabe a WHERE a.legacy_ticket_id = t.id)"#,
    )
    .execute(&pool)
    .await
    .expect("migrate row");

    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_aufgabe WHERE legacy_ticket_id = 't-mig-ticket'",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(n.0, 1, "migration should copy ticket once");
}

#[tokio::test]
async fn arzt_to_rezeption_fulfillment_and_validation_flow() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let a = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: patient_id.clone(),
            typ: "ABRECHNUNG".into(),
            titel: "Zahlung erfassen".into(),
            body: Some("80 EUR Füllung".into()),
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: Some("Füllung".into()),
            gesamtkosten: Some(80.0),
        },
        "seed-arzt-001",
    )
    .await
    .expect("create");

    workflow_transitions::praxis_aufgabe_status_transition(
        &a.status,
        "IN_BEARBEITUNG",
        Role::Rezeption,
        a.assignee_role.as_deref(),
        a.assignee_user_id.as_deref(),
        &a.created_by,
        "seed-rez-001",
    )
    .expect("rez start");

    let mid = praxis_aufgabe_repo::update_status(&pool, &a.id, "IN_BEARBEITUNG", None, None, None)
        .await
        .expect("update");

    workflow_transitions::praxis_aufgabe_status_transition(
        &mid.status,
        "ERLEDIGT_REZEPTION",
        Role::Rezeption,
        mid.assignee_role.as_deref(),
        mid.assignee_user_id.as_deref(),
        &mid.created_by,
        "seed-rez-001",
    )
    .expect("rez done transition");

    let done = praxis_aufgabe_repo::update_status(
        &pool,
        &a.id,
        "ERLEDIGT_REZEPTION",
        Some("Kasse erfasst"),
        None,
        None,
    )
    .await
    .expect("erledigt");

    workflow_transitions::praxis_aufgabe_status_transition(
        &done.status,
        "VALIDIERT",
        Role::Arzt,
        done.assignee_role.as_deref(),
        done.assignee_user_id.as_deref(),
        &done.created_by,
        "seed-arzt-001",
    )
    .expect("arzt validate");

    let closed = praxis_aufgabe_repo::update_status(&pool, &a.id, "VALIDIERT", None, None, None)
        .await
        .expect("validiert");
    assert_eq!(closed.status, "VALIDIERT");
}

#[test]
fn workflow_aufgabe_rejects_invalid_transition() {
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "OFFEN",
        "VALIDIERT",
        Role::Rezeption,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-rez-001",
    )
    .is_err());
    let err = workflow_transitions::praxis_aufgabe_status_transition(
        "ERLEDIGT_REZEPTION",
        "OFFEN",
        Role::Arzt,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-arzt-001",
    )
    .expect_err("arzt cannot reopen without ZURUECK");
    assert!(matches!(err, AppError::Validation(_)));
}
