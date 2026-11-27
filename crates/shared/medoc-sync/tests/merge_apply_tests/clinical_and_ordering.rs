//! Clinical rows, payments and apply ordering across devices.

use super::*;

pub(super) async fn ensure_seed_chart(pool: &SqlitePool) {
    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('seed-patient-001', 'Seed Patient', '1980-01-01', 'FEMALE', 'SEED-INS-001', 'ACTIVE')",
    )
    .execute(pool)
    .await
    .expect("seed patient");
    sqlx::query(
        "INSERT OR IGNORE INTO patient_chart (id, patient_id) VALUES ('seed-chart-001', 'seed-patient-001')",
    )
    .execute(pool)
    .await
    .expect("seed chart");
}

pub(super) async fn seed_examination(
    pool: &SqlitePool,
    id: &str,
    complaint: &str,
    updated_at: &str,
) {
    ensure_seed_chart(pool).await;
    sqlx::query(
        "INSERT INTO examination (id, chart_id, chief_complaint, updated_at)
         VALUES (?1, 'seed-chart-001', ?2, ?3)",
    )
    .bind(id)
    .bind(complaint)
    .bind(updated_at)
    .execute(pool)
    .await
    .expect("seed examination");
}

pub(super) async fn seed_payment_row(
    pool: &SqlitePool,
    id: &str,
    patient_id: &str,
    amount: f64,
    updated_at: &str,
) {
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, updated_at)
         VALUES (?1, ?2, ?3, 'CASH', 'OUTSTANDING', ?4)",
    )
    .bind(id)
    .bind(patient_id)
    .bind(amount)
    .bind(updated_at)
    .execute(pool)
    .await
    .expect("seed payment");
}

#[tokio::test]
pub(super) async fn later_edit_wins_on_both_devices_for_examination() {
    let pool = fresh_pool().await;
    let id = "exam-lww-1";
    seed_examination(&pool, id, "older", "2099-01-01T00:00:00Z").await;
    let payload = format!(
        r#"{{"id":"{id}","chart_id":"seed-chart-001","chief_complaint":"newer","updated_at":"2099-06-01T00:00:00Z"}}"#
    );
    let e = entry("replica-a", 40, "examination", id, "UPDATE", &payload);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    let complaint: String =
        sqlx::query_scalar("SELECT chief_complaint FROM examination WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(complaint, "newer");

    let replica = fresh_pool().await;
    seed_examination(&replica, id, "older", "2099-01-01T00:00:00Z").await;
    apply_remote_entry_phased(
        &replica,
        LOCAL_REPLICA,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &e,
    )
    .await
    .unwrap();
    let complaint_b: String =
        sqlx::query_scalar("SELECT chief_complaint FROM examination WHERE id = ?1")
            .bind(id)
            .fetch_one(&replica)
            .await
            .unwrap();
    assert_eq!(complaint_b, "newer");
}

#[tokio::test]
pub(super) async fn same_for_payment() {
    let pool = fresh_pool().await;
    let patient_id = "00000000-0000-0000-0000-0000000000ac";
    seed_patient(&pool, patient_id, "Pay", "2099-01-01 00:00:00").await;
    let pay_id = "pay-lww-1";
    seed_payment_row(&pool, pay_id, patient_id, 10.0, "2099-01-01T00:00:00Z").await;
    let payload = format!(
        r#"{{"id":"{pay_id}","patient_id":"{patient_id}","amount":22.0,"payment_method":"CASH","status":"OUTSTANDING","updated_at":"2099-06-01T00:00:00Z"}}"#
    );
    let e = entry("replica-a", 41, "payment", pay_id, "UPDATE", &payload);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    let amount: f64 = sqlx::query_scalar("SELECT amount FROM payment WHERE id = ?1")
        .bind(pay_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((amount - 22.0).abs() < f64::EPSILON);
}

#[tokio::test]
pub(super) async fn mesh_equal_timestamp_keeps_local() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-0000000000ad";
    seed_patient(&pool, id, "Local Mesh", "2099-05-01T00:00:00Z").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Peer Mesh","updated_at":"2099-05-01T00:00:00Z"}}"#);
    let e = entry("peer-replica", 42, "patient", id, "UPDATE", &payload);
    apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &e,
    )
    .await
    .unwrap();
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Local Mesh");
}

/// F146: tables keyed by a column other than `id` accept remote inserts,
/// updates and deletes.
#[tokio::test]
pub(super) async fn apply_insert_update_delete_on_patient_keyed_hint() {
    let pool = fresh_pool().await;
    let pid = "hint-patient-1";
    seed_patient(&pool, pid, "Hint", "2099-01-01 00:00:00").await;
    let ins = entry(
        "remote",
        1,
        "chart_next_appointment_hint",
        pid,
        "INSERT",
        &format!(
            r#"{{"patient_id":"{pid}","hint_json":"{{}}","updated_at":"2099-01-02T00:00:00Z"}}"#
        ),
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &ins,
    )
    .await
    .expect("insert hint");
    let upd = entry(
        "remote",
        2,
        "chart_next_appointment_hint",
        pid,
        "UPDATE",
        &format!(
            r#"{{"patient_id":"{pid}","hint_json":"{{\"a\":1}}","updated_at":"2099-01-03T00:00:00Z"}}"#
        ),
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &upd,
    )
    .await
    .expect("update hint");
    let hint: String = sqlx::query_scalar(
        "SELECT hint_json FROM chart_next_appointment_hint WHERE patient_id = ?1",
    )
    .bind(pid)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(hint, r#"{"a":1}"#);
    let del = entry(
        "remote",
        3,
        "chart_next_appointment_hint",
        pid,
        "DELETE",
        r#"{}"#,
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &del,
    )
    .await
    .expect("delete hint");
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM chart_next_appointment_hint WHERE patient_id = ?1",
    )
    .bind(pid)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(n, 0);
}

/// F147: composite-key `chart_validation` rows apply by `patient_id|section`.
#[tokio::test]
pub(super) async fn apply_chart_validation_by_composite_key() {
    let pool = fresh_pool().await;
    let pid = "cv-patient-1";
    seed_patient(&pool, pid, "CV", "2099-01-01 00:00:00").await;
    for (seq, section) in [(1, "anamnesis"), (2, "findings")] {
        let e = entry(
            "remote",
            seq,
            "chart_validation",
            &format!("{pid}|{section}"),
            "INSERT",
            &format!(
                r#"{{"patient_id":"{pid}","section_or_item":"{section}","validated_at":"2099-01-02T00:00:00Z","updated_at":"2099-01-02T00:00:00Z"}}"#
            ),
        );
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .expect("insert cv");
    }
    let del = entry(
        "remote",
        3,
        "chart_validation",
        &format!("{pid}|anamnesis"),
        "DELETE",
        r#"{}"#,
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &del,
    )
    .await
    .expect("delete cv");
    let left: Vec<String> =
        sqlx::query_scalar("SELECT section_or_item FROM chart_validation WHERE patient_id = ?1")
            .bind(pid)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(left, vec!["findings".to_string()]);
}

/// A peer must not overwrite or delete device-local settings (sync config,
/// device id, TLS pin …) and must not write a key other than the entity id.
#[tokio::test]
pub(super) async fn apply_refuses_device_local_app_kv_keys() {
    let pool = fresh_pool().await;
    sqlx::query("INSERT INTO app_kv (key, value) VALUES ('sync.lan_tls_pin.v1', 'local-pin')")
        .execute(&pool)
        .await
        .unwrap();

    let overwrite = entry(
        "remote",
        41,
        "app_kv",
        "sync.lan_tls_pin.v1",
        "UPDATE",
        r#"{"key":"sync.lan_tls_pin.v1","value":"attacker-pin","updated_at":"2099-12-01T00:00:00Z"}"#,
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &overwrite,
    )
    .await
    .unwrap();
    let delete = entry(
        "remote",
        42,
        "app_kv",
        "sync.lan_tls_pin.v1",
        "DELETE",
        "{}",
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &delete,
    )
    .await
    .unwrap();
    let val: String =
        sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'sync.lan_tls_pin.v1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(val, "local-pin");

    // Entity id names a harmless key, payload names a protected one.
    let smuggled = entry(
        "remote",
        43,
        "app_kv",
        "harmless.key",
        "INSERT",
        r#"{"key":"sync.deployment.v1","value":"x"}"#,
    );
    assert!(apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &smuggled
    )
    .await
    .is_err());
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM app_kv WHERE key = 'sync.deployment.v1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
pub(super) async fn template_and_appointment_apply_before_their_parents() {
    let pool = fresh_pool().await;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .unwrap();
    let blocked = sqlx::query(
        "INSERT INTO supplier_pharma_template (id, supplier_id, pharma_consultant_id, product_id)
         VALUES ('direct', 'seed-sup-01', 'seed-pc-01', 'seed-prac-prod-01')",
    )
    .execute(&pool)
    .await;
    assert!(blocked.is_err(), "foreign keys are on for this connection");

    let template = entry(
        "remote",
        1,
        "supplier_pharma_template",
        "seed-spt-01",
        "INSERT",
        r#"{"supplier_id":"seed-sup-01","pharma_consultant_id":"seed-pc-01","product_id":"seed-prac-prod-01","sort_order":10,"active":1}"#,
    );
    apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &template,
    )
    .await
    .expect("template is stored even though product is later in the copy");
    let templates: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM supplier_pharma_template WHERE id = 'seed-spt-01'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(templates, 1);

    let appointment = entry(
        "remote",
        2,
        "appointment",
        "seed-yr-apt-01405",
        "INSERT",
        r#"{"date":"2099-06-01","time":"09:00","kind":"CHECKUP","status":"PLANNED","patient_id":"patient-later","physician_id":"seed-physician-001"}"#,
    );
    apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &appointment,
    )
    .await
    .expect("appointment is stored even though the patient is later in the copy");
    let appts: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM appointment WHERE id = 'seed-yr-apt-01405'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(appts, 1);

    for _ in 0..4 {
        let mut conn = pool.acquire().await.unwrap();
        let on: i32 = sqlx::query_scalar("PRAGMA foreign_keys")
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(
            on, 1,
            "sync apply must not return a connection with foreign keys off"
        );
    }
}

#[tokio::test]
pub(super) async fn product_delete_applies_while_a_template_still_points_at_it() {
    let pool = fresh_pool().await;
    let mut conn = pool.acquire().await.unwrap();
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO product (id, name, category, price) VALUES ('seed-prod-007', 'Gel', 'MED', 1)",
    )
    .execute(&mut *conn)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO supplier_pharma_template (id, supplier_id, pharma_consultant_id, product_id)
         VALUES ('seed-spt-01', 'seed-sup-01', 'seed-pc-01', 'seed-prod-007')",
    )
    .execute(&mut *conn)
    .await
    .unwrap();
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *conn)
        .await
        .unwrap();
    drop(conn);

    let deletion = entry("replica", 1, "product", "seed-prod-007", "DELETE", "{}");
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &deletion,
    )
    .await
    .expect("a product delete must not fail the push when a template still points at it");
    let products: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM product WHERE id = 'seed-prod-007'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(products, 0);
    let templates: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM supplier_pharma_template WHERE id = 'seed-spt-01'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(templates, 1);
}

/// Remote practice_task INSERT without a synced notification must still create
/// a local PRACTICE_TASK_ASSIGNED for the assignee (sync gap-fill hook).
#[tokio::test]
pub(super) async fn practice_task_remote_insert_ensures_assignee_notification() {
    let pool = fresh_pool().await;
    seed_patient(
        &pool,
        "sync-task-pat",
        "Sync Task Pat",
        "2099-01-01 00:00:00",
    )
    .await;
    let task_id = "sync-task-remote-001";
    let payload = format!(
        r#"{{"id":"{task_id}","patient_id":"sync-task-pat","kind":"TICKET","title":"Remote ticket","body":"Please review","assignee_role":null,"assignee_user_id":"seed-physician-001","created_by":"seed-rez-001","treatment_id":null,"examination_id":null,"service_name":null,"total_cost":null,"payment_id":null,"done_note":null,"return_reason":null,"status":"OPEN","legacy_ticket_id":null,"created_at":"2099-06-01T12:00:00Z","updated_at":"2099-06-01T12:00:00Z"}}"#
    );
    let e = entry(
        "remote-device",
        90,
        "practice_task",
        task_id,
        "INSERT",
        &payload,
    );
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .expect("apply task"),
        "remote task insert applies"
    );
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM practice_task WHERE id = ?1 AND assignee_user_id = 'seed-physician-001'",
    )
    .bind(task_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(n, 1, "task visible for assignee");
    let assigned: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM in_app_notification
         WHERE user_id = 'seed-physician-001'
           AND kind = 'PRACTICE_TASK_ASSIGNED'
           AND payload_json LIKE ?1",
    )
    .bind(format!("%\"taskId\":\"{task_id}\"%"))
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        assigned, 1,
        "gap-fill creates PRACTICE_TASK_ASSIGNED for remote task"
    );
}
