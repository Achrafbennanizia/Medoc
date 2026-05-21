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
    pub goz_nr: Option<String>,
    pub faktor: Option<f64>,
    pub einzelpreis_cents: Option<i64>,
    pub menge: Option<i32>,
    pub zahn_nr: Option<String>,
    pub behandlungsdatum: Option<String>,
    pub ust_prozent: Option<f64>,
    pub material: Option<String>,
    pub diagnose_begruendung: Option<String>,
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
    pub behandler_name: Option<String>,
    pub behandler_zanr: Option<String>,
    pub praxis_bsnr: Option<String>,
    pub bankverbindung: Option<Vec<String>>,
    pub zahlungsziel_text: Option<String>,
    pub ust_hinweis: Option<String>,
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
                goz_nr: l.goz_nr,
                faktor: l.faktor,
                einzelpreis_cents: l.einzelpreis_cents,
                menge: l.menge,
                zahn_nr: l.zahn_nr,
                behandlungsdatum: l.behandlungsdatum,
                ust_prozent: l.ust_prozent,
                material: l.material,
                diagnose_begruendung: l.diagnose_begruendung,
            })
            .collect(),
        note: invoice.note,
        behandler_name: invoice.behandler_name,
        behandler_zanr: invoice.behandler_zanr,
        praxis_bsnr: invoice.praxis_bsnr,
        bankverbindung: invoice.bankverbindung,
        zahlungsziel_text: invoice.zahlungsziel_text,
        ust_hinweis: invoice.ust_hinweis,
    };
    log_system!(info, event = "INVOICE_PDF", number = %model.number, total_cents = model.total_cents());
    render(&model)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_invoice_commands {
    () => {
        $crate::commands::invoice_commands::render_invoice_pdf,
    };
}
