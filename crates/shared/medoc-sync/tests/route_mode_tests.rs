//! T4.1: a Group device whose primary hub stops answering sends its own changes to its peers
//! after three missed rounds, using the peer list the primary signed while it was up.
//! Run with `--features medoc-core/full` for the Group path.

use ed25519_dalek::SigningKey;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv;
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::route::{self, RouteMode, FAILS_TO_ORIGIN_SENDS};
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::repo::{append_outbox, ensure_local_device, save_deployment};
use medoc_sync::schema::ensure_sync_tables;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn missed_rounds_switch_to_origin_sends_and_back() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    let master = MockServer::start().await;
    let peer = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[21u8; 32]);
    let master_id = "primary-hub";
    let peers = serde_json::json!([{
        "deviceId": "hub-b",
        "slaveLabel": "Hub B",
        "slavePubkey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "peerBaseUrl": format!("{}/", peer.uri())
    }]);
    let signature = master_keys::sign(
        &sk,
        &serde_json::to_vec(&serde_json::json!({ "masterDeviceId": master_id, "peers": peers }))
            .unwrap(),
    );
    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id, "peers": peers, "signature": signature
        })))
        .mount(&master)
        .await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({ "entries": [] })),
        )
        .mount(&master)
        .await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 1, "lastSeq": 1
        })))
        .mount(&peer)
        .await;

    let mut cfg = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Replica,
        master_base_url: master.uri(),
        master_access_token: "tok".into(),
        master_cert_sha256: "ab".repeat(32),
        master_pubkey: master_keys::pubkey_b64(&sk),
        master_device_id: master_id.into(),
        device_label: "replica-1".into(),
        ..Default::default()
    };
    save_deployment(&pool, &cfg).await.expect("deploy");
    app_kv::set(&pool, "sync.replica.catchup.done.v1", "1")
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, peer_cert_sha256)
         VALUES ('hub-b', 'hub-b', 'REPLICA', 0, ?1)",
    )
    .bind("ab".repeat(32))
    .execute(&pool)
    .await
    .unwrap();

    // Online round: star mode, the signed peer list is kept.
    SyncEngine::run_replica_sync(&pool)
        .await
        .expect("online round");
    assert_eq!(route::mode(&pool).await, RouteMode::Star);

    // The primary goes away (nothing listens on port 9).
    cfg.master_base_url = "http://127.0.0.1:9".into();
    save_deployment(&pool, &cfg).await.expect("redeploy");
    let local = ensure_local_device(&pool, "replica-1").await.unwrap();
    append_outbox(
        &pool,
        &local,
        "app_kv",
        "offline.key",
        "INSERT",
        r#"{"key":"offline.key","value":"1"}"#,
    )
    .await
    .unwrap();
    for _ in 0..FAILS_TO_ORIGIN_SENDS {
        SyncEngine::run_replica_sync(&pool)
            .await
            .expect("offline round");
    }
    let pushed_to_peer = peer
        .received_requests()
        .await
        .is_some_and(|r| !r.is_empty());
    if route::routing_enabled() {
        assert_eq!(route::mode(&pool).await, RouteMode::OriginSends);
        assert!(pushed_to_peer, "the origin sends its change to the peer");
    } else {
        assert_eq!(
            route::mode(&pool).await,
            RouteMode::Star,
            "Duo stays star-only"
        );
        assert!(!pushed_to_peer);
    }

    // The primary answers again: back to star at once.
    cfg.master_base_url = master.uri();
    save_deployment(&pool, &cfg).await.expect("redeploy");
    SyncEngine::run_replica_sync(&pool)
        .await
        .expect("back online");
    assert_eq!(route::mode(&pool).await, RouteMode::Star);
}
