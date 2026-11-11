//! Report PDF preview (statistics, balance, finance, audit, compliance).
//!
//! The permission depends on `input.reportKind` (audit reports need
//! `audit.read`, compliance reports `ops.system`, …). This command returns a
//! watermarked preview; numbered reports go through `issue_report_pdf`.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf_export::ReportPdfInput;
use medoc_core::application::documents::issue as svc;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, input))]
pub async fn render_report_pdf_command(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    input: ReportPdfInput,
) -> Result<Vec<u8>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let out = svc::issue_report(&pool, &session, input, None, true).await?;
    STANDARD
        .decode(out.pdf_base64)
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_report_pdf_commands {
    () => {
        $crate::commands::report_pdf_commands::render_report_pdf_command,
    };
}
