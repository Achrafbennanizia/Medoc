//! T4.1b: a Group primary that starts with paired devices announces "catching up", refuses to
//! relay, collects every device's signed copies by origin vector, then becomes ready.
//! Run with `--features medoc-core/full` for the Group path.

use ed25519_dalek::SigningKey;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::origin_pull::{OriginBatch, OriginPullPage};
use medoc_sync::engine::{catch_up, route, SyncEngine};
use medoc_sync::entry_signature::sign_batch;
use medoc_sync::repo::{save_deployment, OutboxEntry};
use medoc_sync::schema::ensure_sync_tables;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn primary_collects_copies_then_relays_again() {
    if !route::routing_enabled() {
        return; // Group only
    }
    std::env::set_var("MEDOC_PAIRING_MASTER_SECRET", "11".repeat(32));
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    let cfg = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Master,
        device_label: "primary".into(),
        ..Default::default()
    };
    save_deployment(&pool, &cfg).await.expect("deploy");

    // Without paired devices there is nothing to catch up with.
    assert!(!catch_up::announce(&pool).await.unwrap());

    // Hub B kept a change replica-1 made while the primary was off.
    let k1 = SigningKey::from_bytes(&[5u8; 32]);
    let entry = OutboxEntry {
        id: "r1-1".into(),
        device_id: "replica-1".into(),
        seq: 1,
        entity_table: "app_kv".into(),
        entity_id: "made.offline".into(),
        op: "INSERT".into(),
        payload_json: serde_json::json!({ "key": "made.offline", "value": "yes" }).to_string(),
        created_at: "2099-01-01T00:00:00Z".into(),
    };
    let page = OriginPullPage {
        origins: vec![OriginBatch {
            device_id: "replica-1".into(),
            batch: sign_batch(&k1, std::slice::from_ref(&entry)),
            entries: vec![entry],
        }],
    };
    let hub_b = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/origin-pull"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&page))
        .up_to_n_times(1)
        .mount(&hub_b)
        .await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/origin-pull"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({ "origins": [] })),
        )
        .mount(&hub_b)
        .await;
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, peer_cert_sha256, peer_base_url)
         VALUES ('hub-b', 'hub-b', 'REPLICA', 0, ?1, ?2)",
    )
    .bind("ab".repeat(32))
    .bind(hub_b.uri())
    .execute(&pool)
    .await
    .unwrap();

    assert!(catch_up::announce(&pool).await.unwrap());
    assert!(catch_up::is_catching_up(&pool).await);
    // While behind, the primary does not relay to its devices.
    let report = SyncEngine::exchange_packets(&pool, None).await.unwrap();
    assert_eq!(report.error.as_deref(), Some(catch_up::REFUSAL_REASON));

    let report = SyncEngine::primary_catch_up(&pool).await.unwrap();
    assert_eq!(report.peers_reached, 1, "{report:?}");
    assert_eq!(report.applied, 1);
    assert!(!catch_up::is_catching_up(&pool).await);
    let v: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'made.offline'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(v, "yes");
    // The primary re-emits it, so devices that never saw it get it in star mode.
    let relayed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE entity_table = 'app_kv' AND entity_id = 'made.offline'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(relayed, 1);
}

#[test]
fn replicas_read_the_refusal_as_not_reached() {
    assert!(catch_up::is_catching_up_error(
        "pull: 503 unavailable: primary_catching_up"
    ));
    assert!(!catch_up::is_catching_up_error("pull: 503"));
}
