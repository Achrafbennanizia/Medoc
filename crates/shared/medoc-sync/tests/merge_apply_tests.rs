//! Unit tests for `medoc_sync::merge` apply paths (T-U1).

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::merge::{apply_remote_entry, apply_remote_entry_phased, ConflictPolicy};
use medoc_sync::repo::{mark_applied, was_applied, OutboxEntry};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

const LOCAL_MASTER: &str = "local-master-id";
const LOCAL_REPLICA: &str = "local-replica-id";

async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

fn entry(device: &str, seq: i64, table: &str, id: &str, op: &str, payload: &str) -> OutboxEntry {
    OutboxEntry {
        id: format!("e{seq}"),
        device_id: device.into(),
        seq,
        entity_table: table.into(),
        entity_id: id.into(),
        op: op.into(),
        payload_json: payload.into(),
        created_at: "2099-01-01T00:00:00Z".into(),
    }
}

async fn seed_patient(pool: &SqlitePool, id: &str, name: &str, updated_at: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                              phone, email, address, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'MALE', 'V-1', NULL, NULL, NULL, 'ACTIVE',
                 '2099-01-01 00:00:00', ?3)",
    )
    .bind(id)
    .bind(name)
    .bind(updated_at)
    .execute(pool)
    .await
    .expect("seed patient");
}

#[tokio::test]
async fn apply_delete_removes_patient_row() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000001";
    seed_patient(&pool, id, "To Delete", "2099-01-01 00:00:00").await;
    let e = entry("remote", 1, "patient", id, "DELETE", r#"{"id":"x"}"#);
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn apply_delete_patient_with_appointment_does_not_fk_fail() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-0000000000aa";
    seed_patient(&pool, id, "Has Apt", "2099-01-01 00:00:00").await;
    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id)
         VALUES ('apt-fk-1', '2099-01-02', '09:00', 'CHECKUP', 'PLANNED', ?1, 'seed-physician-001')",
    )
    .bind(id)
    .execute(&pool)
    .await
    .expect("appointment");
    let e = entry("remote", 9, "patient", id, "DELETE", r#"{"id":"x"}"#);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect("patient delete with appointment");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn apply_delete_patient_chart_with_treatments_does_not_fk_fail() {
    let pool = fresh_pool().await;
    let e = entry(
        "remote",
        11,
        "patient_chart",
        "seed-chart-001",
        "DELETE",
        r#"{"id":"x"}"#,
    );
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect("chart delete");
    let n: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM patient_chart WHERE id = 'seed-chart-001'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn apply_delete_service_item_with_payment_ref_does_not_fk_fail() {
    let pool = fresh_pool().await;
    let e = entry(
        "remote",
        12,
        "service_item",
        "seed-lei-002",
        "DELETE",
        r#"{"id":"x"}"#,
    );
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect("service_item delete");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM service_item WHERE id = 'seed-lei-002'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn apply_delete_app_kv_key() {
    let pool = fresh_pool().await;
    sqlx::query("INSERT INTO app_kv (key, value) VALUES ('del.me', 'x')")
        .execute(&pool)
        .await
        .unwrap();
    let e = entry("remote", 2, "app_kv", "del.me", "DELETE", "{}");
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM app_kv WHERE key = 'del.me'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn apply_unknown_op_is_validation_error() {
    let pool = fresh_pool().await;
    let e = entry("remote", 3, "patient", "x", "PATCH", "{}");
    let err = apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect_err("bad op");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn apply_rejects_non_object_payload() {
    let pool = fresh_pool().await;
    let e = entry("remote", 4, "patient", "x", "INSERT", r#""not-an-object""#);
    let err = apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect_err("array payload");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn apply_skips_when_already_applied() {
    let pool = fresh_pool().await;
    let e = entry(
        "remote",
        5,
        "app_kv",
        "k5",
        "INSERT",
        r#"{"key":"k5","value":"version"}"#,
    );
    mark_applied(&pool, "remote", 5).await.unwrap();
    assert!(
        !apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    assert!(was_applied(&pool, "remote", 5).await.unwrap());
}

#[tokio::test]
async fn apply_inserts_new_patient_from_remote() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000002";
    let payload = format!(
        r#"{{"id":"{id}","name":"Remote New","date_of_birth":"1991-02-02","sex":"FEMALE",
            "insurance_number":"V-2","status":"ACTIVE","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-02-01T00:00:00Z"}}"#
    );
    let e = entry("remote", 6, "patient", id, "INSERT", &payload);
    assert!(apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &e
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Remote New");
}

#[tokio::test]
async fn apply_skips_stale_remote_when_local_is_newer() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000003";
    seed_patient(&pool, id, "Local Newer", "2099-06-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Stale Remote","updated_at":"2099-01-01T00:00:00Z"}}"#);
    let e = entry("master", 7, "patient", id, "UPDATE", &payload);
    assert!(apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &e
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Local Newer");
}

#[tokio::test]
async fn apply_sqlite_timestamp_format_in_payload() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000004";
    seed_patient(&pool, id, "Old", "2099-01-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"SQLite TS","updated_at":"2099-03-15 12:30:00"}}"#);
    let e = entry("master", 8, "patient", id, "UPDATE", &payload);
    assert!(apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &e
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "SQLite TS");
}

#[tokio::test]
async fn apply_rejects_disallowed_table() {
    let pool = fresh_pool().await;
    let e = entry("remote", 9, "license", "p1", "INSERT", r#"{"id":"p1"}"#);
    let err = apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect_err("bad table");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn apply_fresher_remote_overwrites_local() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000005";
    seed_patient(&pool, id, "Local Older", "2099-01-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Remote Fresher","updated_at":"2099-08-01T00:00:00Z"}}"#);
    let e = entry("master", 10, "patient", id, "UPDATE", &payload);
    assert!(apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &e
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Remote Fresher");
}

#[tokio::test]
async fn apply_main_keeps_row_on_timestamp_tie() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000006";
    seed_patient(&pool, id, "Local Tie", "2099-05-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Remote Tie","updated_at":"2099-05-01T00:00:00Z"}}"#);
    let e = entry("remote-device", 11, "patient", id, "UPDATE", &payload);
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Local Tie");
}

#[tokio::test]
async fn apply_local_keeps_row_when_device_id_wins_tie() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000006b";
    seed_patient(&pool, id, "Local Tie", "2099-05-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Remote Tie","updated_at":"2099-05-01T00:00:00Z"}}"#);
    let e = entry("aaa-remote", 11, "patient", id, "UPDATE", &payload);
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Local Tie");
}

#[tokio::test]
async fn apply_replica_skips_collision_without_timestamps() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000007";
    seed_patient(&pool, id, "Replica Local", "2099-01-01 00:00:00").await;
    let payload = format!(r#"{{"id":"{id}","name":"Remote No TS"}}"#);
    let e = entry("master", 12, "patient", id, "UPDATE", &payload);
    assert!(apply_remote_entry(
        &pool,
        LOCAL_REPLICA,
        false,
        ConflictPolicy::LastWriteWins,
        &e
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Replica Local");
}

#[tokio::test]
async fn apply_replica_accepts_admin_pull_without_timestamps() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000007b";
    seed_patient(&pool, id, "Replica Local", "2099-01-01 00:00:00").await;
    let payload = format!(r#"{{"id":"{id}","name":"Admin Authoritative"}}"#);
    let e = entry("master", 12, "patient", id, "UPDATE", &payload);
    assert!(apply_remote_entry_phased(
        &pool,
        LOCAL_REPLICA,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &e,
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Admin Authoritative");
}

#[tokio::test]
async fn apply_app_kv_upsert_replaces_existing_value() {
    let pool = fresh_pool().await;
    sqlx::query("INSERT INTO app_kv (key, value) VALUES ('upsert.me', 'old')")
        .execute(&pool)
        .await
        .unwrap();
    let e = entry(
        "remote",
        13,
        "app_kv",
        "upsert.me",
        "UPDATE",
        r#"{"key":"upsert.me","value":"new","updated_at":"2099-12-01T00:00:00Z"}"#,
    );
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let val: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'upsert.me'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(val, "new");
}

#[tokio::test]
async fn apply_rejects_invalid_json_payload() {
    let pool = fresh_pool().await;
    let e = entry("remote", 14, "patient", "x", "INSERT", r#"{"id":}"#);
    let err = apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect_err("bad json");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn apply_update_with_only_id_is_noop_but_marks_applied() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000008";
    seed_patient(&pool, id, "Unchanged", "2099-01-01 00:00:00").await;
    let payload = format!(r#"{{"id":"{id}"}}"#);
    let e = entry("remote", 15, "patient", id, "UPDATE", &payload);
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Unchanged");
}

#[tokio::test]
async fn apply_replica_accepts_master_tie_break() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000009";
    seed_patient(&pool, id, "Replica Tie", "2099-05-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Master Wins Tie","updated_at":"2099-05-01T00:00:00Z"}}"#);
    let e = entry("master", 16, "patient", id, "UPDATE", &payload);
    assert!(apply_remote_entry_phased(
        &pool,
        LOCAL_REPLICA,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &e,
    )
    .await
    .unwrap());
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Master Wins Tie");
}

#[tokio::test]
async fn apply_insert_coerces_json_scalar_types() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000010";
    let payload = format!(
        r#"{{"id":"{id}","name":"Typed","date_of_birth":"1992-03-03","sex":"MALE",
            "insurance_number":"V-T","status":"ACTIVE","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-04-01T00:00:00Z","phone":null,"email":true}}"#
    );
    let e = entry("remote", 17, "patient", id, "INSERT", &payload);
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
    let phone: Option<String> = sqlx::query_scalar("SELECT phone FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .unwrap()
        .flatten();
    assert!(phone.is_none() || phone.as_deref() == Some(""));
}

#[tokio::test]
async fn apply_does_not_mark_applied_when_entry_not_applied() {
    let pool = fresh_pool().await;
    let e = entry(
        "remote",
        18,
        "app_kv",
        "k18",
        "INSERT",
        r#"{"key":"k18","value":"version"}"#,
    );
    mark_applied(&pool, "remote", 18).await.unwrap();
    assert!(
        !apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
}

#[tokio::test]
async fn apply_json_number_and_bool_in_payload() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000011";
    let payload = format!(
        r#"{{"id":"{id}","name":"Nums","date_of_birth":"1992-03-03","sex":"MALE",
            "insurance_number":"V-N","status":"ACTIVE","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-04-01T00:00:00Z"}}"#
    );
    let e = entry("remote", 19, "patient", id, "INSERT", &payload);
    assert!(
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .unwrap()
    );
}

#[tokio::test]
async fn apply_payment_without_updated_at_column() {
    let pool = fresh_pool().await;
    let patient_id = "00000000-0000-0000-0000-0000000000ab";
    seed_patient(&pool, patient_id, "Payer", "2099-01-01 00:00:00").await;
    let pay_id = "pay-no-updated-at";
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, created_at)
         VALUES (?1, ?2, 10.0, 'CASH', 'PAID', '2099-01-01 00:00:00')",
    )
    .bind(pay_id)
    .bind(patient_id)
    .execute(&pool)
    .await
    .expect("seed payment");
    let payload = format!(
        r#"{{"id":"{pay_id}","patient_id":"{patient_id}","amount":12.5,"payment_method":"CASH","status":"PAID","created_at":"2099-02-01 00:00:00","updated_at":"2099-02-01T00:00:00Z"}}"#
    );
    let e = entry("master", 21, "payment", pay_id, "UPDATE", &payload);
    assert!(apply_remote_entry_phased(
        &pool,
        LOCAL_REPLICA,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &e
    )
    .await
    .unwrap());
    let amount: f64 = sqlx::query_scalar("SELECT amount FROM payment WHERE id = ?1")
        .bind(pay_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((amount - 12.5).abs() < f64::EPSILON);
}

#[tokio::test]
async fn json_null_stays_sql_null() {
    let pool = fresh_pool().await;
    let staff_id = "seed-physician-001";
    let patient_id = "00000000-0000-0000-0000-0000000000cc";
    let patient_payload = format!(
        r#"{{"id":"{patient_id}","name":"Nullable","date_of_birth":"1991-01-01","sex":"FEMALE",
            "insurance_number":"V-NULL","phone":null,"email":null,"address":null,
            "status":"ACTIVE","created_at":"2099-01-01 00:00:00","updated_at":"2099-01-01T00:00:00Z"}}"#
    );
    let patient = entry(
        "remote",
        30,
        "patient",
        patient_id,
        "INSERT",
        &patient_payload,
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &patient,
    )
    .await
    .expect("patient insert with nulls");
    let phone: Option<String> = sqlx::query_scalar("SELECT phone FROM patient WHERE id = ?1")
        .bind(patient_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(phone.is_none(), "JSON null must bind as SQL NULL, not ''");

    let pay_id = "pay-null-service";
    let pay_payload = format!(
        r#"{{"id":"{pay_id}","patient_id":"{patient_id}","amount":5.0,"payment_method":"CASH",
            "status":"PAID","service_item_id":null,"description":null,"created_at":"2099-01-01 00:00:00"}}"#
    );
    let payment = entry("remote", 31, "payment", pay_id, "INSERT", &pay_payload);
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &payment,
    )
    .await
    .expect("payment with null service_item_id must satisfy the foreign key");
    let service_item_id: Option<String> =
        sqlx::query_scalar("SELECT service_item_id FROM payment WHERE id = ?1")
            .bind(pay_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(service_item_id.is_none());

    let note_id = "note-unread";
    let note_payload = format!(
        r#"{{"id":"{note_id}","user_id":"{staff_id}","kind":"INFO","title":"Unread","body":"Body",
            "payload_json":null,"read_at":null,"created_at":"2099-01-01 00:00:00"}}"#
    );
    let note = entry(
        "remote",
        32,
        "in_app_notification",
        note_id,
        "INSERT",
        &note_payload,
    );
    apply_remote_entry(
        &pool,
        LOCAL_MASTER,
        true,
        ConflictPolicy::LastWriteWins,
        &note,
    )
    .await
    .expect("notification");
    let unread: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM in_app_notification WHERE id = ?1 AND read_at IS NULL",
    )
    .bind(note_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(unread, 1, "unread filter must still match a null read_at");
}

async fn ensure_seed_chart(pool: &SqlitePool) {
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

async fn seed_examination(pool: &SqlitePool, id: &str, complaint: &str, updated_at: &str) {
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

async fn seed_payment_row(pool: &SqlitePool, id: &str, patient_id: &str, amount: f64, updated_at: &str) {
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
async fn later_edit_wins_on_both_devices_for_examination() {
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
async fn same_for_payment() {
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
async fn mesh_equal_timestamp_keeps_local() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-0000000000ad";
    seed_patient(&pool, id, "Local Mesh", "2099-05-01T00:00:00Z").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Peer Mesh","updated_at":"2099-05-01T00:00:00Z"}}"#);
    let e = entry("peer-replica", 42, "patient", id, "UPDATE", &payload);
    apply_remote_entry(&pool, LOCAL_REPLICA, false, ConflictPolicy::LastWriteWins, &e)
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
async fn apply_insert_update_delete_on_patient_keyed_hint() {
    let pool = fresh_pool().await;
    let pid = "hint-patient-1";
    seed_patient(&pool, pid, "Hint", "2099-01-01 00:00:00").await;
    let ins = entry(
        "remote", 1, "chart_next_appointment_hint", pid, "INSERT",
        &format!(r#"{{"patient_id":"{pid}","hint_json":"{{}}","updated_at":"2099-01-02T00:00:00Z"}}"#),
    );
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &ins)
        .await
        .expect("insert hint");
    let upd = entry(
        "remote", 2, "chart_next_appointment_hint", pid, "UPDATE",
        &format!(r#"{{"patient_id":"{pid}","hint_json":"{{\"a\":1}}","updated_at":"2099-01-03T00:00:00Z"}}"#),
    );
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &upd)
        .await
        .expect("update hint");
    let hint: String = sqlx::query_scalar("SELECT hint_json FROM chart_next_appointment_hint WHERE patient_id = ?1")
        .bind(pid)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(hint, r#"{"a":1}"#);
    let del = entry("remote", 3, "chart_next_appointment_hint", pid, "DELETE", r#"{}"#);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &del)
        .await
        .expect("delete hint");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chart_next_appointment_hint WHERE patient_id = ?1")
        .bind(pid)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

/// F147: composite-key `chart_validation` rows apply by `patient_id|section`.
#[tokio::test]
async fn apply_chart_validation_by_composite_key() {
    let pool = fresh_pool().await;
    let pid = "cv-patient-1";
    seed_patient(&pool, pid, "CV", "2099-01-01 00:00:00").await;
    for (seq, section) in [(1, "anamnesis"), (2, "findings")] {
        let e = entry(
            "remote", seq, "chart_validation", &format!("{pid}|{section}"), "INSERT",
            &format!(r#"{{"patient_id":"{pid}","section_or_item":"{section}","validated_at":"2099-01-02T00:00:00Z","updated_at":"2099-01-02T00:00:00Z"}}"#),
        );
        apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
            .await
            .expect("insert cv");
    }
    let del = entry("remote", 3, "chart_validation", &format!("{pid}|anamnesis"), "DELETE", r#"{}"#);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &del)
        .await
        .expect("delete cv");
    let left: Vec<String> = sqlx::query_scalar("SELECT section_or_item FROM chart_validation WHERE patient_id = ?1")
        .bind(pid)
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(left, vec!["findings".to_string()]);
}
