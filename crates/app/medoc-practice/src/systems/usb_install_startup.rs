//! USB install_plan sidecar applied on first app launch after field setup.

use medoc_sync::cluster::services::{
    consume_default_sidecar_and_apply, run_provisioning_tasks, ApplyInstallPlanResult,
};
use sqlx::SqlitePool;

use crate::error::AppError;

pub async fn apply_usb_install_plan_on_startup(
    pool: &SqlitePool,
) -> Result<Option<ApplyInstallPlanResult>, AppError> {
    consume_default_sidecar_and_apply(pool).await.map_err(Into::into)
}

pub async fn run_usb_provisioning_on_startup(
    pool: &SqlitePool,
) -> Result<Option<String>, AppError> {
    run_provisioning_tasks(pool).await.map_err(Into::into)
}
