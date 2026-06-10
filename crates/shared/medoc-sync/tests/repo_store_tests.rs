//! Unit tests for `medoc_sync::repo` store helpers (T-U1).

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::repo::{
    append_outbox, ensure_local_device, list_entries_since, list_pending_outbox,
    list_pending_outbox_for_peer, mark_applied, mark_outbox_delivered, mark_peer_delivery,
    save_deployment, status_snapshot, sync_record_or_noop, was_applied, SYNCED_TABLES,
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

#[tokio::test]
async fn synced_tables_includes_tier1_entities() {
    for table in [
        "rezept",
        "praxis_ticket",
        "anamnesebogen",
        "in_app_notification",
    ] {
        assert!(SYNCED_TABLES.contains(&table), "{table}");
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
    sync_record_or_noop(&pool, "personal", "u-1", "INSERT", "{}")
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
    assert_eq!(list_pending_outbox(&pool, &device).await.unwrap().len(), 2);
    mark_outbox_delivered(&pool, &device, e1.seq)
        .await
        .expect("deliver");
    assert_eq!(list_pending_outbox(&pool, &device).await.unwrap().len(), 1);
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
        "praxis_ticket",
        "tkt-1",
        "INSERT",
        r#"{"id":"tkt-1","patient_id":"p","from_user_id":"u","to_arzt_id":"a","body":"hi","status":"OFFEN","created_at":"2026-06-06T12:00:00Z","updated_at":"2026-06-06T12:00:00Z"}"#,
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
}
