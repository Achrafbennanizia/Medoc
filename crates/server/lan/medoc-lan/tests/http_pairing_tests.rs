//! In-process HTTP tests for `/api/v1/pairing/*` (T-U1 medoc-lan).

mod support;

use axum::http::StatusCode;
use medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX;
use serial_test::serial;
use support::LanTestHarness;

#[tokio::test]
#[serial]
async fn pairing_master_info_is_public() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let (status, body) = lan
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["masterPubkey"].is_string());
    assert!(body["masterDeviceId"].is_string());
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn pairing_submit_and_accept_issues_activation_token() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let device_id = "unit-pair-replica-1";
    let slave_pubkey = LanTestHarness::slave_pubkey(17);

    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": "Unit Tablet"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().expect("id");
    assert_eq!(submitted["status"], "PENDING");

    let (status, pending) = lan
        .json("GET", "/api/v1/pairing/pending", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(pending
        .as_array()
        .expect("array")
        .iter()
        .any(|r| r["id"].as_str() == Some(request_id)));

    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(decided["request"]["status"], "PENDING");
    assert!(decided["request"]["awaitingPin"].as_bool().unwrap_or(false));
    let pin = decided["confirmPin"].as_str().expect("confirm pin");

    let (status, confirmed) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": pin })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(confirmed["status"], "ACCEPTED");
    let token = confirmed["activationToken"]
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

    let (status, peers) = lan
        .json("GET", "/api/v1/pairing/peers", None, Some(token))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(peers["signature"].is_string());
    assert!(peers["peers"].is_array());
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn pairing_submit_rejected_without_license() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let mut lan = LanTestHarness::unlicensed_master().await;
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "no-lic",
                "slavePubkey": LanTestHarness::slave_pubkey(18),
                "slaveLabel": "X"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
#[serial]
async fn pairing_pending_requires_ops_jwt() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let (status, _) = lan.json("GET", "/api/v1/pairing/pending", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn pairing_status_unknown_id_returns_not_found() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let (status, _) = lan
        .json("GET", "/api/v1/pairing/status/does-not-exist", None, None)
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn pairing_revoke_returns_no_content() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let device_id = "revoke-target-1";
    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": LanTestHarness::slave_pubkey(19),
                "slaveLabel": "Revoke Me"
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();

    lan.json(
        "POST",
        &format!("/api/v1/pairing/decide/{request_id}"),
        Some(&serde_json::json!({ "accept": true })),
        Some(&jwt),
    )
    .await;

    let (status, _) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/revoke/{device_id}"),
            None,
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}
