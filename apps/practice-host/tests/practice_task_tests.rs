//! FA-AUFG-01/06 — practice_task IPC + status machine + ticket migration.

use medoc_lib::application::practice_task_notify;
use medoc_lib::application::rbac::Role;
use medoc_lib::domain::entities::practice_task::CreatePracticeTask;
use medoc_lib::domain::services::workflow_transitions;
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::{in_app_notification_repo, practice_task_repo};

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn seed_patient(pool: &sqlx::SqlitePool) -> String {
    let id = "t-aufg-pat".to_string();
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Task Pat', '1990-01-01', 'MALE', 'V-AUFG')",
    )
    .bind(&id)
    .execute(pool)
    .await
    .expect("patient");
    id
}

#[tokio::test]
async fn migrate_practice_ticket_to_task() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;
    sqlx::query(
        "INSERT INTO practice_ticket (id, patient_id, from_user_id, to_physician_id, body, status)
         VALUES ('t-mig-ticket', ?1, 'seed-rez-001', 'seed-physician-001', 'Please review X-ray', 'OPEN')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("ticket");

    sqlx::query(
        r#"INSERT INTO practice_task (
            id, patient_id, kind, title, body, assignee_user_id, created_by, status,
            legacy_ticket_id, created_at, updated_at
        )
        SELECT
            t.id, t.patient_id, 'OTHER',
            CASE WHEN length(t.body) > 80 THEN substr(t.body, 1, 80) || '…' ELSE t.body END,
            t.body, t.to_physician_id, t.from_user_id,
            CASE t.status WHEN 'DONE' THEN 'VALIDATED' WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS' ELSE 'OPEN' END,
            t.id, t.created_at, t.updated_at
        FROM practice_ticket t WHERE t.id = 't-mig-ticket'
          AND NOT EXISTS (SELECT 1 FROM practice_task a WHERE a.legacy_ticket_id = t.id)"#,
    )
    .execute(&pool)
    .await
    .expect("migrate row");

    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_task WHERE legacy_ticket_id = 't-mig-ticket'",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(n.0, 1, "migration should copy ticket once");
}

#[tokio::test]
async fn physician_to_reception_fulfillment_and_validation_flow() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let a = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id.clone()),
            kind: "BILLING".into(),
            title: "Payment erfassen".into(),
            body: Some("80 EUR Füllung".into()),
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: Some("Füllung".into()),
            total_cost: Some(80.0),
        },
        "seed-physician-001",
    )
    .await
    .expect("create");

    workflow_transitions::practice_task_status_transition(
        &a.status,
        "IN_PROGRESS",
        Role::Reception,
        a.assignee_role.as_deref(),
        a.assignee_user_id.as_deref(),
        &a.created_by,
        "seed-rez-001",
        false,
        false,
    )
    .expect("rez start");

    let mid = practice_task_repo::update_status(&pool, &a.id, "IN_PROGRESS", None, None, None)
        .await
        .expect("update");

    workflow_transitions::practice_task_status_transition(
        &mid.status,
        "DONE_RECEPTION",
        Role::Reception,
        mid.assignee_role.as_deref(),
        mid.assignee_user_id.as_deref(),
        &mid.created_by,
        "seed-rez-001",
        false,
        false,
    )
    .expect("rez done transition");

    let done = practice_task_repo::update_status(
        &pool,
        &a.id,
        "DONE_RECEPTION",
        Some("Kasse erfasst"),
        None,
        None,
    )
    .await
    .expect("done");

    workflow_transitions::practice_task_status_transition(
        &done.status,
        "VALIDATED",
        Role::Physician,
        done.assignee_role.as_deref(),
        done.assignee_user_id.as_deref(),
        &done.created_by,
        "seed-physician-001",
        false,
        false,
    )
    .expect("physician validate");

    let closed = practice_task_repo::update_status(&pool, &a.id, "VALIDATED", None, None, None)
        .await
        .expect("validated");
    assert_eq!(closed.status, "VALIDATED");
}

#[tokio::test]
async fn done_reception_notifies_creating_physician_fa_aufg_04() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let a = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id.clone()),
            kind: "OTHER".into(),
            title: "Print X-ray".into(),
            body: Some("Please print".into()),
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-physician-001",
    )
    .await
    .expect("create");

    let mid = practice_task_repo::update_status(&pool, &a.id, "IN_PROGRESS", None, None, None)
        .await
        .expect("in processing");

    let done = practice_task_repo::update_status(
        &pool,
        &a.id,
        "DONE_RECEPTION",
        Some("Printout is ready"),
        None,
        None,
    )
    .await
    .expect("done");

    practice_task_notify::notify_creator_if_task_done_by_other(
        &pool,
        &mid,
        &done,
        "DONE_RECEPTION",
        "seed-rez-001",
        Some("Printout is ready"),
    )
    .await
    .expect("notify");

    let unread = in_app_notification_repo::count_unread(&pool, "seed-physician-001")
        .await
        .expect("count");
    assert_eq!(unread, 1);

    let rows = in_app_notification_repo::list_for_user(&pool, "seed-physician-001", 5)
        .await
        .expect("list");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].kind, "PRACTICE_TASK_DONE");
    assert!(rows[0].title.contains("Task Pat"));
    assert_eq!(rows[0].body, "Printout is ready");
}

#[tokio::test]
async fn done_reception_skips_notification_when_creator_completes_own_task() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let a = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id),
            kind: "OTHER".into(),
            title: "Selbst erledigen".into(),
            body: None,
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-physician-001",
    )
    .await
    .expect("create");

    let done = practice_task_repo::update_status(
        &pool,
        &a.id,
        "DONE_RECEPTION",
        Some("Selbst"),
        None,
        None,
    )
    .await
    .expect("done");

    practice_task_notify::notify_creator_if_task_done_by_other(
        &pool,
        &a,
        &done,
        "DONE_RECEPTION",
        "seed-physician-001",
        Some("Selbst"),
    )
    .await
    .expect("notify noop");

    let unread = in_app_notification_repo::count_unread(&pool, "seed-physician-001")
        .await
        .expect("count");
    assert_eq!(unread, 0);
}

#[tokio::test]
async fn g_21_physician_to_rez_flow_inbox_notify_and_pending_validation() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let created = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id.clone()),
            kind: "OTHER".into(),
            title: "G21 Live Proxy Task".into(),
            body: Some("Manueller Dialog-Äquivalent".into()),
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-physician-001",
    )
    .await
    .expect("physician creates");

    let rez_inbox = practice_task_repo::list_inbox_reception(&pool, 50)
        .await
        .expect("rez list");
    assert!(rez_inbox.iter().any(|a| a.id == created.id));
    assert!(
        practice_task_repo::count_open_for_reception(&pool, "seed-reception-001")
            .await
            .expect("count")
            >= 1
    );

    workflow_transitions::practice_task_status_transition(
        &created.status,
        "IN_PROGRESS",
        Role::Reception,
        created.assignee_role.as_deref(),
        created.assignee_user_id.as_deref(),
        &created.created_by,
        "seed-rez-001",
        false,
        false,
    )
    .expect("rez start");
    let mid =
        practice_task_repo::update_status(&pool, &created.id, "IN_PROGRESS", None, None, None)
            .await
            .expect("in processing");

    workflow_transitions::practice_task_status_transition(
        &mid.status,
        "DONE_RECEPTION",
        Role::Reception,
        mid.assignee_role.as_deref(),
        mid.assignee_user_id.as_deref(),
        &mid.created_by,
        "seed-rez-001",
        false,
        false,
    )
    .expect("rez done");
    let done = practice_task_repo::update_status(
        &pool,
        &created.id,
        "DONE_RECEPTION",
        Some("Done in G21 Test"),
        None,
        None,
    )
    .await
    .expect("done");

    practice_task_notify::notify_creator_if_task_done_by_other(
        &pool,
        &mid,
        &done,
        "DONE_RECEPTION",
        "seed-rez-001",
        Some("Done in G21 Test"),
    )
    .await
    .expect("notify physician");

    let rez_after = practice_task_repo::list_inbox_reception(&pool, 50)
        .await
        .expect("rez list after");
    assert!(!rez_after.iter().any(|a| a.id == created.id));

    let pending = practice_task_repo::list_pending_validation(&pool, "seed-physician-001", 50)
        .await
        .expect("physician pending");
    assert!(pending.iter().any(|a| a.id == created.id));

    let unread = in_app_notification_repo::count_unread(&pool, "seed-physician-001")
        .await
        .expect("notify count");
    assert_eq!(unread, 1);
}

#[tokio::test]
async fn physician_back_notifies_reception_and_stays_visible_until_validated() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let created = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id.clone()),
            kind: "OTHER".into(),
            title: "Return test".into(),
            body: Some("Please review".into()),
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-physician-001",
    )
    .await
    .expect("create");

    let done = practice_task_repo::update_status(
        &pool,
        &created.id,
        "DONE_RECEPTION",
        Some("Fertig"),
        None,
        None,
    )
    .await
    .expect("done");

    workflow_transitions::practice_task_status_transition(
        &done.status,
        "BACK",
        Role::Physician,
        done.assignee_role.as_deref(),
        done.assignee_user_id.as_deref(),
        &done.created_by,
        "seed-physician-001",
        false,
        false,
    )
    .expect("physician may return");
    let back = practice_task_repo::update_status(
        &pool,
        &created.id,
        "BACK",
        None,
        None,
        Some("Please correct"),
    )
    .await
    .expect("back");

    practice_task_notify::notify_assignees_if_task_back(
        &pool,
        &done,
        &back,
        "BACK",
        "seed-physician-001",
        Some("Please correct"),
    )
    .await
    .expect("notify rez");

    let rez_unread = in_app_notification_repo::count_unread(&pool, "seed-rez-001")
        .await
        .expect("rez unread");
    assert!(
        rez_unread >= 1,
        "reception should receive BACK notification"
    );

    let physician_list = practice_task_repo::list_for_user(&pool, "seed-physician-001", false, 50)
        .await
        .expect("physician list");
    assert!(
        physician_list
            .iter()
            .any(|a| a.id == created.id && a.status == "BACK"),
        "creator keeps task visible until VALIDATED"
    );

    let rez_pool = practice_task_repo::list_inbox_reception(&pool, 50)
        .await
        .expect("rez pool");
    assert!(
        rez_pool.iter().any(|a| a.id == created.id),
        "returned task appears in reception inbox"
    );
}

#[test]
fn workflow_task_rejects_invalid_transition() {
    assert!(workflow_transitions::practice_task_status_transition(
        "OPEN",
        "VALIDATED",
        Role::Reception,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-rez-001",
        false,
        false,
    )
    .is_err());
    let err = workflow_transitions::practice_task_status_transition(
        "DONE_RECEPTION",
        "OPEN",
        Role::Physician,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-physician-001",
        false,
        false,
    )
    .expect_err("physician cannot reopen without BACK");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn direct_task_visible_only_to_creator_and_assignee() {
    let pool = migrated_pool().await;
    let patient_id = seed_patient(&pool).await;

    let to_physician = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id.clone()),
            kind: "OTHER".into(),
            title: "Privat an Physician".into(),
            body: Some("Nur Ersteller + Physician".into()),
            assignee_role: None,
            assignee_user_id: Some("seed-physician-001".into()),
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-rez-001",
    )
    .await
    .expect("rez -> physician");

    let physician_inbox = practice_task_repo::list_for_user(&pool, "seed-physician-001", false, 50)
        .await
        .expect("physician inbox");
    assert!(physician_inbox.iter().any(|a| a.id == to_physician.id));

    let creator_out = practice_task_repo::list_for_user(&pool, "seed-rez-001", true, 50)
        .await
        .expect("rez creator");
    assert!(creator_out.iter().any(|a| a.id == to_physician.id));

    let other_rez = practice_task_repo::list_for_user(&pool, "other-rez-user", true, 50)
        .await
        .expect("other rez");
    assert!(!other_rez.iter().any(|a| a.id == to_physician.id));

    let to_rez = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id.clone()),
            kind: "APPOINTMENT".into(),
            title: "Privat an Reception".into(),
            body: None,
            assignee_role: None,
            assignee_user_id: Some("seed-rez-001".into()),
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-physician-001",
    )
    .await
    .expect("physician -> rez person");

    let rez_direct = practice_task_repo::list_for_user(&pool, "seed-rez-001", true, 50)
        .await
        .expect("named rez");
    assert!(rez_direct.iter().any(|a| a.id == to_rez.id));

    let other_rez_direct = practice_task_repo::list_for_user(&pool, "other-rez-user", true, 50)
        .await
        .expect("other rez direct");
    assert!(!other_rez_direct.iter().any(|a| a.id == to_rez.id));

    let pool_task = practice_task_repo::insert(
        &pool,
        &CreatePracticeTask {
            patient_id: Some(patient_id),
            kind: "PRINT".into(),
            title: "Pool Task".into(),
            body: None,
            assignee_role: Some("RECEPTION".into()),
            assignee_user_id: None,
            treatment_id: None,
            examination_id: None,
            service_name: None,
            total_cost: None,
        },
        "seed-physician-001",
    )
    .await
    .expect("pool");

    let any_rez = practice_task_repo::list_for_user(&pool, "other-rez-user", true, 50)
        .await
        .expect("any rez pool");
    assert!(any_rez.iter().any(|a| a.id == pool_task.id));
}
