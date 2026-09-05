//! PDF preview for typed document templates (no raw HTML from the frontend).

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use crate::infrastructure::pdf::{render_clinical_layout_with_logo, PdfLogo};
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

/// Production PDF content (same renderer as template preview); lines from structured data — no raw HTML.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn preview_document_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: PreviewDocumentPdfArgs,
) -> Result<String, AppError> {
    rbac::require_authenticated(&session_state)?;
    let version: serde_json::Value = serde_json::from_str(&args.template_payload_json)
        .map_err(|e| AppError::Validation(format!("Template JSON: {e}")))?;
    let body_pt = version
        .get("bodyPt")
        .and_then(|x| x.as_u64())
        .map(|n| n.clamp(8, 18) as i32)
        .unwrap_or(11);
    let footer = version
        .get("footer")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .chars()
        .take(240)
        .collect::<String>();

    let logo = match app_kv_repo::get(&pool, "practice.logo.v1").await {
        Ok(Some(raw)) => match PdfLogo::from_kv_json(&raw) {
            Some(logo) => Some(logo),
            None => {
                tracing::warn!(
                    event = "PRACTICE_LOGO_DECODE_SKIPPED",
                    bytes = raw.len(),
                    "practice.logo.v1 present but not usable for PDF (placeholder or unsupported image)"
                );
                None
            }
        },
        Ok(None) => None,
        Err(e) => {
            tracing::warn!(event = "PRACTICE_LOGO_KV_READ_FAILED", error = %e);
            None
        }
    };

    let bytes = if let Some(json) = args.layout_json.as_deref().filter(|s| !s.trim().is_empty()) {
        let layout: crate::infrastructure::pdf::ClinicalPdfLayout = serde_json::from_str(json)
            .map_err(|e| AppError::Validation(format!("PDF-Layout: {e}")))?;
        render_clinical_layout_with_logo(&layout, logo.as_ref())?
    } else {
        render_template_preview_pdf(
            &args.kind,
            &args.template_name,
            &footer,
            body_pt,
            &args.body_lines,
            None,
        )?
    };
    Ok(STANDARD.encode(&bytes))
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_document_pdf_commands {
    () => {
        $crate::commands::document_pdf_commands::preview_document_pdf,
    };
}
