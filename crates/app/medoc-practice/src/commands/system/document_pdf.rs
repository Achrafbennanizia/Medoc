//! Template-editor preview for document templates.
//!
//! This path renders whatever the editor sends, so it is **never** an
//! official document: it always carries the "ENTWURF" watermark and has no
//! number. Real certificates / prescriptions / receipts are issued with
//! `issue_clinical_document` (server-side numbering, registry, RBAC).

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf::export::render_template_preview_pdf;
use crate::infrastructure::pdf::{render_clinical_layout_with_logo, ClinicalPdfLayout};
use medoc_core::application::documents::issue::WATERMARK_PREVIEW;
use medoc_core::application::documents::practice_profile::{
    document_locale, logo_hidden_on_documents, practice_logo, PracticeProfile,
};

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

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn preview_document_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: PreviewDocumentPdfArgs,
) -> Result<String, AppError> {
    rbac::require(&session_state, "templates.read")?;
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

    let bytes = if let Some(json) = args.layout_json.as_deref().filter(|s| !s.trim().is_empty()) {
        let mut layout: ClinicalPdfLayout = serde_json::from_str(json)
            .map_err(|e| AppError::Validation(format!("PDF-Layout: {e}")))?;
        // Practice identity from the database, as on the issued document.
        let profile = PracticeProfile::load(&pool).await?;
        let locale = document_locale(&pool).await;
        layout.practice_lines = profile.letterhead_lines();
        layout.footer_lines = profile.footer_lines(locale);
        layout.locale = Some(locale.into());
        layout.document_number = None;
        layout.watermark = Some(WATERMARK_PREVIEW.into());
        if logo_hidden_on_documents(&pool).await {
            layout.logo_kv_json = None;
        }
        let logo = practice_logo(&pool).await;
        render_clinical_layout_with_logo(&layout, logo.as_ref())?
    } else {
        // Already watermarked inside `render_plain_preview`.
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
