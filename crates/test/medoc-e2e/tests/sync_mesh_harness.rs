//! Three-database sync harness: replica A writes, the main router relays, replica B reads.

use chrono::NaiveDate;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::entities::treatment::CreateExamination;
use medoc_core::domain::enums::Sex;
use medoc_core::infrastructure::database::repos::clinical::chart as chart_repo;
use medoc_core::infrastructure::database::repos::clinical::patient as patient_repo;
use medoc_e2e::harness::SyncMesh;
use medoc_sync::merge::{apply_remote_entry_phased, ConflictPolicy};

#[path = "sync_mesh_harness/master_data.rs"]
mod master_data;

#[tokio::test]
async fn patient_created_on_replica_a_is_visible_on_replica_b() {
    let mut mesh = SyncMesh::connect().await;

    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Mesh Patient".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1991, 3, 4).unwrap(),
            sex: Sex::Female,
            insurance_number: "MESH-A-1".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("create on A");

    let pool_a = mesh.replica_a.clone();
    let device_a = mesh.device_a.clone();
    let token_a = mesh.token_a.clone();
    let pushed = mesh.push_pending(&pool_a, &device_a, &token_a).await;
    assert!(
        pushed["accepted"].as_i64().unwrap_or(0) >= 1,
        "main accepted A's patient: {pushed:?}"
    );

    let device_b = mesh.device_b.clone();
    let token_b = mesh.token_b.clone();
    let entries = mesh.pull_entries(&device_b, &token_b).await;
    let patient = entries
        .iter()
        .find(|e| e.entity_table == "patient" && e.entity_id == created.id)
        .unwrap_or_else(|| panic!("B pull missing patient {}: {entries:?}", created.id));

    let pool_b = mesh.replica_b.clone();
    apply_remote_entry_phased(
        &pool_b,
        &device_b,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        patient,
    )
    .await
    .expect("apply on B");

    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(&created.id)
        .fetch_one(&pool_b)
        .await
        .expect("patient row on B");
    assert_eq!(name, "Mesh Patient");
}

#[tokio::test]
async fn later_edit_wins_on_both_devices_for_examination() {
    let mesh = SyncMesh::connect().await;
    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Exam LWW".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1988, 2, 2).unwrap(),
            sex: Sex::Male,
            insurance_number: "EXAM-LWW".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    let chart_id: String = sqlx::query_scalar("SELECT id FROM patient_chart WHERE patient_id = ?1")
        .bind(&created.id)
        .fetch_one(&mesh.replica_a)
        .await
        .expect("chart");
    sqlx::query(
        "INSERT INTO examination (id, chart_id, chief_complaint, updated_at)
         VALUES ('exam-mesh-1', ?1, 'old', '2099-01-01T00:00:00Z')",
    )
    .bind(&chart_id)
    .execute(&mesh.replica_a)
    .await
    .expect("exam");
    for pool in [&mesh.replica_b, &mesh.main.pool] {
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
             VALUES (?1, 'Exam LWW', '1988-02-02', 'MALE', 'EXAM-LWW')",
        )
        .bind(&created.id)
        .execute(pool)
        .await
        .expect("patient parent");
        sqlx::query("INSERT INTO patient_chart (id, patient_id) VALUES (?1, ?2)")
            .bind(&chart_id)
            .bind(&created.id)
            .execute(pool)
            .await
            .expect("chart parent");
    }
    let payload = format!(
        r#"{{"id":"exam-mesh-1","chart_id":"{chart_id}","chief_complaint":"new","updated_at":"2099-06-01T00:00:00Z"}}"#
    );
    let entry = medoc_sync::repo::OutboxEntry {
        id: "oe-exam-1".into(),
        device_id: mesh.device_a.clone(),
        seq: 9001,
        entity_table: "examination".into(),
        entity_id: "exam-mesh-1".into(),
        op: "UPDATE".into(),
        payload_json: payload,
        created_at: "2099-06-01T00:00:00Z".into(),
    };
    apply_remote_entry_phased(
        &mesh.replica_b,
        &mesh.device_b,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &entry,
    )
    .await
    .expect("apply B");
    apply_remote_entry_phased(
        &mesh.main.pool,
        &mesh.device_a,
        true,
        false,
        ConflictPolicy::LastWriteWins,
        &entry,
    )
    .await
    .expect("apply master");
    let on_b: String =
        sqlx::query_scalar("SELECT chief_complaint FROM examination WHERE id = 'exam-mesh-1'")
            .fetch_one(&mesh.replica_b)
            .await
            .expect("B");
    let on_m: String =
        sqlx::query_scalar("SELECT chief_complaint FROM examination WHERE id = 'exam-mesh-1'")
            .fetch_one(&mesh.main.pool)
            .await
            .expect("M");
    assert_eq!(on_b, "new");
    assert_eq!(on_m, "new");
}

#[tokio::test]
async fn release_examination_for_billing_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Release Exam".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1985, 1, 1).unwrap(),
            sex: Sex::Female,
            insurance_number: "REL-EX".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    let chart_id: String = sqlx::query_scalar("SELECT id FROM patient_chart WHERE patient_id = ?1")
        .bind(&created.id)
        .fetch_one(&mesh.replica_a)
        .await
        .expect("chart");
    let exam = chart_repo::create_examination(
        &mesh.replica_a,
        &CreateExamination {
            chart_id: chart_id.clone(),
            chief_complaint: Some("release".into()),
            results: None,
            diagnosis: None,
            examination_number: None,
            category: None,
            service_name: None,
            total_cost: Some(15.0),
        },
    )
    .await
    .expect("exam");
    chart_repo::release_examination_for_billing(&mesh.replica_a, &exam.id, "seed-physician-001")
        .await
        .expect("release");
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "examination" && e.entity_id == exam.id && e.op == "UPDATE"),
        "missing examination UPDATE: {entries:?}"
    );
    let released: Option<String> =
        sqlx::query_scalar("SELECT released_by_physician_id FROM examination WHERE id = ?1")
            .bind(&exam.id)
            .fetch_one(&mesh.replica_b)
            .await
            .expect("row");
    assert_eq!(released.as_deref(), Some("seed-physician-001"));
}

async fn push_pull_apply_all(mesh: &mut SyncMesh) -> Vec<medoc_sync::repo::OutboxEntry> {
    let pool_a = mesh.replica_a.clone();
    let device_a = mesh.device_a.clone();
    let token_a = mesh.token_a.clone();
    let _ = mesh.push_pending(&pool_a, &device_a, &token_a).await;
    let device_b = mesh.device_b.clone();
    let token_b = mesh.token_b.clone();
    let mut entries = mesh.pull_entries(&device_b, &token_b).await;
    entries.sort_by_key(|e| e.seq);
    for entry in &entries {
        apply_remote_entry_phased(
            &mesh.replica_b,
            &device_b,
            false,
            true,
            ConflictPolicy::LastWriteWins,
            entry,
        )
        .await
        .expect("apply");
    }
    entries
}

#[tokio::test]
async fn set_cash_verified_for_ids_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Cash Verified".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1980, 1, 1).unwrap(),
            sex: Sex::Male,
            insurance_number: "CASH-V".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    let pay = medoc_core::infrastructure::database::repos::billing::payment::create(
        &mesh.replica_a,
        &medoc_core::domain::entities::payment::CreatePayment {
            patient_id: created.id.clone(),
            amount: 12.0,
            payment_method: medoc_core::domain::enums::PaymentMethod::Cash,
            service_item_id: None,
            description: Some("cash".into()),
            treatment_id: None,
            examination_id: None,
            amount_expected: Some(12.0),
        },
    )
    .await
    .expect("payment");
    medoc_core::infrastructure::database::repos::billing::payment::set_cash_verified_for_ids(
        &mesh.replica_a,
        std::slice::from_ref(&pay.id),
        1,
    )
    .await
    .expect("verify");
    let wanted = push_pull_apply_all(&mut mesh).await;
    assert!(
        wanted
            .iter()
            .any(|e| e.entity_table == "payment" && e.op == "UPDATE"),
        "missing payment UPDATE: {wanted:?}"
    );
    let verified: i64 = sqlx::query_scalar("SELECT cash_verified FROM payment WHERE id = ?1")
        .bind(&pay.id)
        .fetch_one(&mesh.replica_b)
        .await
        .expect("row");
    assert_eq!(verified, 1);
}

#[tokio::test]
async fn reassign_or_reject_clinical_ownership_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&mesh.replica_a)
        .await
        .ok();
    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Reassign Apt".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1977, 4, 4).unwrap(),
            sex: Sex::Female,
            insurance_number: "REAS-A".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role) VALUES ('extra-phys', 'Extra', 'extra@p.de', 'x', 'PHYSICIAN')",
    )
    .execute(&mesh.replica_a)
    .await
    .expect("staff");
    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id, updated_at)
         VALUES ('apt-reassign-1', '2026-11-08', '09:00', 'CHECKUP', 'PLANNED', ?1, 'extra-phys', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&created.id)
    .execute(&mesh.replica_a)
    .await
    .expect("apt");
    let apt_id = "apt-reassign-1".to_string();
    medoc_core::infrastructure::database::repos::admin::staff::delete(
        &mesh.replica_a,
        "extra-phys",
    )
    .await
    .expect("delete staff");
    let wanted = push_pull_apply_all(&mut mesh).await;
    assert!(
        wanted
            .iter()
            .any(|e| e.entity_table == "appointment" && e.op == "UPDATE"),
        "missing appointment UPDATE: {wanted:?}"
    );
    let phys: String = sqlx::query_scalar("SELECT physician_id FROM appointment WHERE id = ?1")
        .bind(&apt_id)
        .fetch_one(&mesh.replica_b)
        .await
        .expect("row");
    assert_ne!(phys, "extra-phys");
}

#[tokio::test]
async fn delete_for_patient_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Hint Delete".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1975, 5, 5).unwrap(),
            sex: Sex::Male,
            insurance_number: "HINT-D".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO chart_next_appointment_hint (patient_id, hint_json, updated_at)
         VALUES (?1, '{\"when\":\"soon\"}', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&created.id)
    .execute(&mesh.replica_a)
    .await
    .expect("hint");
    medoc_core::infrastructure::database::repos::clinical::chart_next_appointment::delete_for_patient(
        &mesh.replica_a,
        &created.id,
    )
    .await
    .expect("delete hint");
    let wanted = push_pull_apply_all(&mut mesh).await;
    assert!(
        wanted
            .iter()
            .any(|e| e.entity_table == "chart_next_appointment_hint" && e.op == "DELETE"),
        "missing hint DELETE: {wanted:?}"
    );
}

#[tokio::test]
async fn insert_comment_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let task = medoc_core::infrastructure::database::repos::scheduling::practice_task::insert(
        &mesh.replica_a,
        &medoc_core::domain::entities::practice_task::CreatePracticeTask {
            patient_id: None,
            kind: "OTHER".into(),
            title: "Comment task".into(),
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
    .expect("task");
    let comment =
        medoc_core::infrastructure::database::repos::scheduling::practice_task::insert_comment(
            &mesh.replica_a,
            &task.id,
            "seed-physician-001",
            "hello replica",
        )
        .await
        .expect("comment");
    let wanted = push_pull_apply_all(&mut mesh).await;
    assert!(
        wanted
            .iter()
            .any(|e| e.entity_table == "practice_task_comment" && e.op == "INSERT"),
        "missing comment INSERT: {wanted:?}"
    );
    let body: String = sqlx::query_scalar("SELECT body FROM practice_task_comment WHERE id = ?1")
        .bind(&comment.id)
        .fetch_one(&mesh.replica_b)
        .await
        .expect("row");
    assert_eq!(body, "hello replica");
}

#[tokio::test]
async fn attachment_file_reaches_replica_b() {
    let mut mesh = SyncMesh::connect().await;
    let created = patient_repo::create(
        &mesh.replica_a,
        &CreatePatient {
            name: "Blob Patient".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1990, 5, 5).unwrap(),
            sex: Sex::Female,
            insurance_number: "BLOB-1".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("patient");
    let chart_id: String = sqlx::query_scalar("SELECT id FROM patient_chart WHERE patient_id = ?1")
        .bind(&created.id)
        .fetch_one(&mesh.replica_a)
        .await
        .expect("chart");
    let dir = std::env::temp_dir().join(format!("medoc-att-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("tmpdir");
    let bytes = b"mesh-attachment-bytes";
    let row = medoc_core::infrastructure::database::repos::clinical::chart_attachment::create(
        &mesh.replica_a,
        &dir,
        &chart_id,
        "scan.pdf",
        "application/pdf",
        "LAB",
        bytes,
    )
    .await
    .expect("create attachment");
    let sha = medoc_core::infrastructure::database::sync_blob::sha256_hex(bytes);
    let token_a = mesh.token_a.clone();
    let (put_status, _) = mesh
        .main
        .put_bytes(
            &format!("/api/v1/sync/blob/{sha}"),
            bytes.to_vec(),
            Some(&token_a),
        )
        .await;
    assert!(
        put_status == 200 || put_status == 204,
        "put blob on main: {put_status}"
    );
    let entries = push_pull_apply_all(&mut mesh).await;
    assert!(
        entries
            .iter()
            .any(|e| e.entity_table == "chart_attachment" && e.entity_id == row.id),
        "missing attachment outbox: {entries:?}"
    );
    let token_b = mesh.token_b.clone();
    let (get_status, got) = mesh
        .main
        .get_bytes(&format!("/api/v1/sync/blob/{sha}"), Some(&token_b))
        .await;
    assert_eq!(get_status, 200, "get blob from main");
    medoc_core::infrastructure::database::sync_blob::put_verified(&mesh.replica_b, &sha, &got)
        .await
        .expect("store on B");
    let stored = medoc_core::infrastructure::database::sync_blob::get_bytes(&mesh.replica_b, &sha)
        .await
        .expect("bytes on B");
    assert_eq!(stored, bytes);
    let name: String =
        sqlx::query_scalar("SELECT display_name FROM chart_attachment WHERE id = ?1")
            .bind(&row.id)
            .fetch_one(&mesh.replica_b)
            .await
            .expect("row on B");
    assert_eq!(name, "scan.pdf");
}

async fn count_id(pool: &sqlx::SqlitePool, table: &str, id: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"))
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("count")
}

async fn shared_staff_id(pool: &sqlx::SqlitePool) -> String {
    let preferred: Option<String> =
        sqlx::query_scalar("SELECT id FROM staff WHERE id = 'seed-physician-001'")
            .fetch_optional(pool)
            .await
            .expect("staff lookup");
    if let Some(id) = preferred {
        return id;
    }
    sqlx::query_scalar("SELECT id FROM staff ORDER BY id LIMIT 1")
        .fetch_one(pool)
        .await
        .expect("seed staff")
}
