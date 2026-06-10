//! Revocation + re-pairing + activation-token rotation end-to-end.
//!
//! Closes the following coverage gaps (previously unit-tested only):
//!
//! - `POST /api/v1/pairing/revoke/{device_id}` (route present in
//!   `medoc-lan/src/http.rs:214`, no e2e coverage in Wave V1).
//! - Action revoked between issuance and use → `verify_activation_for_path`
//!   must 403 even when the token signature still verifies.
//! - Re-pairing HTTP cycle: same `device_id` resubmits a request after
//!   rejection; the master then accepts and issues a fresh activation
//!   token (`mt2.*`) distinct from any prior one.
//! - Master-side `pairing.enabled.v1` toggle: when set to `"false"`, the
//!   public `POST /api/v1/pairing/request` rejects with 403.

use axum::http::StatusCode;
use medoc_core::infrastructure::database::app_kv_repo;
use medoc_e2e::harness::{slave_pubkey_b64, slave_signing_key, LanHarness};
use medoc_sync::pairing::{ACTIVATION_TOKEN_PREFIX, APP_KV_PAIRING_ENABLED};

async fn submit_pairing(
    lan: &mut LanHarness,
    device_id: &str,
    slave_seed: u8,
    label: &str,
) -> String {
    let (status, body) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(slave_seed)),
                "slaveLabel": label,
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "submit_pairing: {body:?}");
    body["id"].as_str().expect("request id").to_string()
}

async fn accept_pairing(lan: &mut LanHarness, jwt: &str, request_id: &str) -> String {
    lan.pairing_decide_accept_and_confirm(request_id, jwt).await
}

#[tokio::test]
async fn revoke_route_marks_request_revoked_and_clears_permissions() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-revoke-001";

    let request_id = submit_pairing(&mut lan, device_id, 23, "ToBeRevoked").await;
    let token = accept_pairing(&mut lan, &jwt, &request_id).await;
    assert!(token.starts_with(ACTIVATION_TOKEN_PREFIX));

    // Sanity: sync.status works before revoke.
    let (status, snap) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK, "pre-revoke sync.status: {snap:?}");

    let (status, _body) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/revoke/{device_id}"),
            None,
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT, "revoke HTTP status");

    let row = medoc_sync::pairing::load_by_device(&lan.pool, device_id)
        .await
        .expect("db ok")
        .expect("pairing row");
    assert_eq!(row.status, "REVOKED");
    assert!(row.activation_token.is_none());
    let actions = medoc_sync::pairing::slave_actions(&lan.pool, device_id)
        .await
        .expect("slave actions");
    assert!(
        actions.is_empty(),
        "slave_permission rows should be cleared after revoke, got {actions:?}"
    );
}

#[tokio::test]
async fn revoked_action_rejects_sync_status_even_with_valid_token() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-action-revoke-001";

    let request_id = submit_pairing(&mut lan, device_id, 24, "ActionRevoke").await;
    let token = accept_pairing(&mut lan, &jwt, &request_id).await;

    let (status, _ok) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK);

    let (status, _r) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/revoke/{device_id}"),
            None,
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    // Token signature still verifies, but `verify_activation_for_path`
    // re-checks `slave_permission` and must reject with 403.
    let (status, body) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "post-revoke sync.status must 403: {body:?}"
    );
}

#[tokio::test]
async fn re_pairing_after_rejection_issues_fresh_activation_token() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-rotate-001";

    let request_id_a = submit_pairing(&mut lan, device_id, 25, "Rotation A").await;
    let (status, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id_a}"),
            Some(&serde_json::json!({ "accept": false })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(decided["request"]["status"], "REJECTED");
    assert!(decided["request"]["activationToken"].is_null());

    // Replica re-submits with a fresh label.
    let request_id_b = submit_pairing(&mut lan, device_id, 25, "Rotation A (retry)").await;
    assert_eq!(
        request_id_a, request_id_b,
        "re-pair must reuse the same row id"
    );

    let token_b = accept_pairing(&mut lan, &jwt, &request_id_b).await;
    assert!(token_b.starts_with(ACTIVATION_TOKEN_PREFIX));

    let (status, snap) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token_b))
        .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "rotated token sync.status: {snap:?}"
    );
}

#[tokio::test]
async fn already_accepted_request_is_not_re_decidable() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-doubledecide-001";

    let request_id = submit_pairing(&mut lan, device_id, 26, "Double Decide").await;
    let _ = accept_pairing(&mut lan, &jwt, &request_id).await;

    let (status, body) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": false })),
            Some(&jwt),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "second decide must conflict: {body:?}"
    );
}

#[tokio::test]
async fn master_pairing_toggle_off_blocks_submit_with_403() {
    let mut lan = LanHarness::new().await;
    app_kv_repo::set(&lan.pool, APP_KV_PAIRING_ENABLED, "false")
        .await
        .expect("set toggle");

    let (status, _body) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "replica-toggle-off",
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(27)),
                "slaveLabel": "Toggle Off",
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // Re-enable and submit succeeds.
    app_kv_repo::set(&lan.pool, APP_KV_PAIRING_ENABLED, "true")
        .await
        .expect("reset toggle");
    let (status, _body) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "replica-toggle-on",
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(27)),
                "slaveLabel": "Toggle On",
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn revoked_slave_cannot_access_pairing_peers_either() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "replica-peers-revoke-001";

    let request_id = submit_pairing(&mut lan, device_id, 29, "PeersRevoke").await;
    let token = accept_pairing(&mut lan, &jwt, &request_id).await;

    // Pair a second device so /pairing/peers has at least one entry to
    // return (otherwise an empty list still verifies on the happy path).
    let _ = submit_pairing(&mut lan, "replica-peers-revoke-002", 30, "Peer Other").await;

    let (status, _ok) = lan
        .json("GET", "/api/v1/pairing/peers", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK, "peers must work pre-revoke");

    let (status, _r) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/revoke/{device_id}"),
            None,
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (status, body) = lan
        .json("GET", "/api/v1/pairing/peers", None, Some(&token))
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "post-revoke /pairing/peers must 403: {body:?}"
    );
}

#[tokio::test]
async fn revoke_requires_jwt_ops_system() {
    let mut lan = LanHarness::new().await;
    let device_id = "replica-revoke-noauth";

    let _request_id = submit_pairing(&mut lan, device_id, 28, "NoAuth").await;

    let (status, _body) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/revoke/{device_id}"),
            None,
            None,
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
