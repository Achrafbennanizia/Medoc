//! Receipt tables and totals with the document currency (split from `clinical_layout.rs`).

use super::*;

/// Grand-total row: explicit `total` flag; label sniffing only as fallback
/// for layouts that do not set the flag yet.
pub(super) fn is_total_row(row: &LabelValue, all: &[LabelValue]) -> bool {
    if all.iter().any(|r| r.total) {
        return row.total;
    }
    let l = row.label.to_lowercase();
    l == "total" || l == "gesamt" || l.starts_with("gesamtbetrag") || l.starts_with("endbetrag")
}

pub(super) fn receipt_tables_with_currency(tables: &[PdfTableSpec]) -> Vec<PdfTableSpec> {
    tables
        .iter()
        .map(|table| {
            let mut table = table.clone();
            let idx = table.headers.len().saturating_sub(1);
            if table.headers.len() >= 2 {
                for row in &mut table.rows {
                    if let Some(cell) = row.get_mut(idx) {
                        *cell = super::super::core::ensure_money_currency(cell);
                    }
                }
            }
            table
        })
        .collect()
}

pub(super) fn receipt_totals_with_currency(totals: &[LabelValue]) -> Vec<LabelValue> {
    totals
        .iter()
        .map(|row| {
            let mut row = row.clone();
            row.value = super::super::core::ensure_money_currency(&row.value);
            row
        })
        .collect()
}

pub(super) fn emit_receipt_totals(pb: &mut PageBuilder, totals: &[LabelValue]) {
    if totals.is_empty() {
        return;
    }
    // Amount received. The label ends before the amount column; the figure
    // ends at the right margin. This is not a demand for payment.
    let label_right = M_LEFT + 390;
    let amount_right = M_RIGHT - 2;
    pb.ensure_space(24 + totals.len() as i32 * 14);
    pb.advance(4);
    for row in totals {
        let bold = is_total_row(row, totals);
        if bold {
            pb.hline(M_LEFT + 250, M_RIGHT);
            pb.advance(3);
            pb.hline(M_LEFT + 250, M_RIGHT);
            pb.advance(13);
        }
        let value = super::super::core::sanitize_pdf_money(&row.value);
        pb.text_right(label_right, 9, bold, &row.label);
        pb.text_right(amount_right, 9, bold, &value);
        pb.advance(13);
    }
    pb.advance(4);
}
