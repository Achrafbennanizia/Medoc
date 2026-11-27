//! Line table of the GOZ invoice: columns, header, rows, sums (split from `invoice_goz.rs`).

use super::*;

// Column layout relative to M_LEFT (content width 467 pt).
pub(super) const X_DATE: i32 = M_LEFT;
pub(super) const X_REGION: i32 = M_LEFT + 54;
pub(super) const X_NR: i32 = M_LEFT + 88;
pub(super) const X_DESC: i32 = M_LEFT + 130;
pub(super) const DESC_W: i32 = 186;
pub(super) const X_QTY_R: i32 = M_LEFT + 346;
pub(super) const X_FACTOR_R: i32 = M_LEFT + 390;
pub(super) const X_AMOUNT_R: i32 = M_RIGHT;
pub(super) const ROW_FS: i32 = 8;
pub(super) const ROW_STEP: i32 = 10;

/// `factor`: the GOZ increase-factor column, shown only when a line has a factor
/// (a French or EU invoice has no fee multiplier).
pub(super) fn emit_table_header(pb: &mut PageBuilder, locale: &str, factor: bool) {
    pb.table_header_band(M_LEFT, pb.y + 2, M_RIGHT - M_LEFT);
    pb.text(X_DATE + 2, 8, true, tr(locale, "invoice.date"));
    pb.text(X_REGION, 8, true, tr(locale, "invoice.tooth_region"));
    pb.text(X_NR, 8, true, tr(locale, "invoice.no"));
    pb.text(X_DESC, 8, true, tr(locale, "invoice.service_description"));
    pb.text_right(X_QTY_R, 8, true, tr(locale, "invoice.qty"));
    if factor {
        pb.text_right(X_FACTOR_R, 8, true, tr(locale, "invoice.factor"));
    }
    pb.text_right(X_AMOUNT_R - 2, 8, true, tr(locale, "invoice.amount"));
    pb.advance(10);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(11);
}

/// All text lines of the description column for one invoice line. The
/// legal sub-lines (analog billing, expense kind, receipt, justification,
/// agreement) follow the document language — they were always German.
pub(super) fn description_lines(line: &InvoiceLine, locale: &str) -> Vec<(String, bool)> {
    let w = f64::from(DESC_W);
    let mut out: Vec<(String, bool)> = wrap_to_width(&line.description, ROW_FS, false, w)
        .into_iter()
        .map(|s| (s, false))
        .collect();
    let mut sub = |text: String| {
        for s in wrap_to_width(&text, 7, false, w) {
            out.push((s, true));
        }
    };
    if let Some(orig) = line.analog_of.as_deref().filter(|s| !s.trim().is_empty()) {
        sub(trf(locale, "invoice.analog_of", &[("nr", orig)]));
    }
    if let Some(m) = line.material.as_deref().filter(|s| !s.trim().is_empty()) {
        sub(trf(locale, "invoice.material_kind", &[("material", m)]));
    }
    if line.receipt_attached {
        sub(tr(locale, "invoice.receipt_attached").into());
    }
    if let Some(reason) = line
        .diagnosis_reason
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        let label = if line.factor.unwrap_or(0.0) > FACTOR_JUSTIFICATION_THRESHOLD {
            tr(locale, "invoice.justification")
        } else {
            tr(locale, "invoice.note")
        };
        sub(format!("{label}: {reason}"));
    }
    if let Some(a) = line
        .agreement_ref
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        sub(trf(locale, "invoice.agreement", &[("ref", a)]));
    }
    out
}

pub(super) fn emit_line(pb: &mut PageBuilder, line: &InvoiceLine, locale: &str, factor: bool) {
    let desc = description_lines(line, locale);
    let height = desc.len() as i32 * ROW_STEP + 4;
    // Whole row must fit — otherwise new page with repeated header.
    if pb.y - height < M_BOTTOM + 6 {
        pb.break_page();
        emit_table_header(pb, locale, factor);
    }
    let top = pb.y;
    let date = line
        .treatment_date
        .as_deref()
        .map(format_date_dmy)
        .unwrap_or_default();
    pb.text(X_DATE + 2, ROW_FS, false, &date);
    pb.text(
        X_REGION,
        ROW_FS,
        false,
        line.tooth_nr.as_deref().unwrap_or(""),
    );
    let nr = match (&line.goz_nr, line.analog_of.is_some()) {
        (Some(n), true) => format!("{n}a"),
        (Some(n), false) => n.clone(),
        (None, _) => String::new(),
    };
    pb.text(X_NR, ROW_FS, false, &nr);
    if line.fee_schedule.is_fee() {
        pb.text_right(
            X_QTY_R,
            ROW_FS,
            false,
            &line.quantity.unwrap_or(1).to_string(),
        );
        if let Some(f) = line.factor {
            pb.text_right(X_FACTOR_R, ROW_FS, false, &fmt_factor(f));
        }
    }
    pb.text_right(
        X_AMOUNT_R - 2,
        ROW_FS,
        false,
        &fmt_amount(line.amount_cents),
    );
    for (i, (text, small)) in desc.iter().enumerate() {
        pb.y = top - i as i32 * ROW_STEP;
        pb.text(X_DESC, if *small { 7 } else { ROW_FS }, false, text);
    }
    pb.y = top - height;
}

pub(super) fn emit_sum_row(pb: &mut PageBuilder, label: &str, cents: i64, bold: bool, rule: bool) {
    pb.ensure_space(20);
    if rule {
        pb.hline(M_LEFT + 250, M_RIGHT);
        pb.advance(11);
    }
    pb.text_right(X_FACTOR_R, 9, bold, label);
    pb.text_right(X_AMOUNT_R - 2, 9, bold, &fmt_amount(cents));
    pb.advance(13);
}
