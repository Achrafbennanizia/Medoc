//! Invoice / billing amount rules (authoritative; FE `invoice-service-item.ts` mirrors for UI hints).
use crate::error::AppError;
use rand::{rngs::OsRng, Rng};

const EUR_EPS: f64 = 1e-6;

/// Matches FE `roundMoney2`.
pub fn round_money_2(version: f64) -> f64 {
    (version * 100.0).round() / 100.0
}

/// Matches FE `moneyToInvoiceCents`.
pub fn money_to_invoice_cents(bruto: f64) -> i64 {
    let eur = round_money_2(bruto);
    let mut cents = (eur * 100.0).round() as i64;
    if cents == 0 && eur > EUR_EPS {
        cents = 1;
    }
    cents
}

/// FA-LEIST-06: billable treatment (service name and/or amount due > 0).
pub fn treatment_has_billable_service_item(
    service_name: Option<&str>,
    total_cost: Option<f64>,
) -> bool {
    if service_name.map(str::trim).is_some_and(|s| !s.is_empty()) {
        return true;
    }
    total_cost
        .filter(|g| g.is_finite())
        .is_some_and(|g| g > EUR_EPS)
}

/// FA-LEIST-05: both Freigabe fields must be non-empty.
pub fn is_released_for_billing(
    released_by_physician_id: Option<&str>,
    released_at: Option<&str>,
) -> bool {
    let vid = released_by_physician_id
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let vam = released_at.map(str::trim).filter(|s| !s.is_empty());
    vid.is_some() && vam.is_some()
}

pub fn require_released_for_billing(
    released_by_physician_id: Option<&str>,
    released_at: Option<&str>,
    entity_key: &str,
) -> Result<(), AppError> {
    if is_released_for_billing(released_by_physician_id, released_at) {
        Ok(())
    } else {
        Err(AppError::validation_code_params(
            "error.billing.not_released",
            &[("entity", entity_key)],
        ))
    }
}

/// Invoice line amount for a Treatment (port of `lineFromServiceItemChoice` treatment branch).
pub fn invoice_amount_cents_treatment(total_cost: Option<f64>, paid_sum_eur: f64) -> i64 {
    let paid = round_money_2(paid_sum_eur);
    let cost = total_cost.filter(|c| c.is_finite()).map(round_money_2);
    let bruto = match cost {
        Some(c) if c > 0.0 => c,
        _ if paid > 0.0 => paid,
        _ => 0.01,
    };
    money_to_invoice_cents(bruto).max(1)
}

/// Invoice line amount for an examination (FA-LEIST-07: `total_cost` like treatment).
pub fn invoice_amount_cents_examination(total_cost: Option<f64>, paid_sum_eur: f64) -> i64 {
    invoice_amount_cents_treatment(total_cost, paid_sum_eur)
}

/// ZANR / BSNR: exactly 9 digits (ignoring non-digits). Matches FE `isValidPracticeDigitId`.
pub fn is_valid_practice_digit_id(value: &str) -> bool {
    value.chars().filter(|c| c.is_ascii_digit()).count() == 9
}

/// Matches FE `practiceInvoicePflichtMissing`.
pub fn practice_invoice_pflicht_missing(
    clinician_name: Option<&str>,
    zanr: Option<&str>,
    bsnr: Option<&str>,
    bank_iban: Option<&str>,
) -> bool {
    clinician_name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_none()
        || zanr.map(str::trim).filter(|s| !s.is_empty()).is_none()
        || bsnr.map(str::trim).filter(|s| !s.is_empty()).is_none()
        || bank_iban.map(str::trim).filter(|s| !s.is_empty()).is_none()
}

/// Auto invoice number `RE-YYYYMMDD-XXXXXX` (legacy client fallback only — prefer `allocate_invoice_document_number`).
pub fn next_invoice_number(ymd: &str, reserved: &[&str]) -> String {
    let d: String = ymd.chars().filter(|c| c.is_ascii_digit()).collect();
    let mut rng = OsRng;
    if d.len() < 8 {
        for _ in 0..48 {
            let num = format!(
                "RE-{}-{:06}",
                chrono::Utc::now().timestamp(),
                rng.gen_range(0..1_000_000_u32)
            );
            if !reserved.contains(&num.as_str()) {
                return num;
            }
        }
        return format!("RE-{}-{}", chrono::Utc::now().timestamp(), rng.gen::<u32>());
    }
    let prefix = &d[..8.min(d.len())];
    for _ in 0..80 {
        let s = format!("{:06}", rng.gen_range(0..1_000_000_u32));
        let num = format!("RE-{prefix}-{s}");
        if !reserved.contains(&num.as_str()) {
            return num;
        }
    }
    format!("RE-{prefix}-{}", rng.gen::<u32>())
}
