//! Practice contracts (`vertrag` table — replaces browser `localStorage`).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::Path;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, vertrag_repo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VertragDto {
    pub id: String,
    pub bezeichnung: String,
    pub partner: String,
    pub betrag: f64,
    pub intervall: String,
    pub unbefristet: bool,
    pub periode_von: Option<String>,
    pub periode_bis: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub dokument_pfad: Option<String>,
}

fn row_to_dto(r: vertrag_repo::VertragRow) -> VertragDto {
    VertragDto {
        id: r.id,
        bezeichnung: r.bezeichnung,
        partner: r.partner,
        betrag: r.betrag,
        intervall: r.intervall,
        unbefristet: r.unbefristet != 0,
        periode_von: r.periode_von,
        periode_bis: r.periode_bis,
        created_at: r.created_at,
        dokument_pfad: r.dokument_pfad,
    }
}

fn dto_to_row(d: &VertragDto) -> Result<vertrag_repo::VertragRow, AppError> {
    let iv = d.intervall.to_uppercase();
    if iv != "TAG" && iv != "WOCHE" && iv != "MONAT" && iv != "JAHR" {
        return Err(AppError::Validation("intervall ungültig".into()));
    }
    Ok(vertrag_repo::VertragRow {
        id: d.id.clone(),
        bezeichnung: d.bezeichnung.clone(),
        partner: d.partner.clone(),
        betrag: d.betrag,
        intervall: iv,
        unbefristet: if d.unbefristet { 1 } else { 0 },
        periode_von: d.periode_von.clone(),
        periode_bis: d.periode_bis.clone(),
        created_at: d.created_at.clone(),
        dokument_pfad: d.dokument_pfad.clone(),
    })
}

/// Open a contract PDF/scan with the OS default handler (no arbitrary path from FE).
fn open_path_with_os_default(path: &Path) -> Result<(), AppError> {
    let p = path
        .to_str()
        .ok_or_else(|| AppError::Internal("Ungültiger Dateipfad".into()))?;
    if cfg!(target_os = "macos") {
        let st = std::process::Command::new("open")
            .arg(p)
            .status()
            .map_err(|e| AppError::Internal(format!("open: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Datei konnte nicht mit der Standard-App geöffnet werden.".into(),
            ));
        }
        return Ok(());
    }
    if cfg!(target_os = "windows") {
        let st = std::process::Command::new("cmd")
            .args(["/C", "start", "", p])
            .status()
            .map_err(|e| AppError::Internal(format!("start: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Datei konnte nicht geöffnet werden.".into(),
            ));
        }
        return Ok(());
    }
    let st = std::process::Command::new("xdg-open")
        .arg(p)
        .status()
        .map_err(|e| AppError::Internal(format!("xdg-open: {e}")))?;
    if !st.success() {
        return Err(AppError::Internal(
            "Datei konnte nicht geöffnet werden.".into(),
        ));
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_vertraege(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<VertragDto>, AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.read")?;
    let rows = vertrag_repo::list_all(&pool).await?;
    audit_repo::create(&pool, &session.user_id, "READ", "Vertrag", None, None).await?;
    Ok(rows.into_iter().map(row_to_dto).collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn upsert_vertrag(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: VertragDto,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let row = dto_to_row(&data)?;
    vertrag_repo::upsert(&pool, &row).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Vertrag",
        Some(&data.id),
        Some(&data.bezeichnung),
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_vertrag(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let n = vertrag_repo::delete_by_id(&pool, &id).await?;
    if n == 0 {
        return Err(AppError::NotFound("Vertrag".into()));
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Vertrag",
        Some(&id),
        None,
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn open_vertrag_dokument(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    vertrag_id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.read")?;
    let row = vertrag_repo::find_by_id(&pool, &vertrag_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Vertrag".into()))?;
    let rel = row
        .dokument_pfad
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::NotFound("Kein Vertragsdokument".into()))?;
    let path = Path::new(&rel);
    if !path.is_file() {
        return Err(AppError::NotFound("Vertragsdatei nicht gefunden".into()));
    }
    open_path_with_os_default(path)?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "OPEN_EXTERNAL",
        "VertragDokument",
        Some(&vertrag_id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_vertrag_commands {
    () => {
        $crate::commands::vertrag_commands::list_vertraege,
        $crate::commands::vertrag_commands::upsert_vertrag,
        $crate::commands::vertrag_commands::delete_vertrag,
        $crate::commands::vertrag_commands::open_vertrag_dokument,
    };
}
