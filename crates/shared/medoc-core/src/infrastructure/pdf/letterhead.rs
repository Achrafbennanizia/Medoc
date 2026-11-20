//! DIN-5008-compliant letterhead for all MeDoc documents.
//!
//! Layout (Form A, window-envelope compatible):
//!
//! ```text
//! ┌──────────────────────────────────────────────────────────────────┐
//! │ Practice name (bold, 12 pt)               ┌───────────────────┐ │
//! │ Street                                    │ Meta block:       │ │
//! │ ZIP City                                  │ Invoice no.       │ │
//! │ Tel.                                      │ Date              │ │
//! │ Fax                                       │ Provider          │ │
//! │ E-Mail                                    │ Patient no.       │ │
//! │ Web                                       └───────────────────┘ │
//! │ BSNR                                                              │
//! │ ZANR                                                              │
//! │ ┌─── Practice / Street / ZIP City (7 pt, one line each) ───────┐ │
//! │ │                                                              │ │
//! │ │  Recipient address                                           │ │
//! │ │  (window envelope area, DIN 5008 A, Y 700–572)               │ │
//! │ │                                                              │ │
//! │ └──────────────────────────────────────────────────────────────┘ │
//! │ ───────────────────────────────────────────────────────────────  │
//! │ [Content from Y ≈ 560]                                           │
//! └──────────────────────────────────────────────────────────────────┘
//! ```
//!
//! The letterhead is rendered **once** on the first page; on
//! continuation pages a short **header stub** (practice name + document no.)
//! is used (see [`emit_continuation_header`]).

use super::core::{
    pdf_locale, PageBuilder, ADDRESS_WINDOW_BOTTOM_Y, ADDRESS_WINDOW_Y, CONTENT_START_Y,
    INFO_BLOCK_TOP_Y, INFO_BLOCK_X, LETTERHEAD_MIN_Y, M_LEFT, M_RIGHT, M_TOP, SENDER_HINT_Y,
};
use super::logo::{LogoPlacement, PdfLogo, LOGO_GAP};

/// One row of the meta / information block: "label" + "value".
#[derive(Debug, Clone)]
pub struct MetaRow {
    pub label: String,
    pub value: String,
}

impl MetaRow {
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
        }
    }
}

/// Complete practice letterhead.
#[derive(Debug, Clone, Default)]
pub struct Letterhead<'a> {
    /// First line = practice name (bold); further lines = address, contact,
    /// one field per line in the saved order. A block taller than 45 mm
    /// grows the letterhead and moves the address down with it.
    pub practice_lines: &'a [String],
    /// Contact extras ("Tel: …"). Only used when `meta_rows` is empty.
    pub header_right_lines: &'a [String],
    /// Information block (invoice no., date, clinician, …).
    pub meta_rows: &'a [MetaRow],
    /// Recipient address in the window-envelope area.
    pub address_lines: &'a [String],
    /// Return address above the recipient. Lines already printed in the
    /// practice block are skipped, so the name and address appear once.
    pub show_sender_hint: bool,
    /// Place the address directly below the header (hand-out documents such
    /// as receipts). No fold marks in this mode.
    pub compact_address: bool,
    /// Practice logo from Settings (`practice.logo.v1`).
    pub logo: Option<&'a PdfLogo>,
    /// Arabic (or an explicit flag) mirrors the whole page, right to left.
    pub rtl: bool,
    /// Document language (`de` | `en` | `fr`; anything else → `de`).
    pub locale: &'a str,
}

/// Render the letterhead (DIN 5008 Form B) on the current page and place
/// `pb.y` below it. Returns the new `pb.y`.
///
/// Layout: practice block top-left. When it ends above 45 mm, the return
/// address, the window, and the information block stay on the DIN 5008
/// positions. A taller block keeps every field and moves the address down.
/// Without an address field the information block sits top-right.
pub fn emit_letterhead(pb: &mut PageBuilder, lh: &Letterhead) -> i32 {
    pb.locale = pdf_locale(lh.locale);
    if lh.rtl || super::i18n::is_rtl(pb.locale) {
        pb.rtl = true;
    }
    // One field per line. A payload that still joins "Tel. · email" or
    // "BSNR · ZANR" is split here so every document header matches.
    // Coordinates stay in the Latin layout. `PageBuilder` mirrors them when
    // `rtl` is set, so the logo and the information block are not swapped twice.
    // Each incoming line is one table row. A middle dot already joins the two
    // cells of that row, so it must not be split apart.
    let header_right_lines = split_header_fields(lh.header_right_lines);

    let mut text_left = M_LEFT;
    let mut text_right_cap = if lh.address_lines.is_empty() && !lh.meta_rows.is_empty() {
        INFO_BLOCK_X - 10
    } else {
        M_RIGHT
    };
    let mut left_y = M_TOP;
    if let Some(logo) = lh.logo {
        let x = logo.x_for_side(false);
        let y = logo.y_bottom(M_TOP);
        pb.draw_image(0, x, y, logo.display_w, logo.display_h);
        match logo.placement {
            LogoPlacement::Side => {
                text_left = logo.practice_text_left(false);
                text_right_cap = text_right_cap.min(logo.practice_text_right_cap(false));
            }
            LogoPlacement::Top => {
                left_y = y as i32 - LOGO_GAP;
            }
        }
    }
    let avail_pt = f64::from((text_right_cap - text_left).max(80));

    // --- 1. Practice block ----------------------------------------------------
    // One field per line, in the saved order. A block that still ends above
    // 45 mm keeps the DIN 5008 window. A taller block is printed in full and
    // the address moves down with it; nothing is sent to the footer.
    let rows = compose_letterhead(lh.practice_lines);
    let mut block_bottom = left_y - practice_block_span(&rows, avail_pt);
    if let Some(logo) = lh.logo.filter(|logo| logo.placement == LogoPlacement::Side) {
        block_bottom = block_bottom.min(logo.y_bottom(M_TOP) as i32 - 4);
    }
    let fits_window = block_bottom >= LETTERHEAD_MIN_Y;
    let window_layout = !lh.address_lines.is_empty() && !lh.compact_address && fits_window;
    left_y = emit_practice_rows(pb, &rows, text_left, left_y, avail_pt);
    if let Some(logo) = lh.logo.filter(|logo| logo.placement == LogoPlacement::Side) {
        left_y = left_y.min(logo.y_bottom(M_TOP) as i32 - 4);
    }

    // --- 2. Information block / contact -------------------------------------
    // Beside the name when there is no address window. A DIN window keeps the
    // block at its fixed position. A header that grew past 45 mm places it
    // under the practice lines, with the address.
    let info_beside_name = lh.address_lines.is_empty() || (lh.compact_address && fits_window);
    let mut right_y = M_TOP;
    let mut info_bottom = i32::MAX;
    if info_beside_name {
        if !lh.meta_rows.is_empty() {
            right_y = emit_info_block(pb, lh.meta_rows, INFO_BLOCK_X, M_TOP);
        } else {
            for line in header_right_lines.iter().take(8) {
                pb.y = right_y;
                pb.text_right(M_RIGHT, 9, false, line);
                right_y -= 11;
            }
        }
    }
    let header_bottom = left_y.min(right_y);

    // --- 3. Address -----------------------------------------------------------
    let rule_y;
    if lh.address_lines.is_empty() {
        rule_y = header_bottom - 8;
    } else if window_layout {
        if !lh.meta_rows.is_empty() {
            info_bottom = emit_info_block(pb, lh.meta_rows, INFO_BLOCK_X, INFO_BLOCK_TOP_Y);
        } else {
            let mut y = M_TOP;
            for line in header_right_lines.iter().take(8) {
                pb.y = y;
                pb.text_right(M_RIGHT, 9, false, line);
                y -= 11;
            }
        }
        pb.letter_marks = true;
        if lh.show_sender_hint {
            // Name, street, and city each on their own line (no middot).
            emit_sender_hint_lines(pb, lh.practice_lines, SENDER_HINT_Y, 8);
        }
        emit_address_lines(
            pb,
            lh.address_lines,
            ADDRESS_WINDOW_Y,
            ADDRESS_WINDOW_BOTTOM_Y,
        );
        rule_y = (CONTENT_START_Y + 12).min(info_bottom - 2);
    } else if lh.compact_address && fits_window {
        let mut addr_y = header_bottom - 16;
        if lh.show_sender_hint {
            addr_y = emit_sender_hint_lines(pb, lh.practice_lines, addr_y, 9);
        }
        addr_y = emit_address_lines(pb, lh.address_lines, addr_y, i32::MIN);
        rule_y = addr_y - 8;
    } else {
        let mut block_y = header_bottom - 16;
        if lh.show_sender_hint {
            block_y = emit_sender_hint_lines(pb, lh.practice_lines, block_y, 9);
        }
        let address_top = block_y;
        let addr_bottom = emit_address_lines(pb, lh.address_lines, address_top, i32::MIN);
        let info_end = if !lh.meta_rows.is_empty() {
            emit_info_block(pb, lh.meta_rows, INFO_BLOCK_X, address_top)
        } else {
            let mut y = address_top;
            for line in header_right_lines.iter().take(8) {
                pb.y = y;
                pb.text_right(M_RIGHT, 9, false, line);
                y -= 11;
            }
            y
        };
        rule_y = addr_bottom.min(info_end) - 8;
    }

    pb.hline_gray(M_LEFT, rule_y, M_RIGHT, 0.72);
    pb.y = rule_y - 16;
    pb.y
}

fn emit_address_lines(pb: &mut PageBuilder, lines: &[String], start_y: i32, min_y: i32) -> i32 {
    let max_pt = super::core::MM * 80.0;
    let mut y = start_y;
    for (i, line) in lines.iter().enumerate() {
        let size = if i == 0 { 11 } else { 10 };
        for chunk in super::metrics::wrap_to_width(line, size, false, max_pt) {
            if y < min_y {
                // Address field is full (max ~6 lines per DIN 5008); keep the
                // remaining text on the last line instead of overprinting.
                break;
            }
            pb.y = y;
            pb.text(M_LEFT, size, false, &chunk);
            y -= if size == 11 { 13 } else { 12 };
        }
    }
    y
}

/// Short header for continuation pages.
///
/// [`PageBuilder::break_page`] now draws it automatically once registered,
/// so this only registers + draws on the first call and is a no-op afterwards.
pub fn emit_continuation_header(pb: &mut PageBuilder, practice_name: &str, doc_title: &str) {
    let locale = pb.locale;
    emit_continuation_header_locale(pb, practice_name, doc_title, locale);
}

pub fn emit_continuation_header_locale(
    pb: &mut PageBuilder,
    practice_name: &str,
    doc_title: &str,
    _locale: &str,
) {
    if pb.continuation.is_some() {
        return;
    }
    let locale = pb.locale;
    pb.set_continuation(practice_name, doc_title, locale);
    let cont = super::i18n::t(locale, super::i18n::Phrase::Continued);
    pb.y = M_TOP;
    pb.text(M_LEFT, 9, true, practice_name);
    pb.text_right(M_RIGHT, 9, false, &format!("{doc_title} ({cont})"));
    pb.y -= 4;
    let y = pb.y;
    pb.hline_at(M_LEFT, y, M_RIGHT);
    pb.y -= 16;
}

/// Information block: label (8 pt) and value (9 pt bold), right-aligned to the
/// page margin. `x` is only the left limit used for wrapping. Returns the
/// lowest `y` written.
fn emit_info_block(pb: &mut PageBuilder, rows: &[MetaRow], x: i32, start_y: i32) -> i32 {
    let right = if x <= M_LEFT + 8 {
        INFO_BLOCK_X - 12
    } else {
        M_RIGHT
    };
    let max_pt = f64::from((right - x).max(80));
    let mut y = start_y;
    for row in rows {
        pb.y = y;
        pb.text_right(right, 8, false, &row.label);
        y -= 10;
        for chunk in super::metrics::wrap_to_width(&row.value, 9, true, max_pt) {
            pb.y = y;
            pb.text_right(right, 9, true, &chunk);
            y -= 11;
        }
        y -= 3;
    }
    y
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum HeaderKind {
    Title,
    Body,
    Contact,
    Identity,
}

struct HeaderRow {
    text: String,
    kind: HeaderKind,
}

/// One incoming line is one table row. A middle dot stays in the line: it
/// separates the two cells of that row. An exact duplicate line is skipped.
fn compose_letterhead(lines: &[String]) -> Vec<HeaderRow> {
    let mut out = Vec::new();
    for line in lines {
        let text = line.trim();
        if text.is_empty() || out.iter().any(|row: &HeaderRow| row.text == text) {
            continue;
        }
        let kind = if out.is_empty() {
            HeaderKind::Title
        } else {
            classify_header_line(text)
        };
        out.push(HeaderRow {
            text: text.to_string(),
            kind,
        });
    }
    out
}

fn header_row_style(kind: HeaderKind) -> (i32, i32, bool) {
    match kind {
        HeaderKind::Title => (13, 16, true),
        HeaderKind::Identity => (8, 11, false),
        HeaderKind::Contact | HeaderKind::Body => (9, 12, false),
    }
}

/// Vertical span of the practice block, in points, before it is drawn.
fn practice_block_span(rows: &[HeaderRow], avail_pt: f64) -> i32 {
    let mut span = 0;
    for row in rows {
        let (size, step, bold) = header_row_style(row.kind);
        let lines = super::metrics::wrap_to_width(&row.text, size, bold, avail_pt).len() as i32;
        span += step * lines;
    }
    span
}

fn emit_practice_rows(
    pb: &mut PageBuilder,
    rows: &[HeaderRow],
    text_left: i32,
    start_y: i32,
    avail_pt: f64,
) -> i32 {
    let mut y = start_y;
    for row in rows {
        let (size, step, bold) = header_row_style(row.kind);
        for chunk in super::metrics::wrap_to_width(&row.text, size, bold, avail_pt) {
            pb.y = y;
            if row.kind == HeaderKind::Identity {
                pb.text_gray(text_left, size, bold, &chunk, 0.35);
            } else {
                pb.text(text_left, size, bold, &chunk);
            }
            y -= step;
        }
    }
    y
}

fn classify_header_line(line: &str) -> HeaderKind {
    let t = line.trim();
    let lower = t.to_ascii_lowercase();
    if lower.starts_with("tel")
        || lower.starts_with("fax")
        || lower.starts_with("email")
        || lower.starts_with("e-mail")
        || lower.starts_with("notdienst")
        || t.contains('@')
        || (t.contains('.') && !t.contains(' ') && !t.contains('@'))
    {
        return HeaderKind::Contact;
    }
    if lower.starts_with("bsnr")
        || lower.starts_with("zanr")
        || lower.starts_with("kv ")
        || lower.starts_with("steuer")
        || lower.starts_with("tax")
        || lower.starts_with("vat")
        || lower.starts_with("iban")
        || lower.starts_with("bic")
        || lower.starts_with("konto")
    {
        return HeaderKind::Identity;
    }
    HeaderKind::Body
}

/// Drop middots from a header line and keep each field on its own line.
/// A field that is already in the header is not added again.
fn split_header_fields(lines: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    for line in lines {
        let parts: Vec<&str> = if line.contains('·') {
            line.split('·').collect()
        } else {
            vec![line.as_str()]
        };
        for part in parts {
            let t = part.trim();
            if t.is_empty() || out.iter().any(|existing| existing == t) {
                continue;
            }
            out.push(t.to_string());
        }
    }
    out
}

/// Return address above the recipient window. The practice block already
/// prints the name, street, and city, so those lines are not repeated.
fn sender_hint_lines(practice_lines: &[String]) -> Vec<&str> {
    let header: Vec<&str> = practice_lines
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    practice_lines
        .iter()
        .map(|s| s.trim())
        .filter(|line| !line.is_empty() && !header.contains(line))
        .take(3)
        .collect()
}

fn emit_sender_hint_lines(
    pb: &mut PageBuilder,
    practice_lines: &[String],
    start_y: i32,
    step: i32,
) -> i32 {
    let max = super::core::MM * 80.0;
    let mut y = start_y;
    for line in sender_hint_lines(practice_lines) {
        let fitted = super::metrics::wrap_to_width(line, 7, false, max)
            .into_iter()
            .next()
            .unwrap_or_default();
        if fitted.trim().is_empty() {
            continue;
        }
        pb.y = y;
        pb.text(M_LEFT, 7, false, &fitted);
        y -= step;
    }
    y
}

/// Localised "(Praxisstempel)" label.
pub fn stamp_label(locale: &str) -> &'static str {
    super::i18n::t(locale, super::i18n::Phrase::Stamp)
}

/// Signature block: line, clinician name, title · ZANR · BSNR, stamp label.
pub fn emit_signature_block(
    pb: &mut PageBuilder,
    clinician_name: Option<&str>,
    professional_title: Option<&str>,
    zanr: Option<&str>,
    bsnr: Option<&str>,
    show_stempel_label: bool,
) {
    pb.ensure_space(90);
    pb.advance(20);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(28);

    let y = pb.y;
    pb.hline_at(M_LEFT, y, M_LEFT + 180);
    pb.advance(14);

    if let Some(n) = clinician_name.filter(|s| !s.trim().is_empty()) {
        pb.text(M_LEFT, 10, true, n);
        pb.advance(12);
    }

    let mut subline = Vec::new();
    if let Some(b) = professional_title.filter(|s| !s.trim().is_empty()) {
        subline.push(b.to_string());
    }
    if let Some(z) = zanr.filter(|s| !s.trim().is_empty()) {
        subline.push(format!("ZANR: {z}"));
    }
    if let Some(b) = bsnr.filter(|s| !s.trim().is_empty()) {
        subline.push(format!("BSNR: {b}"));
    }
    if !subline.is_empty() {
        pb.text(M_LEFT, 9, false, &subline.join(" · "));
        pb.advance(11);
    }

    if show_stempel_label {
        pb.advance(6);
        let label = stamp_label(pb.locale);
        pb.text(M_LEFT, 8, false, label);
    }
}

/// Bank-details block (prefer [`footer_lines_for_practice`] → page footer).
pub fn emit_bank_details(pb: &mut PageBuilder, lines: &[String]) {
    let locale = pb.locale;
    emit_bank_details_locale(pb, lines, locale);
}

pub fn emit_bank_details_locale(pb: &mut PageBuilder, lines: &[String], locale: &str) {
    if lines.is_empty() {
        return;
    }
    let title = super::i18n::t(locale, super::i18n::Phrase::BankDetails);
    pb.ensure_space(40 + lines.len() as i32 * 11);
    pb.advance(6);
    pb.text(M_LEFT, 9, true, title);
    pb.advance(11);
    for line in lines {
        pb.text(M_LEFT, 9, false, line);
        pb.advance(11);
    }
}

/// DIN 5008 footer content: legal identity, tax and bank details.
#[derive(Debug, Clone, Default)]
pub struct PracticeFooter {
    pub practice_name: String,
    pub tax_number: Option<String>,
    pub vat_id: Option<String>,
    pub iban: Option<String>,
    pub bic: Option<String>,
    pub bank_name: Option<String>,
    pub chamber: Option<String>,
}

/// Build the (max. 3) footer lines for [`PageBuilder::footer_lines`].
pub fn footer_lines_for_practice(f: &PracticeFooter, locale: &str) -> Vec<String> {
    let mut l1 = vec![f.practice_name.trim().to_string()];
    if let Some(c) = f.chamber.as_deref().filter(|s| !s.trim().is_empty()) {
        l1.push(format!(
            "{}: {c}",
            super::i18n::t(locale, super::i18n::Phrase::Chamber)
        ));
    }
    let mut l2 = Vec::new();
    if let Some(t) = f.tax_number.as_deref().filter(|s| !s.trim().is_empty()) {
        l2.push(format!(
            "{} {t}",
            super::i18n::t(locale, super::i18n::Phrase::TaxNo)
        ));
    }
    if let Some(v) = f.vat_id.as_deref().filter(|s| !s.trim().is_empty()) {
        l2.push(format!(
            "{} {v}",
            super::i18n::t(locale, super::i18n::Phrase::VatId)
        ));
    }
    let mut l3 = Vec::new();
    if let Some(b) = f.bank_name.as_deref().filter(|s| !s.trim().is_empty()) {
        l3.push(b.to_string());
    }
    if let Some(i) = f.iban.as_deref().filter(|s| !s.trim().is_empty()) {
        l3.push(format!("IBAN {i}"));
    }
    if let Some(b) = f.bic.as_deref().filter(|s| !s.trim().is_empty()) {
        l3.push(format!("BIC {b}"));
    }
    [l1, l2, l3]
        .into_iter()
        .filter(|v| v.iter().any(|s| !s.is_empty()))
        .map(|v| v.join(" · "))
        .collect()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_practice() -> Vec<String> {
        vec![
            "Dental practice Dr. Sample".into(),
            "Hauptstraße 1".into(),
            "10115 Berlin".into(),
            "Tel: 030/123456".into(),
        ]
    }

    fn dummy_address() -> Vec<String> {
        vec![
            "Max Sample".into(),
            "Sample Street 2".into(),
            "10117 Berlin".into(),
        ]
    }

    #[test]
    fn header_prints_each_practice_line_once() {
        let mut pb = PageBuilder::new();
        let practice = vec![
            "MeDoc Demo Dental Practice".into(),
            "Am Markt 12".into(),
            "28195 Bremen".into(),
            "Tel. +49 421 555 0100 · BSNR 987654321".into(),
            "MeDoc Demo Dental Practice".into(),
            "BSNR 987654321".into(),
        ];
        let addr = dummy_address();
        let lh = Letterhead {
            practice_lines: &practice,
            address_lines: &addr,
            show_sender_hint: true,
            locale: "de",
            ..Default::default()
        };
        emit_letterhead(&mut pb, &lh);
        let page = pb.finish().remove(0);
        assert_eq!(page.matches("(MeDoc Demo Dental Practice)").count(), 1);
        assert_eq!(page.matches("(Am Markt 12)").count(), 1);
        assert_eq!(page.matches("(28195 Bremen)").count(), 1);
        let tel = page.find("Tel. +49 421 555 0100").expect("phone");
        let near = &page[tel..(tel + 80).min(page.len())];
        assert!(
            near.contains("BSNR 987654321"),
            "phone and registration stay on one line"
        );
        assert_eq!(page.matches("(BSNR 987654321)").count(), 1);
    }

    #[test]
    fn letterhead_renders_without_panic() {
        let mut pb = PageBuilder::new();
        let practice = dummy_practice();
        let addr = dummy_address();
        let meta = vec![
            MetaRow::new("Invoice-Nr.", "RE-2026-001"),
            MetaRow::new("Date", "19.04.2026"),
        ];
        let lh = Letterhead {
            practice_lines: &practice,
            meta_rows: &meta,
            address_lines: &addr,
            header_right_lines: &[],
            show_sender_hint: true,
            compact_address: false,
            logo: None,
            rtl: false,
            locale: "en",
        };
        let y_after = emit_letterhead(&mut pb, &lh);
        assert!(y_after < M_TOP);
        assert!(pb.letter_marks, "a short header keeps the envelope marks");
        let pages = pb.finish();
        assert_eq!(pages.len(), 1);
    }

    #[test]
    fn header_info_block_aligns_to_the_right_margin() {
        let mut pb = PageBuilder::new();
        let practice = dummy_practice();
        let addr = dummy_address();
        let meta = vec![MetaRow::new("Rechnungs-Nr.", "RE-2026-000001")];
        let lh = Letterhead {
            practice_lines: &practice,
            meta_rows: &meta,
            address_lines: &addr,
            header_right_lines: &[],
            show_sender_hint: true,
            compact_address: false,
            logo: None,
            rtl: false,
            locale: "de",
        };
        emit_letterhead(&mut pb, &lh);
        let page = pb.finish().remove(0);
        let label = "Rechnungs-Nr.";
        let width = super::super::core::text_width(label, 8, false);
        let x = page
            .lines()
            .find(|line| line.contains("(Rechnungs-Nr.)") || line.contains("Rechnungs-Nr."))
            .and_then(|line| line.split_whitespace().nth(4))
            .and_then(|x| x.parse::<i32>().ok())
            .expect("info label");
        assert_eq!(x + width, M_RIGHT, "label must end on the right margin");
    }

    #[test]
    fn header_keeps_same_row_fields_on_one_line() {
        let mut pb = PageBuilder::new();
        let practice = vec![
            "Praxis".into(),
            "Tel. 030 1 · praxis@example.de".into(),
            "BSNR 123456789 · ZANR 987654321".into(),
        ];
        let lh = Letterhead {
            practice_lines: &practice,
            locale: "de",
            ..Default::default()
        };
        emit_letterhead(&mut pb, &lh);
        let page = pb.finish().remove(0);
        let contact = page
            .lines()
            .find(|line| line.contains("Tel. 030 1"))
            .expect("contact line");
        assert!(contact.contains("praxis@example.de"));
        let identity = page
            .lines()
            .find(|line| line.contains("BSNR 123456789"))
            .expect("registration line");
        assert!(identity.contains("ZANR 987654321"));
        assert_eq!(page.matches("Tel. 030 1").count(), 1);
        assert_eq!(page.matches("BSNR 123456789").count(), 1);
    }

    #[test]
    fn letterhead_without_address_compresses() {
        let mut pb = PageBuilder::new();
        let practice = dummy_practice();
        let lh = Letterhead {
            practice_lines: &practice,
            meta_rows: &[],
            address_lines: &[],
            header_right_lines: &[],
            show_sender_hint: false,
            compact_address: false,
            logo: None,
            rtl: false,
            locale: "en",
        };
        let y_after = emit_letterhead(&mut pb, &lh);
        // Without an address field the divider must be earlier than DIN-5008 Y560.
        assert!(y_after > 560);
    }

    #[test]
    fn overlong_practice_header_stays_in_the_header() {
        let mut pb = PageBuilder::new();
        let practice: Vec<String> = (0..12).map(|i| format!("Kopfzeile {i}")).collect();
        let addr = dummy_address();
        let meta = vec![MetaRow::new("Rechnungs-Nr.", "RE-2026-000001")];
        let lh = Letterhead {
            practice_lines: &practice,
            meta_rows: &meta,
            address_lines: &addr,
            locale: "de",
            ..Default::default()
        };
        emit_letterhead(&mut pb, &lh);
        assert!(
            pb.footer_lines
                .iter()
                .all(|line| !line.starts_with("Kopfzeile")),
            "header lines must not move to the footer"
        );
        assert!(!pb.letter_marks, "a grown header is not a window envelope");
        let page = pb.finish().remove(0);
        for i in 0..12 {
            assert!(
                page.contains(&format!("Kopfzeile {i}")),
                "missing Kopfzeile {i}"
            );
        }
        let last = page.find("Kopfzeile 11").expect("last header line");
        let address = page.find("Max Sample").expect("recipient");
        let info = page.find("Rechnungs-Nr.").expect("info block");
        assert!(
            last < address && last < info,
            "address and info follow the header"
        );
    }

    #[test]
    fn footer_lines_contain_tax_and_bank() {
        let lines = footer_lines_for_practice(
            &PracticeFooter {
                practice_name: "Zahnarztpraxis Dr. Test".into(),
                tax_number: Some("12/345/67890".into()),
                iban: Some("DE89 3704 0044 0532 0130 00".into()),
                ..Default::default()
            },
            "de",
        );
        assert_eq!(lines.len(), 3);
        assert!(lines[1].contains("Steuer-Nr. 12/345/67890"));
    }

    /// Footer matches the official samples: three centred 7 pt lines
    /// (identity, tax, bank) at y = 60 / 51 / 42, above "Seite n von n".
    #[test]
    fn footer_matches_sample_document() {
        let lines = footer_lines_for_practice(
            &PracticeFooter {
                practice_name: "Zahnarztpraxis Dr. Anna Berger · Hauptstraße 12, 49074 Osnabrück"
                    .into(),
                chamber: Some("Zahnärztekammer Niedersachsen".into()),
                tax_number: Some("66/123/45678".into()),
                bank_name: Some("Sparkasse Osnabrück".into()),
                iban: Some("DE89 3704 0044 0532 0130 00".into()),
                bic: Some("COBADEFFXXX".into()),
                ..Default::default()
            },
            "de",
        );
        assert_eq!(lines.len(), 3);
        assert_eq!(
            lines[0],
            "Zahnarztpraxis Dr. Anna Berger · Hauptstraße 12, 49074 Osnabrück · Kammer: Zahnärztekammer Niedersachsen"
        );
        assert_eq!(lines[1], "Steuer-Nr. 66/123/45678");
        assert_eq!(
            lines[2],
            "Sparkasse Osnabrück · IBAN DE89 3704 0044 0532 0130 00 · BIC COBADEFFXXX"
        );
        let mut pb = PageBuilder::new();
        pb.locale = "de";
        pb.footer_lines = lines;
        pb.text(M_LEFT, 10, false, "Inhalt");
        let page = pb.finish().remove(0);
        assert!(page.contains("60 Td"), "identity line");
        assert!(page.contains("51 Td"), "tax line");
        assert!(page.contains("42 Td"), "bank line");
        assert!(page.contains("Steuer-Nr. 66/123/45678"));
        assert!(page.contains("Kammer: Zahn"));
    }

    #[test]
    fn continuation_header_writes_practice_and_title() {
        let mut pb = PageBuilder::new();
        emit_continuation_header(&mut pb, "Practice A", "Invoice");
        let pages = pb.finish();
        assert!(pages[0].contains("Practice A") || pages[0].contains("Rech"));
    }

    #[test]
    fn signature_block_handles_missing_fields() {
        let mut pb = PageBuilder::new();
        pb.y = 200;
        emit_signature_block(&mut pb, None, None, None, None, false);
        let pages = pb.finish();
        // Lines only, no text — should still be valid
        assert_eq!(pages.len(), 1);
    }
}
