// Invoice PDF export command (FA-FIN-INVOICE).

use serde::Deserialize;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf::{render, Invoice, InvoiceLine};
use crate::log_system;

#[derive(Debug, Deserialize)]
pub struct InvoiceLineDto {
    pub description: String,
    pub amount_cents: i64,
}

#[derive(Debug, Deserialize)]
pub struct InvoiceDto {
    pub number: String,
    pub date: String,
    pub recipient_name: String,
    pub recipient_address: Vec<String>,
    pub practice_name: String,
    pub practice_address: Vec<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub note: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, invoice))]
pub fn render_invoice_pdf(
    session_state: State<'_, SessionState>,
    invoice: InvoiceDto,
) -> Result<Vec<u8>, AppError> {
    rbac::require(&session_state, "finanzen.write")?;
    let model = Invoice {
        number: invoice.number,
        date: invoice.date,
        recipient_name: invoice.recipient_name,
        recipient_address: invoice.recipient_address,
        practice_name: invoice.practice_name,
        practice_address: invoice.practice_address,
        lines: invoice
            .lines
            .into_iter()
            .map(|l| InvoiceLine {
                description: l.description,
                amount_cents: l.amount_cents,
            })
            .collect(),
        note: invoice.note,
    };
    log_system!(info, event = "INVOICE_PDF", number = %model.number, total_cents = model.total_cents());
    render(&model)
}
