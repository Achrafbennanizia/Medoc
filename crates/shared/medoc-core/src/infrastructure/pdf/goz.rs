//! GOZ / GOÄ fee calculation and invoice validation (GOZ §§ 2, 5, 6, 9, 10;
//! UStG § 14 (4)).
//!
//! Every issued invoice goes through [`validate_invoice`] **on the server**.
//! Amounts sent by the frontend are recomputed from points × Punktwert ×
//! factor and rejected when they disagree, so a manipulated DTO cannot
//! produce an "official" invoice with wrong fees.

use super::core::is_pdf_renderable;
use super::invoice_goz::{FeeSchedule, Invoice, InvoiceKind, InvoiceLine};
use crate::error::AppError;

/// GOZ Punktwert in 1/100000 cent (5,62421 Cent, § 5 Abs. 1 GOZ).
pub const GOZ_PUNKTWERT_E5: i64 = 562_421;
/// GOÄ Punktwert in 1/100000 cent (5,82873 Cent, § 5 Abs. 1 GOÄ).
/// Update here when the GOÄ reform takes effect.
pub const GOAE_PUNKTWERT_E5: i64 = 582_873;

/// Threshold factor that requires a written justification (§ 5 Abs. 2 / § 10 Abs. 3 GOZ).
pub const FACTOR_JUSTIFICATION_THRESHOLD: f64 = 2.3;
/// Highest factor without a § 2 agreement.
pub const FACTOR_MAX_WITHOUT_AGREEMENT: f64 = 3.5;
/// Single expense above which a receipt must be attached (§ 10 Abs. 2 Nr. 5 GOZ).
pub const EXPENSE_RECEIPT_THRESHOLD_CENTS: i64 = 2_556;

/// Fee for one unit in cents: points × Punktwert × factor, rounded half-up.
pub fn unit_fee_cents(schedule: FeeSchedule, points: u32, factor: f64) -> i64 {
    let pw = match schedule {
        FeeSchedule::Goae => GOAE_PUNKTWERT_E5,
        _ => GOZ_PUNKTWERT_E5,
    };
    // Factor with up to 2 decimals → integer hundredths to avoid f64 drift.
    let factor_x100 = (factor * 100.0).round() as i64;
    let raw = i64::from(points) * pw * factor_x100; // cents × 1e5 × 100
    let denom = 100_000 * 100;
    (raw + denom / 2) / denom
}

/// Expected line amount (unit fee × quantity) for fee lines.
pub fn expected_line_cents(line: &InvoiceLine) -> Option<i64> {
    if !line.fee_schedule.is_fee() {
        return None;
    }
    let points = line.points?;
    let factor = line.factor?;
    let qty = i64::from(line.quantity.unwrap_or(1).max(1));
    Some(unit_fee_cents(line.fee_schedule, points, factor) * qty)
}

/// Totals per VAT rate (net, tax) plus grand total — all in cents.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct InvoiceTotals {
    pub fees_goz: i64,
    pub fees_goae: i64,
    pub material: i64,
    pub lab: i64,
    pub other: i64,
    /// (rate in percent × 100, net cents, tax cents) for every rate > 0.
    pub vat_groups: Vec<(i64, i64, i64)>,
    pub net: i64,
    pub tax: i64,
    pub gross: i64,
}

pub fn compute_totals(inv: &Invoice) -> InvoiceTotals {
    let mut t = InvoiceTotals::default();
    let mut groups: std::collections::BTreeMap<i64, i64> = std::collections::BTreeMap::new();
    for l in &inv.lines {
        match l.fee_schedule {
            FeeSchedule::Goz => t.fees_goz += l.amount_cents,
            FeeSchedule::Goae => t.fees_goae += l.amount_cents,
            FeeSchedule::Material => t.material += l.amount_cents,
            FeeSchedule::Lab => t.lab += l.amount_cents,
            FeeSchedule::Other => t.other += l.amount_cents,
        }
        t.net += l.amount_cents;
        let rate = (l.vat_percent.unwrap_or(0.0) * 100.0).round() as i64;
        if rate > 0 {
            *groups.entry(rate).or_default() += l.amount_cents;
        }
    }
    for (rate, net) in groups {
        // Tax per rate, rounded half away from zero (works for cancellations too).
        let tax = (net * rate + net.signum() * 5_000) / 10_000;
        t.tax += tax;
        t.vat_groups.push((rate, net, tax));
    }
    t.gross = t.net + t.tax;
    t
}

fn is_iso_date(s: &str) -> bool {
    chrono::NaiveDate::parse_from_str(s.get(..10).unwrap_or(""), "%Y-%m-%d").is_ok()
}

fn blank(s: &Option<String>) -> bool {
    s.as_deref().map(|x| x.trim().is_empty()).unwrap_or(true)
}

fn push_code(errs: &mut Vec<String>, code: &str, params: &[(&str, String)]) {
    let mut s = code.to_string();
    for (k, v) in params {
        s.push('|');
        s.push_str(k);
        s.push('=');
        s.push_str(v);
    }
    errs.push(s);
}

/// Validate an invoice before it is numbered, stored and rendered.
/// Returns every problem at once, as `error.invoice.*` keys the UI translates.
pub fn validate_invoice(inv: &Invoice) -> Result<(), AppError> {
    let mut errs: Vec<String> = Vec::new();
    let cancellation = inv.kind == InvoiceKind::Cancellation;

    if inv.number.trim().is_empty() {
        errs.push("error.invoice.number_missing".into());
    }
    if !is_iso_date(&inv.date) {
        errs.push("error.invoice.date_invalid".into());
    }
    if inv.practice_name.trim().is_empty() || inv.practice_address.is_empty() {
        errs.push("error.invoice.practice_missing".into());
    }
    if inv.recipient_name.trim().is_empty() || inv.recipient_address.is_empty() {
        errs.push("error.invoice.recipient_missing".into());
    }
    if inv.lines.is_empty() {
        errs.push("error.invoice.no_lines".into());
    }
    // Moroccan invoices (CGI art. 145) carry ICE and IF instead of GOZ fee rules.
    let morocco = inv.morocco.as_ref();
    if let Some(ids) = morocco {
        if blank(&ids.ice) {
            errs.push("error.invoice.ma_ice_missing".into());
        }
        if blank(&ids.if_number) {
            errs.push("error.invoice.ma_if_missing".into());
        }
    }
    let has_fees = morocco.is_none() && inv.lines.iter().any(|l| l.fee_schedule.is_fee());
    if has_fees && (inv.patient_name.trim().is_empty() || blank(&inv.patient_birth_date)) {
        errs.push("error.invoice.patient_identity_missing".into());
    }
    if cancellation && blank(&inv.cancels_number) {
        errs.push("error.invoice.cancellation_reference_missing".into());
    }

    for (i, l) in inv.lines.iter().enumerate() {
        let pos = (i + 1).to_string();
        if l.description.trim().is_empty() {
            push_code(
                &mut errs,
                "error.invoice.line_description",
                &[("pos", pos.clone())],
            );
        }
        if blank(&l.treatment_date) || !is_iso_date(l.treatment_date.as_deref().unwrap_or("")) {
            push_code(
                &mut errs,
                "error.invoice.line_date",
                &[("pos", pos.clone())],
            );
        }
        if !cancellation && l.amount_cents <= 0 {
            push_code(
                &mut errs,
                "error.invoice.line_amount",
                &[("pos", pos.clone())],
            );
        }
        if cancellation && l.amount_cents >= 0 {
            push_code(
                &mut errs,
                "error.invoice.line_cancellation_sign",
                &[("pos", pos.clone())],
            );
        }

        if morocco.is_none() && l.fee_schedule.is_fee() {
            if blank(&l.goz_nr) {
                push_code(
                    &mut errs,
                    "error.invoice.line_fee_number",
                    &[("pos", pos.clone())],
                );
            }
            match l.factor {
                None => push_code(
                    &mut errs,
                    "error.invoice.line_factor_missing",
                    &[("pos", pos.clone())],
                ),
                Some(f) if f < 1.0 => push_code(
                    &mut errs,
                    "error.invoice.line_factor_low",
                    &[("pos", pos.clone())],
                ),
                Some(f) if f > FACTOR_MAX_WITHOUT_AGREEMENT && blank(&l.agreement_ref) => {
                    push_code(
                        &mut errs,
                        "error.invoice.line_factor_agreement",
                        &[("pos", pos.clone()), ("factor", format!("{f:.1}"))],
                    )
                }
                Some(f) if f > FACTOR_JUSTIFICATION_THRESHOLD && blank(&l.diagnosis_reason) => {
                    push_code(
                        &mut errs,
                        "error.invoice.line_factor_reason",
                        &[("pos", pos.clone()), ("factor", format!("{f:.1}"))],
                    )
                }
                _ => {}
            }
            match (l.points, expected_line_cents(l)) {
                (None, _) => push_code(
                    &mut errs,
                    "error.invoice.line_points",
                    &[("pos", pos.clone())],
                ),
                (Some(_), Some(expected)) => {
                    if (l.amount_cents.abs() - expected).abs() > 1 {
                        push_code(
                            &mut errs,
                            "error.invoice.line_amount_mismatch",
                            &[
                                ("pos", pos.clone()),
                                ("amount", l.amount_cents.to_string()),
                                ("expected", expected.to_string()),
                            ],
                        );
                    }
                }
                _ => {}
            }
            if l.analog_of.is_some() && l.fee_schedule != FeeSchedule::Goz {
                push_code(
                    &mut errs,
                    "error.invoice.line_analog",
                    &[("pos", pos.clone())],
                );
            }
        } else if matches!(l.fee_schedule, FeeSchedule::Material | FeeSchedule::Lab)
            && l.amount_cents.abs() > EXPENSE_RECEIPT_THRESHOLD_CENTS
            && !l.receipt_attached
        {
            push_code(
                &mut errs,
                "error.invoice.line_receipt",
                &[("pos", pos.clone())],
            );
        }
    }

    let taxable = inv.lines.iter().any(|l| l.vat_percent.unwrap_or(0.0) > 0.0);
    if taxable && blank(&inv.tax_number) && blank(&inv.vat_id) {
        errs.push("error.invoice.tax_id_missing".into());
    }
    if !taxable && blank(&inv.vat_notice) {
        errs.push("error.invoice.vat_notice_missing".into());
    }

    // Everything printed must be representable in the PDF fonts.
    let mut texts: Vec<&str> = vec![&inv.recipient_name, &inv.practice_name, &inv.patient_name];
    texts.extend(inv.recipient_address.iter().map(|s| s.as_str()));
    texts.extend(inv.practice_address.iter().map(|s| s.as_str()));
    texts.extend(inv.lines.iter().map(|l| l.description.as_str()));
    texts.extend(
        inv.lines
            .iter()
            .filter_map(|l| l.diagnosis_reason.as_deref()),
    );
    if texts.iter().any(|t| !is_pdf_renderable(t)) {
        errs.push("error.invoice.unprintable".into());
    }

    if errs.is_empty() {
        Ok(())
    } else {
        Err(AppError::ValidationCode(errs.join("\n")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn goz_0010_at_2_3_is_12_94() {
        // GOZ 0010 = 100 points; 100 × 5.62421 ct × 2.3 = 1293.57 ct → 12,94 EUR.
        assert_eq!(unit_fee_cents(FeeSchedule::Goz, 100, 2.3), 1294);
    }

    #[test]
    fn goz_factor_one_rounding() {
        // 100 × 5.62421 = 562.421 → 5,62 EUR.
        assert_eq!(unit_fee_cents(FeeSchedule::Goz, 100, 1.0), 562);
    }

    #[test]
    fn vat_groups_and_gross() {
        let inv = Invoice {
            lines: vec![
                InvoiceLine {
                    amount_cents: 10_000,
                    vat_percent: Some(19.0),
                    fee_schedule: FeeSchedule::Lab,
                    ..Default::default()
                },
                InvoiceLine {
                    amount_cents: 5_000,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        let t = compute_totals(&inv);
        assert_eq!(t.vat_groups, vec![(1900, 10_000, 1_900)]);
        assert_eq!(t.gross, 16_900);
    }
}
