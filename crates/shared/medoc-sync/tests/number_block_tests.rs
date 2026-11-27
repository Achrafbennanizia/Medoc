//! T4.3: the second admin hub issues document numbers from its reserved block only while
//! the primary hub is unreachable. Run with `--features medoc-core/full` for the Group path.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::number_sequence::blocks::{self, NumberBlock};
use medoc_core::infrastructure::database::number_sequence::NumberStyle;
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::numbering::allocate_document_number;
use medoc_sync::repo::{ensure_local_device, save_deployment};
use medoc_sync::schema::ensure_sync_tables;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn hub_b(master_url: &str) -> (sqlx::SqlitePool, String) {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: master_url.into(),
            master_access_token: "tok".into(),
            master_cert_sha256: "ab".repeat(32),
            device_label: "hub-b".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deployment");
    let id = ensure_local_device(&pool, "hub-b").await.expect("device");
    (pool, id)
}

fn group() -> bool {
    medoc_core::edition::CORE_CAPS.multi_admin
}

#[tokio::test]
async fn offline_hub_b_issues_from_its_block_and_never_without_one() {
    // Nothing listens on port 9: the primary is unreachable.
    let (pool, id) = hub_b("http://127.0.0.1:9").await;
    let err = allocate_document_number(&pool, "F", "2026-11-24", NumberStyle::Yearly)
        .await
        .expect_err("no block, no number");
    assert!(err.to_string().contains("not reachable"), "{err}");
    let block = NumberBlock {
        prefix: "F".into(),
        style: "yearly".into(),
        day: "2026-11-24".into(),
        first: 7,
        last: 8,
    };
    blocks::keep(&pool, &block, &id).await.expect("keep");
    let got = allocate_document_number(&pool, "F", "2026-11-24", NumberStyle::Yearly).await;
    if group() {
        assert_eq!(got.expect("from block"), "F-2026-0007");
    } else {
        assert!(got.is_err(), "Duo replicas have no offline numbers");
    }
}

#[tokio::test]
async fn online_hub_b_uses_the_primary_and_refills_its_block() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/number"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "number": "F-2026-0001"
        })))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/number-block"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "prefix": "F", "style": "yearly", "day": "2026-11-24", "first": 2, "last": 51
        })))
        .mount(&server)
        .await;
    let (pool, id) = hub_b(&server.uri()).await;
    let n = allocate_document_number(&pool, "F", "2026-11-24", NumberStyle::Yearly)
        .await
        .expect("online number");
    assert_eq!(n, "F-2026-0001", "online numbers come from the primary");
    let left = blocks::remaining(&pool, "F", "2026-11-24", NumberStyle::Yearly, &id)
        .await
        .unwrap();
    assert_eq!(left, if group() { 50 } else { 0 });
}

#[tokio::test]
async fn a_refusal_by_the_primary_is_never_bypassed() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/v1/sync/number"))
        .respond_with(ResponseTemplate::new(400).set_body_string("bad prefix"))
        .mount(&server)
        .await;
    let (pool, id) = hub_b(&server.uri()).await;
    let block = NumberBlock {
        prefix: "F".into(),
        style: "yearly".into(),
        day: "2026-11-24".into(),
        first: 1,
        last: 5,
    };
    blocks::keep(&pool, &block, &id).await.expect("keep");
    let err = allocate_document_number(&pool, "F", "2026-11-24", NumberStyle::Yearly)
        .await
        .expect_err("refused");
    assert!(err.to_string().contains("refused"), "{err}");
}
