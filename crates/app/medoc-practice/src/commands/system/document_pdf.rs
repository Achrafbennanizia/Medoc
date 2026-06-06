//! PDF preview for typed document templates (no raw HTML from the frontend).

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf_export::render_template_preview_pdf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewDocumentPdfArgs {
    pub kind: String,
    pub template_name: String,
    pub template_payload_json: String,
    pub body_lines: Vec<String>,
    /// Structured layout JSON (`ClinicalPdfLayout`); when set, overrides plain `body_lines` rendering.
    pub layout_json: Option<String>,
}

/// Produktiver PDF-Inhalt (gleicher Renderer wie Vorlagen-Vorschau), Zeilen aus strukturierten Daten — kein Roh-HTML.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, args))]
pub fn preview_document_pdf(
    session_state: State<'_, SessionState>,
    args: PreviewDocumentPdfArgs,
) -> Result<String, AppError> {
    rbac::require_authenticated(&session_state)?;
    let v: serde_json::Value = serde_json::from_str(&args.template_payload_json)
        .map_err(|e| AppError::Validation(format!("Vorlage JSON: {e}")))?;
    let body_pt = v
        .get("bodyPt")
        .and_then(|x| x.as_u64())
        .map(|n| n.clamp(8, 18) as i32)
        .unwrap_or(11);
    let fuss = v
        .get("fusszeile")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .chars()
        .take(240)
        .collect::<String>();
    let bytes = render_template_preview_pdf(
        &args.kind,
        &args.template_name,
        &fuss,
        body_pt,
        &args.body_lines,
        args.layout_json.as_deref(),
    )?;
    Ok(STANDARD.encode(&bytes))
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_document_pdf_commands {
    () => {
        $crate::commands::document_pdf_commands::preview_document_pdf,
    };
}
