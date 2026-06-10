//! Activation-token RBAC on LAN read routes (MS-6).

use axum::http::StatusCode;
use medoc_e2e::harness::{slave_pubkey_b64, slave_signing_key, LanHarness};

async fn pair_with_actions(
    lan: &mut LanHarness,
    jwt: &str,
    seed: u8,
    device_id: &str,
    allowed_actions: &[&str],
) -> String {
    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(seed)),
                "slaveLabel": device_id,
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "submit: {submitted:?}");
    let request_id = submitted["id"].as_str().unwrap();

    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({
                "accept": true,
                "allowedActions": allowed_actions,
            })),
            Some(jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "decide: {decided:?}");
    let pin = decided["confirmPin"]
        .as_str()
        .expect("confirm pin after accept");

    let (status, confirmed) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": pin })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "confirm: {confirmed:?}");
    confirmed["activationToken"]
        .as_str()
        .expect("activation token")
        .to_string()
}

#[tokio::test]
async fn activation_token_without_patient_read_gets_403_on_patienten() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let token = pair_with_actions(
        &mut lan,
        &jwt,
        41,
        "rbac-no-patient-read",
        &["sync.push", "sync.pull", "sync.status", "pairing.peers"],
    )
    .await;

    let (status, _) = lan
        .json("GET", "/api/v1/patienten", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn activation_token_with_patient_read_lists_patienten() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let token = pair_with_actions(
        &mut lan,
        &jwt,
        42,
        "rbac-patient-read",
        &[
            "sync.push",
            "sync.pull",
            "sync.status",
            "pairing.peers",
            "patient.read",
        ],
    )
    .await;

    let (status, body) = lan
        .json("GET", "/api/v1/patienten", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK, "patienten: {body:?}");
    assert!(body.is_array());
}

#[tokio::test]
async fn activation_token_with_termin_read_lists_termine() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let token = pair_with_actions(
        &mut lan,
        &jwt,
        43,
        "rbac-termin-read",
        &[
            "sync.push",
            "sync.pull",
            "sync.status",
            "pairing.peers",
            "termin.read",
        ],
    )
    .await;

    let (status, body) = lan.json("GET", "/api/v1/termine", None, Some(&token)).await;
    assert_eq!(status, StatusCode::OK, "termine: {body:?}");
    assert!(body.is_array());
}

#[tokio::test]
async fn activation_token_cannot_access_me_route() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let token = pair_with_actions(
        &mut lan,
        &jwt,
        44,
        "rbac-no-me",
        &["sync.push", "patient.read", "termin.read"],
    )
    .await;

    let (status, _) = lan.json("GET", "/api/v1/me", None, Some(&token)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}
