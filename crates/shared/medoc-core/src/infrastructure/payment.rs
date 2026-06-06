// Payment processor adapter (FA-FIN-PAY).
//
// Real card-payment integration requires a vendor SDK (SumUp, Worldline,
// VR Payment) and PCI-DSS scope review. We expose a typed contract so the
// frontend and accounting code can be wired in test mode today, then later
// swap in the real adapter without changes upstream.

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::log_system;

#[derive(Debug, Deserialize)]
pub struct PaymentRequest {
    pub invoice_id: String,
    pub amount_cents: i64,
    pub currency: String, // e.g. "EUR"
    pub method: PaymentMethod,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Cash,
    Card,
    SepaTransfer,
}

#[derive(Debug, Serialize)]
pub struct PaymentReceipt {
    pub provider: &'static str,
    pub provider_ref: String,
    pub status: PaymentStatus,
    pub timestamp_unix: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    Approved,
    Declined,
    Pending,
}

/// Process a payment. Cash settles instantly; card/SEPA currently return
/// `Pending` and log a "NOT_IMPLEMENTED" event so the UI can surface a
/// banner until real terminals are integrated.
pub fn process(req: &PaymentRequest) -> Result<PaymentReceipt, AppError> {
    if req.amount_cents <= 0 {
        return Err(AppError::Validation("Betrag muss positiv sein".into()));
    }
    if req.currency != "EUR" {
        return Err(AppError::Validation("Nur EUR unterstützt".into()));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let (provider, status) = match req.method {
        PaymentMethod::Cash => ("cash", PaymentStatus::Approved),
        PaymentMethod::Card => ("card-stub", PaymentStatus::Pending),
        PaymentMethod::SepaTransfer => ("sepa-stub", PaymentStatus::Pending),
    };

    if !matches!(status, PaymentStatus::Approved) {
        log_system!(warn, event = "PAYMENT_PROVIDER_STUB",
            invoice_id = %req.invoice_id, provider = provider);
    }

    Ok(PaymentReceipt {
        provider,
        provider_ref: format!("STUB-{}-{}", provider, now),
        status,
        timestamp_unix: now,
    })
}
