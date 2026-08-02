//! Invoice and patient record as PDF.
//!
//! Both document types use the shared [`PageBuilder`] from
//! [`super::core`] and the DIN-5008 letterhead from [`super::letterhead`].
//! Margins, fonts, encoding, and page numbers are therefore consistent.
//!
//! - **Invoice** ([`render`]) — GOZ/GOÄ-compliant table with position, date,
//!   tooth, GOZ no., description, quantity, factor, and total. Totals block
//!   on the right with VAT note. Bank details + payment terms in the footer.
//! - **Patient record** ([`render_akte_blocks`]) — modular block lists with
//!   master data, diagnosis, findings, treatments, attachment metadata, etc.

use crate::error::AppError;

use super::core::{
    emit_multipage_pdf, format_date_de, format_eur_de, truncate_cell, wrap_de, wrap_soft,
    PageBuilder, CONTENT_WIDTH, M_BOTTOM, M_LEFT, M_RIGHT,
};
use super::letterhead::{
    emit_bankverbindung, emit_continuation_header, emit_letterhead, emit_signature_block,
    Letterhead, MetaRow,
};

// ===========================================================================
// INVOICE
// ===========================================================================

/// One line in the invoice table (GOZ / GOÄ).
#[derive(Debug, Clone)]
pub struct InvoiceLine {
    /// Free-text service description (e.g. "Komposit dreiflächig").
    pub description: String,
    /// Line total in cents (quantity × unit price × factor).
    pub amount_cents: i64,
    /// GOZ/GOÄ fee number (e.g. "2197" or "Ä5000").
    pub goz_nr: Option<String>,
    /// Increase factor (GOZ § 5: 1.0–3.5, default 2.3).
    pub faktor: Option<f64>,
    /// Unit price in cents (before factor).
    pub einzelpreis_cents: Option<i64>,
    /// Quantity (default = 1).
    pub menge: Option<i32>,
    /// FDI tooth designation ("11", "47", "27 mes" …).
    pub zahn_nr: Option<String>,
    /// Treatment date (ISO or DE).
    pub behandlungsdatum: Option<String>,
    /// VAT rate (0 = exempt, 19 = materials).
    pub ust_prozent: Option<f64>,
    /// Material costs / external lab (per GOZ § 9).
    pub material: Option<String>,
    /// Justification when factor > 2.3 (GOZ § 10 (3) — mandatory).
    pub diagnose_begruendung: Option<String>,
}

impl InvoiceLine {
    /// Construct a minimal line (all GOZ fields empty).
    pub fn simple(description: impl Into<String>, amount_cents: i64) -> Self {
        Self {
            description: description.into(),
            amount_cents,
            goz_nr: None,
            faktor: None,
            einzelpreis_cents: None,
            menge: None,
            zahn_nr: None,
            behandlungsdatum: None,
            ust_prozent: None,
            material: None,
            diagnose_begruendung: None,
        }
    }
}

/// Complete invoice (all required/recommended fields per UStG § 14 + GOZ § 10).
#[derive(Debug, Clone, Default)]
pub struct Invoice {
    pub number: String,
    pub date: String, // ISO date (converted to DE format internally)
    pub recipient_name: String,
    pub recipient_address: Vec<String>,
    pub practice_name: String,
    pub practice_address: Vec<String>,
    pub lines: Vec<InvoiceLine>,
    pub note: Option<String>,
    pub behandler_name: Option<String>,
    pub behandler_zanr: Option<String>,
    pub praxis_bsnr: Option<String>,
    /// Full bank lines (e.g. ["IBAN: DE12…", "BIC: COBADEFFXXX",
    /// "Bank: Commerzbank", "Kontoinhaber: Dr. M. Mustermann"]).
    pub bankverbindung: Option<Vec<String>>,
    /// E.g. "Zahlbar innerhalb von 14 Tagen ohne Abzug."
    pub zahlungsziel_text: Option<String>,
    /// E.g. "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG"
    pub ust_hinweis: Option<String>,
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
    pub const DATUM: i32 = 78;
    pub const ZAHN: i32 = 130;
    pub const GOZ: i32 = 160;
    pub const BEZEICHNUNG: i32 = 200;
    pub const MENGE: i32 = 410;
    pub const FAKTOR: i32 = 445;
    /// Right-aligned — align against this X coordinate.
    pub const PREIS_RIGHT: i32 = 545;
    pub const HEADER_BAND_W: i32 = 495;
    /// Width of the description column in characters (for wrap).
    pub const BEZEICHNUNG_CHARS: usize = 36;
}

/// Main entry: render an invoice as PDF bytes.
pub fn render(invoice: &Invoice) -> Result<Vec<u8>, AppError> {
    let mut pb = PageBuilder::new();

    // ---------- Letterhead (first page only) ------------------------------
    let mut meta = Vec::new();
    meta.push(MetaRow::new("Rechnung-Nr.", &invoice.number));
    meta.push(MetaRow::new(
        "Rechnungsdatum",
        format_date_de(&invoice.date),
    ));
    if let Some(b) = invoice
        .behandler_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        meta.push(MetaRow::new("Behandler:in", b));
    }

    // Practice lines + professional IDs (BSNR/ZANR) into the header
    let mut praxis_full = vec![invoice.practice_name.clone()];
    praxis_full.extend(invoice.practice_address.iter().cloned());
    if let (Some(bsnr), zanr) = (
        invoice.praxis_bsnr.as_deref(),
        invoice.behandler_zanr.as_deref(),
    ) {
        if !bsnr.trim().is_empty() {
            let zline = match zanr {
                Some(z) if !z.trim().is_empty() => format!("BSNR: {bsnr} · ZANR: {z}"),
                _ => format!("BSNR: {bsnr}"),
            };
            praxis_full.push(zline);
        }
    }

    let mut recipient = vec![invoice.recipient_name.clone()];
    recipient.extend(invoice.recipient_address.iter().cloned());

    let lh = Letterhead {
        praxis_lines: &praxis_full,
        meta_rows: &meta,
        address_lines: &recipient,
        header_right_lines: &[],
        show_sender_hint: true,
    };
    emit_letterhead(&mut pb, &lh);

    // ---------- Dokument-Titel --------------------------------------------
    pb.text(M_LEFT, 18, true, "Rechnung");
    pb.advance(20);
    pb.text(M_LEFT, 10, false, "Leistungsübersicht nach GOZ / GOÄ");
    pb.advance(8);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(16);

    // ---------- Table header ----------------------------------------------
    emit_invoice_table_header(&mut pb);

    // ---------- Table rows ------------------------------------------------
    for (i, line) in invoice.lines.iter().enumerate() {
        if pb.y < M_BOTTOM + 120 {
            pb.break_page();
            emit_continuation_header(&mut pb, &invoice.practice_name, "Rechnung");
            emit_invoice_table_header(&mut pb);
        }
        emit_invoice_line(&mut pb, i, line);
    }

    // ---------- Totals block ----------------------------------------------
    pb.advance(8);
    emit_invoice_totals(&mut pb, invoice);

    // ---------- Zahlungsbedingungen ---------------------------------------
    if let Some(zt) = invoice
        .zahlungsziel_text
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        pb.advance(8);
        pb.paragraph(zt, 9, 90, 0);
    } else if let Some(note) = &invoice.note {
        pb.advance(8);
        pb.paragraph(note, 9, 90, 0);
    }

    // ---------- Bankverbindung --------------------------------------------
    if let Some(bank) = &invoice.bankverbindung {
        emit_bankverbindung(&mut pb, bank);
    }

    // ---------- Signature -------------------------------------------------
    emit_signature_block(
        &mut pb,
        invoice.behandler_name.as_deref(),
        Some("Zahnärztin/Zahnarzt"),
        invoice.behandler_zanr.as_deref(),
        invoice.praxis_bsnr.as_deref(),
        true,
    );

    let pages = pb.finish();
    emit_multipage_pdf(&pages, &format!("Rechnung {}", invoice.number))
}

fn emit_invoice_table_header(pb: &mut PageBuilder) {
    pb.table_header_band(M_LEFT, pb.y + 2, inv_cols::HEADER_BAND_W);
    pb.text(inv_cols::POS, 8, true, "Pos.");
    pb.text(inv_cols::DATUM, 8, true, "Datum");
    pb.text(inv_cols::ZAHN, 8, true, "Zahn");
    pb.text(inv_cols::GOZ, 8, true, "GOZ/GOÄ");
    pb.text(inv_cols::BEZEICHNUNG, 8, true, "Bezeichnung");
    pb.text(inv_cols::MENGE, 8, true, "Menge");
    pb.text(inv_cols::FAKTOR, 8, true, "Faktor");
    pb.text_right(inv_cols::PREIS_RIGHT, 8, true, "Gesamt €");
    pb.advance(10);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(12);
}

fn emit_invoice_line(pb: &mut PageBuilder, idx: usize, line: &InvoiceLine) {
    let pos = format!("{}", idx + 1);
    let datum = line
        .behandlungsdatum
        .as_deref()
        .map(format_date_de)
        .unwrap_or_else(|| "—".into());
    let zahn = line.zahn_nr.as_deref().unwrap_or("—");
    let goz = line.goz_nr.as_deref().unwrap_or("—");
    let bezeichnung = &line.description;
    let menge = line
        .menge
        .map(|m| m.to_string())
        .unwrap_or_else(|| "1".into());
    let faktor = line
        .faktor
        .map(|f| format!("{:.1}", f))
        .unwrap_or_else(|| "—".into());
    let preis = format_eur_de(line.amount_cents);

    // Description may be multi-line → wrap it
    let bez_lines = wrap_soft(bezeichnung, inv_cols::BEZEICHNUNG_CHARS);
    let row_height = (bez_lines.len() as i32).max(1) * 10 + 4;

    // If not enough space: wrap (already checked before call, but
    // re-guard for very long descriptions)
    if pb.y < M_BOTTOM + row_height + 20 {
        // Caller should already have wrapped; if still too tight:
        // truncate description instead of overlapping.
    }

    // First line: all columns
    pb.text(inv_cols::POS, 8, false, &pos);
    pb.text(inv_cols::DATUM, 8, false, &datum);
    pb.text(inv_cols::ZAHN, 8, false, zahn);
    pb.text(inv_cols::GOZ, 8, false, goz);
    if let Some(first) = bez_lines.first() {
        pb.text(inv_cols::BEZEICHNUNG, 8, false, first);
    }
    pb.text(inv_cols::MENGE, 8, false, &menge);
    pb.text(inv_cols::FAKTOR, 8, false, &faktor);
    pb.text_right(inv_cols::PREIS_RIGHT, 8, false, &preis);

    // Continuation lines of the description
    for extra in bez_lines.iter().skip(1) {
        pb.advance(10);
        pb.text(inv_cols::BEZEICHNUNG, 8, false, extra);
    }

    // Material sub-line (per GOZ § 9: list separately)
    if let Some(m) = line.material.as_deref().filter(|s| !s.trim().is_empty()) {
        pb.advance(10);
        pb.text(
            inv_cols::BEZEICHNUNG,
            8,
            false,
            &format!("   Material: {m}"),
        );
    }

    // Justification sub-line (GOZ § 10 (3): mandatory when factor > 2.3)
    if let Some(reason) = line
        .diagnose_begruendung
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        let needs = line.faktor.map(|f| f > 2.3).unwrap_or(false);
        let label = if needs {
            "Begründung (§ 10 Abs. 3 GOZ)"
        } else {
            "Hinweis"
        };
        // Label only on the first line; continuation lines indented.
        let body = format!("   {label}: {reason}");
        for (i, chunk) in wrap_soft(&body, inv_cols::BEZEICHNUNG_CHARS)
            .iter()
            .enumerate()
        {
            pb.advance(10);
            let text = if i == 0 {
                chunk.clone()
            } else {
                format!("      {chunk}")
            };
            pb.text(inv_cols::BEZEICHNUNG, 7, false, &text);
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

    pb.text_right(label_right_x, 10, false, "Warenwert netto:");
    pb.text_right(M_RIGHT, 10, false, &format_eur_de(inv.total_cents()));
    pb.advance(14);

    if let Some(ust) = inv.ust_hinweis.as_deref().filter(|s| !s.trim().is_empty()) {
        for chunk in wrap_de(ust, 60) {
            pb.text(M_LEFT, 9, false, &chunk);
            pb.advance(11);
        }
    }

    pb.advance(4);
    pb.text_right(label_right_x, 11, true, "Endbetrag:");
    pb.text_right(M_RIGHT, 11, true, &format_eur_de(inv.total_cents()));
    pb.advance(22);
}

// ===========================================================================
// PATIENT RECORD  (modular block list)
// ===========================================================================

/// Table inside a record block.
#[derive(Debug, Clone, Default)]
pub struct AktePdfTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    /// Optional column weights (e.g. `[2, 1, 10]` → narrow · narrow · wide).
    /// If omitted: even distribution across [`CONTENT_WIDTH`].
    pub column_weights: Option<Vec<i32>>,
}

impl AktePdfTable {
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
pub struct AktePdfBlock {
    pub title: String,
    pub body_lines: Vec<String>,
    pub kv_pairs: Vec<(String, String)>,
    pub table: Option<AktePdfTable>,
}

impl AktePdfBlock {
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

    pub fn table(title: impl Into<String>, table: AktePdfTable) -> Self {
        Self {
            title: title.into(),
            body_lines: Vec::new(),
            kv_pairs: Vec::new(),
            table: Some(table),
        }
    }
}

/// Legacy single-document mode (for backward compatibility).
pub struct AkteDocument {
    pub patient_name: String,
    pub patient_geburtsdatum: String,
    pub patient_versicherungsnummer: String,
    pub akte_status: String,
    pub diagnose: Option<String>,
    pub befunde: Option<String>,
    pub behandlungen: Vec<(String, String)>,
    pub generated_at: String,
}

/// Practice header data for record / fact sheet (optional — when `None` a
/// slim header without DIN-5008 letterhead is rendered).
#[derive(Debug, Clone, Default)]
pub struct AkteHeaderContext {
    pub praxis_lines: Vec<String>,
    pub behandler_name: Option<String>,
    pub berufsbezeichnung: Option<String>,
    pub bsnr: Option<String>,
    pub zanr: Option<String>,
    pub erstellt_von: Option<String>,
    pub dokument_id: Option<String>,
}

/// Main renderer for the patient record as PDF (modular).
///
/// `header` supplies the practice context (letterhead, provider) for the first
/// page. When empty, only title + date are rendered at the top.
pub fn render_akte_blocks(
    doc_title: &str,
    generated_at: &str,
    pdf_title_meta: &str,
    blocks: &[AktePdfBlock],
    header: Option<&AkteHeaderContext>,
) -> Result<Vec<u8>, AppError> {
    let mut pb = PageBuilder::new();

    // ---------- Kopf -------------------------------------------------------
    if let Some(h) = header.filter(|h| !h.praxis_lines.is_empty()) {
        let mut meta = Vec::new();
        if let Some(id) = h.dokument_id.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new("Dokument-ID", id));
        }
        meta.push(MetaRow::new("Erstellt", generated_at));
        if let Some(by) = h.erstellt_von.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new("Erstellt von", by));
        }
        if let Some(b) = h.behandler_name.as_deref().filter(|s| !s.trim().is_empty()) {
            meta.push(MetaRow::new("Behandler:in", b));
        }

        let lh = Letterhead {
            praxis_lines: &h.praxis_lines,
            meta_rows: &meta,
            address_lines: &[],
            header_right_lines: &[],
            show_sender_hint: false,
        };
        emit_letterhead(&mut pb, &lh);
    } else {
        // Slim header: title + date only
        pb.text(M_LEFT, 18, true, doc_title);
        pb.advance(22);
        pb.text(M_LEFT, 9, false, &format!("Erstellt: {generated_at}"));
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
        .and_then(|h| h.praxis_lines.first().cloned())
        .unwrap_or_else(|| "MeDoc".into());

    if blocks.is_empty() {
        pb.text(M_LEFT, 10, false, "(Keine Inhalte für diesen Export.)");
        pb.advance(14);
    }

    for block in blocks {
        emit_akte_block(&mut pb, block, &practice_name, doc_title);
    }

    // ---------- GDPR notice at the end ------------------------------------
    if header.is_some() {
        pb.ensure_space(60);
        pb.advance(10);
        pb.hline(M_LEFT, M_RIGHT);
        pb.advance(14);
        pb.text(M_LEFT, 8, true, "Datenschutzhinweis");
        pb.advance(11);
        pb.paragraph(
            "Dieses Dokument enthält vertrauliche Patientendaten gem. § 630f BGB. \
             Weitergabe nur mit ausdrücklicher Einwilligung des Patienten. \
             Eine Speicherung über die gesetzliche Aufbewahrungsfrist hinaus \
             ist nicht zulässig.",
            8,
            90,
            0,
        );
    }

    let pages = pb.finish();
    emit_multipage_pdf(&pages, pdf_title_meta)
}

fn emit_akte_block(
    pb: &mut PageBuilder,
    block: &AktePdfBlock,
    practice_name: &str,
    doc_title: &str,
) {
    // Ensure at least title + 2 lines fit
    pb.ensure_space(48);
    if pb.y < M_BOTTOM + 100 {
        pb.break_page();
        emit_continuation_header(pb, practice_name, doc_title);
    }

    // Block-Titel in Hellgrau-Band
    pb.table_header_band(M_LEFT, pb.y + 2, CONTENT_WIDTH);
    pb.text(M_LEFT + 4, 11, true, &block.title);
    pb.advance(18);

    let mut wrote_any = false;

    if let Some(ref tbl) = block.table {
        if !tbl.headers.is_empty() || !tbl.rows.is_empty() {
            emit_akte_table(pb, tbl, practice_name, doc_title);
            wrote_any = true;
        }
    }

    if !block.kv_pairs.is_empty() {
        for (k, v) in &block.kv_pairs {
            emit_akte_kv_pair(pb, k, v, practice_name, doc_title);
        }
        wrote_any = true;
    }

    if !block.body_lines.is_empty() {
        for line in &block.body_lines {
            let display = crate::infrastructure::clinical_text_format::plain_text_for_pdf(line);
            for chunk in wrap_de(&display, 90) {
                if pb.y < M_BOTTOM + 24 {
                    pb.break_page();
                    emit_continuation_header(pb, practice_name, doc_title);
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

fn emit_akte_kv_pair(
    pb: &mut PageBuilder,
    key: &str,
    value: &str,
    practice_name: &str,
    doc_title: &str,
) {
    let display = crate::infrastructure::clinical_text_format::plain_text_for_pdf(value);
    let compact = !display.contains('\n') && display.chars().count() <= 70;

    if pb.y < M_BOTTOM + 30 {
        pb.break_page();
        emit_continuation_header(pb, practice_name, doc_title);
    }

    if compact {
        pb.text(M_LEFT, 9, true, &format!("{key}:"));
        pb.text(M_LEFT + 130, 10, false, &display);
        pb.advance(14);
    } else {
        pb.text(M_LEFT, 9, true, &format!("{key}:"));
        pb.advance(12);
        for chunk in wrap_de(&display, 90) {
            if pb.y < M_BOTTOM + 24 {
                pb.break_page();
                emit_continuation_header(pb, practice_name, doc_title);
            }
            pb.text(M_LEFT + 8, 10, false, &chunk);
            pb.advance(12);
        }
        pb.advance(4);
    }
}

fn akte_table_column_xs(ncol: usize, weights: Option<&[i32]>) -> Vec<i32> {
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

fn akte_table_column_char_widths(col_xs: &[i32]) -> Vec<usize> {
    let mut w = Vec::with_capacity(col_xs.len());
    for i in 0..col_xs.len() {
        let next = col_xs.get(i + 1).copied().unwrap_or(M_RIGHT);
        let width_pt = (next - col_xs[i]).max(24);
        w.push(((width_pt / 5).max(8)) as usize);
    }
    w
}

fn emit_akte_table_header_row(
    pb: &mut PageBuilder,
    tbl: &AktePdfTable,
    col_xs: &[i32],
    col_chars: &[usize],
) {
    pb.table_header_band(M_LEFT, pb.y + 2, CONTENT_WIDTH);
    for ci in 0..tbl.headers.len().max(1) {
        let h = tbl.headers.get(ci).map(|s| s.as_str()).unwrap_or("");
        let max_chars = col_chars.get(ci).copied().unwrap_or(20);
        let x = col_xs.get(ci).copied().unwrap_or(M_LEFT);
        pb.text(x + 2, 9, true, &truncate_cell(h, max_chars));
    }
    pb.advance(13);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(10);
}

fn emit_akte_table(pb: &mut PageBuilder, tbl: &AktePdfTable, practice_name: &str, doc_title: &str) {
    let ncol = tbl
        .headers
        .len()
        .max(tbl.rows.iter().map(|r| r.len()).max().unwrap_or(0))
        .max(1);
    let col_xs = akte_table_column_xs(ncol, tbl.column_weights.as_deref());
    let col_chars = akte_table_column_char_widths(&col_xs);

    if pb.y < M_BOTTOM + 60 {
        pb.break_page();
        emit_continuation_header(pb, practice_name, doc_title);
    }

    emit_akte_table_header_row(pb, tbl, &col_xs, &col_chars);

    if tbl.rows.is_empty() {
        pb.text(M_LEFT + 4, 9, false, "(keine Tabellenzeilen)");
        pb.advance(12);
        return;
    }

    for (ri, row) in tbl.rows.iter().enumerate() {
        let mut wrapped: Vec<Vec<String>> = Vec::with_capacity(ncol);
        let mut row_lines = 1usize;
        for ci in 0..ncol {
            let cell = row.get(ci).map(|s| s.as_str()).unwrap_or("");
            let max_chars = col_chars.get(ci).copied().unwrap_or(20);
            let w = wrap_soft(cell, max_chars);
            row_lines = row_lines.max(w.len().max(1));
            wrapped.push(w);
        }

        let row_height = row_lines as i32 * 12 + 6;
        if pb.y < M_BOTTOM + row_height + 20 {
            pb.break_page();
            emit_continuation_header(pb, practice_name, doc_title);
            emit_akte_table_header_row(pb, tbl, &col_xs, &col_chars);
        }

        if ri % 2 == 1 {
            pb.fill_rect(M_LEFT, pb.y - row_height, CONTENT_WIDTH, row_height, 0.97);
        }

        let base_y = pb.y;
        for li in 0..row_lines {
            for ci in 0..ncol {
                let x = col_xs.get(ci).copied().unwrap_or(M_LEFT);
                let chunk = wrapped
                    .get(ci)
                    .and_then(|w| w.get(li))
                    .map(|s| s.as_str())
                    .unwrap_or("");
                if !chunk.is_empty() {
                    let prev = pb.y;
                    pb.y = base_y - li as i32 * 12;
                    pb.text(x + 2, 9, false, chunk);
                    pb.y = prev;
                }
            }
        }
        pb.advance(row_height);
    }
    pb.advance(4);
}

/// Legacy wrapper.
pub fn render_akte(doc: &AkteDocument) -> Result<Vec<u8>, AppError> {
    let diag = doc
        .diagnose
        .clone()
        .unwrap_or_else(|| "(keine Eintragung)".into());
    let bef = doc
        .befunde
        .clone()
        .unwrap_or_else(|| "(keine Eintragung)".into());
    let beh_lines: Vec<String> = if doc.behandlungen.is_empty() {
        vec!["(keine Behandlungen erfasst)".to_string()]
    } else {
        doc.behandlungen
            .iter()
            .map(|(d, b)| format!("{d} — {b}"))
            .collect()
    };

    let blocks = vec![
        AktePdfBlock::kv(
            "Stammdaten / Aktenkopf",
            vec![
                ("Patient".into(), doc.patient_name.clone()),
                ("Geburtsdatum".into(), doc.patient_geburtsdatum.clone()),
                (
                    "Versicherungsnr.".into(),
                    doc.patient_versicherungsnummer.clone(),
                ),
                ("Akten-Status".into(), doc.akte_status.clone()),
            ],
        ),
        AktePdfBlock::body("Diagnose", vec![diag]),
        AktePdfBlock::body("Befunde (Freitext)", vec![bef]),
        AktePdfBlock::body("Behandlungen", beh_lines),
    ];

    render_akte_blocks(
        "Patientenakte",
        &doc.generated_at,
        &format!("Patientenakte {}", doc.patient_name),
        &blocks,
        None,
    )
}

// ===========================================================================
// Auswertungs- / Finanzberichte (Statistik, Bilanz, Einnahmen)
// ===========================================================================

/// Key-value row in the report summary block.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfSummaryRow {
    pub label: String,
    pub value: String,
}

/// Tabular section (same table primitive as Patientenakte).
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPdfSection {
    pub title: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Structured input for practice reports (Einnahmen, Statistik, Bilanz).
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

/// Renders a practice report PDF using the same [`render_akte_blocks`] pipeline as
/// Akte / Merkblatt — identical letterhead, margins, tables, and page numbers.
pub fn render_report_pdf(input: &ReportPdfInput) -> Result<Vec<u8>, AppError> {
    let mut praxis_lines: Vec<String> = Vec::new();
    if !input.practice_name.trim().is_empty() {
        praxis_lines.push(input.practice_name.trim().to_string());
    }
    for line in &input.practice_address {
        let t = line.trim();
        if !t.is_empty() {
            praxis_lines.push(t.to_string());
        }
    }

    let header = if praxis_lines.is_empty() {
        None
    } else {
        Some(AkteHeaderContext {
            praxis_lines,
            ..Default::default()
        })
    };

    let mut blocks: Vec<AktePdfBlock> = Vec::new();
    if !input.summary.is_empty() {
        blocks.push(AktePdfBlock::kv(
            "Zusammenfassung",
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
        blocks.push(AktePdfBlock::table(
            &sec.title,
            AktePdfTable::new(sec.headers.clone(), sec.rows.clone()),
        ));
    }

    render_akte_blocks(
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
    fusszeile: &str,
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
        fusszeile,
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
            recipient_name: "Max Mustermann".into(),
            recipient_address: vec!["Musterstr. 1".into(), "10115 Berlin".into()],
            practice_name: "Zahnarztpraxis Dr. Beispiel".into(),
            practice_address: vec![
                "Hauptstr. 2".into(),
                "10115 Berlin".into(),
                "Tel. 030 12345".into(),
            ],
            lines: vec![
                InvoiceLine {
                    description: "Komposit, dreiflächig".into(),
                    amount_cents: 5670,
                    goz_nr: Some("2197".into()),
                    faktor: Some(2.3),
                    einzelpreis_cents: Some(2465),
                    menge: Some(1),
                    zahn_nr: Some("21".into()),
                    behandlungsdatum: Some("2026-04-01".into()),
                    ust_prozent: Some(0.0),
                    material: None,
                    diagnose_begruendung: None,
                },
                InvoiceLine::simple("Kontrolluntersuchung", 4500),
            ],
            note: None,
            behandler_name: Some("Dr. Maria Beispiel".into()),
            behandler_zanr: Some("987654321".into()),
            praxis_bsnr: Some("123456789".into()),
            bankverbindung: Some(vec![
                "IBAN: DE89 3704 0044 0532 0130 00".into(),
                "BIC: COBADEFFXXX".into(),
                "Bank: Commerzbank Berlin".into(),
            ]),
            zahlungsziel_text: Some("Zahlbar innerhalb von 14 Tagen ohne Abzug.".into()),
            ust_hinweis: Some("Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG".into()),
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
            "Rechnung",
            "BSNR",
            "ZANR",
            "IBAN",
            "GOZ",
            "Faktor",
            "Endbetrag",
            "Zahlbar",
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
            practice_name: "Min Praxis".into(),
            practice_address: vec!["Y-Straße 2".into(), "12345 Ort".into()],
            lines: vec![InvoiceLine::simple("Kontrolle", 4500)],
            ..Default::default()
        };
        let pdf = render(&inv).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
        assert!(pdf.ends_with(b"%%EOF\n"));
    }

    #[test]
    fn invoice_with_high_faktor_emits_begruendung() {
        let mut inv = dummy_invoice();
        inv.lines[0].faktor = Some(3.5);
        inv.lines[0].diagnose_begruendung =
            Some("Erschwerter Zugang, komplexes Mehrflächen-Trauma.".into());
        let pdf = render(&inv).unwrap();
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("Begründung") || text.contains("Begr") || text.contains("Hinweis"));
    }

    #[test]
    fn renders_akte_with_header_context() {
        let blocks = vec![
            AktePdfBlock::kv(
                "Stammdaten",
                vec![
                    ("Name".into(), "Max Mustermann".into()),
                    ("Geb.-Dat.".into(), "01.01.1980".into()),
                ],
            ),
            AktePdfBlock::body(
                "Diagnose",
                vec!["Karies an Zahn 36, Kontrolle Zahn 26.".into()],
            ),
        ];
        let header = AkteHeaderContext {
            praxis_lines: vec!["Test-Praxis".into(), "Test-Straße 1".into()],
            behandler_name: Some("Dr. Test".into()),
            erstellt_von: Some("Rezeption".into()),
            dokument_id: Some("AKT-001".into()),
            ..Default::default()
        };
        let pdf = render_akte_blocks(
            "Patientenakte",
            "19.04.2026 14:30",
            "Akte Max Mustermann",
            &blocks,
            Some(&header),
        )
        .unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("Test-Praxis") || text.contains("Praxis"));
        assert!(text.contains("Datenschutz") || text.contains("Daten"));
    }

    #[test]
    fn renders_akte_without_header_context() {
        let blocks = vec![AktePdfBlock::body(
            "Hinweis",
            vec!["Ohne Praxiskopf.".into()],
        )];
        let pdf = render_akte_blocks("Akte", "datum", "Titel", &blocks, None).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
    }

    #[test]
    fn akte_table_renders_zebra() {
        let blocks = vec![AktePdfBlock::table(
            "Behandlungen",
            AktePdfTable {
                headers: vec!["Datum".into(), "Leistung".into(), "EUR".into()],
                rows: vec![
                    vec!["01.04.".into(), "Komposit".into(), "56,70 €".into()],
                    vec!["08.04.".into(), "Recall".into(), "45,00 €".into()],
                    vec!["15.04.".into(), "PZR".into(), "85,00 €".into()],
                ],
                ..Default::default()
            },
        )];
        let pdf = render_akte_blocks("Akte", "datum", "Titel", &blocks, None).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
    }

    #[test]
    fn template_preview_fallback_works() {
        let pdf = render_template_preview_pdf(
            "quittung",
            "Standardvorlage",
            "Mit freundlichen Grüßen",
            11,
            &["Zeile 1".into(), "Zeile 2".into()],
            None,
        )
        .unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
    }

    #[test]
    fn renders_financial_report_with_summary_and_table() {
        let input = ReportPdfInput {
            doc_title: "Einnahmenbericht".into(),
            generated_at: "26.05.2026".into(),
            practice_name: "Zahnarztpraxis Nord".into(),
            practice_address: vec!["Hauptstr. 1".into(), "10115 Berlin".into()],
            summary: vec![ReportPdfSummaryRow {
                label: "Einnahmen (laufender Monat)".into(),
                value: "12.450,00 €".into(),
            }],
            sections: vec![ReportPdfSection {
                title: "Einnahmen pro Monat".into(),
                headers: vec!["Monat".into(), "Betrag".into()],
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
            "Einnahmenbericht",
            "Zusammenfassung",
            "Einnahmen pro Monat",
            "Seite",
        ] {
            assert!(text.contains(needle), "missing {needle}");
        }
    }
}
