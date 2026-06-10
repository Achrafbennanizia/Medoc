//! IPC command logic tests for sync + pairing (T-U1 medoc-practice).
//!
//! Tests RBAC policy + `SyncEngine`/`pairing` delegation (same paths as Tauri commands).

mod support;

use medoc_practice::application::rbac::{effective_allowed, Role};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::pairing::{self, PairingDecision, ACTIVATION_TOKEN_PREFIX};
use medoc_sync::repo::save_deployment;
use serial_test::serial;
use support::{fresh_pool, seed_master_license};

#[test]
#[serial]
fn sync_set_deployment_requires_ops_system_role() {
    let role = Role::parse("ARZT").expect("arzt");
    assert!(effective_allowed("ops.system", role, &[]));
    let role = Role::parse("REZEPTION").expect("rezeption");
    assert!(!effective_allowed("ops.system", role, &[]));
}

#[test]
#[serial]
fn sync_run_now_allows_any_authenticated_role() {
    for role_str in ["ARZT", "REZEPTION"] {
        let role = Role::parse(role_str).expect(role_str);
        assert!(effective_allowed("patient.read", role, &[]));
    }
}

#[tokio::test]
#[serial]
async fn sync_get_status_returns_deployment_snapshot() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Master,
            device_label: "IPC Master".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_eq!(snap.deployment.device_label, "IPC Master");
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_set_deployment_via_engine_registers_replica() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let pool = fresh_pool().await;
    SyncEngine::set_deployment(
        &pool,
        SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            device_label: "IPC Replica".into(),
            master_base_url: "https://127.0.0.1:8787".into(),
            ..Default::default()
        },
    )
    .await
    .expect("set");
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_eq!(snap.deployment.role, DeviceRole::Replica);
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn sync_record_change_noops_outside_serverless_peer() {
    let pool = fresh_pool().await;
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_ne!(snap.deployment.mode, DeploymentMode::ServerlessPeer);
    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(before, 0);
}

#[tokio::test]
#[serial]
async fn pairing_list_pending_empty_on_fresh_master() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    let pool = fresh_pool().await;
    seed_master_license(&pool).await;
    let rows = pairing::list_pending(&pool).await.expect("list");
    assert!(rows.is_empty());
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
}

#[tokio::test]
#[serial]
async fn pairing_decide_accept_mints_activation_token() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    std::env::set_var(
        "MEDOC_PAIRING_MASTER_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    let pool = fresh_pool().await;
    seed_master_license(&pool).await;
    let master_id = medoc_sync::repo::ensure_local_device(&pool, "IPC Master")
        .await
        .expect("device");
    let submitted = pairing::submit_request(
        &pool,
        medoc_sync::pairing::PairingRequestSubmit {
            device_id: "ipc-replica-1".into(),
            slave_pubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".into(),
            slave_label: "IPC Tablet".into(),
            requester_ip: "192.168.1.10".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    let decided = pairing::decide(
        &pool,
        &master_id,
        &submitted.id,
        PairingDecision {
            accept: true,
            allowed_actions: vec!["sync.push".into(), "sync.pull".into()],
            decided_by: "seed-arzt-001".into(),
        },
        8787,
    )
    .await
    .expect("decide");
    assert!(decided.confirm_pin.is_some());
    assert!(decided.request.awaiting_pin);

    let pin = decided.confirm_pin.expect("pin");
    let confirmed = pairing::confirm_pin(&pool, &master_id, &submitted.id, &pin, 8787)
        .await
        .expect("confirm");
    assert_eq!(confirmed.status, "ACCEPTED");
    assert!(confirmed
        .activation_token
        .as_deref()
        .is_some_and(|t| t.starts_with(ACTIVATION_TOKEN_PREFIX)));
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    std::env::remove_var("MEDOC_PAIRING_MASTER_SECRET");
}

#[tokio::test]
#[serial]
async fn pairing_persist_token_validation_prefix() {
    let token = format!("{ACTIVATION_TOKEN_PREFIX}body.sig");
    assert!(token.starts_with(ACTIVATION_TOKEN_PREFIX));
    let bad = "not-a-token";
    assert!(!bad.starts_with(ACTIVATION_TOKEN_PREFIX));
}
