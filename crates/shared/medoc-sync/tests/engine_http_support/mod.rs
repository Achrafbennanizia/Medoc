//! Deploy, pool and replica-config helpers of the engine HTTP tests (split from `engine_http_tests.rs`).

use super::*;

pub(super) async fn deploy(
    pool: &sqlx::SqlitePool,
    cfg: &SyncDeploymentConfig,
) -> Result<(), medoc_core::error::AppError> {
    let mut cfg = cfg.clone();
    if cfg.master_cert_sha256.is_empty() {
        cfg.master_cert_sha256 = "ab".repeat(32);
    }
    save_deployment(pool, &cfg).await
}

pub(super) async fn seed_peer_tls_pin(pool: &sqlx::SqlitePool, device_id: &str) {
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, peer_cert_sha256)
         VALUES (?1, ?1, 'REPLICA', 0, ?2)
         ON CONFLICT(device_id) DO UPDATE SET peer_cert_sha256 = excluded.peer_cert_sha256",
    )
    .bind(device_id)
    .bind("ab".repeat(32))
    .execute(pool)
    .await
    .expect("peer pin");
}

pub(super) async fn fresh_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

pub(super) async fn save_replica(
    pool: &sqlx::SqlitePool,
    master_url: &str,
    token: &str,
    label: &str,
) {
    deploy(
        pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Replica,
            master_base_url: master_url.into(),
            master_access_token: token.into(),
            master_cert_sha256: "ab".repeat(32),
            device_label: label.into(),
            ..Default::default()
        },
    )
    .await
    .expect("deployment");
}
