//! In-process HTTP tests for `/api/v1/sync/*` (T-U1 medoc-lan).

mod support;

use axum::http::StatusCode;
use serial_test::serial;
use support::LanTestHarness;

#[tokio::test]
#[serial]
async fn sync_status_requires_license_on_unlicensed_master() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let lan = LanTestHarness::unlicensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let (status, body) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["reason"], "staff_jwt_rejected");
}

#[tokio::test]
#[serial]
async fn sync_status_returns_snapshot_when_licensed() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let mut lan = LanTestHarness::licensed_master().await;
    let token = device_token("status-device", &["sync.status"]);
    let (status, body) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["localDeviceId"].is_string());
}

#[tokio::test]
#[serial]
async fn sync_push_rejects_invalid_json_body() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let token = device_token("json-device", &["sync.push"]);
    let status = lan.post_raw("/api/v1/sync/push", "{not-json", &token).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_push_ingests_remote_app_kv_row() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let remote = "remote-lan-replica-1";
    let token = device_token(remote, &["sync.push"]);
    let entry = serde_json::json!({
        "id": "lan-e1",
        "deviceId": remote,
        "seq": 1,
        "entityTable": "app_kv",
        "entityId": "lan.http.key",
        "op": "INSERT",
        "payloadJson": r#"{"key":"lan.http.key","value":"42"}"#,
        "createdAt": "2099-01-01T00:00:00Z"
    });

    let (status, push_body) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": remote,
                "entries": [entry]
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(push_body["accepted"], 1);

    let val: String = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'lan.http.key'")
        .fetch_one(&lan.pool)
        .await
        .expect("app_kv");
    assert_eq!(val, "42");
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_pull_rejects_staff_jwt() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let device = medoc_sync::repo::ensure_local_device(&lan.pool, "LAN Test Master")
        .await
        .expect("device");
    medoc_sync::repo::append_outbox(
        &lan.pool,
        &device,
        "app_kv",
        "pull.key",
        "INSERT",
        r#"{"key":"pull.key","value":"99"}"#,
    )
    .await
    .expect("seed outbox");

    let (status, pull_body) = lan
        .json(
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": device,
                "sinceSeq": 0
            })),
            Some(&jwt),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "staff jwt pull: {pull_body:?}"
    );
    assert_eq!(pull_body["reason"], "staff_jwt_rejected");
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_pull_rejects_unlicensed_master() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let lan = LanTestHarness::unlicensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let (status, body) = lan
        .json(
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": "any",
                "sinceSeq": 0
            })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["reason"], "staff_jwt_rejected");
}

fn device_token(device_id: &str, actions: &[&str]) -> String {
    let signing_key = medoc_sync::master_keys::load_or_create().expect("master key");
    medoc_sync::pairing::mint_activation_token(
        &signing_key,
        &medoc_sync::pairing::ActivationTokenPayload {
            version: 2,
            device_id: device_id.to_string(),
            slave_label: "replica".into(),
            master_device_id: "master".into(),
            allowed_actions: actions.iter().map(|action| (*action).to_string()).collect(),
            issued_at: "2026-11-07T00:00:00Z".into(),
            nonce: format!("n-{device_id}"),
        },
    )
    .expect("mint")
}

#[tokio::test]
#[serial]
async fn sync_push_rejects_a_foreign_device_id() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let token = device_token("paired-device", &["sync.push"]);
    let (status, body) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": "someone-else",
                "entries": []
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["reason"], "from_device_mismatch");
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_status_rejects_an_unlicensed_paired_device() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let mut lan = LanTestHarness::unlicensed_master().await;
    let token = device_token("paired-device", &["sync.status"]);
    let (status, body) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["reason"], "master_license_required");
}

#[tokio::test]
#[serial]
async fn reception_cannot_delete_the_license_or_submit_a_prescription() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let lan = LanTestHarness::licensed_master().await;
    let jwt = lan.reception_jwt();
    let mut lan = lan;
    let (license_status, _) = lan
        .json("DELETE", "/api/v1/license", None, Some(&jwt))
        .await;
    assert_eq!(license_status, StatusCode::FORBIDDEN);
    let (rx_status, _) = lan
        .json(
            "POST",
            "/api/v1/eprescriptions/validate",
            Some(&serde_json::json!({
                "kvnr": "A123456789",
                "pzn": "12345678",
                "doctorLanr": "123456789"
            })),
            Some(&jwt),
        )
        .await;
    assert_eq!(rx_status, StatusCode::CONFLICT);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_routes_require_bearer_token() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let (status, _) = lan.json("GET", "/api/v1/sync/status", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn staff_jwt_on_digest_is_401() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/digest",
            Some(&serde_json::json!({})),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn digest_returns_256_buckets_with_activation_token() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let token = device_token("digest-device", &["sync.reconcile"]);
    let (status, body) = lan
        .json(
            "POST",
            "/api/v1/sync/digest",
            Some(&serde_json::json!({})),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["buckets"].as_array().map(|a| a.len()), Some(256));
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn replica_sync_push_token_can_allocate_document_number() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let token = device_token("number-device", &["sync.push"]);
    let body = serde_json::json!({
        "prefix": "RE",
        "date": "2026-11-08",
        "style": "daily"
    });
    let (status, first) = lan
        .json("POST", "/api/v1/sync/number", Some(&body), Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK, "{first}");
    let n1 = first["number"].as_str().expect("number");
    assert!(n1.contains("RE"), "{n1}");
    let (status, second) = lan
        .json("POST", "/api/v1/sync/number", Some(&body), Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK, "{second}");
    let n2 = second["number"].as_str().expect("number");
    assert_ne!(n1, n2, "replica allocations must be unique");
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn number_block_needs_its_own_grant_and_moves_the_main_counter() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let body = serde_json::json!({ "prefix": "F", "date": "2026-11-24", "size": 5 });
    let plain = device_token("member-device", &["sync.push"]);
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/number-block",
            Some(&body),
            Some(&plain),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a replica without the grant gets no block"
    );

    let hub_b = device_token("hub-b", &["sync.push", "sync.number_block"]);
    let (status, block) = lan
        .json(
            "POST",
            "/api/v1/sync/number-block",
            Some(&body),
            Some(&hub_b),
        )
        .await;
    if !medoc_core::edition::CORE_CAPS.multi_admin {
        assert_eq!(status, StatusCode::FORBIDDEN, "only Group reserves blocks");
        std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
        return;
    }
    assert_eq!(status, StatusCode::OK, "{block}");
    assert_eq!(
        (block["first"].as_i64(), block["last"].as_i64()),
        (Some(1), Some(5))
    );
    let one = serde_json::json!({ "prefix": "F", "date": "2026-11-24" });
    let (status, next) = lan
        .json("POST", "/api/v1/sync/number", Some(&one), Some(&plain))
        .await;
    assert_eq!(status, StatusCode::OK, "{next}");
    assert_eq!(
        next["number"], "F-2026-0006",
        "the main device continues after the block"
    );
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn blob_with_wrong_hash_is_rejected() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let bytes = b"attachment-bytes";
    let hex = medoc_core::infrastructure::database::sync_blob::sha256_hex(bytes);
    let token = device_token("blob-device", &["sync.blob.put", "sync.blob.get"]);
    let bad_hex = "00".repeat(32);
    let bad = lan
        .put_bytes(
            &format!("/api/v1/sync/blob/{bad_hex}"),
            bytes.to_vec(),
            &token,
        )
        .await;
    assert_eq!(bad, StatusCode::BAD_REQUEST);
    let ok = lan
        .put_bytes(&format!("/api/v1/sync/blob/{hex}"), bytes.to_vec(), &token)
        .await;
    assert_eq!(ok, StatusCode::NO_CONTENT);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

/// T7.6: a peer on a protocol this build cannot speak is refused before anything is applied.
#[tokio::test]
#[serial]
async fn incompatible_sync_protocol_gets_426_with_our_protocol() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let token = device_token("future-device", &["sync.push"]);
    let (status, headers) = lan
        .post_with_header("/api/v1/sync/push", ("x-medoc-sync-protocol", "99;min=99"), &token)
        .await;
    assert_eq!(status, StatusCode::UPGRADE_REQUIRED);
    assert!(headers.contains_key("x-medoc-sync-protocol-peer"));
    // T5.8: protocol 1 (no signed author) must update; the current protocol is accepted.
    let (status, _) = lan
        .post_with_header("/api/v1/sync/push", ("x-medoc-sync-protocol", "1;min=1"), &token)
        .await;
    assert_eq!(status, StatusCode::UPGRADE_REQUIRED);
    let current = medoc_sync::protocol_compat::header_value();
    let (status, _) = lan
        .post_with_header("/api/v1/sync/push", ("x-medoc-sync-protocol", current.as_str()), &token)
        .await;
    assert_ne!(status, StatusCode::UPGRADE_REQUIRED);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}
