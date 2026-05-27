//! PDF export for practice reports (Statistik, Bilanz, Einnahmen).

use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf::{render_report_pdf, ReportPdfInput};

/// Structured practice report → PDF bytes (same renderer as Akte / Merkblatt).
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, input))]
pub fn render_report_pdf_command(
    session_state: State<'_, SessionState>,
    input: ReportPdfInput,
) -> Result<Vec<u8>, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    render_report_pdf(&input)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_report_pdf_commands {
    () => {
        $crate::commands::report_pdf_commands::render_report_pdf_command,
    };
}
