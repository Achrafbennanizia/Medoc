//! HTTP-path tests for `SyncEngine` push/pull/mesh (T-U1) using wiremock.

use ed25519_dalek::SigningKey;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::repo::{
    append_outbox, ensure_local_device, list_pending_outbox, mark_applied, save_deployment,
};
use medoc_sync::schema::ensure_sync_tables;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn fresh_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

async fn save_replica(pool: &sqlx::SqlitePool, master_url: &str, token: &str, label: &str) {
    save_deployment(
        pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: master_url.into(),
            master_access_token: token.into(),
            device_label: label.into(),
            ..Default::default()
        },
    )
    .await
    .expect("deployment");
}

#[tokio::test]
async fn push_to_master_empty_outbox_skips_http() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok", "empty-push").await;
    let result = SyncEngine::push_to_master(&pool).await.expect("push");
    assert_eq!(result.accepted, 0);
    assert_eq!(
        server
            .received_requests()
            .await
            .as_ref()
            .map(|r| r.len())
            .unwrap_or(0),
        0
    );
}

#[tokio::test]
async fn push_to_master_delivers_pending_and_clears_outbox() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok-push", "push-test").await;
    let device = ensure_local_device(&pool, "push-test").await.unwrap();
    append_outbox(
        &pool,
        &device,
        "app_kv",
        "http.push.key",
        "INSERT",
        r#"{"key":"http.push.key","value":"42"}"#,
    )
    .await
    .expect("outbox");

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 1,
            "lastSeq": 1
        })))
        .mount(&server)
        .await;

    let result = SyncEngine::push_to_master(&pool).await.expect("push ok");
    assert_eq!(result.accepted, 1);
    assert_eq!(result.last_seq, 1);
    assert!(list_pending_outbox(&pool, &device)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn pull_from_master_applies_remote_app_kv() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok-pull", "pull-test").await;
    let _device = ensure_local_device(&pool, "pull-test").await.unwrap();

    let remote_entry = serde_json::json!({
        "id": "pull-e1",
        "deviceId": "master-device",
        "seq": 1,
        "entityTable": "app_kv",
        "entityId": "pull.key",
        "op": "INSERT",
        "payloadJson": r#"{"key":"pull.key","value":"from-master"}"#,
        "createdAt": "2099-01-01T00:00:00Z"
    });

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "entries": [remote_entry]
        })))
        .mount(&server)
        .await;

    // Seed master device id for vector lookup
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local)
         VALUES ('master-device', 'Master', 'MASTER', 0)",
    )
    .execute(&pool)
    .await
    .expect("master row");

    let result = SyncEngine::pull_from_master(&pool).await.expect("pull");
    assert_eq!(result.applied, 1);
    let val: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'pull.key'")
        .fetch_one(&pool)
        .await
        .expect("app_kv");
    assert_eq!(val, "from-master");
}

#[tokio::test]
async fn run_mesh_sync_off_flag_returns_message() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: "https://127.0.0.1:1".into(),
            master_access_token: "tok".into(),
            unstable_mesh: false,
            device_label: "mesh-off".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let report = SyncEngine::run_mesh_sync(&pool).await.expect("mesh");
    assert_eq!(report.attempted, 0);
    assert!(report.errors.iter().any(|e| e.contains("unstable_mesh")));
}

#[tokio::test]
async fn pull_from_master_requires_bearer_token() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: "https://127.0.0.1:8787".into(),
            device_label: "no-token".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let err = SyncEngine::pull_from_master(&pool)
        .await
        .expect_err("no bearer");
    let message = err.to_string().to_lowercase();
    assert!(
        message.contains("pair") || message.contains("gekoppelt"),
        "unexpected missing-bearer error: {message}"
    );
}

#[tokio::test]
async fn run_mesh_sync_fetches_signed_peer_list() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[7u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);
    let master_id = "master-mesh-1";

    let peers_json = serde_json::json!([{
        "deviceId": "peer-other",
        "slaveLabel": "Peer B",
        "slavePubkey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "peerBaseUrl": format!("{}/", server.uri())
    }]);
    let canonical = serde_json::json!({
        "masterDeviceId": master_id,
        "peers": peers_json
    });
    let body_bytes = serde_json::to_vec(&canonical).unwrap();
    let signature = master_keys::sign(&sk, &body_bytes);

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id,
            "peers": peers_json,
            "signature": signature
        })))
        .mount(&server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 0,
            "lastSeq": 0
        })))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "mesh-tok".into(),
            master_pubkey: pubkey,
            master_device_id: master_id.into(),
            unstable_mesh: true,
            device_label: "mesh-on".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let _local = ensure_local_device(&pool, "mesh-on").await.unwrap();

    let report = SyncEngine::run_mesh_sync(&pool).await.expect("mesh");
    assert!(report.attempted >= 1);
}

#[tokio::test]
async fn run_mesh_sync_skips_peer_without_base_url() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[8u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);
    let master_id = "master-mesh-2";

    let peers_json = serde_json::json!([{
        "deviceId": "peer-no-url",
        "slaveLabel": "No URL",
        "slavePubkey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    }]);
    let canonical = serde_json::json!({
        "masterDeviceId": master_id,
        "peers": peers_json
    });
    let signature = master_keys::sign(&sk, &serde_json::to_vec(&canonical).unwrap());

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id,
            "peers": peers_json,
            "signature": signature
        })))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "mesh-tok".into(),
            master_pubkey: pubkey,
            master_device_id: master_id.into(),
            unstable_mesh: true,
            device_label: "mesh-skip-url".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let _local = ensure_local_device(&pool, "mesh-skip-url").await.unwrap();

    let report = SyncEngine::run_mesh_sync(&pool).await.expect("mesh");
    assert_eq!(report.attempted, 1);
    assert!(report.errors.iter().any(|e| e.contains("peer_base_url")));
}

#[tokio::test]
async fn push_to_master_prefers_activation_token_over_jwt() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "legacy-jwt".into(),
            activation_token: "activation-bearer".into(),
            device_label: "act-token".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let device = ensure_local_device(&pool, "act-token").await.unwrap();
    append_outbox(
        &pool,
        &device,
        "app_kv",
        "act.key",
        "INSERT",
        r#"{"key":"act.key","value":"1"}"#,
    )
    .await
    .expect("outbox");

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 1,
            "lastSeq": 1
        })))
        .mount(&server)
        .await;

    SyncEngine::push_to_master(&pool).await.expect("push");
    let reqs = server.received_requests().await.expect("requests");
    assert!(reqs[0]
        .headers
        .get("authorization")
        .is_some_and(|v| { v.to_str().unwrap_or("").contains("activation-bearer") }));
}

#[tokio::test]
async fn run_mesh_sync_missing_master_pubkey_fails() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: "https://127.0.0.1:8787".into(),
            master_access_token: "tok".into(),
            unstable_mesh: true,
            device_label: "mesh-no-pubkey".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let err = SyncEngine::run_mesh_sync(&pool)
        .await
        .expect_err("no pubkey");
    assert!(matches!(err, medoc_core::error::AppError::Validation(_)));
}

#[tokio::test]
async fn push_to_master_http_error_surfaces_status() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok-err", "push-err").await;
    let device = ensure_local_device(&pool, "push-err").await.unwrap();
    append_outbox(
        &pool,
        &device,
        "app_kv",
        "err.key",
        "INSERT",
        r#"{"key":"err.key","value":"1"}"#,
    )
    .await
    .expect("outbox");

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&server)
        .await;

    let err = SyncEngine::push_to_master(&pool).await.expect_err("503");
    assert!(err.to_string().contains("503"));
}

#[tokio::test]
async fn run_replica_sync_push_and_pull_success() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "full-sync".into(),
            master_device_id: "master-device".into(),
            device_label: "replica-full".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let device = ensure_local_device(&pool, "replica-full").await.unwrap();
    append_outbox(
        &pool,
        &device,
        "app_kv",
        "full.key",
        "INSERT",
        r#"{"key":"full.key","value":"sent"}"#,
    )
    .await
    .expect("outbox");

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 1,
            "lastSeq": 1
        })))
        .mount(&server)
        .await;

    let remote_entry = serde_json::json!({
        "id": "full-pull",
        "deviceId": "master-device",
        "seq": 1,
        "entityTable": "app_kv",
        "entityId": "pulled.key",
        "op": "INSERT",
        "payloadJson": r#"{"key":"pulled.key","value":"down"}"#,
        "createdAt": "2099-01-01T00:00:00Z"
    });
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "entries": [remote_entry]
        })))
        .mount(&server)
        .await;

    let report = SyncEngine::run_replica_sync(&pool).await.expect("sync");
    assert!(report.error.is_none(), "{:?}", report.error);
    assert_eq!(report.push.as_ref().map(|p| p.accepted), Some(1));
    assert_eq!(report.pull.as_ref().map(|p| p.applied), Some(1));
}

#[tokio::test]
async fn pull_from_master_counts_skipped_already_applied() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok-skip", "pull-skip").await;
    let _device = ensure_local_device(&pool, "pull-skip").await.unwrap();

    let remote_entry = serde_json::json!({
        "id": "skip-e1",
        "deviceId": "master-device",
        "seq": 1,
        "entityTable": "app_kv",
        "entityId": "skip.key",
        "op": "INSERT",
        "payloadJson": r#"{"key":"skip.key","value":"v"}"#,
        "createdAt": "2099-01-01T00:00:00Z"
    });
    mark_applied(&pool, "master-device", 1).await.unwrap();

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "entries": [remote_entry]
        })))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "tok-skip".into(),
            master_device_id: "master-device".into(),
            device_label: "pull-skip".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");

    let result = SyncEngine::pull_from_master(&pool).await.expect("pull");
    assert_eq!(result.applied, 0);
    assert_eq!(result.skipped, 1);
}

#[tokio::test]
async fn pull_from_master_http_error_surfaces_status() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok-pull-err", "pull-err").await;
    let _device = ensure_local_device(&pool, "pull-err").await.unwrap();

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(ResponseTemplate::new(502))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "tok-pull-err".into(),
            master_device_id: "master-device".into(),
            device_label: "pull-err".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");

    let err = SyncEngine::pull_from_master(&pool).await.expect_err("502");
    assert!(err.to_string().contains("502"));
}

#[tokio::test]
async fn pull_resolves_master_device_id_from_sync_device_registry() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    save_replica(&pool, &server.uri(), "tok-fallback", "pull-fallback").await;
    let _device = ensure_local_device(&pool, "pull-fallback").await.unwrap();

    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local)
         VALUES ('registry-master', 'Registry Master', 'MASTER', 0)",
    )
    .execute(&pool)
    .await
    .expect("master row");

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "entries": []
        })))
        .mount(&server)
        .await;

    let result = SyncEngine::pull_from_master(&pool).await.expect("pull");
    assert_eq!(result.applied, 0);
}

#[tokio::test]
async fn run_mesh_sync_pushes_pending_outbox_to_peer() {
    let pool = fresh_pool().await;
    let master_server = MockServer::start().await;
    let peer_server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[9u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);
    let master_id = "master-mesh-push";

    let peers_json = serde_json::json!([{
        "deviceId": "peer-target",
        "slaveLabel": "Peer Target",
        "slavePubkey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "peerBaseUrl": format!("{}/", peer_server.uri())
    }]);
    let canonical = serde_json::json!({
        "masterDeviceId": master_id,
        "peers": peers_json
    });
    let signature = master_keys::sign(&sk, &serde_json::to_vec(&canonical).unwrap());

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id,
            "peers": peers_json,
            "signature": signature
        })))
        .mount(&master_server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 1,
            "lastSeq": 1
        })))
        .mount(&peer_server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: master_server.uri(),
            master_access_token: "mesh-push-tok".into(),
            master_pubkey: pubkey,
            master_device_id: master_id.into(),
            unstable_mesh: true,
            device_label: "mesh-pusher".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let local = ensure_local_device(&pool, "mesh-pusher").await.unwrap();
    append_outbox(
        &pool,
        &local,
        "app_kv",
        "mesh.peer.key",
        "INSERT",
        r#"{"key":"mesh.peer.key","value":"peer-bound"}"#,
    )
    .await
    .expect("outbox");

    let report = SyncEngine::run_mesh_sync(&pool).await.expect("mesh");
    assert_eq!(report.attempted, 1);
    assert_eq!(report.succeeded, 1);
    assert!(peer_server
        .received_requests()
        .await
        .as_ref()
        .is_some_and(|r| !r.is_empty()));
}

#[tokio::test]
async fn run_mesh_sync_empty_peer_list_returns_zero_attempts() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[10u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);
    let master_id = "master-empty-peers";
    let peers_json = serde_json::json!([]);
    let canonical = serde_json::json!({
        "masterDeviceId": master_id,
        "peers": peers_json
    });
    let signature = master_keys::sign(&sk, &serde_json::to_vec(&canonical).unwrap());

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id,
            "peers": peers_json,
            "signature": signature
        })))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "tok".into(),
            master_pubkey: pubkey,
            master_device_id: master_id.into(),
            unstable_mesh: true,
            device_label: "mesh-empty".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");

    let report = SyncEngine::run_mesh_sync(&pool).await.expect("mesh");
    assert_eq!(report.attempted, 0);
    assert_eq!(report.succeeded, 0);
}

#[tokio::test]
async fn run_replica_sync_includes_mesh_when_enabled() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[11u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);
    let master_id = "master-replica-mesh";

    let peers_json = serde_json::json!([]);
    let canonical = serde_json::json!({
        "masterDeviceId": master_id,
        "peers": peers_json
    });
    let signature = master_keys::sign(&sk, &serde_json::to_vec(&canonical).unwrap());

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id,
            "peers": peers_json,
            "signature": signature
        })))
        .mount(&server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "accepted": 0,
            "lastSeq": 0
        })))
        .mount(&server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/pull"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "entries": []
        })))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "full-mesh".into(),
            master_pubkey: pubkey,
            master_device_id: master_id.into(),
            unstable_mesh: true,
            device_label: "replica-mesh".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");

    let report = SyncEngine::run_replica_sync(&pool).await.expect("sync");
    assert!(report.mesh.is_some());
    assert!(report.error.is_none(), "{:?}", report.error);
}

#[tokio::test]
async fn run_mesh_sync_records_peer_push_failure() {
    let pool = fresh_pool().await;
    let master_server = MockServer::start().await;
    let peer_server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[12u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);
    let master_id = "master-mesh-fail";

    let peers_json = serde_json::json!([{
        "deviceId": "peer-fail",
        "slaveLabel": "Peer Fail",
        "slavePubkey": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "peerBaseUrl": format!("{}/", peer_server.uri())
    }]);
    let canonical = serde_json::json!({
        "masterDeviceId": master_id,
        "peers": peers_json
    });
    let signature = master_keys::sign(&sk, &serde_json::to_vec(&canonical).unwrap());

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "masterDeviceId": master_id,
            "peers": peers_json,
            "signature": signature
        })))
        .mount(&master_server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/v1/sync/push"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&peer_server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: master_server.uri(),
            master_access_token: "mesh-fail-tok".into(),
            master_pubkey: pubkey,
            master_device_id: master_id.into(),
            unstable_mesh: true,
            device_label: "mesh-fail-replica".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let local = ensure_local_device(&pool, "mesh-fail-replica")
        .await
        .unwrap();
    append_outbox(
        &pool,
        &local,
        "app_kv",
        "mesh.fail.key",
        "INSERT",
        r#"{"key":"mesh.fail.key","value":"x"}"#,
    )
    .await
    .expect("outbox");

    let report = SyncEngine::run_mesh_sync(&pool).await.expect("mesh");
    assert_eq!(report.attempted, 1);
    assert_eq!(report.succeeded, 0);
    assert!(report.errors.iter().any(|e| e.contains("503")));
}

#[tokio::test]
async fn run_mesh_sync_peers_http_error() {
    let pool = fresh_pool().await;
    let server = MockServer::start().await;
    let sk = SigningKey::from_bytes(&[13u8; 32]);
    let pubkey = master_keys::pubkey_b64(&sk);

    Mock::given(method("GET"))
        .and(path("/api/v1/pairing/peers"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: server.uri(),
            master_access_token: "tok".into(),
            master_pubkey: pubkey,
            master_device_id: "m1".into(),
            unstable_mesh: true,
            device_label: "peers-err".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");

    let err = SyncEngine::run_mesh_sync(&pool).await.expect_err("500");
    assert!(err.to_string().contains("500"));
}
