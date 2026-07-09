//! FA-AUFG-01/06 — praxis_aufgabe IPC + status machine + ticket migration.

use medoc_lib::application::praxis_aufgabe_notify;
use medoc_lib::application::rbac::Role;
use medoc_lib::domain::entities::praxis_aufgabe::CreatePraxisAufgabe;
use medoc_lib::domain::services::workflow_transitions;
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::{in_app_notification_repo, praxis_aufgabe_repo};

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
            patient_id: Some(patient_id.clone()),
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
        false,
        false,
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
        false,
        false,
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
        false,
        false,
    )
    .expect("arzt validate");

    let closed = praxis_aufgabe_repo::update_status(&pool, &a.id, "VALIDIERT", None, None, None)
        .await
        .expect("validiert");
    assert_eq!(closed.status, "VALIDIERT");
}

#[tokio::test]
async fn erledigt_rezeption_notifies_creating_arzt_fa_aufg_04() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let a = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id.clone()),
            typ: "SONSTIGES".into(),
            titel: "Röntgenbild drucken".into(),
            body: Some("Bitte ausdrucken".into()),
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-arzt-001",
    )
    .await
    .expect("create");

    let mid = praxis_aufgabe_repo::update_status(&pool, &a.id, "IN_BEARBEITUNG", None, None, None)
        .await
        .expect("in bearbeitung");

    let done = praxis_aufgabe_repo::update_status(
        &pool,
        &a.id,
        "ERLEDIGT_REZEPTION",
        Some("Ausdruck liegt bereit"),
        None,
        None,
    )
    .await
    .expect("erledigt");

    praxis_aufgabe_notify::notify_creator_if_aufgabe_erledigt_by_other(
        &pool,
        &mid,
        &done,
        "ERLEDIGT_REZEPTION",
        "seed-rez-001",
        Some("Ausdruck liegt bereit"),
    )
    .await
    .expect("notify");

    let unread = in_app_notification_repo::count_unread(&pool, "seed-arzt-001")
        .await
        .expect("count");
    assert_eq!(unread, 1);

    let rows = in_app_notification_repo::list_for_user(&pool, "seed-arzt-001", 5)
        .await
        .expect("list");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].kind, "PRAXIS_AUFGABE_ERLEDIGT");
    assert!(rows[0].title.contains("Aufgabe Pat"));
    assert_eq!(rows[0].body, "Ausdruck liegt bereit");
}

#[tokio::test]
async fn erledigt_rezeption_skips_notification_when_creator_completes_own_task() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let a = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id),
            typ: "SONSTIGES".into(),
            titel: "Selbst erledigen".into(),
            body: None,
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-arzt-001",
    )
    .await
    .expect("create");

    let done = praxis_aufgabe_repo::update_status(
        &pool,
        &a.id,
        "ERLEDIGT_REZEPTION",
        Some("Selbst"),
        None,
        None,
    )
    .await
    .expect("erledigt");

    praxis_aufgabe_notify::notify_creator_if_aufgabe_erledigt_by_other(
        &pool,
        &a,
        &done,
        "ERLEDIGT_REZEPTION",
        "seed-arzt-001",
        Some("Selbst"),
    )
    .await
    .expect("notify noop");

    let unread = in_app_notification_repo::count_unread(&pool, "seed-arzt-001")
        .await
        .expect("count");
    assert_eq!(unread, 0);
}

#[tokio::test]
async fn g21_arzt_to_rez_flow_posteingang_notify_and_pending_validation() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let created = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id.clone()),
            typ: "SONSTIGES".into(),
            titel: "G21 Live Proxy Aufgabe".into(),
            body: Some("Manueller Dialog-Äquivalent".into()),
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-arzt-001",
    )
    .await
    .expect("arzt creates");

    let rez_inbox = praxis_aufgabe_repo::list_posteingang_rezeption(&pool, 50)
        .await
        .expect("rez list");
    assert!(rez_inbox.iter().any(|a| a.id == created.id));
    assert!(
        praxis_aufgabe_repo::count_open_for_rezeption(&pool, "seed-rezeption-001")
            .await
            .expect("count")
            >= 1
    );

    workflow_transitions::praxis_aufgabe_status_transition(
        &created.status,
        "IN_BEARBEITUNG",
        Role::Rezeption,
        created.assignee_role.as_deref(),
        created.assignee_user_id.as_deref(),
        &created.created_by,
        "seed-rez-001",
        false,
        false,
    )
    .expect("rez start");
    let mid =
        praxis_aufgabe_repo::update_status(&pool, &created.id, "IN_BEARBEITUNG", None, None, None)
            .await
            .expect("in bearbeitung");

    workflow_transitions::praxis_aufgabe_status_transition(
        &mid.status,
        "ERLEDIGT_REZEPTION",
        Role::Rezeption,
        mid.assignee_role.as_deref(),
        mid.assignee_user_id.as_deref(),
        &mid.created_by,
        "seed-rez-001",
        false,
        false,
    )
    .expect("rez done");
    let done = praxis_aufgabe_repo::update_status(
        &pool,
        &created.id,
        "ERLEDIGT_REZEPTION",
        Some("Erledigt in G21 Test"),
        None,
        None,
    )
    .await
    .expect("erledigt");

    praxis_aufgabe_notify::notify_creator_if_aufgabe_erledigt_by_other(
        &pool,
        &mid,
        &done,
        "ERLEDIGT_REZEPTION",
        "seed-rez-001",
        Some("Erledigt in G21 Test"),
    )
    .await
    .expect("notify arzt");

    let rez_after = praxis_aufgabe_repo::list_posteingang_rezeption(&pool, 50)
        .await
        .expect("rez list after");
    assert!(!rez_after.iter().any(|a| a.id == created.id));

    let pending = praxis_aufgabe_repo::list_pending_validation(&pool, "seed-arzt-001", 50)
        .await
        .expect("arzt pending");
    assert!(pending.iter().any(|a| a.id == created.id));

    let unread = in_app_notification_repo::count_unread(&pool, "seed-arzt-001")
        .await
        .expect("notify count");
    assert_eq!(unread, 1);
}

#[tokio::test]
async fn arzt_zurueck_notifies_rezeption_and_stays_visible_until_validiert() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let created = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id.clone()),
            typ: "SONSTIGES".into(),
            titel: "Zurück-Test".into(),
            body: Some("Bitte prüfen".into()),
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-arzt-001",
    )
    .await
    .expect("create");

    let done = praxis_aufgabe_repo::update_status(
        &pool,
        &created.id,
        "ERLEDIGT_REZEPTION",
        Some("Fertig"),
        None,
        None,
    )
    .await
    .expect("erledigt");

    workflow_transitions::praxis_aufgabe_status_transition(
        &done.status,
        "ZURUECK",
        Role::Arzt,
        done.assignee_role.as_deref(),
        done.assignee_user_id.as_deref(),
        &done.created_by,
        "seed-arzt-001",
        false,
        false,
    )
    .expect("arzt may return");
    let zurueck = praxis_aufgabe_repo::update_status(
        &pool,
        &created.id,
        "ZURUECK",
        None,
        None,
        Some("Bitte korrigieren"),
    )
    .await
    .expect("zurueck");

    praxis_aufgabe_notify::notify_assignees_if_aufgabe_zurueck(
        &pool,
        &done,
        &zurueck,
        "ZURUECK",
        "seed-arzt-001",
        Some("Bitte korrigieren"),
    )
    .await
    .expect("notify rez");

    let rez_unread = in_app_notification_repo::count_unread(&pool, "seed-rez-001")
        .await
        .expect("rez unread");
    assert!(
        rez_unread >= 1,
        "rezeption should receive ZURUECK notification"
    );

    let arzt_list = praxis_aufgabe_repo::list_for_user(&pool, "seed-arzt-001", false, 50)
        .await
        .expect("arzt list");
    assert!(
        arzt_list
            .iter()
            .any(|a| a.id == created.id && a.status == "ZURUECK"),
        "creator keeps task visible until VALIDIERT"
    );

    let rez_pool = praxis_aufgabe_repo::list_posteingang_rezeption(&pool, 50)
        .await
        .expect("rez pool");
    assert!(
        rez_pool.iter().any(|a| a.id == created.id),
        "returned task appears in rezeption posteingang"
    );
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
        false,
        false,
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
        false,
        false,
    )
    .expect_err("arzt cannot reopen without ZURUECK");
    assert!(matches!(err, AppError::ValidationCode(_)));
}

#[tokio::test]
async fn direct_aufgabe_visible_only_to_creator_and_assignee() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let to_arzt = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id.clone()),
            typ: "SONSTIGES".into(),
            titel: "Privat an Arzt".into(),
            body: Some("Nur Ersteller + Arzt".into()),
            assignee_role: None,
            assignee_user_id: Some("seed-arzt-001".into()),
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-rez-001",
    )
    .await
    .expect("rez -> arzt");

    let arzt_inbox = praxis_aufgabe_repo::list_for_user(&pool, "seed-arzt-001", false, 50)
        .await
        .expect("arzt inbox");
    assert!(arzt_inbox.iter().any(|a| a.id == to_arzt.id));

    let creator_out = praxis_aufgabe_repo::list_for_user(&pool, "seed-rez-001", true, 50)
        .await
        .expect("rez creator");
    assert!(creator_out.iter().any(|a| a.id == to_arzt.id));

    let other_rez = praxis_aufgabe_repo::list_for_user(&pool, "other-rez-user", true, 50)
        .await
        .expect("other rez");
    assert!(!other_rez.iter().any(|a| a.id == to_arzt.id));

    let to_rez = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id.clone()),
            typ: "TERMIN".into(),
            titel: "Privat an Rezeption".into(),
            body: None,
            assignee_role: None,
            assignee_user_id: Some("seed-rez-001".into()),
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-arzt-001",
    )
    .await
    .expect("arzt -> rez person");

    let rez_direct = praxis_aufgabe_repo::list_for_user(&pool, "seed-rez-001", true, 50)
        .await
        .expect("named rez");
    assert!(rez_direct.iter().any(|a| a.id == to_rez.id));

    let other_rez_direct = praxis_aufgabe_repo::list_for_user(&pool, "other-rez-user", true, 50)
        .await
        .expect("other rez direct");
    assert!(!other_rez_direct.iter().any(|a| a.id == to_rez.id));

    let pool_task = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: Some(patient_id),
            typ: "DRUCK".into(),
            titel: "Pool Aufgabe".into(),
            body: None,
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "seed-arzt-001",
    )
    .await
    .expect("pool");

    let any_rez = praxis_aufgabe_repo::list_for_user(&pool, "other-rez-user", true, 50)
        .await
        .expect("any rez pool");
    assert!(any_rez.iter().any(|a| a.id == pool_task.id));
}
