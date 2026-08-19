use crate::domain::entities::anamnesis_form::SaveAnamnesisForm;
use crate::domain::entities::treatment::{
    Treatment, CreateTreatment, CreateExamination, Examination, UpdateTreatment,
    UpdateExamination,
};
use crate::domain::entities::dental_finding::CreateDentalFinding;
use crate::domain::entities::{AnamnesisForm, PatientChart, DentalFinding};
use crate::error::AppError;
use sqlx::SqlitePool;

/// Next `U-{year}-{nnn}` number per record (sequential per year).
pub async fn next_examination_number(
    pool: &SqlitePool,
    chart_id: &str,
) -> Result<String, AppError> {
    let year = chrono::Utc::now().format("%Y").to_string();
    let prefix = format!("U-{year}-");
    let rows: Vec<(Option<String>,)> = sqlx::query_as(
        "SELECT examination_number FROM examination WHERE chart_id = ?1 AND examination_number IS NOT NULL AND TRIM(examination_number) != ''",
    )
    .bind(chart_id)
    .fetch_all(pool)
    .await?;
    let mut max = 0u32;
    for (n,) in rows {
        let Some(n) = n else { continue };
        if let Some(rest) = n.strip_prefix(prefix.as_str()) {
            if let Ok(version) = rest.parse::<u32>() {
                max = max.max(version);
            }
        }
    }
    let next = max + 1;
    Ok(format!("{prefix}{:03}", next))
}

pub async fn find_chart_by_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<PatientChart>, AppError> {
    let row =
        sqlx::query_as::<_, PatientChart>("SELECT * FROM patient_chart WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_optional(pool)
            .await?;
    Ok(row)
}

// --- DentalFinding ---

pub async fn find_dental_findings(
    pool: &SqlitePool,
    chart_id: &str,
) -> Result<Vec<DentalFinding>, AppError> {
    let rows = sqlx::query_as::<_, DentalFinding>(
        "SELECT * FROM dental_finding WHERE chart_id = ?1 ORDER BY tooth_number",
    )
    .bind(chart_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn upsert_dental_finding(
    pool: &SqlitePool,
    data: &CreateDentalFinding,
) -> Result<DentalFinding, AppError> {
    data.validate_tooth_number().map_err(AppError::Validation)?;

    // Check if finding for this tooth already exists
    let existing: Option<DentalFinding> =
        sqlx::query_as("SELECT * FROM dental_finding WHERE chart_id = ?1 AND tooth_number = ?2")
            .bind(&data.chart_id)
            .bind(data.tooth_number)
            .fetch_optional(pool)
            .await?;

    if let Some(ex) = existing {
        sqlx::query(
            "UPDATE dental_finding SET finding = ?1, diagnosis = ?2, notes = ?3, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?4"
        )
        .bind(&data.finding)
        .bind(&data.diagnosis)
        .bind(&data.notes)
        .bind(&ex.id)
        .execute(pool)
        .await?;

        let updated = sqlx::query_as::<_, DentalFinding>("SELECT * FROM dental_finding WHERE id = ?1")
            .bind(&ex.id)
            .fetch_one(pool)
            .await?;
        let body =
            serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", ex.id));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "dental_finding",
            &ex.id,
            "UPDATE",
            &body,
        )
        .await?;
        Ok(updated)
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO dental_finding (id, chart_id, tooth_number, finding, diagnosis, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&id)
        .bind(&data.chart_id)
        .bind(data.tooth_number)
        .bind(&data.finding)
        .bind(&data.diagnosis)
        .bind(&data.notes)
        .execute(pool)
        .await?;

        let inserted = sqlx::query_as::<_, DentalFinding>("SELECT * FROM dental_finding WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?;
        let body =
            serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "dental_finding",
            &id,
            "INSERT",
            &body,
        )
        .await?;
        Ok(inserted)
    }
}

// --- AnamnesisForm ---

pub async fn find_anamnesis_form(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<AnamnesisForm>, AppError> {
    let row =
        sqlx::query_as::<_, AnamnesisForm>("SELECT * FROM anamnesis_form WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_optional(pool)
            .await?;
    Ok(row)
}

pub async fn save_anamnesis_form(
    pool: &SqlitePool,
    data: &SaveAnamnesisForm,
) -> Result<AnamnesisForm, AppError> {
    let answers_json =
        serde_json::to_string(&data.answers).map_err(|e| AppError::Internal(e.to_string()))?;

    let existing = find_anamnesis_form(pool, &data.patient_id).await?;

    if let Some(ex) = existing {
        sqlx::query(
            "UPDATE anamnesis_form SET answers = ?1, signed = ?2, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3"
        )
        .bind(&answers_json)
        .bind(data.signed)
        .bind(&ex.id)
        .execute(pool)
        .await?;

        let updated =
            sqlx::query_as::<_, AnamnesisForm>("SELECT * FROM anamnesis_form WHERE id = ?1")
                .bind(&ex.id)
                .fetch_one(pool)
                .await?;
        let body =
            serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", ex.id));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "anamnesis_form",
            &ex.id,
            "UPDATE",
            &body,
        )
        .await?;
        Ok(updated)
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO anamnesis_form (id, patient_id, answers, signed)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&id)
        .bind(&data.patient_id)
        .bind(&answers_json)
        .bind(data.signed)
        .execute(pool)
        .await?;

        let inserted =
            sqlx::query_as::<_, AnamnesisForm>("SELECT * FROM anamnesis_form WHERE id = ?1")
                .bind(&id)
                .fetch_one(pool)
                .await?;
        let body =
            serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "anamnesis_form",
            &id,
            "INSERT",
            &body,
        )
        .await?;
        Ok(inserted)
    }
}

// --- Examination ---

pub async fn create_examination(
    pool: &SqlitePool,
    data: &CreateExamination,
) -> Result<Examination, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let nr = match &data.examination_number {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => next_examination_number(pool, &data.chart_id).await?,
    };
    sqlx::query(
        "INSERT INTO examination (id, chart_id, chief_complaint, results, diagnosis, examination_number, category, service_name, total_cost)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(&id)
    .bind(&data.chart_id)
    .bind(&data.chief_complaint)
    .bind(&data.results)
    .bind(&data.diagnosis)
    .bind(&nr)
    .bind(&data.category)
    .bind(&data.service_name)
    .bind(data.total_cost)
    .execute(pool)
    .await?;

    let inserted = sqlx::query_as::<_, Examination>("SELECT * FROM examination WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "examination",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn list_examinations(
    pool: &SqlitePool,
    chart_id: &str,
) -> Result<Vec<Examination>, AppError> {
    let rows = sqlx::query_as::<_, Examination>(
        "SELECT * FROM examination WHERE chart_id = ?1 ORDER BY created_at DESC",
    )
    .bind(chart_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// --- Treatment ---

pub async fn list_treatments(
    pool: &SqlitePool,
    chart_id: &str,
) -> Result<Vec<Treatment>, AppError> {
    let rows = sqlx::query_as::<_, Treatment>(
        "SELECT * FROM treatment WHERE chart_id = ?1
         ORDER BY
           CASE WHEN treatment_number IS NULL OR treatment_number = '' THEN 1 ELSE 0 END,
           treatment_number DESC,
           COALESCE(session_number, 0) DESC,
           created_at DESC",
    )
    .bind(chart_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_treatment(
    pool: &SqlitePool,
    data: &CreateTreatment,
) -> Result<Treatment, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let kat = data.category.clone().unwrap_or_else(|| data.kind.clone());
    let leist = data
        .service_name
        .clone()
        .or_else(|| data.description.clone());
    let appointment = data
        .appointment_required
        .map(|b| if b { 1i64 } else { 0i64 });
    sqlx::query(
        "INSERT INTO treatment (id, chart_id, kind, description, teeth, material, notes,
         category, service_name, treatment_number, session_number, treatment_status, total_cost, appointment_required, treatment_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
    )
    .bind(&id)
    .bind(&data.chart_id)
    .bind(&data.kind)
    .bind(&data.description)
    .bind(&data.teeth)
    .bind(&data.material)
    .bind(&data.notes)
    .bind(&kat)
    .bind(&leist)
    .bind(&data.treatment_number)
    .bind(data.session_number)
    .bind(&data.treatment_status)
    .bind(data.total_cost)
    .bind(appointment)
    .bind(&data.treatment_date)
    .execute(pool)
    .await?;

    let inserted = sqlx::query_as::<_, Treatment>("SELECT * FROM treatment WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "treatment",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn find_treatment_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Treatment>, AppError> {
    let row = sqlx::query_as::<_, Treatment>("SELECT * FROM treatment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn update_treatment(
    pool: &SqlitePool,
    data: &UpdateTreatment,
) -> Result<Treatment, AppError> {
    let existing = find_treatment_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Treatment".into()))?;
    let kat = data.category.clone().unwrap_or_else(|| data.kind.clone());
    let leist = data
        .service_name
        .clone()
        .or_else(|| data.description.clone());
    let appointment = data
        .appointment_required
        .map(|b| if b { 1i64 } else { 0i64 });
    sqlx::query(
        "UPDATE treatment SET kind = ?1, description = ?2, teeth = ?3, material = ?4, notes = ?5,
         category = ?6, service_name = ?7, treatment_number = ?8, session_number = ?9,
         treatment_status = ?10, total_cost = ?11, appointment_required = ?12, treatment_date = ?13
         WHERE id = ?14",
    )
    .bind(&data.kind)
    .bind(&data.description)
    .bind(&data.teeth)
    .bind(&data.material)
    .bind(&data.notes)
    .bind(&kat)
    .bind(&leist)
    .bind(&data.treatment_number)
    .bind(data.session_number)
    .bind(&data.treatment_status)
    .bind(data.total_cost)
    .bind(appointment)
    .bind(&data.treatment_date)
    .bind(&data.id)
    .execute(pool)
    .await?;
    let updated = find_treatment_by_id(pool, &existing.id)
        .await?
        .ok_or(AppError::Internal("Treatment update failed".into()))?;
    let body = serde_json::to_string(&updated)
        .unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", existing.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "treatment",
        &existing.id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete_treatment(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let n = sqlx::query("DELETE FROM treatment WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Treatment".into()));
    }
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "treatment",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

pub async fn find_examination_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Examination>, AppError> {
    sqlx::query_as::<_, Examination>("SELECT * FROM examination WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(Into::into)
}

pub async fn update_examination(
    pool: &SqlitePool,
    data: &UpdateExamination,
) -> Result<Examination, AppError> {
    let _ex = find_examination_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Examination".into()))?;
    sqlx::query(
        "UPDATE examination SET chief_complaint = ?1, results = ?2, diagnosis = ?3,
         category = ?4, service_name = ?5, total_cost = ?6 WHERE id = ?7",
    )
    .bind(&data.chief_complaint)
    .bind(&data.results)
    .bind(&data.diagnosis)
    .bind(&data.category)
    .bind(&data.service_name)
    .bind(data.total_cost)
    .bind(&data.id)
    .execute(pool)
    .await?;
    let updated = find_examination_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::Internal("Examination update failed".into()))?;
    let body =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", data.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "examination",
        &data.id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete_examination(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let n = sqlx::query("DELETE FROM examination WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Examination".into()));
    }
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "examination",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

pub async fn release_examination_for_billing(
    pool: &SqlitePool,
    examination_id: &str,
    physician_staff_id: &str,
) -> Result<Examination, AppError> {
    let n = sqlx::query(
        "UPDATE examination SET released_by_physician_id = ?1, released_at = datetime('now')
         WHERE id = ?2",
    )
    .bind(physician_staff_id)
    .bind(examination_id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Examination".into()));
    }
    find_examination_by_id(pool, examination_id)
        .await?
        .ok_or_else(|| AppError::Internal("Examination not readable after release".into()))
}

pub async fn release_treatment_for_billing(
    pool: &SqlitePool,
    treatment_id: &str,
    physician_staff_id: &str,
) -> Result<Treatment, AppError> {
    let n = sqlx::query(
        "UPDATE treatment SET released_by_physician_id = ?1, released_at = datetime('now')
         WHERE id = ?2",
    )
    .bind(physician_staff_id)
    .bind(treatment_id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Treatment".into()));
    }
    find_treatment_by_id(pool, treatment_id)
        .await?
        .ok_or_else(|| AppError::Internal("Treatment not readable after release".into()))
}

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
         ORDER BY datetime(pa.updated_at) ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// FA-AKTE-15: count for sidebar badge (same filter as [`list_charts_to_validate`]).
pub async fn count_charts_to_validate(pool: &SqlitePool) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM patient_chart pa
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
        "UPDATE patient_chart SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
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
        "UPDATE patient_chart SET status = 'VALIDATED', updated_at = CURRENT_TIMESTAMP
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
