//! Master-side license gate for LAN pairing/sync endpoints.
//!
//! Installations acting as the sync **master** must hold a valid v2/v1
//! license before accepting replicas or ingesting sync traffic. Replicas
//! running embedded LAN for mesh receive skip this check.

use medoc_core::error::AppError;
use medoc_core::infrastructure::license_repo;
use medoc_sync::deployment::{DeploymentMode, DeviceRole};
use medoc_sync::repo::load_deployment;
use sqlx::SqlitePool;

fn skip_enforcement() -> bool {
    std::env::var("MEDOC_SKIP_MASTER_LICENSE")
        .ok()
        .is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
}

async fn acts_as_sync_master(pool: &SqlitePool) -> Result<bool, AppError> {
    let deployment = load_deployment(pool).await?;
    Ok(matches!(
        (deployment.mode, deployment.role),
        (DeploymentMode::PracticeDesktop, _)
            | (DeploymentMode::ServerlessPeer, DeviceRole::Master)
            | (DeploymentMode::LanClient, DeviceRole::Master)
    ))
}

/// Returns `Ok(())` when the host may accept pairing/sync as master.
pub async fn require_master_license(pool: &SqlitePool) -> Result<(), AppError> {
    if skip_enforcement() {
        return Ok(());
    }
    if !acts_as_sync_master(pool).await? {
        return Ok(());
    }
    let status = license_repo::current_status(pool).await?;
    if status.valid {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn unlicensed_practice_desktop_master_is_rejected() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
        let err = require_master_license(&pool)
            .await
            .expect_err("needs license");
        assert!(matches!(err, AppError::Forbidden));
    }

    #[tokio::test]
    async fn replica_role_skips_license_gate() {
        use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
        use medoc_sync::repo::save_deployment;

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
        save_deployment(
            &pool,
            &SyncDeploymentConfig {
                schema_version: 1,
                mode: DeploymentMode::ServerlessPeer,
                role: DeviceRole::Replica,
                device_label: "Replica".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        require_master_license(&pool).await.expect("replica skip");
    }

    #[tokio::test]
    async fn skip_enforcement_env_allows_unlicensed_master() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
        require_master_license(&pool).await.expect("skip env");
        std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    }
}
