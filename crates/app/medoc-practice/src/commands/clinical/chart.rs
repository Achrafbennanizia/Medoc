use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::anamnesis_form::SaveAnamnesisForm;
use crate::domain::entities::treatment::{
    Treatment, CreateTreatment, CreateExamination, Examination, UpdateTreatment,
    UpdateExamination,
};
use crate::domain::entities::dental_finding::CreateDentalFinding;
use crate::domain::entities::{AnamnesisForm, PatientChart, DentalFinding};
use crate::error::AppError;
use crate::infrastructure::database::{chart_repo, audit_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_chart(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<PatientChart, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let mut a = chart_repo::find_chart_by_patient(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if !rbac::allowed("patient.read_medical", role) {
        // Reception sees administrative shell only — no diagnoses / clinical text.
        a.diagnosis = None;
        a.findings = None;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "PatientChart",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_dental_finding(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateDentalFinding,
) -> Result<DentalFinding, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let z = chart_repo::upsert_dental_finding(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPSERT",
        "DentalFinding",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_dental_findings(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    chart_id: String,
) -> Result<Vec<DentalFinding>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let rows = chart_repo::find_dental_findings(&pool, &chart_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "DentalFinding",
        Some(&chart_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_treatments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    chart_id: String,
) -> Result<Vec<Treatment>, AppError> {
    let session = rbac::require(&session_state, "patient.treatments_list_for_payment")?;
    let rows = chart_repo::list_treatments(&pool, &chart_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Treatment",
        Some(&chart_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(
        crate::application::chart::reception_redact::apply_reception_redact_treatments(
            &session.role,
            rows,
        ),
    )
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_examinations(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    chart_id: String,
) -> Result<Vec<Examination>, AppError> {
    let session = rbac::require(&session_state, "patient.treatments_list_for_payment")?;
    let rows = chart_repo::list_examinations(&pool, &chart_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Examination",
        Some(&chart_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(
        crate::application::chart::reception_redact::apply_reception_redact_examinations(
            &session.role,
            rows,
        ),
    )
}

/// FA-LEIST-05: Release treatment for billing (physician chart only).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn release_treatment_for_billing(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    treatment_id: String,
) -> Result<Treatment, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::billing_release::release_treatment_for_billing(
        &pool,
        &session.user_id,
        &treatment_id,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn release_examination_for_billing(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    examination_id: String,
) -> Result<Examination, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::billing_release::release_examination_for_billing(
        &pool,
        &session.user_id,
        &examination_id,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn save_anamnesis_form(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: SaveAnamnesisForm,
) -> Result<AnamnesisForm, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let a = chart_repo::save_anamnesis_form(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPSERT",
        "AnamnesisForm",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_anamnesis_form(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Option<AnamnesisForm>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let bogen = chart_repo::find_anamnesis_form(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "AnamnesisForm",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(bogen)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_examination(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateExamination,
) -> Result<Examination, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::clinical_line_persistence::create_examination(
        &pool,
        &session.user_id,
        &session.role,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_treatment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateTreatment,
) -> Result<Treatment, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::clinical_line_persistence::create_treatment(
        &pool,
        &session.user_id,
        &session.role,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_treatment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateTreatment,
) -> Result<Treatment, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::clinical_line_persistence::update_treatment(
        &pool,
        &session.user_id,
        &session.role,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_treatment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::clinical_line_persistence::delete_treatment(
        &pool,
        &session.user_id,
        &id,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_examination(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateExamination,
) -> Result<Examination, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::clinical_line_persistence::update_examination(
        &pool,
        &session.user_id,
        &session.role,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_examination(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::chart::clinical_line_persistence::delete_examination(
        &pool,
        &session.user_id,
        &id,
    )
    .await
}

/// FA-AKTE-04 / extension: patient chart as PDF (selectable sections).
/// Returns base64-encoded PDF bytes for safe transport across the Tauri bridge.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn export_chart_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: crate::application::chart::pdf_export::ExportChartPdfArgs,
) -> Result<String, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    crate::application::chart::pdf_export::export_chart_pdf(&pool, &session, args).await
}

/// FA-DOK-08: Discharge information sheet / aftercare as PDF (compact summary).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn export_discharge_leaflet_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: crate::application::chart::pdf_export::ExportDischargeLeafletPdfArgs,
) -> Result<String, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    crate::application::chart::pdf_export::export_discharge_leaflet_pdf(&pool, &session, args)
        .await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_chart_commands {
    () => {
        $crate::commands::chart_commands::get_chart,
        $crate::commands::chart_commands::update_dental_finding,
        $crate::commands::chart_commands::list_dental_findings,
        $crate::commands::chart_commands::list_treatments,
        $crate::commands::chart_commands::list_examinations,
        $crate::commands::chart_commands::save_anamnesis_form,
        $crate::commands::chart_commands::get_anamnesis_form,
        $crate::commands::chart_commands::create_examination,
        $crate::commands::chart_commands::create_treatment,
        $crate::commands::chart_commands::update_treatment,
        $crate::commands::chart_commands::delete_treatment,
        $crate::commands::chart_commands::release_treatment_for_billing,
        $crate::commands::chart_commands::release_examination_for_billing,
        $crate::commands::chart_commands::update_examination,
        $crate::commands::chart_commands::delete_examination,
        $crate::commands::chart_commands::export_chart_pdf,
        $crate::commands::chart_commands::export_discharge_leaflet_pdf,
    };
}
