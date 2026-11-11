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
    emit_pdf_document, pdf_locale, sanitize_pdf_money, table_row_height, text_width, truncate_cell,
    wrap_text, PageBuilder, PdfDocMeta, CONTENT_WIDTH, M_BOTTOM, M_LEFT, M_RIGHT,
};
use super::letterhead::{emit_continuation_header_locale, emit_letterhead, Letterhead, MetaRow};
use super::logo::PdfLogo;

// ===========================================================================
// INVOICE — moved to `invoice_goz.rs` (Anlage 2 GOZ structure, German).
// ===========================================================================

pub use super::invoice_goz::{
    fmt_amount, render_goz_invoice, FeeSchedule, Invoice, InvoiceKind, InvoiceLine,
};

/// Render an invoice. Kept as `render` for existing call sites.
pub fn render(invoice: &Invoice) -> Result<Vec<u8>, AppError> {
    render_goz_invoice(invoice)
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
    /// "ENTWURF" for previews (not registered, not audited as export).
    pub watermark: Option<String>,
    /// DIN footer lines (practice identity).
    pub footer_lines: Vec<String>,
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
            locale: "de".into(),
            rtl: false,
            watermark: None,
            footer_lines: Vec::new(),
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
    let locale = pdf_locale(header.map(|h| h.locale.as_str()).unwrap_or("de"));
    pb.locale = locale;
    pb.rtl = locale == "ar" || header.is_some_and(|h| h.rtl);
    let de = locale == "de";
    if let Some(h) = header {
        pb.watermark = h.watermark.clone();
        pb.footer_lines = h.footer_lines.clone();
    }

    // ---------- Header -----------------------------------------------------
    if let Some(h) = header.filter(|h| !h.practice_lines.is_empty()) {
        let mut meta = Vec::new();
        if let Some(id) = h.document_id.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new(
                if de { "Dokument-Nr." } else { "Document no." },
                id,
            ));
        }
        meta.push(MetaRow::new(
            if de { "Erstellt am" } else { "Created" },
            generated_at,
        ));
        if let Some(by) = h.created_by.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new(
                if de { "Erstellt von" } else { "Created by" },
                by,
            ));
        }
        if let Some(b) = h.clinician_name.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new(
                if de { "Behandler/in" } else { "Clinician" },
                b,
            ));
        }

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
        let created = if de { "Erstellt am" } else { "Created" };
        pb.text(M_LEFT, 9, false, &format!("{created}: {generated_at}"));
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
    pb.set_continuation(&practice_name, doc_title, locale);

    if blocks.is_empty() {
        let empty = if de {
            "(Keine Inhalte für diesen Export.)"
        } else {
            "(No content for this export.)"
        };
        pb.text(M_LEFT, 10, false, empty);
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
        pb.text(
            M_LEFT,
            8,
            true,
            if de {
                "Datenschutzhinweis"
            } else {
                "Privacy notice"
            },
        );
        pb.advance(11);
        let notice = if de {
            "Dieses Dokument enthält vertrauliche Patientendaten (§ 630f BGB, Art. 9 DSGVO). \
             Weitergabe nur mit ausdrücklicher Einwilligung der Patientin bzw. des Patienten."
        } else {
            "This document contains confidential patient data (§ 630f BGB, Art. 9 GDPR). \
             Disclosure only with the patient's explicit consent."
        };
        pb.paragraph(notice, 8, 120, 0);
    }

    let pages = pb.finish();
    {
        let images: Vec<PdfLogo> = header.and_then(|h| h.logo.clone()).into_iter().collect();
        emit_pdf_document(
            &pages,
            &PdfDocMeta {
                title: pdf_title_meta.to_string(),
                subject: header.and_then(|h| h.document_id.clone()),
                author: header.and_then(|h| h.practice_lines.first().cloned()),
                locale: locale.to_string(),
            },
            &images,
        )
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
        emit_continuation_header_locale(pb, practice_name, doc_title, pb.locale);
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
                    emit_continuation_header_locale(pb, practice_name, doc_title, pb.locale);
                }
                pb.text(M_LEFT, 10, false, &chunk);
                pb.advance(12);
            }
        }
        wrote_any = true;
    }

    if !wrote_any {
        let none = if pb.locale == "de" {
            "(keine Einträge)"
        } else {
            "(no entries)"
        };
        pb.text(M_LEFT, 10, false, none);
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
    let display =
        sanitize_pdf_money(&crate::infrastructure::clinical_text_format::plain_text_for_pdf(value));
    let label = format!("{key}:");
    let label_w = text_width(&label, 9, true);
    // Long labels (e.g. "Income (current calendar month)") must not collide with values.
    let value_x = M_LEFT + label_w + 14;
    let fits_one_line = !display.contains('\n')
        && value_x + text_width(&display, 10, false) <= M_RIGHT
        && label_w <= 240;

    if pb.y < M_BOTTOM + 30 {
        pb.break_page();
        emit_continuation_header_locale(pb, practice_name, doc_title, pb.locale);
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
                emit_continuation_header_locale(pb, practice_name, doc_title, pb.locale);
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

/// Usable width (pt) per column (cell padding subtracted).
fn chart_table_column_pt_widths(col_xs: &[i32]) -> Vec<i32> {
    let mut w = Vec::with_capacity(col_xs.len());
    for i in 0..col_xs.len() {
        let next = col_xs.get(i + 1).copied().unwrap_or(M_RIGHT);
        w.push((next - col_xs[i] - 2 * CHART_CELL_PAD).max(20));
    }
    w
}

fn is_amount_header(h: &str) -> bool {
    let l = h.to_ascii_lowercase();
    l.contains("amount")
        || l.contains("betrag")
        || l.contains("total")
        || l.contains("eur")
        || l.contains("einnahme")
        || l.contains("ausgabe")
        || l.contains("bestand")
        || l.contains("balance")
}

const CHART_CELL_PAD: i32 = 6;

fn emit_chart_table_header_row(
    pb: &mut PageBuilder,
    tbl: &ChartPdfTable,
    col_xs: &[i32],
    col_widths: &[i32],
) {
    pb.table_header_band(M_LEFT, pb.y + 2, CONTENT_WIDTH);
    for ci in 0..tbl.headers.len().max(1) {
        let h = tbl.headers.get(ci).map(|s| s.as_str()).unwrap_or("");
        let max_pt = col_widths.get(ci).copied().unwrap_or(60);
        let x = col_xs.get(ci).copied().unwrap_or(M_LEFT);
        let next = col_xs.get(ci + 1).copied().unwrap_or(M_RIGHT);
        let n = super::metrics::fit_chars(h, 9, true, f64::from(max_pt));
        let text = truncate_cell(h, n.max(3));
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

fn emit_chart_table(
    pb: &mut PageBuilder,
    tbl: &ChartPdfTable,
    practice_name: &str,
    doc_title: &str,
) {
    let ncol = tbl
        .headers
        .len()
        .max(tbl.rows.iter().map(|r| r.len()).max().unwrap_or(0))
        .max(1);
    let col_xs = chart_table_column_xs(ncol, tbl.column_weights.as_deref());
    let col_widths = chart_table_column_pt_widths(&col_xs);

    if pb.y < M_BOTTOM + 60 {
        pb.break_page();
        emit_continuation_header_locale(pb, practice_name, doc_title, pb.locale);
    }

    emit_chart_table_header_row(pb, tbl, &col_xs, &col_widths);

    if tbl.rows.is_empty() {
        let none = super::i18n::t(pb.locale, super::i18n::Phrase::NoTableRows);
        pb.text(M_LEFT + CHART_CELL_PAD, 9, false, none);
        pb.advance(12);
        return;
    }

    for (ri, row) in tbl.rows.iter().enumerate() {
        let mut wrapped: Vec<Vec<String>> = Vec::with_capacity(ncol);
        let mut row_lines = 1usize;
        for ci in 0..ncol {
            let cell = row.get(ci).map(|s| s.as_str()).unwrap_or("");
            let safe = sanitize_pdf_money(cell);
            let max_pt = col_widths.get(ci).copied().unwrap_or(60);
            let w = super::metrics::wrap_to_width(&safe, 9, false, f64::from(max_pt));
            row_lines = row_lines.max(w.len().max(1));
            wrapped.push(w);
        }

        let font_size = 9;
        let line_step = 12;
        let row_height = table_row_height(row_lines, line_step, font_size);
        if pb.y < M_BOTTOM + row_height + 20 {
            pb.break_page();
            emit_continuation_header_locale(pb, practice_name, doc_title, pb.locale);
            emit_chart_table_header_row(pb, tbl, &col_xs, &col_widths);
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
                ("Insurance no.".into(), doc.patient_insurance_number.clone()),
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
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfSummaryRow {
    pub label: String,
    pub value: String,
}

/// Tabular section (same table primitive as PatientChart).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfSection {
    pub title: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    /// Relative column widths (e.g. `[2, 5, 2, 2, 2, 2]`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column_weights: Option<Vec<i32>>,
}

/// Structured input for practice reports (Income, Statistics, BalanceSheet).
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfInput {
    pub doc_title: String,
    pub generated_at: String,
    pub practice_name: String,
    pub practice_address: Vec<String>,
    pub summary: Vec<ReportPdfSummaryRow>,
    pub sections: Vec<ReportPdfSection>,
    /// Which report this is — decides the permission the command requires:
    /// `finance` (default) | `statistics` | `audit` | `compliance` | `daily_report`.
    #[serde(default)]
    pub report_kind: Option<String>,
    /// Document language (`de` default).
    #[serde(default)]
    pub locale: Option<String>,
    /// Registry number (set by the backend when the report is issued).
    #[serde(default)]
    pub document_number: Option<String>,
    /// "ENTWURF" for previews.
    #[serde(default)]
    pub watermark: Option<String>,
    /// Signature lines printed at the end ("Kassierer/in", "Geprüft").
    #[serde(default)]
    pub signatures: Vec<String>,
    /// DIN footer (practice, tax, bank). The server fills this from the practice profile.
    #[serde(default)]
    pub footer_lines: Vec<String>,
    /// Practice logo from Settings. Left out of the stored payload.
    #[serde(skip)]
    pub logo: Option<PdfLogo>,
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
            locale: pdf_locale(input.locale.as_deref().unwrap_or("de")).into(),
            document_id: input.document_number.clone(),
            watermark: input.watermark.clone(),
            footer_lines: input.footer_lines.clone(),
            logo: input.logo.clone(),
            ..Default::default()
        })
    };
    let de = pdf_locale(input.locale.as_deref().unwrap_or("de")) == "de";

    let mut blocks: Vec<ChartPdfBlock> = Vec::new();
    if !input.summary.is_empty() {
        blocks.push(ChartPdfBlock::kv(
            if de { "Zusammenfassung" } else { "Summary" },
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
        if let Some(w) = sec.column_weights.clone().filter(|w| w.len() == sec.headers.len()) {
            table = table.with_column_weights(w);
        } else if sec.headers.len() == 2 {
            table = table.with_column_weights(vec![3, 2]);
        }
        blocks.push(ChartPdfBlock::table(&sec.title, table));
    }
    if !input.signatures.is_empty() {
        // Blank line to sign on, label underneath (paper copy for the file).
        let mut lines = Vec::new();
        for s in &input.signatures {
            lines.push("______________________________________".into());
            lines.push(s.clone());
        }
        blocks.push(ChartPdfBlock::body(
            if de { "Bestätigung" } else { "Confirmation" },
            lines,
        ));
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

    super::clinical_layout::render_plain_preview(kind, template_name, footer, body_pt, body_lines)
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

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
                column_weights: None,
            }],
            report_kind: None,
            locale: Some("en".into()),
            document_number: None,
            watermark: None,
            signatures: Vec::new(),
            footer_lines: vec!["Sparkasse · IBAN DE00 · BIC TEST".into()],
            logo: None,
        };
        let pdf = render_report_pdf(&input).unwrap();
        let text = String::from_utf8_lossy(&pdf);
        assert!(pdf.starts_with(b"%PDF-1.4"));
        for needle in [
            "Income report",
            "Summary",
            "Income by month",
            "Page",
            "IBAN DE00",
        ] {
            assert!(text.contains(needle), "missing {needle}");
        }
    }
}
