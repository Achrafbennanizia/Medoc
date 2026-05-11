// Device & DSGVO compliance commands.

use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::devices::{dicom, gdt, host_integration, scanner};
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
    let session = rbac::require_authenticated(&session_state)?;
    let role = rbac::Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;
    if !rbac::allowed("patient.write", role) && !rbac::allowed("verwaltung.vertraege.write", role) {
        return Err(AppError::Forbidden);
    }
    scanner::list_recent(&PathBuf::from(folder), limit.unwrap_or(20))
}

/// Open the OS-native scanning application (Image Capture, Windows Scan, simple-scan, …).
/// Output should be saved to the watch folder used with [`scanner_list_recent`].
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn open_system_scan_utility(session_state: State<'_, SessionState>) -> Result<(), AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = rbac::Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;
    if !rbac::allowed("patient.write", role)
        && !rbac::allowed("verwaltung.vertraege.write", role)
        && !rbac::allowed("ops.migration", role)
    {
        return Err(AppError::Forbidden);
    }
    host_integration::open_system_scan_utility()
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, app))]
pub fn open_native_print_dialog(
    app: AppHandle,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    rbac::require_authenticated(&session_state)?;
    let win = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
        .ok_or_else(|| AppError::Internal("Kein Fenster für Druckdialog.".into()))?;
    win.print()
        .map_err(|e| AppError::Internal(format!("Druckdialog: {e}")))?;
    log_system!(info, event = "NATIVE_PRINT_DIALOG_OPENED");
    Ok(())
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
#[tracing::instrument(level = "info", skip(session_state, src, vertrag_id))]
pub fn scanner_attach_vertrag_app_data(
    session_state: State<'_, SessionState>,
    src: String,
    vertrag_id: String,
) -> Result<String, AppError> {
    rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let root = dirs::home_dir()
        .map(|h| h.join("medoc-data"))
        .unwrap_or_else(|| PathBuf::from("./medoc-data"));
    std::fs::create_dir_all(&root).map_err(|e| AppError::Internal(format!("medoc-data: {e}")))?;
    let p = scanner::attach_to_vertrag(&PathBuf::from(src), &root, &vertrag_id)?;
    Ok(p.display().to_string())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, src, archive_root, vertrag_id))]
pub fn scanner_attach_vertrag(
    session_state: State<'_, SessionState>,
    src: String,
    archive_root: String,
    vertrag_id: String,
) -> Result<String, AppError> {
    rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let p = scanner::attach_to_vertrag(
        &PathBuf::from(src),
        &PathBuf::from(archive_root),
        &vertrag_id,
    )?;
    Ok(p.display().to_string())
}

/// Native PDF file picker for Vertragsdokument — copy via [`scanner_attach_vertrag_app_data`] or [`scanner_attach_vertrag`].
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn pick_vertrag_pdf_file(session_state: State<'_, SessionState>) -> Result<Option<String>, AppError> {
    rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let path = rfd::FileDialog::new().add_filter("PDF", &["pdf"]).pick_file();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
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
