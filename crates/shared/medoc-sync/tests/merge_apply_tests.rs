//! Unit tests for `medoc_sync::merge` apply paths (T-U1).

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::merge::{apply_remote_entry, apply_remote_entry_phased, ConflictPolicy};
use medoc_sync::repo::{mark_applied, was_applied, OutboxEntry};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

#[path = "merge_apply_tests/clinical_and_ordering.rs"]
mod clinical_and_ordering;

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
async fn clock_two_minutes_ahead_overwrites_and_a_slow_clock_does_not() {
    let pool = fresh_pool().await;
    let ahead = "00000000-0000-0000-0000-000000000015";
    seed_patient(&pool, ahead, "Local Noon", "2099-06-01 12:00:00").await;
    let payload = format!(
        r#"{{"id":"{ahead}","name":"Replica Two Minutes Fast","updated_at":"2099-06-01T12:02:00Z"}}"#
    );
    let e = entry("replica-fast", 15, "patient", ahead, "UPDATE", &payload);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(ahead)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Replica Two Minutes Fast");

    let payload =
        format!(r#"{{"id":"{ahead}","name":"Replica Slow","updated_at":"2099-06-01T12:00:00Z"}}"#);
    let e = entry("replica-slow", 16, "patient", ahead, "UPDATE", &payload);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(ahead)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Replica Two Minutes Fast");
}

#[tokio::test]
async fn a_slow_wall_clock_wins_when_its_logical_stamp_is_newer() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000017";
    seed_patient(&pool, id, "Master Noon", "2099-06-01 12:00:00").await;
    sqlx::query(
        "INSERT INTO sync_row_hlc (entity_table, entity_id, wall_ms, counter)
         VALUES ('patient', ?1, 1700000000000, 2)",
    )
    .bind(id)
    .execute(&pool)
    .await
    .unwrap();
    let payload = format!(
        r#"{{"id":"{id}","name":"Replica After Master","updated_at":"2099-06-01T11:00:00Z","syncHlc":"1700000000000:3"}}"#
    );
    let e = entry("replica-slow", 17, "patient", id, "UPDATE", &payload);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Replica After Master");

    let behind = format!(
        r#"{{"id":"{id}","name":"Replica Behind","updated_at":"2099-06-01T13:00:00Z","syncHlc":"1700000000000:1"}}"#
    );
    let e = entry("replica-behind", 18, "patient", id, "UPDATE", &behind);
    apply_remote_entry(&pool, LOCAL_MASTER, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Replica After Master");
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
