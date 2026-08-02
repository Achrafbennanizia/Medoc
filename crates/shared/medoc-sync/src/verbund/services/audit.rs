//! Audit helpers for device-cluster events.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::audit;
use sqlx::SqlitePool;

pub const ENTITY_VERBUND: &str = "VERBUND";
pub const ENTITY_KOPPLUNG: &str = "KOPPLUNG";

pub async fn log_verbund(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    entity_id: Option<&str>,
    details: Option<&str>,
) -> Result<(), AppError> {
    audit::create(pool, user_id, action, ENTITY_VERBUND, entity_id, details).await
}

pub async fn log_kopplung(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    entity_id: Option<&str>,
    details: Option<&str>,
) -> Result<(), AppError> {
    audit::create(pool, user_id, action, ENTITY_KOPPLUNG, entity_id, details).await
}
