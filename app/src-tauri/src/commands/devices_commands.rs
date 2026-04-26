// Device & DSGVO compliance commands.

use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::devices::{dicom, gdt, scanner};
use crate::infrastructure::{dsfa, payment, update, vvt};
use crate::log_system;

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn generate_vvt(session_state: State<'_, SessionState>) -> Result<Value, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    log_system!(info, event = "VVT_GENERATED");
    let v = vvt::generate();
    serde_json::to_value(v).map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn generate_dsfa(session_state: State<'_, SessionState>) -> Result<Value, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    log_system!(info, event = "DSFA_GENERATED");
    let d = dsfa::generate();
    serde_json::to_value(d).map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, path))]
pub fn parse_gdt_file(
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<gdt::GdtRecord, AppError> {
    rbac::require(&session_state, "patient.write")?;
    gdt::parse_file(&PathBuf::from(path))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, path))]
pub fn inspect_dicom_file(
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<dicom::DicomFileInfo, AppError> {
    rbac::require(&session_state, "patient.write")?;
    dicom::inspect(&PathBuf::from(path))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, folder, limit))]
pub fn scanner_list_recent(
    session_state: State<'_, SessionState>,
    folder: String,
    limit: Option<usize>,
) -> Result<Vec<scanner::ScannedDocument>, AppError> {
    rbac::require(&session_state, "patient.write")?;
    scanner::list_recent(&PathBuf::from(folder), limit.unwrap_or(20))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, src, archive_root, patient_id))]
pub fn scanner_attach(
    session_state: State<'_, SessionState>,
    src: String,
    archive_root: String,
    patient_id: String,
) -> Result<String, AppError> {
    rbac::require(&session_state, "patient.write")?;
    let p = scanner::attach_to_patient(
        &PathBuf::from(src),
        &PathBuf::from(archive_root),
        &patient_id,
    )?;
    Ok(p.display().to_string())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, request))]
pub fn process_payment(
    session_state: State<'_, SessionState>,
    request: payment::PaymentRequest,
) -> Result<payment::PaymentReceipt, AppError> {
    rbac::require(&session_state, "finanzen.write")?;
    payment::process(&request)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, payload))]
pub fn evaluate_update_payload(
    session_state: State<'_, SessionState>,
    payload: update::UpdateInfo,
) -> Result<update::UpdateStatus, AppError> {
    rbac::require_authenticated(&session_state)?;
    Ok(update::evaluate(payload))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn current_app_version(session_state: State<'_, SessionState>) -> Result<&'static str, AppError> {
    rbac::require_authenticated(&session_state)?;
    Ok(update::current_version())
}
