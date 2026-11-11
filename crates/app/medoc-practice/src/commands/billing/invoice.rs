// Invoice PDF (FA-FIN-INVOICE).
//
// `render_invoice_pdf` is now a **preview only** (watermark "ENTWURF", no
// number, not stored). Issuing goes through `issue_invoice` in
// `commands::documents`, which allocates the RE number, validates GOZ /
// UStG rules, stores the document and writes the audit entry.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf::Invoice;
use medoc_core::application::documents::issue::{self as svc, IssueInvoiceArgs};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, invoice))]
pub async fn render_invoice_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
    invoice: Invoice,
) -> Result<Vec<u8>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let out = svc::issue_invoice(
        &pool,
        &session,
        IssueInvoiceArgs {
            patient_id,
            invoice,
            preview: true,
        },
    )
    .await?;
    STANDARD
        .decode(out.pdf_base64)
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_invoice_commands {
    () => {
        $crate::commands::invoice_commands::render_invoice_pdf,
    };
}
