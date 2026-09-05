// Invoice PDF export command (FA-FIN-INVOICE).

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::pdf_export::{render, Invoice, InvoiceLine};
use crate::log_system;

#[derive(Debug, Deserialize)]
pub struct InvoiceLineDto {
    pub description: String,
    pub amount_cents: i64,
    pub goz_nr: Option<String>,
    pub factor: Option<f64>,
    pub unit_price_cents: Option<i64>,
    pub quantity: Option<i32>,
    pub tooth_nr: Option<String>,
    pub treatment_date: Option<String>,
    pub vat_percent: Option<f64>,
    pub material: Option<String>,
    pub diagnosis_reason: Option<String>,
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
    pub clinician_name: Option<String>,
    pub clinician_zanr: Option<String>,
    pub practice_bsnr: Option<String>,
    pub bank_details: Option<Vec<String>>,
    pub payment_terms_text: Option<String>,
    pub vat_notice: Option<String>,
    #[serde(default)]
    pub locale: Option<String>,
    #[serde(default)]
    pub rtl: Option<bool>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, invoice))]
pub async fn render_invoice_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    invoice: InvoiceDto,
) -> Result<Vec<u8>, AppError> {
    rbac::require(&session_state, "finance.write")?;
    let logo = match crate::infrastructure::database::app_kv_repo::get(&pool, "practice.logo.v1").await
    {
        Ok(Some(raw)) => match crate::infrastructure::pdf::PdfLogo::from_kv_json(&raw) {
            Some(logo) => Some(logo),
            None => {
                tracing::warn!(
                    event = "PRACTICE_LOGO_DECODE_SKIPPED",
                    bytes = raw.len(),
                    "practice.logo.v1 present but not usable for PDF"
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
    let locale = invoice.locale.unwrap_or_else(|| "en".into());
    let rtl = locale == "ar" || invoice.rtl.unwrap_or(false);
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
                factor: l.factor,
                unit_price_cents: l.unit_price_cents,
                quantity: l.quantity,
                tooth_nr: l.tooth_nr,
                treatment_date: l.treatment_date,
                vat_percent: l.vat_percent,
                material: l.material,
                diagnosis_reason: l.diagnosis_reason,
            })
            .collect(),
        note: invoice.note,
        clinician_name: invoice.clinician_name,
        clinician_zanr: invoice.clinician_zanr,
        practice_bsnr: invoice.practice_bsnr,
        bank_details: invoice.bank_details,
        payment_terms_text: invoice.payment_terms_text,
        vat_notice: invoice.vat_notice,
        logo,
        locale,
        rtl,
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
