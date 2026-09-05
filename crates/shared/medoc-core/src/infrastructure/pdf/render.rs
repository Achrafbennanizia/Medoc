//! Invoice and patient record as PDF.
//!
//! Both document types use the shared [`PageBuilder`] from
//! [`super::core`] and the DIN-5008 letterhead from [`super::letterhead`].
//! Margins, fonts, encoding, and page numbers are therefore consistent.
//!
//! - **Invoice** ([`render`]) — GOZ/GOÄ-compliant table with position, date,
//!   tooth, GOZ no., description, quantity, factor, and total. Totals block
//!   on the right with VAT note. Bank details + payment terms in the footer.
//! - **Patient record** ([`render_chart_blocks`]) — modular block lists with
//!   master data, diagnosis, findings, treatments, attachment metadata, etc.

use crate::error::AppError;

use super::core::{
    approx_text_width, emit_multipage_pdf_with_images, format_date_dmy, format_eur, sanitize_pdf_money,
    table_row_height, truncate_cell, wrap_soft, wrap_text, PageBuilder, CONTENT_WIDTH, M_BOTTOM,
    M_LEFT, M_RIGHT,
};
use super::letterhead::{
    emit_bank_details_locale, emit_continuation_header_locale, emit_letterhead, emit_signature_block,
    Letterhead, MetaRow,
};
use super::logo::PdfLogo;

// ===========================================================================
// INVOICE
// ===========================================================================

/// One line in the invoice table (GOZ / GOÄ).
#[derive(Debug, Clone)]
pub struct InvoiceLine {
    /// Free-text service description (e.g. "Composite, three-surface").
    pub description: String,
    /// Line total in cents (quantity × unit price × factor).
    pub amount_cents: i64,
    /// GOZ/GOÄ fee number (e.g. "2197" or "Ä5000").
    pub goz_nr: Option<String>,
    /// Increase factor (GOZ § 5: 1.0–3.5, default 2.3).
    pub factor: Option<f64>,
    /// Unit price in cents (before factor).
    pub unit_price_cents: Option<i64>,
    /// Quantity (default = 1).
    pub quantity: Option<i32>,
    /// FDI tooth designation ("11", "47", "27 mes" …).
    pub tooth_nr: Option<String>,
    /// Treatment date (ISO or DE).
    pub treatment_date: Option<String>,
    /// VAT rate (0 = exempt, 19 = materials).
    pub vat_percent: Option<f64>,
    /// Material costs / external lab (per GOZ § 9).
    pub material: Option<String>,
    /// Justification when factor > 2.3 (GOZ § 10 (3) — mandatory).
    pub diagnosis_reason: Option<String>,
}

impl InvoiceLine {
    /// Construct a minimal line (all GOZ fields empty).
    pub fn simple(description: impl Into<String>, amount_cents: i64) -> Self {
        Self {
            description: description.into(),
            amount_cents,
            goz_nr: None,
            factor: None,
            unit_price_cents: None,
            quantity: None,
            tooth_nr: None,
            treatment_date: None,
            vat_percent: None,
            material: None,
            diagnosis_reason: None,
        }
    }
}

/// Complete invoice (all required/recommended fields per UStG § 14 + GOZ § 10).
#[derive(Debug, Clone)]
pub struct Invoice {
    pub number: String,
    pub date: String, // ISO date (converted to DE format internally)
    pub recipient_name: String,
    pub recipient_address: Vec<String>,
    pub practice_name: String,
    pub practice_address: Vec<String>,
    pub lines: Vec<InvoiceLine>,
    pub note: Option<String>,
    pub clinician_name: Option<String>,
    pub clinician_zanr: Option<String>,
    pub practice_bsnr: Option<String>,
    /// Full bank lines (e.g. ["IBAN: DE12…", "BIC: COBADEFFXXX",
    /// "Bank: Commerzbank", "Account holder: Dr. M. Sample"]).
    pub bank_details: Option<Vec<String>>,
    /// E.g. "Payable within 14 days with no deduction."
    pub payment_terms_text: Option<String>,
    /// E.g. "Exempt from VAT under UStG § 4 no. 14"
    pub vat_notice: Option<String>,
    /// Optional practice logo for the letterhead.
    pub logo: Option<PdfLogo>,
    /// Document locale (`en`|`de`|`fr`|`ar`).
    pub locale: String,
    /// Arabic: logo top-right.
    pub rtl: bool,
}

impl Default for Invoice {
    fn default() -> Self {
        Self {
            number: String::new(),
            date: String::new(),
            recipient_name: String::new(),
            recipient_address: Vec::new(),
            practice_name: String::new(),
            practice_address: Vec::new(),
            lines: Vec::new(),
            note: None,
            clinician_name: None,
            clinician_zanr: None,
            practice_bsnr: None,
            bank_details: None,
            payment_terms_text: None,
            vat_notice: None,
            logo: None,
            locale: "en".into(),
            rtl: false,
        }
    }
}

impl Invoice {
    pub fn total_cents(&self) -> i64 {
        self.lines.iter().map(|l| l.amount_cents).sum()
    }
}

/// Table columns — as constants so header and rows use
/// exactly the same X positions.
mod inv_cols {
    pub const POS: i32 = 50;
    pub const DATE: i32 = 78;
    pub const TOOTH: i32 = 130;
    pub const GOZ: i32 = 160;
    pub const DESIGNATION: i32 = 200;
    pub const QTY: i32 = 410;
    pub const FACTOR: i32 = 445;
    /// Right-aligned — align against this X coordinate.
    pub const PRICE_RIGHT: i32 = 545;
    pub const HEADER_BAND_W: i32 = 495;
    /// Width of the description column in characters (for wrap).
    pub const DESIGNATION_CHARS: usize = 36;
}

/// Main entry: render an invoice as PDF bytes.
pub fn render(invoice: &Invoice) -> Result<Vec<u8>, AppError> {
    let mut pb = PageBuilder::new();

    // ---------- Letterhead (first page only) ------------------------------
    let mut meta = Vec::new();
    meta.push(MetaRow::new("Invoice-Nr.", &invoice.number));
    meta.push(MetaRow::new(
        "Invoice date",
        format_date_dmy(&invoice.date),
    ));
    if let Some(b) = invoice
        .clinician_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        meta.push(MetaRow::new("Clinician", b));
    }

    // Practice lines + professional IDs (BSNR/ZANR) into the header
    let mut practice_full = vec![invoice.practice_name.clone()];
    practice_full.extend(invoice.practice_address.iter().cloned());
    if let (Some(bsnr), zanr) = (
        invoice.practice_bsnr.as_deref(),
        invoice.clinician_zanr.as_deref(),
    ) {
        if !bsnr.trim().is_empty() {
            let zline = match zanr {
                Some(z) if !z.trim().is_empty() => format!("BSNR: {bsnr} · ZANR: {z}"),
                _ => format!("BSNR: {bsnr}"),
            };
            practice_full.push(zline);
        }
    }

    let mut recipient = vec![invoice.recipient_name.clone()];
    recipient.extend(invoice.recipient_address.iter().cloned());

    let locale = if invoice.locale.trim().is_empty() { "en" } else { invoice.locale.as_str() };
    let lh = Letterhead {
        practice_lines: &practice_full,
        meta_rows: &meta,
        address_lines: &recipient,
        header_right_lines: &[],
        show_sender_hint: true,
        compact_address: false,
        logo: invoice.logo.as_ref(),
        rtl: invoice.rtl,
        locale,
    };
    emit_letterhead(&mut pb, &lh);

    // ---------- Document-Titel --------------------------------------------
    pb.text(M_LEFT, 18, true, "Invoice");
    pb.advance(20);
    pb.text(M_LEFT, 10, false, "Service overview per GOZ / GOÄ");
    pb.advance(8);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(16);

    // ---------- Table header ----------------------------------------------
    emit_invoice_table_header(&mut pb);

    // ---------- Table rows ------------------------------------------------
    for (i, line) in invoice.lines.iter().enumerate() {
        if pb.y < M_BOTTOM + 120 {
            pb.break_page();
            emit_continuation_header_locale(&mut pb, &invoice.practice_name, "Invoice", locale);
            emit_invoice_table_header(&mut pb);
        }
        emit_invoice_line(&mut pb, i, line);
    }

    // ---------- Totals block ----------------------------------------------
    pb.advance(8);
    emit_invoice_totals(&mut pb, invoice);

    // ---------- Payment terms ---------------------------------------------
    if let Some(zt) = invoice
        .payment_terms_text
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        pb.advance(8);
        pb.paragraph(zt, 9, 90, 0);
    } else if let Some(note) = &invoice.note {
        pb.advance(8);
        pb.paragraph(note, 9, 90, 0);
    }

    // ---------- Bank details ----------------------------------------------
    if let Some(bank) = &invoice.bank_details {
        emit_bank_details_locale(&mut pb, bank, locale);
    }

    // ---------- Signature -------------------------------------------------
    emit_signature_block(
        &mut pb,
        invoice.clinician_name.as_deref(),
        Some("Dentist"),
        invoice.clinician_zanr.as_deref(),
        invoice.practice_bsnr.as_deref(),
        true,
    );

    let pages = pb.finish();
    {
        let images: Vec<PdfLogo> = invoice.logo.clone().into_iter().collect();
        emit_multipage_pdf_with_images(&pages, &format!("Invoice {}", invoice.number), &images, locale)
    }
}

fn emit_invoice_table_header(pb: &mut PageBuilder) {
    pb.table_header_band(M_LEFT, pb.y + 2, inv_cols::HEADER_BAND_W);
    pb.text(inv_cols::POS, 8, true, "Pos.");
    pb.text(inv_cols::DATE, 8, true, "Date");
    pb.text(inv_cols::TOOTH, 8, true, "Tooth");
    pb.text(inv_cols::GOZ, 8, true, "GOZ/GOÄ");
    pb.text(inv_cols::DESIGNATION, 8, true, "Designation");
    pb.text(inv_cols::QTY, 8, true, "Qty");
    pb.text(inv_cols::FACTOR, 8, true, "Factor");
    pb.text_right(inv_cols::PRICE_RIGHT, 8, true, "Total €");
    pb.advance(10);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(12);
}

fn emit_invoice_line(pb: &mut PageBuilder, idx: usize, line: &InvoiceLine) {
    let pos = format!("{}", idx + 1);
    let date = line
        .treatment_date
        .as_deref()
        .map(format_date_dmy)
        .unwrap_or_else(|| "—".into());
    let tooth = line.tooth_nr.as_deref().unwrap_or("—");
    let goz = line.goz_nr.as_deref().unwrap_or("—");
    let designation = &line.description;
    let quantity = line
        .quantity
        .map(|m| m.to_string())
        .unwrap_or_else(|| "1".into());
    let factor = line
        .factor
        .map(|f| format!("{:.1}", f))
        .unwrap_or_else(|| "—".into());
    let price = format_eur(line.amount_cents);

    // Description may be multi-line → wrap it
    let bez_lines = wrap_soft(designation, inv_cols::DESIGNATION_CHARS);
    let row_height = (bez_lines.len() as i32).max(1) * 10 + 4;

    // If not enough space: wrap (already checked before call, but
    // re-guard for very long descriptions)
    if pb.y < M_BOTTOM + row_height + 20 {
        // Caller should already have wrapped; if still too tight:
        // truncate description instead of overlapping.
    }

    // First line: all columns
    pb.text(inv_cols::POS, 8, false, &pos);
    pb.text(inv_cols::DATE, 8, false, &date);
    pb.text(inv_cols::TOOTH, 8, false, tooth);
    pb.text(inv_cols::GOZ, 8, false, goz);
    if let Some(first) = bez_lines.first() {
        pb.text(inv_cols::DESIGNATION, 8, false, first);
    }
    pb.text(inv_cols::QTY, 8, false, &quantity);
    pb.text(inv_cols::FACTOR, 8, false, &factor);
    pb.text_right(inv_cols::PRICE_RIGHT, 8, false, &price);

    // Continuation lines of the description
    for extra in bez_lines.iter().skip(1) {
        pb.advance(10);
        pb.text(inv_cols::DESIGNATION, 8, false, extra);
    }

    // Material sub-line (per GOZ § 9: list separately)
    if let Some(m) = line.material.as_deref().filter(|s| !s.trim().is_empty()) {
        pb.advance(10);
        pb.text(
            inv_cols::DESIGNATION,
            8,
            false,
            &format!("   Material: {m}"),
        );
    }

    // Justification sub-line (GOZ § 10 (3): mandatory when factor > 2.3)
    if let Some(reason) = line
        .diagnosis_reason
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        let needs = line.factor.map(|f| f > 2.3).unwrap_or(false);
        let label = if needs {
            "Justification (GOZ § 10 (3))"
        } else {
            "Note"
        };
        // Label only on the first line; continuation lines indented.
        let body = format!("   {label}: {reason}");
        for (i, chunk) in wrap_soft(&body, inv_cols::DESIGNATION_CHARS)
            .iter()
            .enumerate()
        {
            pb.advance(10);
            let text = if i == 0 {
                chunk.clone()
            } else {
                format!("      {chunk}")
            };
            pb.text(inv_cols::DESIGNATION, 7, false, &text);
        }
    }

    pb.advance(14);
}

fn emit_invoice_totals(pb: &mut PageBuilder, inv: &Invoice) {
    pb.ensure_space(80);
    let label_right_x = 380;

    // Double line above the totals area
    pb.hline(300, M_RIGHT);
    pb.advance(3);
    pb.hline(300, M_RIGHT);
    pb.advance(14);

    pb.text_right(label_right_x, 10, false, "Net amount:");
    pb.text_right(M_RIGHT, 10, false, &format_eur(inv.total_cents()));
    pb.advance(14);

    if let Some(ust) = inv.vat_notice.as_deref().filter(|s| !s.trim().is_empty()) {
        for chunk in wrap_text(ust, 60) {
            pb.text(M_LEFT, 9, false, &chunk);
            pb.advance(11);
        }
    }

    pb.advance(4);
    pb.text_right(label_right_x, 11, true, "Amount due:");
    pb.text_right(M_RIGHT, 11, true, &format_eur(inv.total_cents()));
    pb.advance(22);
}

// ===========================================================================
// PATIENT RECORD  (modular block list)
// ===========================================================================

/// Table inside a record block.
#[derive(Debug, Clone, Default)]
pub struct ChartPdfTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    /// Optional column weights (e.g. `[2, 1, 10]` → narrow · narrow · wide).
    /// If omitted: even distribution across [`CONTENT_WIDTH`].
    pub column_weights: Option<Vec<i32>>,
}

impl ChartPdfTable {
    pub fn new(headers: Vec<String>, rows: Vec<Vec<String>>) -> Self {
        Self {
            headers,
            rows,
            column_weights: None,
        }
    }

    pub fn with_column_weights(mut self, weights: Vec<i32>) -> Self {
        self.column_weights = Some(weights);
        self
    }
}

/// One section in the record (master data, diagnosis, treatments, …).
#[derive(Debug, Clone, Default)]
pub struct ChartPdfBlock {
    pub title: String,
    pub body_lines: Vec<String>,
    pub kv_pairs: Vec<(String, String)>,
    pub table: Option<ChartPdfTable>,
}

impl ChartPdfBlock {
    pub fn body(title: impl Into<String>, lines: Vec<String>) -> Self {
        Self {
            title: title.into(),
            body_lines: lines,
            kv_pairs: Vec::new(),
            table: None,
        }
    }

    pub fn kv(title: impl Into<String>, kv: Vec<(String, String)>) -> Self {
        Self {
            title: title.into(),
            body_lines: Vec::new(),
            kv_pairs: kv,
            table: None,
        }
    }

    pub fn table(title: impl Into<String>, table: ChartPdfTable) -> Self {
        Self {
            title: title.into(),
            body_lines: Vec::new(),
            kv_pairs: Vec::new(),
            table: Some(table),
        }
    }
}

/// Legacy single-document mode (for backward compatibility).
pub struct ChartDocument {
    pub patient_name: String,
    pub patient_date_of_birth: String,
    pub patient_insurance_number: String,
    pub chart_status: String,
    pub diagnosis: Option<String>,
    pub findings: Option<String>,
    pub treatments: Vec<(String, String)>,
    pub generated_at: String,
}

/// Practice header data for record / fact sheet (optional — when `None` a
/// slim header without DIN-5008 letterhead is rendered).
#[derive(Debug, Clone)]
pub struct ChartHeaderContext {
    pub practice_lines: Vec<String>,
    pub clinician_name: Option<String>,
    pub professional_title: Option<String>,
    pub bsnr: Option<String>,
    pub zanr: Option<String>,
    pub created_by: Option<String>,
    pub document_id: Option<String>,
    pub logo: Option<PdfLogo>,
    pub locale: String,
    pub rtl: bool,
}

impl Default for ChartHeaderContext {
    fn default() -> Self {
        Self {
            practice_lines: Vec::new(),
            clinician_name: None,
            professional_title: None,
            bsnr: None,
            zanr: None,
            created_by: None,
            document_id: None,
            logo: None,
            locale: "en".into(),
            rtl: false,
        }
    }
}

/// Main renderer for the patient record as PDF (modular).
///
/// `header` supplies the practice context (letterhead, provider) for the first
/// page. When empty, only title + date are rendered at the top.
pub fn render_chart_blocks(
    doc_title: &str,
    generated_at: &str,
    pdf_title_meta: &str,
    blocks: &[ChartPdfBlock],
    header: Option<&ChartHeaderContext>,
) -> Result<Vec<u8>, AppError> {
    let mut pb = PageBuilder::new();

    // ---------- Header -----------------------------------------------------
    if let Some(h) = header.filter(|h| !h.practice_lines.is_empty()) {
        let mut meta = Vec::new();
        if let Some(id) = h.document_id.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new("Document-ID", id));
        }
        meta.push(MetaRow::new("Created", generated_at));
        if let Some(by) = h.created_by.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new("Created by", by));
        }
        if let Some(b) = h.clinician_name.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new("Clinician", b));
        }

        let locale = if h.locale.trim().is_empty() { "en" } else { h.locale.as_str() };
        let lh = Letterhead {
            practice_lines: &h.practice_lines,
            meta_rows: &meta,
            address_lines: &[],
            header_right_lines: &[],
            show_sender_hint: false,
            compact_address: false,
            logo: h.logo.as_ref(),
            rtl: h.rtl,
            locale,
        };
        emit_letterhead(&mut pb, &lh);
    } else {
        // Slim header: title + date only
        pb.text(M_LEFT, 18, true, doc_title);
        pb.advance(22);
        pb.text(M_LEFT, 9, false, &format!("Created: {generated_at}"));
        pb.advance(14);
        pb.hline(M_LEFT, M_RIGHT);
        pb.advance(20);
    }

    // Place document title centrally even when letterhead is present
    if header.is_some() {
        pb.text(M_LEFT, 16, true, doc_title);
        pb.advance(20);
        pb.hline(M_LEFT, M_RIGHT);
        pb.advance(18);
    }

    // ---------- Blocks -----------------------------------------------------
    let practice_name = header
        .and_then(|h| h.practice_lines.first().cloned())
        .unwrap_or_else(|| "MeDoc".into());

    if blocks.is_empty() {
        pb.text(M_LEFT, 10, false, "(No content for this export.)");
        pb.advance(14);
    }

    for block in blocks {
        emit_chart_block(&mut pb, block, &practice_name, doc_title);
    }

    // ---------- GDPR notice at the end ------------------------------------
    if header.is_some() {
        pb.ensure_space(60);
        pb.advance(10);
        pb.hline(M_LEFT, M_RIGHT);
        pb.advance(14);
        pb.text(M_LEFT, 8, true, "Privacy notice");
        pb.advance(11);
        pb.paragraph(
            "This document contains confidential patient data under German BGB § 630f. \
             Disclosure only with the patient's explicit consent. \
             Retention beyond the statutory retention period is not permitted.",
            8,
            90,
            0,
        );
    }

    let pages = pb.finish();
    {
        let images: Vec<PdfLogo> = header.and_then(|h| h.logo.clone()).into_iter().collect();
        let locale = header.map(|h| h.locale.as_str()).filter(|s| !s.is_empty()).unwrap_or("en");
        emit_multipage_pdf_with_images(&pages, pdf_title_meta, &images, locale)
    }
}

fn emit_chart_block(
    pb: &mut PageBuilder,
    block: &ChartPdfBlock,
    practice_name: &str,
    doc_title: &str,
) {
    // Ensure at least title + 2 lines fit
    pb.ensure_space(48);
    if pb.y < M_BOTTOM + 100 {
        pb.break_page();
        emit_continuation_header_locale(pb, practice_name, doc_title, "en");
    }

    // Block-Titel in Hellgrau-Band
    pb.table_header_band(M_LEFT, pb.y + 2, CONTENT_WIDTH);
    pb.text(M_LEFT + 4, 11, true, &block.title);
    pb.advance(18);

    let mut wrote_any = false;

    if let Some(ref tbl) = block.table {
        if !tbl.headers.is_empty() || !tbl.rows.is_empty() {
            emit_chart_table(pb, tbl, practice_name, doc_title);
            wrote_any = true;
        }
    }

    if !block.kv_pairs.is_empty() {
        for (k, version) in &block.kv_pairs {
            emit_chart_kv_pair(pb, k, version, practice_name, doc_title);
        }
        wrote_any = true;
    }

    if !block.body_lines.is_empty() {
        for line in &block.body_lines {
            let display = crate::infrastructure::clinical_text_format::plain_text_for_pdf(line);
            for chunk in wrap_text(&display, 90) {
                if pb.y < M_BOTTOM + 24 {
                    pb.break_page();
                    emit_continuation_header_locale(pb, practice_name, doc_title, "en");
                }
                pb.text(M_LEFT, 10, false, &chunk);
                pb.advance(12);
            }
        }
        wrote_any = true;
    }

    if !wrote_any {
        pb.text(M_LEFT, 10, false, "(keine Einträge)");
        pb.advance(12);
    }

    pb.advance(8);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(14);
}

fn emit_chart_kv_pair(
    pb: &mut PageBuilder,
    key: &str,
    value: &str,
    practice_name: &str,
    doc_title: &str,
) {
    let display = sanitize_pdf_money(
        &crate::infrastructure::clinical_text_format::plain_text_for_pdf(value),
    );
    let label = format!("{key}:");
    let label_w = approx_text_width(&label, 9);
    // Long labels (e.g. "Income (current calendar month)") must not collide with values.
    let value_x = M_LEFT + label_w + 14;
    let fits_one_line = !display.contains('\n')
        && value_x + approx_text_width(&display, 10) <= M_RIGHT
        && label_w <= 240;

    if pb.y < M_BOTTOM + 30 {
        pb.break_page();
        emit_continuation_header_locale(pb, practice_name, doc_title, "en");
    }

    if fits_one_line {
        pb.text(M_LEFT, 9, true, &label);
        pb.text(value_x, 10, false, &display);
        pb.advance(14);
    } else {
        pb.text(M_LEFT, 9, true, &label);
        pb.advance(12);
        for chunk in wrap_text(&display, 90) {
            if pb.y < M_BOTTOM + 24 {
                pb.break_page();
                emit_continuation_header_locale(pb, practice_name, doc_title, "en");
            }
            pb.text(M_LEFT + 8, 10, false, &chunk);
            pb.advance(12);
        }
        pb.advance(4);
    }
}

fn chart_table_column_xs(ncol: usize, weights: Option<&[i32]>) -> Vec<i32> {
    let n = ncol.max(1);
    let Some(w) = weights.filter(|w| !w.is_empty()) else {
        let step = CONTENT_WIDTH / n as i32;
        return (0..n).map(|i| M_LEFT + i as i32 * step).collect();
    };
    let sum: i32 = w.iter().copied().sum::<i32>().max(1);
    let mut xs = vec![M_LEFT];
    let mut acc = 0i32;
    for i in 0..n.saturating_sub(1) {
        let wt = w.get(i).copied().unwrap_or(1).max(1);
        acc += CONTENT_WIDTH * wt / sum;
        xs.push(M_LEFT + acc);
    }
    xs
}

fn chart_table_column_char_widths(col_xs: &[i32]) -> Vec<usize> {
    let mut w = Vec::with_capacity(col_xs.len());
    for i in 0..col_xs.len() {
        let next = col_xs.get(i + 1).copied().unwrap_or(M_RIGHT);
        let width_pt = (next - col_xs[i]).max(24);
        w.push(((width_pt / 5).max(8)) as usize);
    }
    w
}

fn is_amount_header(h: &str) -> bool {
    let l = h.to_ascii_lowercase();
    l.contains("amount") || l.contains("betrag") || l.contains("total") || l.contains("eur")
}

const CHART_CELL_PAD: i32 = 6;

fn emit_chart_table_header_row(
    pb: &mut PageBuilder,
    tbl: &ChartPdfTable,
    col_xs: &[i32],
    col_chars: &[usize],
) {
    pb.table_header_band(M_LEFT, pb.y + 2, CONTENT_WIDTH);
    for ci in 0..tbl.headers.len().max(1) {
        let h = tbl.headers.get(ci).map(|s| s.as_str()).unwrap_or("");
        let max_chars = col_chars.get(ci).copied().unwrap_or(20);
        let x = col_xs.get(ci).copied().unwrap_or(M_LEFT);
        let next = col_xs.get(ci + 1).copied().unwrap_or(M_RIGHT);
        let text = truncate_cell(h, max_chars);
        if is_amount_header(h) {
            pb.text_right(next - CHART_CELL_PAD, 9, true, &text);
        } else {
            pb.text(x + CHART_CELL_PAD, 9, true, &text);
        }
    }
    pb.advance(14);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(10);
}

fn emit_chart_table(pb: &mut PageBuilder, tbl: &ChartPdfTable, practice_name: &str, doc_title: &str) {
    let ncol = tbl
        .headers
        .len()
        .max(tbl.rows.iter().map(|r| r.len()).max().unwrap_or(0))
        .max(1);
    let col_xs = chart_table_column_xs(ncol, tbl.column_weights.as_deref());
    let col_chars = chart_table_column_char_widths(&col_xs);

    if pb.y < M_BOTTOM + 60 {
        pb.break_page();
        emit_continuation_header_locale(pb, practice_name, doc_title, "en");
    }

    emit_chart_table_header_row(pb, tbl, &col_xs, &col_chars);

    if tbl.rows.is_empty() {
        pb.text(M_LEFT + CHART_CELL_PAD, 9, false, "(no table rows)");
        pb.advance(12);
        return;
    }

    for (ri, row) in tbl.rows.iter().enumerate() {
        let mut wrapped: Vec<Vec<String>> = Vec::with_capacity(ncol);
        let mut row_lines = 1usize;
        for ci in 0..ncol {
            let cell = row.get(ci).map(|s| s.as_str()).unwrap_or("");
            let safe = sanitize_pdf_money(cell);
            let max_chars = col_chars.get(ci).copied().unwrap_or(20);
            let w = wrap_soft(&safe, max_chars);
            row_lines = row_lines.max(w.len().max(1));
            wrapped.push(w);
        }

        let font_size = 9;
        let line_step = 12;
        let row_height = table_row_height(row_lines, line_step, font_size);
        if pb.y < M_BOTTOM + row_height + 20 {
            pb.break_page();
            emit_continuation_header_locale(pb, practice_name, doc_title, "en");
            emit_chart_table_header_row(pb, tbl, &col_xs, &col_chars);
        }

        let first_baseline = pb.y;
        if ri % 2 == 1 {
            pb.fill_table_row_band(
                M_LEFT,
                CONTENT_WIDTH,
                first_baseline,
                row_height,
                font_size,
                0.97,
            );
        }

        for li in 0..row_lines {
            for ci in 0..ncol {
                let x = col_xs.get(ci).copied().unwrap_or(M_LEFT);
                let next = col_xs.get(ci + 1).copied().unwrap_or(M_RIGHT);
                let chunk = wrapped
                    .get(ci)
                    .and_then(|w| w.get(li))
                    .map(|s| s.as_str())
                    .unwrap_or("");
                if chunk.is_empty() {
                    continue;
                }
                let prev = pb.y;
                pb.y = first_baseline - li as i32 * line_step;
                let header = tbl.headers.get(ci).map(|s| s.as_str()).unwrap_or("");
                if is_amount_header(header) {
                    pb.text_right(next - CHART_CELL_PAD, font_size, false, chunk);
                } else {
                    pb.text(x + CHART_CELL_PAD, font_size, false, chunk);
                }
                pb.y = prev;
            }
        }
        pb.advance(row_height);
    }
    pb.advance(4);
}

/// Legacy wrapper.
pub fn render_chart(doc: &ChartDocument) -> Result<Vec<u8>, AppError> {
    let diag = doc
        .diagnosis
        .clone()
        .unwrap_or_else(|| "(none recorded)".into());
    let bef = doc
        .findings
        .clone()
        .unwrap_or_else(|| "(none recorded)".into());
    let beh_lines: Vec<String> = if doc.treatments.is_empty() {
        vec!["(no treatments recorded)".to_string()]
    } else {
        doc.treatments
            .iter()
            .map(|(d, b)| format!("{d} — {b}"))
            .collect()
    };

    let blocks = vec![
        ChartPdfBlock::kv(
            "Master data / chart header",
            vec![
                ("Patient".into(), doc.patient_name.clone()),
                ("Date of birth".into(), doc.patient_date_of_birth.clone()),
                (
                    "Insurance no.".into(),
                    doc.patient_insurance_number.clone(),
                ),
                ("Chart status".into(), doc.chart_status.clone()),
            ],
        ),
        ChartPdfBlock::body("Diagnosis", vec![diag]),
        ChartPdfBlock::body("Findings (free text)", vec![bef]),
        ChartPdfBlock::body("Treatments", beh_lines),
    ];

    render_chart_blocks(
        "PatientChart",
        &doc.generated_at,
        &format!("PatientChart {}", doc.patient_name),
        &blocks,
        None,
    )
}

// ===========================================================================
// Auswertungs- / Finanzberichte (Statistics, BalanceSheet, Income)
// ===========================================================================

/// Key-value row in the report summary block.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfSummaryRow {
    pub label: String,
    pub value: String,
}

/// Tabular section (same table primitive as PatientChart).
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfSection {
    pub title: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Structured input for practice reports (Income, Statistics, BalanceSheet).
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfInput {
    pub doc_title: String,
    pub generated_at: String,
    pub practice_name: String,
    pub practice_address: Vec<String>,
    pub summary: Vec<ReportPdfSummaryRow>,
    pub sections: Vec<ReportPdfSection>,
}

/// Renders a practice report PDF using the same [`render_chart_blocks`] pipeline as
/// Chart / Leaflet — identical letterhead, margins, tables, and page numbers.
pub fn render_report_pdf(input: &ReportPdfInput) -> Result<Vec<u8>, AppError> {
    let mut practice_lines: Vec<String> = Vec::new();
    if !input.practice_name.trim().is_empty() {
        practice_lines.push(input.practice_name.trim().to_string());
    }
    for line in &input.practice_address {
        let t = line.trim();
        if !t.is_empty() {
            practice_lines.push(t.to_string());
        }
    }

    let header = if practice_lines.is_empty() {
        None
    } else {
        Some(ChartHeaderContext {
            practice_lines,
            ..Default::default()
        })
    };

    let mut blocks: Vec<ChartPdfBlock> = Vec::new();
    if !input.summary.is_empty() {
        blocks.push(ChartPdfBlock::kv(
            "Summary",
            input
                .summary
                .iter()
                .map(|r| (r.label.clone(), r.value.clone()))
                .collect(),
        ));
    }
    for sec in &input.sections {
        if sec.headers.is_empty() && sec.rows.is_empty() {
            continue;
        }
        let mut table = ChartPdfTable::new(sec.headers.clone(), sec.rows.clone());
        // Two-column metric/amount tables: give the value column room + right align.
        if sec.headers.len() == 2 {
            table = table.with_column_weights(vec![3, 2]);
        }
        blocks.push(ChartPdfBlock::table(&sec.title, table));
    }

    render_chart_blocks(
        &input.doc_title,
        &input.generated_at,
        &input.doc_title,
        &blocks,
        header.as_ref(),
    )
}

// ===========================================================================
// Template preview (for template editor)
// ===========================================================================

/// Preview renderer: uses either a structured layout
/// (`layout_json`, see `clinical_pdf_layout`) or the same letterhead/footer
/// library via [`clinical_pdf_layout::render_plain_preview`].
pub fn render_template_preview_pdf(
    kind: &str,
    template_name: &str,
    footer: &str,
    body_pt: i32,
    body_lines: &[String],
    layout_json: Option<&str>,
) -> Result<Vec<u8>, AppError> {
    if let Some(json) = layout_json.filter(|s| !s.trim().is_empty()) {
        let layout: super::clinical_layout::ClinicalPdfLayout = serde_json::from_str(json)
            .map_err(|e| AppError::Validation(format!("PDF-Layout: {e}")))?;
        return super::clinical_layout::render_clinical_layout(&layout);
    }

    super::clinical_layout::render_plain_preview(
        kind,
        template_name,
        footer,
        body_pt,
        body_lines,
    )
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_invoice() -> Invoice {
        Invoice {
            number: "RE-2026-04-0001".into(),
            date: "2026-04-19".into(),
            recipient_name: "Max Sample".into(),
            recipient_address: vec!["Sample Street 1".into(), "10115 Berlin".into()],
            practice_name: "Dental practice Dr. Example".into(),
            practice_address: vec![
                "Main Street 2".into(),
                "10115 Berlin".into(),
                "Tel. 030 12345".into(),
            ],
            lines: vec![
                InvoiceLine {
                    description: "Composite, three-surface".into(),
                    amount_cents: 5670,
                    goz_nr: Some("2197".into()),
                    factor: Some(2.3),
                    unit_price_cents: Some(2465),
                    quantity: Some(1),
                    tooth_nr: Some("21".into()),
                    treatment_date: Some("2026-04-01".into()),
                    vat_percent: Some(0.0),
                    material: None,
                    diagnosis_reason: None,
                },
                InvoiceLine::simple("Checkup", 4500),
            ],
            note: None,
            clinician_name: Some("Dr. Maria Example".into()),
            clinician_zanr: Some("987654321".into()),
            practice_bsnr: Some("123456789".into()),
            bank_details: Some(vec![
                "IBAN: DE89 3704 0044 0532 0130 00".into(),
                "BIC: COBADEFFXXX".into(),
                "Bank: Commerzbank Berlin".into(),
            ]),
            payment_terms_text: Some("Payable within 14 days with no deduction.".into()),
            vat_notice: Some("VAT-exempt under § 4 No. 14 UStG".into()),
            logo: None,
            locale: "en".into(),
            rtl: false,
        }
    }

    #[test]
    fn renders_goz_compliant_invoice() {
        let inv = dummy_invoice();
        let pdf = render(&inv).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
        assert!(pdf.ends_with(b"%%EOF\n"));

        // Look for required fields (either as Latin-1 text or as
        // bytes — Helvetica WinAnsi values are all 7-bit ASCII).
        let text = String::from_utf8_lossy(&pdf);
        for needle in [
            "Invoice",
            "BSNR",
            "ZANR",
            "IBAN",
            "GOZ",
            "Factor",
            "Amount due",
            "Payable",
        ] {
            assert!(text.contains(needle), "missing: {needle}");
        }
    }

    #[test]
    fn renders_minimal_invoice_without_optional_fields() {
        let inv = Invoice {
            number: "RE-MIN-001".into(),
            date: "2026-04-19".into(),
            recipient_name: "Min Patient".into(),
            recipient_address: vec!["X-Straße 1".into(), "12345 Ort".into()],
            practice_name: "Min Practice".into(),
            practice_address: vec!["Y-Straße 2".into(), "12345 Ort".into()],
            lines: vec![InvoiceLine::simple("Kontrolle", 4500)],
            ..Default::default()
        };
        let pdf = render(&inv).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
        assert!(pdf.ends_with(b"%%EOF\n"));
    }

    #[test]
    fn invoice_with_high_factor_emits_reason() {
        let mut inv = dummy_invoice();
        inv.lines[0].factor = Some(3.5);
        inv.lines[0].diagnosis_reason =
            Some("Difficult access, complex multi-surface trauma.".into());
        let pdf = render(&inv).unwrap();
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("Justification") || text.contains("Note"));
    }

    #[test]
    fn renders_chart_with_header_context() {
        let blocks = vec![
            ChartPdfBlock::kv(
                "MasterData",
                vec![
                    ("Name".into(), "Max Sample".into()),
                    ("Geb.-Dat.".into(), "01.01.1980".into()),
                ],
            ),
            ChartPdfBlock::body(
                "Diagnosis",
                vec!["Caries on tooth 36, checkup tooth 26.".into()],
            ),
        ];
        let header = ChartHeaderContext {
            practice_lines: vec!["Test-Practice".into(), "Test-Straße 1".into()],
            clinician_name: Some("Dr. Test".into()),
            created_by: Some("Reception".into()),
            document_id: Some("AKT-001".into()),
            ..Default::default()
        };
        let pdf = render_chart_blocks(
            "PatientChart",
            "19.04.2026 14:30",
            "Chart Max Sample",
            &blocks,
            Some(&header),
        )
        .unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("Test-Practice") || text.contains("Practice"));
        assert!(text.contains("Privacy") || text.contains("Daten"));
    }

    #[test]
    fn renders_chart_without_header_context() {
        let blocks = vec![ChartPdfBlock::body(
            "Note",
            vec!["No practice header.".into()],
        )];
        let pdf = render_chart_blocks("Chart", "date", "Titel", &blocks, None).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
    }

    #[test]
    fn chart_table_renders_zebra() {
        let blocks = vec![ChartPdfBlock::table(
            "Treatments",
            ChartPdfTable {
                headers: vec!["Date".into(), "ServiceItem".into(), "EUR".into()],
                rows: vec![
                    vec!["01.04.".into(), "Composite".into(), "56,70 €".into()],
                    vec!["08.04.".into(), "Recall".into(), "45,00 €".into()],
                    vec!["15.04.".into(), "PZR".into(), "85,00 €".into()],
                ],
                ..Default::default()
            },
        )];
        let pdf = render_chart_blocks("Chart", "date", "Title", &blocks, None).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
    }

    #[test]
    fn template_preview_fallback_works() {
        let pdf = render_template_preview_pdf(
            "receipt",
            "Standard template",
            "Kind regards",
            11,
            &["Line 1".into(), "Line 2".into()],
            None,
        )
        .unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
    }

    #[test]
    fn renders_financial_report_with_summary_and_table() {
        let input = ReportPdfInput {
            doc_title: "Income report".into(),
            generated_at: "26.05.2026".into(),
            practice_name: "Dental practice North".into(),
            practice_address: vec!["Main Street 1".into(), "10115 Berlin".into()],
            summary: vec![ReportPdfSummaryRow {
                label: "Income (current month)".into(),
                value: "12.450,00 €".into(),
            }],
            sections: vec![ReportPdfSection {
                title: "Income by month".into(),
                headers: vec!["Month".into(), "Amount".into()],
                rows: vec![
                    vec!["2026-04".into(), "10.200,00".into()],
                    vec!["2026-05".into(), "12.450,00".into()],
                ],
            }],
        };
        let pdf = render_report_pdf(&input).unwrap();
        let text = String::from_utf8_lossy(&pdf);
        assert!(pdf.starts_with(b"%PDF-1.4"));
        for needle in [
            "Income report",
            "Summary",
            "Income by month",
            "Page",
        ] {
            assert!(text.contains(needle), "missing {needle}");
        }
    }
}
