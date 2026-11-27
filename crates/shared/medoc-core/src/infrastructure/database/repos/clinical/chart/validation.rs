//! Physician validation queue: charts waiting for review, validate and decline.

use super::*;

/// FA-AKTE-15: records with status DRAFT or IN_PROGRESS (physician validation pending).
#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ChartToValidateRow {
    pub patient_id: String,
    pub patient_name: String,
    pub chart_id: String,
    pub chart_status: String,
    pub updated_at: String,
}

pub async fn list_charts_to_validate(
    pool: &SqlitePool,
) -> Result<Vec<ChartToValidateRow>, AppError> {
    let rows = sqlx::query_as::<_, ChartToValidateRow>(
        "SELECT p.id AS patient_id, p.name AS patient_name, pa.id AS chart_id, pa.status AS chart_status,
                strftime('%Y-%m-%d %H:%M:%S', pa.updated_at) AS updated_at
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

/// Set the GOZ billing data of a treatment line (fee number, points, factor …).
/// The factor/justification rules are checked again when the invoice is issued.
pub async fn set_treatment_billing(
    pool: &SqlitePool,
    data: &crate::domain::entities::treatment::TreatmentBilling,
) -> Result<Treatment, AppError> {
    let schedule = data.fee_schedule.trim().to_lowercase();
    if !["goz", "goae", "material", "lab", "other"].contains(&schedule.as_str()) {
        return Err(AppError::validation_code(
            "error.treatment.invalid_fee_schedule",
        ));
    }
    if matches!(schedule.as_str(), "goz" | "goae") {
        if data
            .goz_nr
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
            || data.points.is_none()
        {
            return Err(AppError::validation_code(
                "error.treatment.goz_nr_and_points_required",
            ));
        }
        let f = data.factor.unwrap_or(0.0);
        if !(1.0..=10.0).contains(&f) {
            return Err(AppError::validation_code(
                "error.treatment.factor_out_of_range",
            ));
        }
        if f > 2.3
            && data
                .factor_reason
                .as_deref()
                .map(str::trim)
                .unwrap_or("")
                .is_empty()
        {
            return Err(AppError::validation_code(
                "error.treatment.factor_reason_required",
            ));
        }
        if f > 3.5
            && data
                .agreement_ref
                .as_deref()
                .map(str::trim)
                .unwrap_or("")
                .is_empty()
        {
            return Err(AppError::validation_code(
                "error.treatment.agreement_required",
            ));
        }
    }
    let n = sqlx::query(
        "UPDATE treatment SET fee_schedule = ?1, goz_nr = ?2, points = ?3, factor = ?4,
                factor_reason = ?5, quantity = ?6, analog_of = ?7, agreement_ref = ?8,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?9",
    )
    .bind(&schedule)
    .bind(data.goz_nr.as_deref().map(str::trim))
    .bind(data.points)
    .bind(data.factor)
    .bind(data.factor_reason.as_deref().map(str::trim))
    .bind(data.quantity.unwrap_or(1).max(1))
    .bind(
        data.analog_of
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(
        data.agreement_ref
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(&data.treatment_id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Treatment".into()));
    }
    let updated = find_treatment_by_id(pool, &data.treatment_id)
        .await?
        .ok_or(AppError::NotFound("Treatment".into()))?;
    // Billing fields are part of the synced treatment row: replicate the change.
    let body = serde_json::to_string(&updated)
        .unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", data.treatment_id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "treatment",
        &data.treatment_id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}
