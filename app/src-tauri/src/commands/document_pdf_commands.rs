//! PDF preview for typed document templates (no raw HTML from the frontend).

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf::render_template_preview_pdf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTemplatePdfArgs {
    pub kind: String,
    pub template_name: String,
    /// JSON string of {@link DocumentTemplatePayloadV1} from the frontend.
    pub template_payload_json: String,
}

/// Returns Base64-encoded PDF bytes for in-app preview.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, args))]
pub fn preview_template_pdf(
    session_state: State<'_, SessionState>,
    args: PreviewTemplatePdfArgs,
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
    let lines = vec![
        format!("Dokumentart: {}", args.kind),
        format!("Vorlage: {}", args.template_name),
        String::new(),
        "Layout-Vorschau — Produktivinhalt folgt bei echtem Export.".into(),
    ];
    let bytes = render_template_preview_pdf(
        &args.kind,
        &args.template_name,
        &fuss,
        body_pt,
        &lines,
    )?;
    Ok(STANDARD.encode(&bytes))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewDocumentPdfArgs {
    pub kind: String,
    pub template_name: String,
    pub template_payload_json: String,
    pub body_lines: Vec<String>,
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
    )?;
    Ok(STANDARD.encode(&bytes))
}
