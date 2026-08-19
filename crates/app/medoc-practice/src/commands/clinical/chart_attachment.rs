//! Tauri commands: persisted chart attachments (photos, PDF, …).

use base64::Engine;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::path::Path;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::chart_attachment_repo::{self, ChartAttachmentRow};
use crate::infrastructure::database::audit_repo;

const ALLOWED_DOCUMENT_KINDS: &[&str] = &[
    "MRT",
    "CT",
    "XRAY",
    "LAB",
    "REFERRAL",
    "CONSENT",
    "OTHER",
];

fn normalize_document_kind(input: Option<&str>) -> String {
    let s = input.unwrap_or("OTHER").trim().to_ascii_uppercase();
    if ALLOWED_DOCUMENT_KINDS.contains(&s.as_str()) {
        s
    } else {
        "OTHER".into()
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateChartAttachmentInput {
    pub chart_id: String,
    pub display_name: String,
    pub mime_type: String,
    pub bytes_base64: String,
    #[serde(default, alias = "documentKind")]
    pub document_kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChartAttachmentFromPathInput {
    pub chart_id: String,
    pub src_path: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default, alias = "documentKind")]
    pub document_kind: Option<String>,
}

fn mime_from_path(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "pdf" => "application/pdf",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "heic" => "image/heic",
        "heif" => "image/heif",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "tif" | "tiff" => "image/tiff",
        "dcm" => "application/dicom",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn allowed_attachment_extension(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(
        ext.as_str(),
        "pdf" | "jpg" | "jpeg" | "png" | "webp" | "heic" | "heif" | "gif" | "bmp" | "tif" | "tiff" | "dcm"
    )
}

#[derive(Debug, serde::Serialize)]
pub struct ChartAttachmentDto {
    pub id: String,
    pub display_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub document_kind: String,
    pub created_at: String,
    /// Absolute path for frontend `convertFileSrc`.
    pub abs_path: String,
}

fn app_data_dir(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App data directory: {e}")))
}

fn row_to_dto(app_data_dir: &Path, row: ChartAttachmentRow) -> ChartAttachmentDto {
    let abs = chart_attachment_repo::absolute_path(app_data_dir, &row.rel_storage_path);
    ChartAttachmentDto {
        id: row.id,
        display_name: row.display_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        document_kind: normalize_document_kind(Some(row.document_kind.as_str())),
        created_at: row.created_at,
        abs_path: abs.to_string_lossy().to_string(),
    }
}

fn open_file_with_optional_app(path: &Path, app_opt: Option<&str>) -> Result<(), AppError> {
    let p = path
        .to_str()
        .ok_or_else(|| AppError::Internal("Invalid file path".into()))?;
    let custom = app_opt.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });

    if cfg!(target_os = "macos") {
        if let Some(app) = custom {
            let st = std::process::Command::new("open")
                .args(["-a", app, p])
                .status()
                .map_err(|e| AppError::Internal(format!("open: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "External application could not open the file.".into(),
                ));
            }
        } else {
            let st = std::process::Command::new("open")
                .arg(p)
                .status()
                .map_err(|e| AppError::Internal(format!("open: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "Could not open the file with the default application.".into(),
                ));
            }
        }
        return Ok(());
    }

    if cfg!(target_os = "windows") {
        if let Some(exe) = custom {
            let st = std::process::Command::new(exe)
                .arg(p)
                .status()
                .map_err(|e| AppError::Internal(format!("Failed to start program: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "External application could not open the file.".into(),
                ));
            }
        } else {
            let st = std::process::Command::new("cmd")
                .args(["/C", "start", "", p])
                .status()
                .map_err(|e| AppError::Internal(format!("start: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "Could not open the file.".into(),
                ));
            }
        }
        return Ok(());
    }

    if let Some(exe) = custom {
        let st = std::process::Command::new(exe)
            .arg(p)
            .status()
            .map_err(|e| AppError::Internal(format!("Failed to start program: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "External application could not open the file.".into(),
            ));
        }
    } else {
        let st = std::process::Command::new("xdg-open")
            .arg(p)
            .status()
            .map_err(|e| AppError::Internal(format!("xdg-open: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Could not open the file.".into(),
            ));
        }
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn list_chart_attachments(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    chart_id: String,
) -> Result<Vec<ChartAttachmentDto>, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let app_dir = app_data_dir(&app)?;
    let rows = chart_attachment_repo::list_for_chart(&pool, &chart_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "ChartAttachment",
        Some(&chart_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows.into_iter().map(|r| row_to_dto(&app_dir, r)).collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app, data))]
pub async fn create_chart_attachment(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateChartAttachmentInput,
) -> Result<ChartAttachmentDto, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.bytes_base64.trim())
        .map_err(|_| AppError::Validation("Invalid Base64 data.".into()))?;
    let kind = normalize_document_kind(data.document_kind.as_deref());
    let row = chart_attachment_repo::create(
        &pool,
        &app_dir,
        &data.chart_id,
        &data.display_name,
        &data.mime_type,
        &kind,
        &bytes,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "ChartAttachment",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row_to_dto(&app_dir, row))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app, data))]
pub async fn create_chart_attachment_from_path(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateChartAttachmentFromPathInput,
) -> Result<ChartAttachmentDto, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    let src = Path::new(data.src_path.trim());
    if !src.is_file() {
        return Err(AppError::NotFound("Scanner-Datei".into()));
    }
    if !allowed_attachment_extension(src) {
        return Err(AppError::validation_code("error.attachment.invalid_format"));
    }
    let bytes =
        std::fs::read(src).map_err(|e| AppError::Internal(format!("Reading scanner file: {e}")))?;
    let display_name = data
        .display_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or_else(|| {
            src.file_name()
                .and_then(|n| n.to_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "scan".to_string());
    let kind = normalize_document_kind(data.document_kind.as_deref());
    let mime = mime_from_path(src);
    let row = chart_attachment_repo::create(
        &pool,
        &app_dir,
        &data.chart_id,
        &display_name,
        &mime,
        &kind,
        &bytes,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "ChartAttachment",
        Some(&row.id),
        Some("scanner_import"),
    )
    .await
    .ok();
    Ok(row_to_dto(&app_dir, row))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn delete_chart_attachment(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    chart_attachment_repo::delete_row_and_file(&pool, &app_dir, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "ChartAttachment",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn rename_chart_attachment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    display_name: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    chart_attachment_repo::update_display_name(&pool, &id, &display_name).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "ChartAttachment",
        Some(&id),
        Some("rename"),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_chart_attachment_document_kind(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    document_kind: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let kind = normalize_document_kind(Some(document_kind.as_str()));
    chart_attachment_repo::update_document_kind(&pool, &id, &kind).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "ChartAttachment",
        Some(&id),
        Some("document_kind"),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn open_chart_attachment_externally(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    with_app: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let app_dir = app_data_dir(&app)?;
    let row = chart_attachment_repo::find_by_id(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("Chart-Attachment".into()))?;
    let path = chart_attachment_repo::absolute_path(&app_dir, &row.rel_storage_path);
    if !path.is_file() {
        return Err(AppError::NotFound("Attachments-Datei".into()));
    }
    open_file_with_optional_app(&path, with_app.as_deref())?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "OPEN_EXTERNAL",
        "ChartAttachment",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn duplicate_chart_attachment(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<ChartAttachmentDto, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    let src = chart_attachment_repo::find_by_id(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("Chart-Attachment".into()))?;
    let path = chart_attachment_repo::absolute_path(&app_dir, &src.rel_storage_path);
    let bytes =
        std::fs::read(&path).map_err(|e| AppError::Internal(format!("Reading attachment: {e}")))?;
    let new_name = format!("{} (Copy)", src.display_name);
    let row = chart_attachment_repo::create(
        &pool,
        &app_dir,
        &src.chart_id,
        &new_name,
        &src.mime_type,
        &normalize_document_kind(Some(src.document_kind.as_str())),
        &bytes,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "ChartAttachment",
        Some(&row.id),
        Some("duplicate"),
    )
    .await
    .ok();
    Ok(row_to_dto(&app_dir, row))
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_chart_attachment_commands {
    () => {
        $crate::commands::chart_attachment_commands::list_chart_attachments,
        $crate::commands::chart_attachment_commands::create_chart_attachment,
        $crate::commands::chart_attachment_commands::create_chart_attachment_from_path,
        $crate::commands::chart_attachment_commands::delete_chart_attachment,
        $crate::commands::chart_attachment_commands::rename_chart_attachment,
        $crate::commands::chart_attachment_commands::set_chart_attachment_document_kind,
        $crate::commands::chart_attachment_commands::open_chart_attachment_externally,
        $crate::commands::chart_attachment_commands::duplicate_chart_attachment,
    };
}
