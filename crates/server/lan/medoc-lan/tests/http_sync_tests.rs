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
    let (status, _) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
#[serial]
async fn sync_status_returns_snapshot_when_licensed() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let (status, body) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["localDeviceId"].is_string());
}

#[tokio::test]
#[serial]
async fn sync_push_rejects_invalid_json_body() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let mut lan = LanTestHarness::licensed_master().await;
    let status = lan.post_raw("/api/v1/sync/push", "{not-json").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_push_ingests_remote_app_kv_row() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let remote = "remote-lan-replica-1";
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
            Some(&jwt),
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
async fn sync_pull_returns_outbox_entries_for_device() {
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
    assert_eq!(status, StatusCode::OK);
    assert_eq!(pull_body["entries"].as_array().map(|a| a.len()), Some(1));
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_pull_rejects_unlicensed_master() {
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let lan = LanTestHarness::unlicensed_master().await;
    let jwt = lan.ops_jwt();
    let mut lan = lan;
    let (status, _) = lan
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
