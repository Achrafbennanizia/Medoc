//! FA-LEIST-05 — physician release for billing (B/U lines).

use crate::domain::entities::treatment::{Treatment, Examination};
use crate::error::AppError;
use crate::infrastructure::database::{chart_repo, audit_repo};
use sqlx::SqlitePool;

pub async fn release_treatment_for_billing(
    pool: &SqlitePool,
    user_id: &str,
    treatment_id: &str,
) -> Result<Treatment, AppError> {
    let b = chart_repo::release_treatment_for_billing(pool, treatment_id, user_id).await?;
    audit_repo::create(
        pool,
        user_id,
        "FREIGABE_BILLING",
        "Treatment",
        Some(treatment_id),
        None,
    )
    .await
    .ok();
    Ok(b)
}

pub async fn release_examination_for_billing(
    pool: &SqlitePool,
    user_id: &str,
    examination_id: &str,
) -> Result<Examination, AppError> {
    let u = chart_repo::release_examination_for_billing(pool, examination_id, user_id).await?;
    audit_repo::create(
        pool,
        user_id,
        "FREIGABE_BILLING",
        "Examination",
        Some(examination_id),
        None,
    )
    .await
    .ok();
    Ok(u)
}
