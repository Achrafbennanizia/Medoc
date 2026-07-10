//! Two-replica mesh discovery — master lists both slaves with peer URLs.

use axum::http::StatusCode;
use medoc_e2e::harness::{fresh_replica_pool, slave_pubkey_b64, slave_signing_key, LanHarness};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::repo;
use std::net::SocketAddr;

fn connect_from_ip(ip: &str) -> SocketAddr {
    format!("{ip}:54321").parse().expect("connect addr")
}

async fn pair_replica(
    lan: &mut LanHarness,
    jwt: &str,
    seed: u8,
    device_id: &str,
    label: &str,
    ip: &str,
) -> String {
    let connect = connect_from_ip(ip);
    let (status, submitted) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(seed)),
                "slaveLabel": label,
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "submit: {submitted:?}");
    let request_id = submitted["id"].as_str().unwrap();

    lan.pairing_decide_accept_and_confirm(request_id, jwt).await
}

#[allow(clippy::too_many_arguments)]
async fn configure_replica(
    pool: &sqlx::SqlitePool,
    device_id: &str,
    label: &str,
    master_base_url: &str,
    master_pubkey: &str,
    master_device_id: &str,
    activation_token: &str,
    unstable_mesh: bool,
) {
    let cfg = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Replica,
        master_base_url: master_base_url.to_string(),
        master_cert_sha256: String::new(),
        device_label: label.to_string(),
        activation_token: activation_token.to_string(),
        master_pubkey: master_pubkey.to_string(),
        master_device_id: master_device_id.to_string(),
        unstable_mesh,
        ..Default::default()
    };
    SyncEngine::set_deployment(pool, cfg)
        .await
        .expect("set deployment");
    let _ = repo::ensure_local_device(pool, label)
        .await
        .expect("local device");
    assert_eq!(
        repo::ensure_local_device(pool, label).await.expect("id"),
        device_id
    );
}

async fn set_peer_url(pool: &sqlx::SqlitePool, device_id: &str, peer_base_url: &str) {
    sqlx::query("UPDATE sync_device SET peer_base_url = ?1 WHERE device_id = ?2")
        .bind(peer_base_url)
        .bind(device_id)
        .execute(pool)
        .await
        .expect("peer url");
}

#[tokio::test]
async fn two_replicas_appear_in_signed_peer_list_with_urls() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;

    let mut tokens: Vec<(String, String)> = Vec::new();
    for (seed, ip, label) in [
        (3_u8, "192.168.1.21", "Tablet A"),
        (5_u8, "192.168.1.22", "Tablet B"),
    ] {
        let device_id = format!("replica-mesh-{seed}");
        let connect = connect_from_ip(ip);
        let (status, submitted) = lan
            .json_with_connect(
                connect,
                "POST",
                "/api/v1/pairing/request",
                Some(&serde_json::json!({
                    "deviceId": device_id,
                    "slavePubkey": slave_pubkey_b64(&slave_signing_key(seed)),
                    "slaveLabel": label,
                })),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::OK, "submit: {submitted:?}");
        let request_id = submitted["id"].as_str().unwrap();

        let token = lan
            .pairing_decide_accept_and_confirm(request_id, &jwt)
            .await;
        tokens.push((device_id, token));
    }

    let (status, peers_a) = lan
        .json("GET", "/api/v1/pairing/peers", None, Some(&tokens[0].1))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(peers_a["signature"].is_string());
    let list = peers_a["peers"].as_array().expect("peers");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["deviceId"], "replica-mesh-5");
    assert_eq!(
        list[0]["peerBaseUrl"].as_str(),
        Some("https://192.168.1.22:8787")
    );

    let (status, peers_b) = lan
        .json("GET", "/api/v1/pairing/peers", None, Some(&tokens[1].1))
        .await;
    assert_eq!(status, StatusCode::OK);
    let list_b = peers_b["peers"].as_array().expect("peers b");
    assert_eq!(list_b.len(), 1);
    assert_eq!(list_b[0]["deviceId"], "replica-mesh-3");
    assert_eq!(
        list_b[0]["peerBaseUrl"].as_str(),
        Some("https://192.168.1.21:8787")
    );
}

#[tokio::test]
async fn unlicensed_master_rejects_pairing_submit() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let mut lan = LanHarness::new_unlicensed().await;

    let (status, _body) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "unlicensed-test",
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(99)),
                "slaveLabel": "Blocked"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn touch_replica_seen_updates_peer_url_on_sync_push() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-touch-001";
    let connect = connect_from_ip("192.168.1.55");

    let (status, submitted) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(11)),
                "slaveLabel": "Touch Test",
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();
    let token = lan
        .pairing_decide_accept_and_confirm(request_id, &jwt)
        .await;

    let (status, _push) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": []
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let url: Option<String> =
        sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
            .bind(device_id)
            .fetch_one(&lan.pool)
            .await
            .expect("row");
    assert_eq!(url.as_deref(), Some("https://192.168.1.55:8787"));

    let seen_push: Option<String> =
        sqlx::query_scalar("SELECT last_seen_at FROM sync_device WHERE device_id = ?1")
            .bind(device_id)
            .fetch_one(&lan.pool)
            .await
            .expect("row");
    assert!(seen_push.as_deref().is_some_and(|s| !s.is_empty()));

    let master_device_id = medoc_sync::repo::ensure_local_device(&lan.pool, "E2E Master")
        .await
        .expect("master id");
    let (status, _pull) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": master_device_id,
                "sinceSeq": 0,
                "requesterId": device_id,
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let seen_pull: Option<String> =
        sqlx::query_scalar("SELECT last_seen_at FROM sync_device WHERE device_id = ?1")
            .bind(device_id)
            .fetch_one(&lan.pool)
            .await
            .expect("row");
    assert!(seen_pull.as_deref().is_some_and(|s| !s.is_empty()));
}

#[tokio::test]
async fn touch_replica_seen_updates_last_seen_on_sync_pull() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-pull-touch-001";
    let connect = connect_from_ip("192.168.1.56");

    let (status, submitted) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(12)),
                "slaveLabel": "Pull Touch",
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();
    let token = lan
        .pairing_decide_accept_and_confirm(request_id, &jwt)
        .await;

    sqlx::query("UPDATE sync_device SET last_seen_at = NULL WHERE device_id = ?1")
        .bind(device_id)
        .execute(&lan.pool)
        .await
        .expect("clear seen");

    let master_device_id = medoc_sync::repo::ensure_local_device(&lan.pool, "E2E Master")
        .await
        .expect("master id");
    let (status, _pull) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": master_device_id,
                "sinceSeq": 0,
                "requesterId": device_id,
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let seen: Option<String> =
        sqlx::query_scalar("SELECT last_seen_at FROM sync_device WHERE device_id = ?1")
            .bind(device_id)
            .fetch_one(&lan.pool)
            .await
            .expect("row");
    assert!(seen.as_deref().is_some_and(|s| !s.is_empty()));
}

#[tokio::test]
async fn mesh_push_delivers_outbox_entry_to_peer_replica() {
    let mut master = LanHarness::new().await;
    let jwt = master.login_ops_jwt().await;
    let master_tcp = master.spawn_tcp().await;

    let (_, master_info) = master
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    let master_pubkey = master_info["masterPubkey"].as_str().unwrap();
    let master_device_id = medoc_sync::repo::ensure_local_device(&master.pool, "E2E Master")
        .await
        .expect("master device id");

    let device_a = "mesh-live-replica-a";
    let device_b = "mesh-live-replica-b";
    let token_a = pair_replica(&mut master, &jwt, 31, device_a, "Mesh A", "10.0.0.1").await;
    let token_b = pair_replica(&mut master, &jwt, 32, device_b, "Mesh B", "10.0.0.2").await;

    let pool_a = fresh_replica_pool(device_a).await;
    let pool_b = fresh_replica_pool(device_b).await;
    let replica_a = LanHarness::from_pool(pool_a.clone()).await;
    let replica_b = LanHarness::from_pool(pool_b.clone()).await;
    let tcp_a = replica_a.spawn_tcp().await;
    let tcp_b = replica_b.spawn_tcp().await;

    set_peer_url(&master.pool, device_a, &tcp_a.base_url).await;
    set_peer_url(&master.pool, device_b, &tcp_b.base_url).await;

    let stored_b: String =
        sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
            .bind(device_b)
            .fetch_one(&master.pool)
            .await
            .expect("peer url b");
    assert_eq!(stored_b, tcp_b.base_url);

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap();
    let peers_url = format!("{}/api/v1/pairing/peers", master_tcp.base_url);
    let peers_json: serde_json::Value = client
        .get(&peers_url)
        .bearer_auth(&token_a)
        .send()
        .await
        .expect("peers get")
        .json()
        .await
        .expect("peers json");
    assert_eq!(
        peers_json["peers"][0]["peerBaseUrl"].as_str(),
        Some(tcp_b.base_url.as_str()),
        "peers listing: {peers_json:?}"
    );

    configure_replica(
        &pool_a,
        device_a,
        "Mesh A",
        &master_tcp.base_url,
        master_pubkey,
        &master_device_id,
        &token_a,
        true,
    )
    .await;
    configure_replica(
        &pool_b,
        device_b,
        "Mesh B",
        &master_tcp.base_url,
        master_pubkey,
        &master_device_id,
        &token_b,
        false,
    )
    .await;

    let kv_key = "mesh.e2e.delivered";
    let _entry = repo::append_outbox(
        &pool_a,
        device_a,
        "app_kv",
        kv_key,
        "INSERT",
        &format!(r#"{{"key":"{kv_key}","value":"from-mesh-a"}}"#),
    )
    .await
    .expect("outbox");

    let report = SyncEngine::run_mesh_sync(&pool_a).await.expect("mesh sync");
    assert_eq!(report.attempted, 1, "errors: {:?}", report.errors);
    assert_eq!(report.succeeded, 1, "errors: {:?}", report.errors);
    assert!(report.errors.is_empty());

    let value_after_mesh: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
            .bind(kv_key)
            .fetch_optional(&pool_b)
            .await
            .expect("read replica b after mesh");
    assert_eq!(
        value_after_mesh.as_deref(),
        Some("from-mesh-a"),
        "mesh push payload"
    );

    tcp_a.abort();
    tcp_b.abort();
    master_tcp.abort();
}
