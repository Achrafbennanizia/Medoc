//! T4.1: in mode O a replica keeps signed copies of changes pushed to it, serves them by origin
//! vector, and the device that asks applies them only when each origin's own signature holds.
//! Run with `--features medoc-core/full` for the Group path.

use ed25519_dalek::SigningKey;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::origin_pull::{self, OriginPullBody};
use medoc_sync::engine::route;
use medoc_sync::entry_signature::sign_batch;
use medoc_sync::repo::{ensure_local_device, save_deployment, OutboxEntry};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn group_replica(label: &str) -> (SqlitePool, String) {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    let cfg = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Replica,
        master_device_id: "primary-hub".into(),
        device_label: label.into(),
        ..Default::default()
    };
    save_deployment(&pool, &cfg).await.expect("deploy");
    let id = ensure_local_device(&pool, label).await.expect("local id");
    (pool, id)
}

fn entry(origin: &str, seq: i64, key: &str, value: &str) -> OutboxEntry {
    OutboxEntry {
        id: format!("{origin}-{seq}"),
        device_id: origin.into(),
        seq,
        entity_table: "app_kv".into(),
        entity_id: key.into(),
        op: "INSERT".into(),
        payload_json: serde_json::json!({ "key": key, "value": value }).to_string(),
        created_at: "2099-01-01T00:00:00Z".into(),
    }
}

#[tokio::test]
async fn copies_are_served_after_the_vector_and_applied_when_signed_by_the_origin() {
    if !route::routing_enabled() {
        return; // Group only
    }
    let origin = "replica-1";
    let k1 = SigningKey::from_bytes(&[7u8; 32]);
    let entries = vec![entry(origin, 1, "op.a", "1"), entry(origin, 2, "op.b", "2")];
    let batch = sign_batch(&k1, &entries);

    // Hub B received the push while replica-2 was off.
    let (hub_b, _) = group_replica("hub-b").await;
    assert_eq!(origin_pull::keep(&hub_b, origin, &entries, &batch).await.unwrap(), 2);
    // Kept once: a second push of the same entries adds nothing.
    assert_eq!(origin_pull::keep(&hub_b, origin, &entries, &batch).await.unwrap(), 0);

    let mut vector = OriginPullBody::default();
    vector.vector.insert(origin.into(), 1);
    let page = origin_pull::serve(&hub_b, &vector, "replica-2").await.unwrap();
    assert_eq!(page.origins.len(), 1);
    assert_eq!(page.origins[0].entries.len(), 1, "only entries after the vector");
    // The origin itself is not served its own entries.
    assert!(origin_pull::serve(&hub_b, &OriginPullBody::default(), origin)
        .await
        .unwrap()
        .origins
        .is_empty());

    // replica-2 comes back and pulls everything.
    let (rep2, rep2_id) = group_replica("replica-2").await;
    let page = origin_pull::serve(&hub_b, &OriginPullBody::default(), &rep2_id).await.unwrap();
    let (applied, refused) = origin_pull::apply_page(&rep2, &rep2_id, &page).await.unwrap();
    assert!(refused.is_empty(), "{refused:?}");
    assert_eq!(applied, 2);
    let v: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'op.b'")
        .fetch_one(&rep2)
        .await
        .unwrap();
    assert_eq!(v, "2");
    assert_eq!(origin_pull::local_vector(&rep2).await.unwrap().get(origin), Some(&2));

    // A page that claims to come from replica-1 but is signed by another key is refused.
    let forged = vec![entry(origin, 3, "op.c", "evil")];
    let k2 = SigningKey::from_bytes(&[9u8; 32]);
    let (hub_c, _) = group_replica("hub-c").await;
    origin_pull::keep(&hub_c, origin, &forged, &sign_batch(&k2, &forged)).await.unwrap();
    let page = origin_pull::serve(&hub_c, &OriginPullBody::default(), &rep2_id).await.unwrap();
    let (applied, refused) = origin_pull::apply_page(&rep2, &rep2_id, &page).await.unwrap();
    assert_eq!(applied, 0);
    assert!(refused.contains_key(origin));
    let evil: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'op.c'")
        .fetch_optional(&rep2)
        .await
        .unwrap();
    assert!(evil.is_none());
}

#[tokio::test]
async fn unsigned_entries_are_not_kept_for_forwarding() {
    let (pool, _) = group_replica("hub-b").await;
    let entries = vec![entry("replica-1", 1, "k", "v")];
    let kept = origin_pull::keep(&pool, "replica-1", &entries, &Default::default()).await.unwrap();
    assert_eq!(kept, 0);
}
