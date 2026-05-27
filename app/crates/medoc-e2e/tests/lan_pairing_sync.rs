//! LAN server end-to-end: health, auth, pairing, activation-token sync, RBAC gates.

use axum::http::StatusCode;
use medoc_e2e::harness::{slave_pubkey_b64, slave_signing_key, LanHarness};
use medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX;
use medoc_sync::repo;

#[tokio::test]
async fn lan_health_and_ping_are_public() {
    let mut lan = LanHarness::new().await;

    let (status, body) = lan.json("GET", "/health", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "medoc-lan");

    let (status, body) = lan.json("GET", "/api/v1/ping", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["ok"], true);
}

async fn enroll_seed_arzt_totp(pool: &sqlx::SqlitePool) {
    use medoc_core::infrastructure::database::personal_repo;
    use medoc_core::infrastructure::totp;
    let (secret, _) = totp::generate_enrollment("ahmed@praxis.de").expect("totp enroll");
    personal_repo::set_totp_pending_secret(pool, "seed-arzt-001", &secret)
        .await
        .expect("pending totp");
    personal_repo::confirm_totp_enrollment(pool, "seed-arzt-001")
        .await
        .expect("confirm totp");
}

#[tokio::test]
async fn lan_login_and_me_profile() {
    let mut lan = LanHarness::new().await;
    enroll_seed_arzt_totp(&lan.pool).await;
    let jwt = lan.login_via_http_with_totp("1234").await;

    let (status, body) = lan.json("GET", "/api/v1/me", None, Some(&jwt)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["email"], "ahmed@praxis.de");
    assert_eq!(body["rolle"], "ARZT");
}

#[tokio::test]
async fn pairing_accept_issue_activation_token_and_sync() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;

    let slave_sk = slave_signing_key(7);
    let device_id = "replica-e2e-001";
    let slave_pubkey = slave_pubkey_b64(&slave_sk);

    let (status, master_info) = lan
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(master_info["masterPubkey"].is_string());

    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": "E2E Tablet"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().expect("request id");
    assert_eq!(submitted["status"], "PENDING");

    let (status, pending) = lan
        .json("GET", "/api/v1/pairing/pending", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(pending
        .as_array()
        .expect("array")
        .iter()
        .any(|r| { r["id"].as_str() == Some(request_id) }));

    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(decided["status"], "ACCEPTED");
    let token = decided["activationToken"]
        .as_str()
        .expect("activation token");
    assert!(token.starts_with(ACTIVATION_TOKEN_PREFIX));

    let (status, polled) = lan
        .json(
            "GET",
            &format!("/api/v1/pairing/status/{request_id}"),
            None,
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(polled["status"], "ACCEPTED");

    let (status, sync_status) = lan
        .json("GET", "/api/v1/sync/status", None, Some(token))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(sync_status["localDeviceId"].is_string());

    let entry = repo::append_outbox(
        &lan.pool,
        device_id,
        "app_kv",
        "e2e.sync.key",
        "INSERT",
        r#"{"key":"e2e.sync.key","value":"from-replica"}"#,
    )
    .await
    .expect("outbox row");

    let (status, push_result) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": [entry]
            })),
            Some(token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(push_result["accepted"], 1);

    let (status, pull_result) = lan
        .json(
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "sinceSeq": 0
            })),
            Some(token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(pull_result["entries"].is_array());

    let (status, peers) = lan
        .json("GET", "/api/v1/pairing/peers", None, Some(token))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(peers["signature"].is_string());
    assert!(peers["peers"].is_array());
}

#[tokio::test]
async fn pairing_reject_flow() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let slave_pubkey = slave_pubkey_b64(&slave_signing_key(9));

    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "replica-reject-001",
                "slavePubkey": slave_pubkey,
                "slaveLabel": "Rejected Tablet"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();

    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": false })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(decided["status"], "REJECTED");
    assert!(decided["activationToken"].is_null());
}

#[tokio::test]
async fn activation_token_cannot_access_patienten() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let slave_pubkey = slave_pubkey_b64(&slave_signing_key(11));
    let device_id = "replica-rbac-001";

    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": "RBAC Tablet"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();

    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let token = decided["activationToken"].as_str().unwrap();

    let (status, _body) = lan
        .json("GET", "/api/v1/patienten", None, Some(token))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn sync_push_rejects_mismatched_device_id() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let slave_pubkey = slave_pubkey_b64(&slave_signing_key(13));
    let device_id = "replica-mismatch-001";

    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": "Mismatch Tablet"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();

    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let token = decided["activationToken"].as_str().unwrap();

    let (status, _body) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": "other-device",
                "entries": []
            })),
            Some(token),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn protected_routes_require_auth() {
    let mut lan = LanHarness::new().await;
    let (status, _body) = lan.json("GET", "/api/v1/sync/status", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
