//! Unit tests for `medoc_sync::repo` store helpers (T-U1).

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::repo::{
    load_row_payload_json,
    append_outbox, enqueue_full_snapshot, ensure_local_device, list_entries_since,
    list_pending_outbox, list_pending_outbox_for_peer, mark_applied, mark_outbox_delivered,
    mark_outbox_failed, mark_peer_delivery, save_deployment, set_observed_seq, status_snapshot,
    sync_record_or_noop,
    was_applied, is_synced_table, synced_tables,
};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

async fn enable_serverless(pool: &SqlitePool, label: &str) {
    save_deployment(
        pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            device_label: label.into(),
            ..Default::default()
        },
    )
    .await
    .expect("deployment");
}

#[test]
fn synced_tables_lists_parents_before_children() {
    let tables: Vec<_> = synced_tables().collect();
    let pos = |name: &str| {
        tables
            .iter()
            .position(|table| *table == name)
            .unwrap_or_else(|| panic!("{name} missing"))
    };
    assert!(pos("patient") < pos("patient_chart"));
    assert!(pos("patient") < pos("appointment"));
    assert!(pos("patient") < pos("anamnesis_form"));
    assert!(pos("patient") < pos("payment"));
    assert!(pos("patient") < pos("prescription"));
    assert!(pos("patient") < pos("practice_ticket"));
    assert!(pos("patient_chart") < pos("dental_finding"));
    assert!(pos("patient_chart") < pos("examination"));
    assert!(pos("patient_chart") < pos("treatment"));
    assert!(pos("service_item") < pos("payment"));
    assert!(pos("product") < pos("supplier_pharma_template"));
    assert!(pos("supplier_master") < pos("supplier_pharma_template"));
    assert!(pos("pharma_consultant_master") < pos("supplier_pharma_template"));
    assert!(pos("product") < pos("purchase_order"));
}

#[tokio::test]
async fn synced_tables_includes_tier1_entities() {
    for table in [
        "prescription",
        "practice_ticket",
        "anamnesis_form",
        "in_app_notification",
    ] {
        assert!(is_synced_table(table), "{table}");
    }
}

#[tokio::test]
async fn sync_record_or_noop_skips_practice_desktop_mode() {
    let pool = fresh_pool().await;
    sync_record_or_noop(&pool, "patient", "p-1", "INSERT", r#"{"id":"p-1"}"#)
        .await
        .expect("noop");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn sync_record_or_noop_skips_non_allowlisted_table() {
    let pool = fresh_pool().await;
    enable_serverless(&pool, "hook-tester").await;
    sync_record_or_noop(&pool, "license", "u-1", "INSERT", "{}")
        .await
        .expect("noop");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn sync_record_or_noop_appends_for_serverless_peer() {
    let pool = fresh_pool().await;
    enable_serverless(&pool, "hook-replica").await;
    sync_record_or_noop(
        &pool,
        "app_kv",
        "sync.hook.key",
        "INSERT",
        r#"{"key":"sync.hook.key","value":"1"}"#,
    )
    .await
    .expect("record");
    let pending = list_pending_outbox(
        &pool,
        &ensure_local_device(&pool, "hook-replica").await.unwrap(),
        500,
    )
    .await
    .expect("list");
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].entity_table, "app_kv");
}

#[tokio::test]
async fn mark_outbox_delivered_clears_pending_count() {
    let pool = fresh_pool().await;
    let device = ensure_local_device(&pool, "delivery-test").await.unwrap();
    let e1 = append_outbox(
        &pool,
        &device,
        "app_kv",
        "k1",
        "INSERT",
        r#"{"key":"k1","value":"a"}"#,
    )
    .await
    .expect("append");
    let _e2 = append_outbox(
        &pool,
        &device,
        "app_kv",
        "k2",
        "INSERT",
        r#"{"key":"k2","value":"b"}"#,
    )
    .await
    .expect("append");
    assert_eq!(list_pending_outbox(&pool, &device, 500).await.unwrap().len(), 2);
    mark_outbox_delivered(&pool, &device, e1.seq)
        .await
        .expect("deliver");
    assert_eq!(list_pending_outbox(&pool, &device, 500).await.unwrap().len(), 1);
}

#[tokio::test]
async fn delivered_watermark_leaves_a_missing_blob_row_pending() {
    let pool = fresh_pool().await;
    let device = ensure_local_device(&pool, "blob-hold").await.unwrap();
    let blob = append_outbox(
        &pool,
        &device,
        "chart_attachment",
        "file-1",
        "INSERT",
        r#"{"sha256":"ab"}"#,
    )
    .await
    .unwrap();
    let later = append_outbox(
        &pool,
        &device,
        "patient",
        "p-1",
        "INSERT",
        r#"{"id":"p-1"}"#,
    )
    .await
    .unwrap();
    mark_outbox_failed(&pool, &blob.id, "BLOB_MISSING").await.unwrap();
    mark_outbox_delivered(&pool, &device, later.seq).await.unwrap();
    let delivered: Option<String> =
        sqlx::query_scalar("SELECT delivered_at FROM sync_outbox WHERE id = ?1")
            .bind(&blob.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(delivered.is_none());
    let later_delivered: Option<String> =
        sqlx::query_scalar("SELECT delivered_at FROM sync_outbox WHERE id = ?1")
            .bind(&later.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(later_delivered.is_some());
}

#[tokio::test]
async fn peer_vector_tracks_mesh_delivery_watermark() {
    let pool = fresh_pool().await;
    let source_label = "mesh-source";
    let target = "mesh-target";
    let device = ensure_local_device(&pool, source_label).await.unwrap();
    append_outbox(
        &pool,
        &device,
        "app_kv",
        "m1",
        "INSERT",
        r#"{"key":"m1","value":"x"}"#,
    )
    .await
    .expect("o1");
    let e2 = append_outbox(
        &pool,
        &device,
        "app_kv",
        "m2",
        "INSERT",
        r#"{"key":"m2","value":"y"}"#,
    )
    .await
    .expect("o2");

    assert_eq!(
        list_pending_outbox_for_peer(&pool, &device, target)
            .await
            .unwrap()
            .len(),
        2
    );

    mark_peer_delivery(&pool, &device, target, 1)
        .await
        .expect("mark");
    let after_first = list_pending_outbox_for_peer(&pool, &device, target)
        .await
        .unwrap();
    assert_eq!(after_first.len(), 1);
    assert_eq!(after_first[0].seq, e2.seq);

    mark_peer_delivery(&pool, &device, target, e2.seq)
        .await
        .expect("mark2");
    assert!(list_pending_outbox_for_peer(&pool, &device, target)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn was_applied_and_mark_applied_are_idempotent() {
    let pool = fresh_pool().await;
    assert!(!was_applied(&pool, "dev-a", 7).await.unwrap());
    mark_applied(&pool, "dev-a", 7).await.expect("mark");
    assert!(was_applied(&pool, "dev-a", 7).await.unwrap());
    mark_applied(&pool, "dev-a", 7).await.expect("mark again");
    assert!(was_applied(&pool, "dev-a", 7).await.unwrap());
}

#[tokio::test]
async fn list_entries_since_returns_rows_after_seq() {
    let pool = fresh_pool().await;
    let device = ensure_local_device(&pool, "pull-test").await.unwrap();
    append_outbox(
        &pool,
        &device,
        "app_kv",
        "a",
        "INSERT",
        r#"{"key":"a","value":"1"}"#,
    )
    .await
    .expect("o1");
    let e2 = append_outbox(
        &pool,
        &device,
        "app_kv",
        "b",
        "INSERT",
        r#"{"key":"b","value":"2"}"#,
    )
    .await
    .expect("o2");
    let rows = list_entries_since(&pool, &device, 1).await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].seq, e2.seq);
}

#[tokio::test]
async fn status_snapshot_reports_pending_outbox() {
    let pool = fresh_pool().await;
    enable_serverless(&pool, "status-replica").await;
    sync_record_or_noop(
        &pool,
        "practice_ticket",
        "tkt-1",
        "INSERT",
        r#"{"id":"tkt-1","patient_id":"p","from_user_id":"u","to_physician_id":"a","body":"hi","status":"OPEN","created_at":"2026-06-06T12:00:00Z","updated_at":"2026-06-06T12:00:00Z"}"#,
    )
    .await
    .expect("record");
    let snap = status_snapshot(&pool).await.expect("status");
    assert_eq!(snap.deployment.mode, DeploymentMode::ServerlessPeer);
    assert_eq!(snap.pending_outbox, 1);
    assert!(snap.local_seq >= 1);
}

#[tokio::test]
async fn sync_engine_status_delegates_to_snapshot() {
    let pool = fresh_pool().await;
    enable_serverless(&pool, "engine-status").await;
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_eq!(snap.deployment.device_label, "engine-status");
}

#[tokio::test]
async fn touch_replica_seen_updates_peer_base_url() {
    use medoc_sync::repo::touch_replica_seen;

    let pool = fresh_pool().await;
    let device = ensure_local_device(&pool, "touch-target").await.unwrap();
    touch_replica_seen(&pool, &device, "192.168.1.50", 8787)
        .await
        .expect("touch");
    let url: Option<String> =
        sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
            .bind(&device)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(url.as_deref().is_some_and(|u| u.contains("192.168.1.50")));
    let seen: Option<String> =
        sqlx::query_scalar("SELECT last_seen_at FROM sync_device WHERE device_id = ?1")
            .bind(&device)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(seen.as_deref().is_some_and(|s| !s.is_empty()));
}

#[tokio::test]
async fn enqueue_full_snapshot_queues_existing_patients() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::PracticeDesktop,
            role: DeviceRole::Master,
            device_label: "Main".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES ('snap-p1', 'Snapshot Patient', '1990-01-01', 'MALE', 'INS-SNAP-1')",
    )
    .execute(&pool)
    .await
    .expect("patient");
    let n = enqueue_full_snapshot(&pool).await.expect("snapshot");
    assert!(n >= 1);
    let found: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE entity_id = 'snap-p1' AND entity_table = 'patient'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(found >= 1, "snapshot must include the live patient row");
}

#[tokio::test]
async fn snapshot_and_load_row_use_non_id_keys() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::PracticeDesktop,
            role: DeviceRole::Master,
            device_label: "Main".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('hint-p', 'H', '1980-01-01', 'MALE', 'H-1', 'ACTIVE')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO chart_next_appointment_hint (patient_id, hint_json)
         VALUES ('hint-p', '{\"n\":1}')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO chart_validation (patient_id, section_or_item, validated_at)
         VALUES ('hint-p', 'anamnesis', '2099-01-01T00:00:00Z')",
    )
    .execute(&pool)
    .await
    .unwrap();
    enqueue_full_snapshot(&pool).await.expect("snapshot");
    let hint_n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE entity_table = 'chart_next_appointment_hint' AND entity_id = 'hint-p'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(hint_n, 1);
    let cv_n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE entity_table = 'chart_validation' AND entity_id = 'hint-p|anamnesis'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(cv_n, 1);
    let payload = load_row_payload_json(&pool, "chart_validation", "hint-p|anamnesis")
        .await
        .expect("load")
        .expect("json");
    assert!(payload.contains("anamnesis"));
}

#[tokio::test]
async fn set_observed_seq_advances_cursor() {
    let pool = fresh_pool().await;
    set_observed_seq(&pool, "master-1", 3).await.expect("seq");
    set_observed_seq(&pool, "master-1", 2)
        .await
        .expect("no rewind");
    set_observed_seq(&pool, "master-1", 9)
        .await
        .expect("advance");
    let seq: i64 = sqlx::query_scalar("SELECT seq FROM sync_vector WHERE device_id = 'master-1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(seq, 9);
}

#[tokio::test]
async fn snapshot_omits_staff_secrets_and_portal_keys() {
    let pool = fresh_pool().await;
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    enable_serverless(&pool, "Main").await;
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, totp_secret)
         VALUES ('s-secret', 'Ada', 'ada@practice.test', 'HASH-SENTINEL-P2', 'RECEPTION', 'TOTP-SENTINEL-P2')",
    )
    .execute(&pool)
    .await
    .expect("staff");
    medoc_core::infrastructure::database::app_kv_repo::set(
        &pool,
        "company.portal.config.v1",
        r#"{"apiKey":"PORTAL-SECRET-P2"}"#,
    )
    .await
    .expect("portal");

    assert!(
        load_row_payload_json(&pool, "staff", "s-secret")
            .await
            .expect("payload")
            .is_none(),
        "staff is DeviceLocal and must not enter the outbox"
    );
    assert!(load_row_payload_json(&pool, "app_kv", "company.portal.config.v1")
        .await
        .expect("portal load")
        .is_none());
}
