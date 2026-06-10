//! Unit tests for `medoc_sync::merge` apply paths (T-U1).

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::merge::{apply_remote_entry, ConflictPolicy};
use medoc_sync::repo::{mark_applied, was_applied, OutboxEntry};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

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
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer,
                              telefon, email, adresse, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'MAENNLICH', 'V-1', NULL, NULL, NULL, 'AKTIV',
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
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
async fn apply_delete_app_kv_key() {
    let pool = fresh_pool().await;
    sqlx::query("INSERT INTO app_kv (key, value) VALUES ('del.me', 'x')")
        .execute(&pool)
        .await
        .unwrap();
    let e = entry("remote", 2, "app_kv", "del.me", "DELETE", "{}");
    assert!(
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
    let err = apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
        .await
        .expect_err("bad op");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn apply_rejects_non_object_payload() {
    let pool = fresh_pool().await;
    let e = entry("remote", 4, "patient", "x", "INSERT", r#""not-an-object""#);
    let err = apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
        r#"{"key":"k5","value":"v"}"#,
    );
    mark_applied(&pool, "remote", 5).await.unwrap();
    assert!(
        !apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
        r#"{{"id":"{id}","name":"Remote New","geburtsdatum":"1991-02-02","geschlecht":"WEIBLICH",
            "versicherungsnummer":"V-2","status":"AKTIV","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-02-01T00:00:00Z"}}"#
    );
    let e = entry("remote", 6, "patient", id, "INSERT", &payload);
    assert!(
        apply_remote_entry(&pool, false, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
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
    assert!(
        apply_remote_entry(&pool, false, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
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
    assert!(
        apply_remote_entry(&pool, false, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
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
    let e = entry("remote", 9, "personal", "p1", "INSERT", r#"{"id":"p1"}"#);
    let err = apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
    assert!(
        apply_remote_entry(&pool, false, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Remote Fresher");
}

#[tokio::test]
async fn apply_master_keeps_row_on_timestamp_tie() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000006";
    seed_patient(&pool, id, "Master Tie", "2099-05-01 00:00:00").await;
    let payload =
        format!(r#"{{"id":"{id}","name":"Remote Tie","updated_at":"2099-05-01T00:00:00Z"}}"#);
    let e = entry("remote", 11, "patient", id, "UPDATE", &payload);
    assert!(
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Master Tie");
}

#[tokio::test]
async fn apply_replica_skips_collision_without_timestamps() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000007";
    seed_patient(&pool, id, "Replica Local", "2099-01-01 00:00:00").await;
    let payload = format!(r#"{{"id":"{id}","name":"Remote No TS"}}"#);
    let e = entry("master", 12, "patient", id, "UPDATE", &payload);
    assert!(
        apply_remote_entry(&pool, false, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
    let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(name, "Replica Local");
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
        r#"{"key":"upsert.me","value":"new"}"#,
    );
    assert!(
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
    let err = apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
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
    assert!(
        apply_remote_entry(&pool, false, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
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
        r#"{{"id":"{id}","name":"Typed","geburtsdatum":"1992-03-03","geschlecht":"MAENNLICH",
            "versicherungsnummer":"V-T","status":"AKTIV","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-04-01T00:00:00Z","telefon":null,"email":true}}"#
    );
    let e = entry("remote", 17, "patient", id, "INSERT", &payload);
    assert!(
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
    let telefon: Option<String> = sqlx::query_scalar("SELECT telefon FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .unwrap()
        .flatten();
    assert!(telefon.is_none() || telefon.as_deref() == Some(""));
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
        r#"{"key":"k18","value":"v"}"#,
    );
    mark_applied(&pool, "remote", 18).await.unwrap();
    assert!(
        !apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
}

#[tokio::test]
async fn apply_json_number_and_bool_in_payload() {
    let pool = fresh_pool().await;
    let id = "00000000-0000-0000-0000-000000000011";
    let payload = format!(
        r#"{{"id":"{id}","name":"Nums","geburtsdatum":"1992-03-03","geschlecht":"MAENNLICH",
            "versicherungsnummer":"V-N","status":"AKTIV","created_at":"2099-01-01 00:00:00",
            "updated_at":"2099-04-01T00:00:00Z"}}"#
    );
    let e = entry("remote", 19, "patient", id, "INSERT", &payload);
    assert!(
        apply_remote_entry(&pool, true, ConflictPolicy::MasterWinsWithFreshness, &e)
            .await
            .unwrap()
    );
}
