//! PDF export for practice reports (statistics, balance, revenue).

use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf_export::{render_report_pdf, ReportPdfInput};

/// Structured practice report → PDF bytes (same renderer as chart / leaflet export).
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, input))]
pub fn render_report_pdf_command(
    session_state: State<'_, SessionState>,
    input: ReportPdfInput,
) -> Result<Vec<u8>, AppError> {
    rbac::require(&session_state, "finance.read")?;
    render_report_pdf(&input)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_report_pdf_commands {
    () => {
        $crate::commands::report_pdf_commands::render_report_pdf_command,
    };
}
