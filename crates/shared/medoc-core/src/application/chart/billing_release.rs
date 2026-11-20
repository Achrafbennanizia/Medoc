//! FA-LEIST-05 — physician release for billing (B/U lines).

use crate::domain::entities::treatment::{Examination, Treatment};
use crate::error::AppError;
use crate::infrastructure::database::recorded_write::audit_in_tx;
use crate::infrastructure::database::repos::clinical::chart as chart_repo;
use sqlx::SqlitePool;

pub async fn release_treatment_for_billing(
    pool: &SqlitePool,
    user_id: &str,
    treatment_id: &str,
) -> Result<Treatment, AppError> {
    let mut tx = pool.begin().await?;
    chart_repo::release_treatment_for_billing_in_tx(&mut tx, treatment_id, user_id).await?;
    audit_in_tx(
        &mut tx,
        user_id,
        "FREIGABE_BILLING",
        "Treatment",
        Some(treatment_id),
        None,
    )
    .await?;
    tx.commit().await?;
    chart_repo::find_treatment_by_id(pool, treatment_id)
        .await?
        .ok_or_else(|| AppError::Internal("Treatment not readable after release".into()))
}

pub async fn release_examination_for_billing(
    pool: &SqlitePool,
    user_id: &str,
    examination_id: &str,
) -> Result<Examination, AppError> {
    let mut tx = pool.begin().await?;
    chart_repo::release_examination_for_billing_in_tx(&mut tx, examination_id, user_id).await?;
    audit_in_tx(
        &mut tx,
        user_id,
        "FREIGABE_BILLING",
        "Examination",
        Some(examination_id),
        None,
    )
    .await?;
    tx.commit().await?;
    chart_repo::find_examination_by_id(pool, examination_id)
        .await?
        .ok_or_else(|| AppError::Internal("Examination not readable after release".into()))
}
