//! Audit helpers for device-cluster events.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::audit;
use sqlx::SqlitePool;

pub const ENTITY_CLUSTER: &str = "CLUSTER";
pub const ENTITY_PAIRING: &str = "PAIRING";

pub async fn log_cluster(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    entity_id: Option<&str>,
    details: Option<&str>,
) -> Result<(), AppError> {
    audit::create(pool, user_id, action, ENTITY_CLUSTER, entity_id, details).await
}

pub async fn log_pairing(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    entity_id: Option<&str>,
    details: Option<&str>,
) -> Result<(), AppError> {
    audit::create(pool, user_id, action, ENTITY_PAIRING, entity_id, details).await
}
