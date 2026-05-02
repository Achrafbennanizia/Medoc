//! Tauri-Kommandos: persistierte Akte-Anlagen (Fotos, PDF, …).

use base64::Engine;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::path::Path;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::akte_anlage_repo::{self, AkteAnlageRow};
use crate::infrastructure::database::audit_repo;

const ALLOWED_DOCUMENT_KINDS: &[&str] = &[
    "MRT",
    "CT",
    "ROENTGEN",
    "LABOR",
    "UEBERWEISUNG",
    "EINVERSTAENDNIS",
    "SONSTIGES",
];

fn normalize_document_kind(input: Option<&str>) -> String {
    let s = input.unwrap_or("SONSTIGES").trim().to_ascii_uppercase();
    if ALLOWED_DOCUMENT_KINDS.contains(&s.as_str()) {
        s
    } else {
        "SONSTIGES".into()
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateAkteAnlageInput {
    pub akte_id: String,
    pub display_name: String,
    pub mime_type: String,
    pub bytes_base64: String,
    #[serde(default, alias = "documentKind")]
    pub document_kind: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct AkteAnlageDto {
    pub id: String,
    pub display_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub document_kind: String,
    pub created_at: String,
    /// Absoluter Pfad für `convertFileSrc` im Frontend
    pub abs_path: String,
}

fn app_data_dir(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))
}

fn row_to_dto(app_data_dir: &Path, row: AkteAnlageRow) -> AkteAnlageDto {
    let abs = akte_anlage_repo::absolute_path(app_data_dir, &row.rel_storage_path);
    AkteAnlageDto {
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
        .ok_or_else(|| AppError::Internal("Ungültiger Dateipfad".into()))?;
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
                    "Externes Programm konnte die Datei nicht öffnen.".into(),
                ));
            }
        } else {
            let st = std::process::Command::new("open")
                .arg(p)
                .status()
                .map_err(|e| AppError::Internal(format!("open: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "Datei konnte nicht mit der Standard-App geöffnet werden.".into(),
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
                .map_err(|e| AppError::Internal(format!("Programmstart: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "Externes Programm konnte die Datei nicht öffnen.".into(),
                ));
            }
        } else {
            let st = std::process::Command::new("cmd")
                .args(["/C", "start", "", p])
                .status()
                .map_err(|e| AppError::Internal(format!("start: {e}")))?;
            if !st.success() {
                return Err(AppError::Internal(
                    "Datei konnte nicht geöffnet werden.".into(),
                ));
            }
        }
        return Ok(());
    }

    if let Some(exe) = custom {
        let st = std::process::Command::new(exe)
            .arg(p)
            .status()
            .map_err(|e| AppError::Internal(format!("Programmstart: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Externes Programm konnte die Datei nicht öffnen.".into(),
            ));
        }
    } else {
        let st = std::process::Command::new("xdg-open")
            .arg(p)
            .status()
            .map_err(|e| AppError::Internal(format!("xdg-open: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Datei konnte nicht geöffnet werden.".into(),
            ));
        }
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn list_akte_anlagen(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<AkteAnlageDto>, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let app_dir = app_data_dir(&app)?;
    let rows = akte_anlage_repo::list_for_akte(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "AkteAnlage",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows.into_iter().map(|r| row_to_dto(&app_dir, r)).collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app, data))]
pub async fn create_akte_anlage(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateAkteAnlageInput,
) -> Result<AkteAnlageDto, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.bytes_base64.trim())
        .map_err(|_| AppError::Validation("Ungültige Base64-Daten.".into()))?;
    let kind = normalize_document_kind(data.document_kind.as_deref());
    let row = akte_anlage_repo::create(
        &pool,
        &app_dir,
        &data.akte_id,
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
        "AkteAnlage",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row_to_dto(&app_dir, row))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn delete_akte_anlage(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    akte_anlage_repo::delete_row_and_file(&pool, &app_dir, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "AkteAnlage",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn rename_akte_anlage(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    display_name: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    akte_anlage_repo::update_display_name(&pool, &id, &display_name).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "AkteAnlage",
        Some(&id),
        Some("rename"),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_akte_anlage_document_kind(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    document_kind: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let kind = normalize_document_kind(Some(document_kind.as_str()));
    akte_anlage_repo::update_document_kind(&pool, &id, &kind).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "AkteAnlage",
        Some(&id),
        Some("document_kind"),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn open_akte_anlage_externally(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    with_app: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let app_dir = app_data_dir(&app)?;
    let row = akte_anlage_repo::find_by_id(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("Akte-Anlage".into()))?;
    let path = akte_anlage_repo::absolute_path(&app_dir, &row.rel_storage_path);
    if !path.is_file() {
        return Err(AppError::NotFound("Anlagen-Datei".into()));
    }
    open_file_with_optional_app(&path, with_app.as_deref())?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "OPEN_EXTERNAL",
        "AkteAnlage",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn duplicate_akte_anlage(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<AkteAnlageDto, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let app_dir = app_data_dir(&app)?;
    let src = akte_anlage_repo::find_by_id(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("Akte-Anlage".into()))?;
    let path = akte_anlage_repo::absolute_path(&app_dir, &src.rel_storage_path);
    let bytes =
        std::fs::read(&path).map_err(|e| AppError::Internal(format!("Anlage lesen: {e}")))?;
    let new_name = format!("{} (Kopie)", src.display_name);
    let row = akte_anlage_repo::create(
        &pool,
        &app_dir,
        &src.akte_id,
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
        "AkteAnlage",
        Some(&row.id),
        Some("duplicate"),
    )
    .await
    .ok();
    Ok(row_to_dto(&app_dir, row))
}
