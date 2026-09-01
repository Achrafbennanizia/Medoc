//! Engine validation-path tests (T-U1) — no live HTTP required.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::repo::save_deployment;
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

#[tokio::test]
async fn push_to_master_rejects_practice_desktop_mode() {
    let pool = fresh_pool().await;
    let err = SyncEngine::push_to_master(&pool)
        .await
        .expect_err("desktop");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn push_to_master_rejects_master_role() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Master,
            master_base_url: "https://127.0.0.1:8787".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let err = SyncEngine::push_to_master(&pool).await.expect_err("master");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn push_to_master_rejects_missing_master_url() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let err = SyncEngine::push_to_master(&pool).await.expect_err("no url");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn pull_from_master_rejects_practice_desktop_mode() {
    let pool = fresh_pool().await;
    let err = SyncEngine::pull_from_master(&pool)
        .await
        .expect_err("desktop");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn run_replica_sync_records_push_error_without_master_url() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            device_label: "replica-smoke".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let report = SyncEngine::run_replica_sync(&pool).await.expect("report");
    assert!(report.error.as_ref().is_some_and(|e| e.contains("push")));
}

#[tokio::test]
async fn set_deployment_registers_local_peer_row() {
    let pool = fresh_pool().await;
    SyncEngine::set_deployment(
        &pool,
        SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Master,
            device_label: "Test-Master".into(),
            master_base_url: "https://127.0.0.1:8787".into(),
            master_cert_sha256: "abc".into(),
            ..Default::default()
        },
    )
    .await
    .expect("set");
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_eq!(snap.deployment.mode, DeploymentMode::ServerlessPeer);
    assert_eq!(snap.deployment.role, DeviceRole::Master);
}

#[tokio::test]
async fn set_deployment_empty_label_uses_default_display_name() {
    let pool = fresh_pool().await;
    SyncEngine::set_deployment(
        &pool,
        SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            device_label: String::new(),
            ..Default::default()
        },
    )
    .await
    .expect("set");
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert!(snap.peers.iter().any(|p| p.display_name == "This device"));
}

#[tokio::test]
async fn run_mesh_sync_rejects_master_role() {
    let pool = fresh_pool().await;
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Master,
            unstable_mesh: true,
            master_access_token: "tok".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
    let err = SyncEngine::run_mesh_sync(&pool).await.expect_err("master");
    assert!(matches!(err, AppError::Validation(_)));
}
