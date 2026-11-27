//! Unit tests for `medoc_sync::merge` apply paths (T-U1).

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::merge::{apply_remote_entry, apply_remote_entry_phased, ConflictPolicy};
use medoc_sync::repo::{mark_applied, was_applied, OutboxEntry};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

mod merge_apply_support;
#[allow(unused_imports)]
pub use merge_apply_support::*;

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

async fn seed_payment_row(
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
async fn apply_insert_update_delete_on_patient_keyed_hint() {
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
async fn apply_chart_validation_by_composite_key() {
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
async fn apply_refuses_device_local_app_kv_keys() {
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
async fn template_and_appointment_apply_before_their_parents() {
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
async fn product_delete_applies_while_a_template_still_points_at_it() {
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
async fn practice_task_remote_insert_ensures_assignee_notification() {
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

/// T5.8 phase 2: a change applied from another device lands in history with that device and
/// the author it signed; a re-delivered entry is not recorded twice.
#[tokio::test]
async fn applied_remote_change_is_recorded_with_its_origin() {
    if !medoc_core::edition::CORE_CAPS.multi_staff {
        return;
    }
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-0000000000a1";
    let payload = format!(
        r#"{{"id":"{id}","name":"From B","date_of_birth":"1991-02-02","sex":"FEMALE",
            "insurance_number":"V-a1","status":"ACTIVE","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-02-01T00:00:00Z","syncActor":"dr-b"}}"#
    );
    let e = entry("device-b", 7, "patient", id, "INSERT", &payload);
    for _ in 0..2 {
        apply_remote_entry(
            &pool,
            LOCAL_REPLICA,
            false,
            ConflictPolicy::LastWriteWins,
            &e,
        )
        .await
        .unwrap();
    }
    let h = medoc_core::application::history::for_record(&pool, "patient", id)
        .await
        .unwrap();
    assert_eq!(h.len(), 1, "{h:?}");
    assert_eq!(h[0].actor_staff_id.as_deref(), Some("dr-b"));
    assert_eq!(h[0].device_id, "device-b");
    assert!(h[0].changes.iter().any(|c| c.field == "name"));
}

/// GDPR: a pseudonymised patient arriving from another device clears its old values here too.
#[tokio::test]
async fn received_erasure_clears_history() {
    if !medoc_core::edition::CORE_CAPS.multi_staff {
        return;
    }
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-0000000000a2";
    let row = |name: &str, vnr: &str, at: &str| {
        format!(
            r#"{{"id":"{id}","name":"{name}","date_of_birth":"1991-02-02","sex":"FEMALE",
                "insurance_number":"{vnr}","status":"ACTIVE","created_at":"2099-01-01 00:00:00",
                "updated_at":"{at}"}}"#
        )
    };
    let first = entry(
        "device-b",
        1,
        "patient",
        id,
        "INSERT",
        &row("Secret Name", "V-a2", "2099-02-01T00:00:00Z"),
    );
    let erased = entry(
        "device-b",
        2,
        "patient",
        id,
        "UPDATE",
        &row(
            &format!("Anonymisiert ({id})"),
            &format!("ANON-{id}"),
            "2099-03-01T00:00:00Z",
        ),
    );
    for e in [&first, &erased] {
        apply_remote_entry(
            &pool,
            LOCAL_REPLICA,
            false,
            ConflictPolicy::LastWriteWins,
            e,
        )
        .await
        .unwrap();
    }
    let all: String = sqlx::query_scalar("SELECT group_concat(payload_json) FROM change_record")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!all.contains("Secret Name"), "{all}");
}
