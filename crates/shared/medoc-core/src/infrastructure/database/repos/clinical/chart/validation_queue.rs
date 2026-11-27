//! Charts waiting for physician validation: list, count, mark, validate, decline (split from `chart.rs`).

use super::*;

/// FA-AKTE-15: records with status DRAFT or IN_PROGRESS (physician validation pending).
#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ChartToValidateRow {
    pub patient_id: String,
    pub patient_name: String,
    pub chart_id: String,
    pub chart_status: String,
    pub updated_at: String,
    /// Group: the doctor the chart belongs to (responsible doctor, else the patient's treating doctor).
    pub owner_staff_id: Option<String>,
    /// Group: this person may validate or decline it (owner's clinical change rule). Always true elsewhere.
    #[sqlx(default)]
    pub can_validate: bool,
}

/// The doctor a chart belongs to, for routing its validation (T5.5).
pub async fn chart_owner(pool: &SqlitePool, patient_id: &str) -> Result<Option<String>, AppError> {
    let owner: Option<Option<String>> = sqlx::query_scalar(
        "SELECT COALESCE(NULLIF(pa.responsible_staff_id, ''), NULLIF(p.treating_staff_id, ''))
         FROM patient_chart pa INNER JOIN patient p ON p.id = pa.patient_id WHERE pa.patient_id = ?1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?;
    Ok(owner.flatten())
}

pub async fn list_charts_to_validate(
    pool: &SqlitePool,
) -> Result<Vec<ChartToValidateRow>, AppError> {
    let rows = sqlx::query_as::<_, ChartToValidateRow>(
        "SELECT p.id AS patient_id, p.name AS patient_name, pa.id AS chart_id, pa.status AS chart_status,
                strftime('%Y-%m-%d %H:%M:%S', pa.updated_at) AS updated_at,
                COALESCE(NULLIF(pa.responsible_staff_id, ''), NULLIF(p.treating_staff_id, '')) AS owner_staff_id,
                1 AS can_validate
         FROM patient_chart pa
         INNER JOIN patient p ON p.id = pa.patient_id
         WHERE pa.status IN ('DRAFT', 'IN_PROGRESS')
         ORDER BY datetime(pa.updated_at) DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// FA-AKTE-15: count for sidebar badge (same filter as [`list_charts_to_validate`]).
pub async fn count_charts_to_validate(pool: &SqlitePool) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        // F94: same join as the list, so charts without a patient row are not counted.
        "SELECT COUNT(*) FROM patient_chart pa
         INNER JOIN patient p ON p.id = pa.patient_id
         WHERE pa.status IN ('DRAFT', 'IN_PROGRESS')",
    )
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

/// FA-AKTE-14: mark record for physician review (validation queue).
pub async fn mark_chart_for_physician_review(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<PatientChart, AppError> {
    let cur = find_chart_by_patient(pool, patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;
    crate::domain::services::workflow_transitions::patient_chart_forward_review_transition(
        &cur.status,
    )?;
    if cur.status.eq_ignore_ascii_case("IN_PROGRESS") {
        return Ok(cur);
    }
    sqlx::query(
        "UPDATE patient_chart SET status = 'IN_PROGRESS', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE patient_id = ?1",
    )
    .bind(patient_id)
    .execute(pool)
    .await?;
    let updated = find_chart_by_patient(pool, patient_id)
        .await?
        .ok_or_else(|| AppError::Internal("Chart not readable after handoff".into()))?;
    let body = serde_json::to_string(&updated)
        .unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", updated.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patient_chart",
        &updated.id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

/// Set record status to VALIDATED (forward-only from DRAFT / IN_PROGRESS).
pub async fn validate_patient_chart_status(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<PatientChart, AppError> {
    let cur = find_chart_by_patient(pool, patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;
    crate::domain::services::workflow_transitions::patient_chart_validate_transition(&cur.status)?;
    sqlx::query(
        "UPDATE patient_chart SET status = 'VALIDATED', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE patient_id = ?1",
    )
    .bind(patient_id)
    .execute(pool)
    .await?;
    let updated = find_chart_by_patient(pool, patient_id)
        .await?
        .ok_or_else(|| AppError::Internal("Chart not readable after validation".into()))?;
    let body = serde_json::to_string(&updated)
        .unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", updated.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patient_chart",
        &updated.id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

/// Set record status to DECLINED (from DRAFT / IN_PROGRESS). Leaves the validation queue.
pub async fn decline_patient_chart_status(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<PatientChart, AppError> {
    let cur = find_chart_by_patient(pool, patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;
    crate::domain::services::workflow_transitions::patient_chart_decline_transition(&cur.status)?;
    if cur.status.eq_ignore_ascii_case("DECLINED") {
        return Ok(cur);
    }
    sqlx::query(
        "UPDATE patient_chart SET status = 'DECLINED', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE patient_id = ?1",
    )
    .bind(patient_id)
    .execute(pool)
    .await?;
    let updated = find_chart_by_patient(pool, patient_id)
        .await?
        .ok_or_else(|| AppError::Internal("Chart not readable after decline".into()))?;
    let body = serde_json::to_string(&updated)
        .unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", updated.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patient_chart",
        &updated.id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}
