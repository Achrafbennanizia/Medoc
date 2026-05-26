//! FA-LEIST-05 — physician release for billing (B/U lines).

use crate::domain::entities::behandlung::{Behandlung, Untersuchung};
use crate::error::AppError;
use crate::infrastructure::database::{akte_repo, audit_repo};
use sqlx::SqlitePool;

pub async fn release_behandlung_for_billing(
    pool: &SqlitePool,
    user_id: &str,
    behandlung_id: &str,
) -> Result<Behandlung, AppError> {
    let b = akte_repo::release_behandlung_for_billing(pool, behandlung_id, user_id).await?;
    audit_repo::create(
        pool,
        user_id,
        "FREIGABE_ABRECHNUNG",
        "Behandlung",
        Some(behandlung_id),
        None,
    )
    .await
    .ok();
    Ok(b)
}

pub async fn release_untersuchung_for_billing(
    pool: &SqlitePool,
    user_id: &str,
    untersuchung_id: &str,
) -> Result<Untersuchung, AppError> {
    let u = akte_repo::release_untersuchung_for_billing(pool, untersuchung_id, user_id).await?;
    audit_repo::create(
        pool,
        user_id,
        "FREIGABE_ABRECHNUNG",
        "Untersuchung",
        Some(untersuchung_id),
        None,
    )
    .await
    .ok();
    Ok(u)
}
