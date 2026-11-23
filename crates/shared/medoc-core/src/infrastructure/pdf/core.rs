//! Shared PDF primitives for every MeDoc document type (invoice, record, certificate,
//! prescription, receipt, daily report, fact sheet).
//!
//! What lives here:
//! - **Constants** (DIN-5008-compliant margins, A4 media box, page positions).
//! - **Character encoding** WinAnsi with UTF-16BE fallback (without truncating
//!   the rest of the string).
//! - **PdfPage / PdfDoc** low-level builder model — writes a PDF-1.4 object stream.
//! - **Primitives** for text, lines, rectangles, table headers.
//!
//! All further renderers (invoice, record, clinical documents) build their
//! content on **one** shared [`PageBuilder`] instance so margins,
//! fonts, and encoding are defined exactly once.

use crate::error::AppError;
use std::fmt::Write;

// ---------------------------------------------------------------------------
// DIN-5008 / A4 constants
// ---------------------------------------------------------------------------

/// A4 width in PDF points (1 pt = 1/72 inch).
pub const PAGE_WIDTH: i32 = 595;
/// A4 height in PDF points.
pub const PAGE_HEIGHT: i32 = 842;

/// 1 mm in PDF points.
pub const MM: f64 = 72.0 / 25.4;

/// Converts "mm from the top edge" (how DIN 5008 is specified) to a PDF y.
pub const fn y_from_top_mm(mm_x10: i32) -> i32 {
    // mm_x10 = millimetres × 10 to keep this a const fn without floats.
    PAGE_HEIGHT - (mm_x10 * 2835 / 10_000)
}

/// Left content margin — DIN 5008: 25 mm.
pub const M_LEFT: i32 = 71;
/// Right content margin — DIN 5008: at least 20 mm → 595 − 57.
pub const M_RIGHT: i32 = 538;
/// Top content start (PDF Y-axis: 0 at bottom, 842 at top).
pub const M_TOP: i32 = 810;
/// Bottom of the content area. Below it: DIN footer (practice/bank/tax lines)
/// and the page number.
pub const M_BOTTOM: i32 = 80;

/// Content width = M_RIGHT − M_LEFT.
pub const CONTENT_WIDTH: i32 = M_RIGHT - M_LEFT;

// DIN 5008 **Form B** (letterhead 45 mm high, address field 45–90 mm from top).
/// Lowest baseline the letterhead may use (45 mm from top).
pub const LETTERHEAD_MIN_Y: i32 = y_from_top_mm(450);
/// Return-address line (Rücksendeangabe, zone 45–50 mm).
pub const SENDER_HINT_Y: i32 = y_from_top_mm(485);
/// First line of the recipient address (Anschriftzone starts at 62.7 mm).
pub const ADDRESS_WINDOW_Y: i32 = y_from_top_mm(662);
/// Bottom of the address field (90 mm).
pub const ADDRESS_WINDOW_BOTTOM_Y: i32 = y_from_top_mm(900);
/// Height of the address field (45 mm).
pub const ADDRESS_WINDOW_HEIGHT: i32 = 128;
/// Information block (Infoblock) starts 125 mm from the left edge, 50 mm from top.
pub const INFO_BLOCK_X: i32 = 354;
pub const INFO_BLOCK_TOP_Y: i32 = y_from_top_mm(500);
/// First content line after the address field (subject line, ~98.4 mm).
pub const CONTENT_START_Y: i32 = y_from_top_mm(984);
/// Fold marks (105 mm, 210 mm) and hole mark (148.5 mm), Form B.
pub const FOLD_MARK_1_Y: i32 = y_from_top_mm(1050);
pub const FOLD_MARK_2_Y: i32 = y_from_top_mm(2100);
pub const HOLE_MARK_Y: i32 = y_from_top_mm(1485);

/// Y where the page-number footer is rendered.
pub const PAGE_NUMBER_Y: i32 = 30;
/// Y of the first DIN footer line (grows upward, max 3 lines).
pub const FOOTER_FIRST_Y: i32 = 42;
/// Y where the signature footer area begins.
pub const SIGNATURE_FOOTER_Y: i32 = 90;

/// Document language: a code from [`super::i18n::LOCALES`], or `None` when
/// the caller did not name a supported one. Region and case are ignored
/// (`"ar-MA"` → `ar`, `"fr_FR"` → `fr`) — the old exact match turned every
/// `"en-US"` / `"ar-MA"` request into a German document.
pub fn known_pdf_locale(requested: &str) -> Option<&'static str> {
    super::i18n::known_locale(requested)
}

pub fn pdf_locale(requested: &str) -> &'static str {
    super::i18n::locale_or_default(requested)
}

// ---------------------------------------------------------------------------
// Document identity
// ---------------------------------------------------------------------------

thread_local! {
    static DOCUMENT_UID: std::cell::RefCell<Option<String>> = const { std::cell::RefCell::new(None) };
}

/// New document id (UUID v4). Issued documents use it as `issued_document.id`.
pub fn new_document_uid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Render with a fixed document id: every PDF written by `f` on this thread
/// carries `uid` (footer, `/MeDocDocumentId`, trailer `/ID`). Without it each
/// PDF gets a fresh id, so previews and exports are identifiable too.
pub fn with_document_uid<T>(uid: &str, f: impl FnOnce() -> T) -> T {
    let previous = DOCUMENT_UID.with(|c| c.replace(Some(uid.to_string())));
    let out = f();
    DOCUMENT_UID.with(|c| *c.borrow_mut() = previous);
    out
}

/// Guard form of [`with_document_uid`] for a block that renders several
/// ways (`match`). Keep it inside a block without `.await`: the id lives in
/// a thread-local.
pub struct DocumentUidScope {
    previous: Option<String>,
}

impl DocumentUidScope {
    pub fn enter(uid: &str) -> Self {
        let previous = DOCUMENT_UID.with(|c| c.replace(Some(uid.to_string())));
        Self { previous }
    }
}

impl Drop for DocumentUidScope {
    fn drop(&mut self) {
        let previous = self.previous.take();
        DOCUMENT_UID.with(|c| *c.borrow_mut() = previous);
    }
}

fn current_document_uid() -> String {
    DOCUMENT_UID
        .with(|c| c.borrow().clone())
        .unwrap_or_else(new_document_uid)
}

/// Read the document id back from PDF bytes written by MeDoc.
pub fn document_uid_of(pdf: &[u8]) -> Option<String> {
    let needle = b"/MeDocDocumentId (";
    let start = pdf.windows(needle.len()).position(|w| w == needle)? + needle.len();
    let end = pdf[start..].iter().position(|&b| b == b')')? + start;
    let uid = std::str::from_utf8(&pdf[start..end]).ok()?;
    uid.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
        .then(|| uid.to_string())
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/// Map a Unicode code point to WinAnsi (CP1252, Helvetica Type-1).
///
/// The complete table: ASCII, the Latin-1 block U+00A0–U+00FF (identical
/// byte values) and the 27 CP1252 extensions in 0x80–0x9F. The old table
/// listed letters one by one and missed most of French (à â î ï ô û ù ë ÿ æ)
/// and Spanish/Portuguese (á í ó ú ã õ), so those strings fell through to
/// the Arabic font and lost characters or were rejected.
pub(crate) fn winansi_byte(ch: char) -> Option<u8> {
    let c = ch as u32;
    if c < 0x80 {
        return Some(c as u8);
    }
    if (0xA0..=0xFF).contains(&c) {
        return Some(c as u8);
    }
    Some(match ch {
        '€' => 0x80,
        '\u{201A}' => 0x82, // ‚
        'ƒ' => 0x83,
        '\u{201E}' => 0x84, // „
        '\u{2026}' => 0x85, // …
        '\u{2020}' => 0x86, // †
        '\u{2021}' => 0x87, // ‡
        '\u{02C6}' => 0x88, // ˆ
        '\u{2030}' => 0x89, // ‰
        'Š' => 0x8A,
        '\u{2039}' => 0x8B, // ‹
        'Œ' => 0x8C,
        'Ž' => 0x8E,
        '\u{2018}' => 0x91, // ‘
        '\u{2019}' => 0x92, // ’
        '\u{201C}' => 0x93, // “
        '\u{201D}' => 0x94, // ”
        '\u{2022}' => 0x95, // •
        '\u{2013}' => 0x96, // –
        '\u{2014}' => 0x97, // —
        '\u{02DC}' => 0x98, // ˜
        '\u{2122}' => 0x99, // ™
        'š' => 0x9A,
        '\u{203A}' => 0x9B, // ›
        'œ' => 0x9C,
        'ž' => 0x9E,
        'Ÿ' => 0x9F,
        // Typographic minus / bars → ASCII hyphen.
        '\u{2015}' | '\u{2212}' => b'-',
        _ => return None,
    })
}

fn pdf_escape_winansi_bytes(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() + 4);
    for &b in bytes {
        match b {
            b'(' | b')' | b'\\' => {
                out.push('\\');
                out.push(b as char);
            }
            32..=126 => out.push(b as char),
            _ => {
                out.push('\\');
                let _ = write!(out, "{:03o}", b);
            }
        }
    }
    out
}

/// True when every character of `s` can be drawn with the WinAnsi fonts.
pub fn is_winansi_renderable(s: &str) -> bool {
    s.chars()
        .all(|c| winansi_byte(c).is_some() || c.is_whitespace())
}

/// True when every character can be drawn by Helvetica or an embedded font
/// (after normalisation: NFC, exotic spaces, emoji and invisible characters
/// are handled by [`super::text::prepare`]).
pub fn is_pdf_renderable(s: &str) -> bool {
    super::text::is_renderable(s)
}

/// Characters no font can draw (for error messages and logs).
pub fn unrenderable_chars(s: &str) -> Vec<char> {
    super::text::unsupported_chars(s)
}

/// Encode a text literal for a **content stream** (Helvetica / WinAnsi).
///
/// A simple Type-1 font reads every byte as one WinAnsi glyph, so the old
/// UTF-16 hex fallback (`<FEFF…>`) printed `þÿ` followed by garbage.
/// Unmappable characters are now replaced by `?` and the caller is expected
/// to validate input with [`is_winansi_renderable`] for official documents.
/// Real non-Latin support needs embedded fonts (see `CHANGES.md`, phase 2).
pub fn text_operand(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    for ch in s.chars() {
        match winansi_byte(ch) {
            Some(b) => bytes.push(b),
            None if ch.is_whitespace() => bytes.push(b' '),
            None => bytes.push(b'?'),
        }
    }
    format!("({})", pdf_escape_winansi_bytes(&bytes))
}

/// Encode a string for the document **Info dictionary** / metadata, where
/// PDF allows UTF-16BE with BOM (unlike content streams).
pub fn info_string_operand(s: &str) -> String {
    // Info strings use PDFDocEncoding, which differs from WinAnsi in
    // 0x80–0x9F (€, quotes, dashes). Only plain ASCII stays a literal.
    if s.chars().all(|c| (' '..='~').contains(&c)) {
        return text_operand(s);
    }
    let mut hex = String::from("<FEFF");
    for unit in s.encode_utf16() {
        let _ = write!(hex, "{:04X}", unit);
    }
    hex.push('>');
    hex
}

/// Text width in PDF points from the Helvetica AFM metrics (regular weight).
pub fn approx_text_width(s: &str, font_size: i32) -> i32 {
    text_width(s, font_size, false)
}

/// Text width in PDF points from the Helvetica / Helvetica-Bold AFM metrics.
/// Measured exactly like [`PageBuilder::text`] draws it (shaped scripts,
/// embedded fonts and Helvetica alike).
pub fn text_width(s: &str, font_size: i32, bold: bool) -> i32 {
    super::text::width_pt(s, f64::from(font_size), bold, false).ceil() as i32
}

/// Continuation header drawn automatically after every page break.
#[derive(Debug, Clone)]
pub struct ContinuationHeader {
    pub practice_name: String,
    pub doc_title: String,
    pub locale: &'static str,
}

// ---------------------------------------------------------------------------
// PageBuilder — unified write model for every document type
// ---------------------------------------------------------------------------

/// A PageBuilder accumulates PDF content streams page by page.
///
/// **Usage:**
/// ```ignore
/// let mut pb = PageBuilder::new();
/// pb.text(M_LEFT, pb.y, 10, false, "Hello World");
/// pb.advance(12);
/// let pages = pb.finish();
/// emit_multipage_pdf(&pages, "My Document")?;
/// ```
///
/// `y` always points at the **baseline** of the next text output in
/// PDF coordinates (0 at bottom). `advance(n)` reduces `y` by `n` and
/// automatically page-breaks when `y < M_BOTTOM`.
pub struct PageBuilder {
    pub pages: Vec<String>,
    pub cur: String,
    pub y: i32,
    page_top: i32,
    /// DIN 5008 footer lines (practice / tax / bank), repeated on every page.
    pub footer_lines: Vec<String>,
    /// Drawn after each automatic or manual page break.
    pub continuation: Option<ContinuationHeader>,
    /// Diagonal watermark on every page (e.g. "ENTWURF", "KOPIE").
    pub watermark: Option<String>,
    /// Draw fold and hole marks (letters with an address window).
    pub letter_marks: bool,
    /// Document language for fixed labels (see [`pdf_locale`]).
    pub locale: &'static str,
    /// Mirror the page so an Arabic document reads from the right.
    pub rtl: bool,
}

impl Default for PageBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl PageBuilder {
    pub fn new() -> Self {
        Self {
            pages: Vec::new(),
            cur: String::new(),
            y: M_TOP,
            page_top: M_TOP,
            footer_lines: Vec::new(),
            continuation: None,
            watermark: None,
            letter_marks: false,
            locale: "de",
            rtl: false,
        }
    }

    /// Right-to-left documents are laid out as the mirror of the Latin page.
    pub fn reading_rtl(&self) -> bool {
        self.rtl || super::i18n::is_rtl(self.locale)
    }

    /// Width of `s` exactly as [`Self::text`] draws it on this page.
    pub fn width(&self, s: &str, size: i32, bold: bool) -> f64 {
        super::text::width_pt(s, f64::from(size), bold, self.reading_rtl())
    }

    /// Left edge after mirroring a run that starts at `x` in the Latin layout.
    fn mirror_left(&self, x: i32, width: i32) -> i32 {
        if !self.reading_rtl() {
            return x;
        }
        M_LEFT + M_RIGHT - x - width
    }

    fn mirror_x(&self, x: i32) -> i32 {
        if !self.reading_rtl() {
            return x;
        }
        M_LEFT + M_RIGHT - x
    }

    /// Use a different top-of-page start (e.g. after letterhead).
    pub fn with_page_top(mut self, page_top: i32) -> Self {
        self.page_top = page_top;
        self.y = page_top;
        self
    }

    /// Register the header that every continuation page starts with.
    pub fn set_continuation(&mut self, practice_name: &str, doc_title: &str, locale: &str) {
        self.continuation = Some(ContinuationHeader {
            practice_name: practice_name.to_string(),
            doc_title: doc_title.to_string(),
            locale: pdf_locale(locale),
        });
    }

    /// Force a page break — the next write starts at `y = self.page_top`,
    /// below the continuation header when one is registered.
    pub fn break_page(&mut self) {
        if !self.cur.is_empty() {
            self.pages.push(std::mem::take(&mut self.cur));
        }
        self.y = self.page_top;
        if let Some(c) = self.continuation.clone() {
            let cont = super::i18n::t(c.locale, super::i18n::Phrase::Continued);
            self.text(M_LEFT, 9, true, &c.practice_name);
            self.text_right(M_RIGHT, 9, false, &format!("{} ({cont})", c.doc_title));
            self.y -= 4;
            let y = self.y;
            self.hline_at(M_LEFT, y, M_RIGHT);
            self.y -= 16;
        }
    }

    /// Ensure at least `min_y_remaining` points remain — otherwise
    /// page-break.
    pub fn ensure_space(&mut self, min_y_remaining: i32) {
        if self.y < M_BOTTOM + min_y_remaining {
            self.break_page();
        }
    }

    /// Reduce `y` by `dy` (line height).
    pub fn advance(&mut self, dy: i32) {
        self.y -= dy;
    }

    /// Write text. `bold = true` uses /F2 (Helvetica-Bold), otherwise /F1.
    /// **Cursor is NOT moved** — caller is responsible for `advance(line_height)`.
    pub fn text(&mut self, x: i32, size: i32, bold: bool, s: &str) {
        let line = super::text::layout(s, f64::from(size), bold, self.reading_rtl());
        if line.pieces.is_empty() {
            return;
        }
        let x = if self.reading_rtl() {
            f64::from(M_LEFT + M_RIGHT - x) - line.width
        } else {
            f64::from(x)
        };
        self.cur.push_str(&super::text::draw_layout(
            x,
            f64::from(self.y),
            &line,
            f64::from(size),
        ));
    }

    /// Same as [`Self::text`], drawn in grayscale (`0` black, `1` white).
    pub fn text_gray(&mut self, x: i32, size: i32, bold: bool, s: &str, gray: f64) {
        let _ = writeln!(self.cur, "q {gray:.3} g");
        self.text(x, size, bold, s);
        let _ = writeln!(self.cur, "Q");
    }

    /// Text right-aligned to right margin `x_right`.
    pub fn text_right(&mut self, x_right: i32, size: i32, bold: bool, s: &str) {
        let w = self.width(s, size, bold).ceil() as i32;
        let x = (x_right - w).max(M_LEFT);
        self.text(x, size, bold, s);
    }

    /// Writes `text` wrapped to `max_pt` starting at `x`; returns lines written.
    /// Breaks pages as needed (continuation header included).
    pub fn wrapped(&mut self, x: i32, size: i32, bold: bool, text: &str, max_pt: i32) -> usize {
        let lines = super::metrics::wrap_to_width(text, size, bold, f64::from(max_pt));
        for line in &lines {
            self.ensure_space(size + 6);
            if !line.is_empty() {
                self.text(x, size, bold, line);
            }
            self.advance(size + 3);
        }
        lines.len()
    }

    /// Draw shared Image XObject `/Im{index}` with bottom-left at `(x, y)`.
    pub fn draw_image(&mut self, index: usize, x: f64, y: f64, w: f64, h: f64) {
        let x = if self.reading_rtl() {
            f64::from(M_LEFT + M_RIGHT) - x - w
        } else {
            x
        };
        let _ = writeln!(
            self.cur,
            "q {w:.2} 0 0 {h:.2} {x:.2} {y:.2} cm /Im{index} Do Q"
        );
    }

    /// Text centered between `M_LEFT` and `M_RIGHT`.
    pub fn text_center(&mut self, size: i32, bold: bool, s: &str) {
        let w = self.width(s, size, bold).ceil() as i32;
        let x = M_LEFT + (CONTENT_WIDTH - w) / 2;
        self.text(x.max(M_LEFT), size, bold, s);
    }

    /// Multi-line paragraph wrapped by measured width (the `max_chars`
    /// argument is kept for call-site compatibility and only caps the width).
    /// Handles page breaks itself.
    pub fn paragraph(&mut self, text: &str, size: i32, max_chars: usize, indent: i32) {
        let by_chars = (max_chars as f64 * f64::from(size) * 0.556) as i32;
        let max_pt = (CONTENT_WIDTH - indent).min(by_chars.max(40));
        for raw_line in text.split('\n') {
            if raw_line.trim().is_empty() {
                self.advance(size / 2);
                continue;
            }
            for chunk in super::metrics::wrap_to_width(raw_line, size, false, f64::from(max_pt)) {
                self.ensure_space(size + 6);
                self.text(M_LEFT + indent, size, false, &chunk);
                self.advance(size + 4);
            }
        }
    }

    /// Horizontal line at the current `y` position.
    pub fn hline(&mut self, x1: i32, x2: i32) {
        let x1 = self.mirror_x(x1);
        let x2 = self.mirror_x(x2);
        let _ = writeln!(self.cur, "{} {} m {} {} l S", x1, self.y, x2, self.y);
    }

    /// Horizontal line at an arbitrary `y` position (page element, e.g.
    /// letterhead divider).
    pub fn hline_at(&mut self, x1: i32, y: i32, x2: i32) {
        let x1 = self.mirror_x(x1);
        let x2 = self.mirror_x(x2);
        let _ = writeln!(self.cur, "{} {} m {} {} l S", x1, y, x2, y);
    }

    /// Hairline used under a letterhead. `gray` is 0 (black) to 1 (white).
    pub fn hline_gray(&mut self, x1: i32, y: i32, x2: i32, gray: f64) {
        let x1 = self.mirror_x(x1);
        let x2 = self.mirror_x(x2);
        let _ = writeln!(self.cur, "q {gray:.3} G 0.4 w {x1} {y} m {x2} {y} l S Q");
    }

    /// Filled rectangle (grayscale). `y_bottom` is the bottom edge.
    pub fn fill_rect(&mut self, x: i32, y_bottom: i32, w: i32, h: i32, gray: f64) {
        let x = self.mirror_left(x, w);
        let _ = writeln!(
            self.cur,
            "q {g:.3} g {x} {y} {w} {h} re f Q",
            g = gray,
            x = x,
            y = y_bottom,
            w = w,
            h = h,
        );
    }

    /// Outlined rectangle.
    pub fn stroke_rect(&mut self, x: i32, y_bottom: i32, w: i32, h: i32) {
        let x = self.mirror_left(x, w);
        let _ = writeln!(
            self.cur,
            "{x} {y} {w} {h} re S",
            x = x,
            y = y_bottom,
            w = w,
            h = h
        );
    }

    /// Table header band: light background behind the table header row.
    /// `y_text_baseline` is the header text baseline; the band covers ascenders.
    pub fn table_header_band(&mut self, x: i32, y_text_baseline: i32, w: i32) {
        let font_size = 9;
        let ascent = table_font_ascent(font_size);
        let descent = table_font_descent(font_size);
        let h = ascent + descent + 4;
        let y_bottom = y_text_baseline + ascent - h;
        self.fill_rect(x, y_bottom, w, h, 0.92);
    }

    /// Zebra stripe behind a table data row.
    ///
    /// PDF text sits on a **baseline** with glyphs extending above it. Filling
    /// `[baseline − h, baseline]` leaves the ink in white and the gray below
    /// the letters. This band is anchored so its **top** is at
    /// `first_baseline + ascent`, matching the vertical span consumed by
    /// `advance(row_height)` after drawing at `first_baseline`.
    pub fn fill_table_row_band(
        &mut self,
        x: i32,
        w: i32,
        first_baseline: i32,
        row_height: i32,
        font_size: i32,
        gray: f64,
    ) {
        let ascent = table_font_ascent(font_size);
        let y_bottom = first_baseline + ascent - row_height;
        self.fill_rect(x, y_bottom, w, row_height, gray);
    }

    /// Finish the current stream and return all pages.
    /// Guarantees at least one page (even if empty) so `emit_multipage_pdf`
    /// does not crash.
    pub fn finish(mut self) -> Vec<String> {
        if !self.cur.is_empty() {
            let last = std::mem::take(&mut self.cur);
            self.pages.push(last);
        }
        if self.pages.is_empty() {
            self.pages.push(String::new());
        }
        let rtl = self.reading_rtl();
        let footer = footer_stream(&self.footer_lines, rtl);
        let marks = if self.letter_marks {
            letter_marks_stream()
        } else {
            String::new()
        };
        let locale = self.locale;
        let wm = self
            .watermark
            .as_deref()
            .filter(|w| !w.trim().is_empty())
            .map(|w| watermark_stream(&super::i18n::localize_watermark(w, locale), rtl))
            .unwrap_or_default();
        self.pages
            .into_iter()
            .map(|body| format!("{wm}{body}{footer}{marks}"))
            .collect()
    }
}

/// DIN 5008 footer: up to three centred 7 pt lines above the page number.
fn footer_stream(lines: &[String], rtl: bool) -> String {
    let mut s = String::new();
    let mut wrapped: Vec<String> = Vec::new();
    for l in lines.iter().filter(|l| !l.trim().is_empty()) {
        wrapped.extend(super::metrics::wrap_to_width(
            l,
            7,
            false,
            f64::from(CONTENT_WIDTH),
        ));
    }
    if wrapped.is_empty() {
        return s;
    }
    let _ = writeln!(
        s,
        "q 0.6 G 0.5 w {M_LEFT} {} m {M_RIGHT} {} l S Q",
        M_BOTTOM - 8,
        M_BOTTOM - 8
    );
    // Draw bottom-up so the first line ends highest.
    for (i, line) in wrapped.iter().rev().take(3).enumerate() {
        let layout = super::text::layout(line, 7.0, false, rtl);
        let x = (f64::from(M_LEFT) + (f64::from(CONTENT_WIDTH) - layout.width) / 2.0)
            .max(f64::from(M_LEFT));
        let y = FOOTER_FIRST_Y + i as i32 * 9;
        s.push_str(&super::text::draw_layout(x, f64::from(y), &layout, 7.0));
    }
    s
}

/// Fold marks at 105 / 210 mm and the hole mark at 148.5 mm (DIN 5008 Form B).
fn letter_marks_stream() -> String {
    let mut s = String::from("q 0.4 w\n");
    for y in [FOLD_MARK_1_Y, FOLD_MARK_2_Y] {
        let _ = writeln!(s, "14 {y} m 28 {y} l S");
    }
    let _ = writeln!(s, "14 {y} m 34 {y} l S", y = HOLE_MARK_Y);
    s.push_str("Q\n");
    s
}

/// Light diagonal watermark drawn **under** the page content.
fn watermark_stream(text: &str, rtl: bool) -> String {
    let size = 64;
    let w = super::text::width_pt(text, f64::from(size), true, rtl);
    // Rotate 45° around the page centre.
    let (c, sn) = (
        std::f64::consts::FRAC_1_SQRT_2,
        std::f64::consts::FRAC_1_SQRT_2,
    );
    let cx = f64::from(PAGE_WIDTH) / 2.0;
    let cy = f64::from(PAGE_HEIGHT) / 2.0;
    let x0 = cx - (w / 2.0) * c;
    let y0 = cy - (w / 2.0) * sn;
    // One laid-out line (any script), rotated 45° around the page centre.
    let ops = super::text::draw_ops(0.0, 0.0, text, f64::from(size), true, rtl);
    format!(
        "q 0.88 g {c:.4} {sn:.4} {:.4} {c:.4} {x0:.2} {y0:.2} cm\n{ops}Q\n",
        -sn,
    )
}

/// Helvetica-ish ascent above the baseline (points) for `font_size`.
pub fn table_font_ascent(font_size: i32) -> i32 {
    (font_size * 4 / 5).max(6)
}

/// Helvetica-ish descent below the baseline (points) for `font_size`.
pub fn table_font_descent(font_size: i32) -> i32 {
    (font_size / 4).max(2)
}

/// Total row advance for wrapped table cells: ascent + lines + descent + padding.
pub fn table_row_height(line_count: usize, line_step: i32, font_size: i32) -> i32 {
    let lines = line_count.max(1) as i32;
    let ascent = table_font_ascent(font_size);
    let descent = table_font_descent(font_size);
    let vpad = 4;
    ascent + vpad + (lines - 1) * line_step + descent + vpad
}

// ---------------------------------------------------------------------------
// PDF-Datei zusammenbauen
// ---------------------------------------------------------------------------

/// Write n pages as a PDF-1.4 file with embedded Helvetica + Helvetica-Bold
/// and an automatic "Page X of Y" footer.
///
/// Typically called after `let pages = page_builder.finish();`.
pub fn emit_multipage_pdf(page_streams: &[String], pdf_title: &str) -> Result<Vec<u8>, AppError> {
    emit_multipage_pdf_with_images(page_streams, pdf_title, &[], "de")
}

/// Document-level metadata written to the Catalog and Info dictionary.
#[derive(Debug, Clone, Default)]
pub struct PdfDocMeta {
    pub title: String,
    /// Stable document number or registry id (stored in `/Subject`).
    pub subject: Option<String>,
    /// Issuing practice / clinician (`/Author`).
    pub author: Option<String>,
    /// Document language (`de`, `en`, `fr`).
    pub locale: String,
}

/// Like [`emit_multipage_pdf`], with optional Image XObjects (`/Im0` …) and
/// localized page-number footer.
pub fn emit_multipage_pdf_with_images(
    page_streams: &[String],
    pdf_title: &str,
    images: &[super::logo::PdfLogo],
    locale: &str,
) -> Result<Vec<u8>, AppError> {
    emit_pdf_document(
        page_streams,
        &PdfDocMeta {
            title: pdf_title.to_string(),
            locale: locale.to_string(),
            ..Default::default()
        },
        images,
    )
}

/// PDF date string `D:YYYYMMDDHHmmSS+HH'mm'` in local time.
pub fn pdf_date_now() -> String {
    let now = chrono::Local::now();
    let off = now.offset().local_minus_utc();
    let sign = if off < 0 { '-' } else { '+' };
    let off = off.abs();
    format!(
        "D:{}{}{:02}'{:02}'",
        now.format("%Y%m%d%H%M%S"),
        sign,
        off / 3600,
        (off % 3600) / 60
    )
}

/// Write the PDF file (PDF 1.4). Adds `/Lang`, `/DisplayDocTitle`,
/// creation/modification dates, author/subject, the document id
/// (`/MeDocDocumentId`, trailer `/ID`, footer line) and the embedded font
/// subsets the pages use.
pub fn emit_pdf_document(
    page_streams: &[String],
    meta: &PdfDocMeta,
    images: &[super::logo::PdfLogo],
) -> Result<Vec<u8>, AppError> {
    let locale = pdf_locale(&meta.locale);
    let rtl = super::i18n::is_rtl(locale);
    let uid = current_document_uid();
    let pdf_title = meta.title.as_str();
    let n = page_streams.len().max(1);
    let image_count = images.len();

    // Final page streams (page number + document id footer included), so the
    // font scan below sees every glyph.
    let streams: Vec<String> = (0..n)
        .map(|i| {
            let mut stream = page_streams.get(i).cloned().unwrap_or_default();
            append_page_number_footer(&mut stream, i, n, locale, rtl, &uid);
            stream
        })
        .collect();
    let stream_refs: Vec<&str> = streams.iter().map(String::as_str).collect();
    let used = super::fonts::scan_used_glyphs(&stream_refs);

    // Object layout: 1=Catalog, 2=Pages, page/content pairs, Helvetica ×2,
    // embedded fonts (6 objects each), images, Info.
    let font_regular_id = 3 + n * 2;
    let font_bold_id = font_regular_id + 1;
    let mut next_id = font_bold_id + 1;
    let mut embedded: Vec<(&'static super::fonts::LoadedFace, usize)> = Vec::new();
    for face in super::fonts::faces() {
        if used.get(face.res).is_some_and(|g| !g.is_empty()) {
            embedded.push((face, next_id));
            next_id += super::fonts::OBJECTS_PER_FONT;
        }
    }
    let first_image_id = next_id;
    let info_id = first_image_id + image_count;
    let embedded_res: String = embedded
        .iter()
        .map(|(face, id)| format!(" /{} {id} 0 R", face.res))
        .collect();

    let mut out: Vec<u8> = Vec::new();
    let mut offsets: Vec<usize> = Vec::new();

    out.extend_from_slice(b"%PDF-1.4\n");
    out.extend_from_slice(b"%\xE2\xE3\xCF\xD3\n"); // binary marker

    // 1 0 obj — Catalog
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Lang {} \
             /ViewerPreferences << /DisplayDocTitle true{} >> >>\nendobj\n",
            text_operand(super::i18n::lang_tag(locale)),
            if rtl { " /Direction /R2L" } else { "" },
        )
        .as_bytes(),
    );

    // 2 0 obj — Pages tree
    offsets.push(out.len());
    let kids: String = (0..n)
        .map(|i| format!("{} 0 R", 3 + i * 2))
        .collect::<Vec<_>>()
        .join(" ");
    out.extend_from_slice(
        format!(
            "2 0 obj\n<< /Type /Pages /Kids [{}] /Count {} >>\nendobj\n",
            kids, n
        )
        .as_bytes(),
    );

    let xobject_dict = if image_count == 0 {
        String::new()
    } else {
        let entries: String = (0..image_count)
            .map(|i| format!("/Im{i} {} 0 R", first_image_id + i))
            .collect::<Vec<_>>()
            .join(" ");
        format!(" /XObject << {entries} >>")
    };

    // 3 0 obj .. — Page + Content per page
    for (i, stream) in streams.iter().enumerate() {
        let page_id = 3 + i * 2;
        let content_id = 4 + i * 2;
        let bytes = stream.as_bytes();

        offsets.push(out.len());
        out.extend_from_slice(
            format!(
                "{p} 0 obj\n<< /Type /Page /Parent 2 0 R \
                 /MediaBox [0 0 {w} {h}] \
                 /Resources << /Font << /F1 {f} 0 R /F2 {fb} 0 R{emb} >>{xo} >> \
                 /Contents {c} 0 R >>\nendobj\n",
                p = page_id,
                w = PAGE_WIDTH,
                h = PAGE_HEIGHT,
                f = font_regular_id,
                fb = font_bold_id,
                emb = embedded_res,
                xo = xobject_dict,
                c = content_id,
            )
            .as_bytes(),
        );

        offsets.push(out.len());
        out.extend_from_slice(
            format!(
                "{c} 0 obj\n<< /Length {len} >>\nstream\n",
                c = content_id,
                len = bytes.len()
            )
            .as_bytes(),
        );
        out.extend_from_slice(bytes);
        out.extend_from_slice(b"\nendstream\nendobj\n");
    }

    // Fonts
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
            font_regular_id
        )
        .as_bytes(),
    );
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
            font_bold_id
        )
        .as_bytes(),
    );
    for (face, id) in &embedded {
        let glyphs = used.get(face.res).cloned().unwrap_or_default();
        super::fonts::append_font_objects(&mut out, &mut offsets, *id, face, &glyphs);
    }

    // Images
    for (i, img) in images.iter().enumerate() {
        let id = first_image_id + i;
        offsets.push(out.len());
        out.extend_from_slice(
            format!(
                "{id} 0 obj\n<< /Type /XObject /Subtype /Image \
                 /Width {w} /Height {h} /ColorSpace /DeviceRGB /BitsPerComponent 8 \
                 /Filter /FlateDecode /Length {len} >>\nstream\n",
                id = id,
                w = img.width_px,
                h = img.height_px,
                len = img.data.len(),
            )
            .as_bytes(),
        );
        out.extend_from_slice(&img.data);
        out.extend_from_slice(b"\nendstream\nendobj\n");
    }

    // Info-Dictionary
    offsets.push(out.len());
    let date = pdf_date_now();
    let mut info = format!(
        "<< /Title {} /Producer (MeDoc) /Creator (MeDoc) /CreationDate {} /ModDate {} /MeDocDocumentId ({uid})",
        info_string_operand(pdf_title),
        text_operand(&date),
        text_operand(&date),
    );
    if let Some(s) = meta.subject.as_deref().filter(|s| !s.trim().is_empty()) {
        info.push_str(&format!(" /Subject {}", info_string_operand(s)));
    }
    if let Some(a) = meta.author.as_deref().filter(|s| !s.trim().is_empty()) {
        info.push_str(&format!(" /Author {}", info_string_operand(a)));
    }
    info.push_str(&format!(
        " /Keywords {}",
        info_string_operand(&format!("MeDoc document id {uid}"))
    ));
    info.push_str(" >>");
    out.extend_from_slice(format!("{info_id} 0 obj\n{info}\nendobj\n").as_bytes());

    // xref
    let xref_pos = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n", offsets.len() + 1).as_bytes());
    out.extend_from_slice(b"0000000000 65535 f \n");
    for off in &offsets {
        out.extend_from_slice(format!("{:010} 00000 n \n", off).as_bytes());
    }

    // trailer — /ID from the document id (PDF 1.4 file identifier).
    let id_hex: String = uid.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    let id_hex = if id_hex.len() == 32 {
        id_hex.to_ascii_uppercase()
    } else {
        format!("{:0>32}", id_hex.to_ascii_uppercase())
    };
    out.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info {} 0 R /ID [<{id_hex}> <{id_hex}>] >>\nstartxref\n{}\n%%EOF\n",
            offsets.len() + 1,
            info_id,
            xref_pos,
        )
        .as_bytes(),
    );

    Ok(out)
}

fn page_of_label(locale: &str, page: usize, total: usize) -> String {
    super::i18n::page_label(locale, page, total)
}

/// Page number centred; document id small and grey in the bottom corner
/// (left on Latin pages, right on right-to-left pages).
fn append_page_number_footer(
    stream: &mut String,
    page_index: usize,
    page_total: usize,
    locale: &str,
    rtl: bool,
    uid: &str,
) {
    let label = page_of_label(locale, page_index + 1, page_total);
    let layout = super::text::layout(&label, 9.0, false, rtl);
    let x = (f64::from(PAGE_WIDTH) - layout.width) / 2.0;
    stream.push_str(&super::text::draw_layout(
        x,
        f64::from(PAGE_NUMBER_Y),
        &layout,
        9.0,
    ));

    let id_label = format!(
        "{}: {uid}",
        super::i18n::t(locale, super::i18n::Phrase::DocumentId)
    );
    let id_layout = super::text::layout(&id_label, 6.0, false, rtl);
    let id_x = if rtl {
        f64::from(M_RIGHT) - id_layout.width
    } else {
        f64::from(M_LEFT)
    };
    stream.push_str("q 0.45 g\n");
    stream.push_str(&super::text::draw_layout(
        id_x,
        f64::from(PAGE_NUMBER_Y),
        &id_layout,
        6.0,
    ));
    stream.push_str("Q\n");
}

// ---------------------------------------------------------------------------
// Text helpers: wrap and hyphenation
// ---------------------------------------------------------------------------

fn char_len(s: &str) -> usize {
    s.chars().count()
}

fn is_vowel(c: char) -> bool {
    matches!(
        c,
        'a' | 'e'
            | 'i'
            | 'o'
            | 'u'
            | 'ä'
            | 'ö'
            | 'ü'
            | 'y'
            | 'A'
            | 'E'
            | 'I'
            | 'O'
            | 'U'
            | 'Ä'
            | 'Ö'
            | 'Ü'
            | 'Y'
    )
}

/// Soft wrap — breaks ONLY on whitespace, never mid-word.
/// For table cells and short fields where hyphens would be distracting.
pub fn wrap_soft(text: &str, max_chars: usize) -> Vec<String> {
    let width = max_chars.clamp(4, 200);
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        let trimmed = paragraph.trim_end();
        if trimmed.is_empty() {
            lines.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in trimmed.split_whitespace() {
            if current.is_empty() {
                current.push_str(word);
            } else if char_len(&current) + 1 + char_len(word) <= width {
                current.push(' ');
                current.push_str(word);
            } else {
                lines.push(std::mem::take(&mut current));
                current.push_str(word);
            }
        }
        if !current.is_empty() {
            lines.push(current);
        }
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

/// Wrap for the document language: German text breaks long compounds at
/// syllable points ([`wrap_text`]); every other language wraps on spaces only
/// — German syllable rules produced wrong hyphens in French and English, and
/// a hyphen inside an Arabic word disconnects its letters.
pub fn wrap_text_locale(text: &str, max_chars: usize, locale: &str) -> Vec<String> {
    if pdf_locale(locale) == "de" {
        wrap_text(text, max_chars)
    } else {
        wrap_soft(text, max_chars)
    }
}

/// German flowing-text wrap — also breaks long compounds at syllable points
/// (prefix/suffix heuristic + vowel/consonant change) with a hyphen.
/// Arabic (and other non-WinAnsi) text never hyphenates — that disconnects
/// joining letter forms — so it falls back to soft whitespace wrapping.
pub fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    if !super::text::is_helvetica_only(&super::text::prepare(text)) {
        return wrap_soft(text, max_chars);
    }
    let width = max_chars.clamp(12, 200);
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        let trimmed = paragraph.trim_end();
        if trimmed.is_empty() {
            lines.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in trimmed.split_whitespace() {
            let pieces = hyphenate_german_word(word, width);
            for part in pieces {
                if current.is_empty() {
                    current = part;
                } else if char_len(&current) + 1 + char_len(&part) <= width {
                    current.push(' ');
                    current.push_str(&part);
                } else {
                    lines.push(std::mem::take(&mut current));
                    current = part;
                }
            }
        }
        if !current.is_empty() {
            lines.push(current);
        }
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn hyphenate_german_word(word: &str, width: usize) -> Vec<String> {
    if char_len(word) <= width {
        return vec![word.to_string()];
    }
    if word.contains('-') {
        let mut out = Vec::new();
        let mut acc = String::new();
        for (i, seg) in word.split('-').enumerate() {
            let piece = if i == 0 {
                seg.to_string()
            } else {
                format!("-{seg}")
            };
            if acc.is_empty() {
                acc = piece;
            } else if char_len(&acc) + char_len(&piece) <= width {
                acc.push_str(&piece);
            } else {
                out.extend(hyphenate_german_word(&acc, width));
                acc = piece;
            }
        }
        if !acc.is_empty() {
            out.extend(hyphenate_german_word(&acc, width));
        }
        return out;
    }
    pack_word_at_hyphen_points(word, width)
}

fn collect_german_hyphen_points(word: &str) -> Vec<usize> {
    let chars: Vec<char> = word.chars().collect();
    let n = chars.len();
    if n < 5 {
        return Vec::new();
    }
    let lower: String = chars.iter().collect::<String>().to_lowercase();
    let mut set = std::collections::BTreeSet::new();

    const PREFIXES: &[&str] = &[
        "be",
        "ge",
        "ver",
        "zer",
        "er",
        "emp",
        "ent",
        "auf",
        "aus",
        "ein",
        "über",
        "examination",
        "voll",
        "teil",
        "haus",
        "grund",
        "haupt",
        "neben",
        "zwischen",
    ];
    for p in PREFIXES {
        if lower.starts_with(p) && n > p.len() + 4 {
            set.insert(p.len());
        }
    }

    const SUFFIXES: &[&str] = &[
        "ierung", "schaft", "heit", "keit", "chen", "lein", "ieren", "isch", "lich", "los", "bar",
        "sam", "haft", "nis", "tum", "ung", "ion",
    ];
    for s in SUFFIXES {
        if let Some(pos) = lower.find(s) {
            if pos >= 3 && pos + s.len() < n {
                set.insert(pos);
            }
        }
    }

    for i in 2..n.saturating_sub(3) {
        let a = chars[i - 1];
        let b = chars[i];
        if is_vowel(a) != is_vowel(b) {
            set.insert(i);
        }
    }

    set.into_iter()
        .filter(|&i| i >= 2 && i <= n.saturating_sub(3))
        .collect()
}

fn pack_word_at_hyphen_points(word: &str, width: usize) -> Vec<String> {
    let chars: Vec<char> = word.chars().collect();
    let mut breaks = collect_german_hyphen_points(word);
    breaks.sort_unstable();
    breaks.dedup();

    if breaks.is_empty() {
        return vec![word.to_string()];
    }

    let mut syllables: Vec<String> = Vec::new();
    let mut start = 0usize;
    for b in breaks {
        if b > start && b <= chars.len() {
            syllables.push(chars[start..b].iter().collect());
            start = b;
        }
    }
    if start < chars.len() {
        syllables.push(chars[start..].iter().collect());
    }
    if syllables.is_empty() {
        return vec![word.to_string()];
    }

    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();
    for (idx, syl) in syllables.iter().enumerate() {
        let is_last = idx + 1 == syllables.len();
        let piece = if current.is_empty() {
            syl.clone()
        } else {
            format!("{current}{syl}")
        };
        let with_hyphen = if is_last {
            piece.clone()
        } else {
            format!("{piece}-")
        };
        if char_len(&with_hyphen) <= width {
            current = with_hyphen;
        } else if current.is_empty() {
            lines.push(with_hyphen);
            current.clear();
        } else {
            lines.push(current);
            current = if is_last {
                syl.clone()
            } else {
                format!("{syl}-")
            };
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push(word.to_string());
    }
    lines
}

// ---------------------------------------------------------------------------
// Format-Helfer
// ---------------------------------------------------------------------------

/// ISO `YYYY-MM-DD` → `DD.MM.YYYY` (DIN 5008, German practices) or `DD/MM/YYYY`
/// (France, Morocco and the rest of the EU). Other inputs returned unchanged.
pub fn format_date_dmy(iso: &str) -> String {
    let d = iso.trim();
    if d.len() >= 10 && d.as_bytes().get(4) == Some(&b'-') && d.as_bytes().get(7) == Some(&b'-') {
        let sep = if super::i18n::legal_jurisdiction(super::i18n::default_document_locale()) == "de" { '.' } else { '/' };
        return format!("{}{sep}{}{sep}{}", &d[8..10], &d[5..7], &d[0..4]);
    }
    d.to_string()
}

static DOCUMENT_CURRENCY: std::sync::Mutex<String> = std::sync::Mutex::new(String::new());

const DOCUMENT_CURRENCIES: &[&str] = &[
    "EUR", "USD", "GBP", "CHF", "MAD", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "CZK", "TND",
    "AED", "SAR",
];

pub fn is_known_currency(code: &str) -> bool {
    let next = code.trim().to_ascii_uppercase();
    DOCUMENT_CURRENCIES.contains(&next.as_str())
}

/// Practice currency for money on screen and on documents. Unknown codes stay EUR.
pub fn set_document_currency(code: &str) {
    let next = code.trim().to_ascii_uppercase();
    let next = if DOCUMENT_CURRENCIES.contains(&next.as_str()) {
        next
    } else {
        "EUR".to_string()
    };
    if let Ok(mut guard) = DOCUMENT_CURRENCY.lock() {
        *guard = next;
    }
}

pub fn document_currency() -> String {
    DOCUMENT_CURRENCY
        .lock()
        .ok()
        .map(|g| {
            if g.is_empty() {
                "EUR".to_string()
            } else {
                g.clone()
            }
        })
        .unwrap_or_else(|| "EUR".to_string())
}

/// Cent value → "1.234,56 EUR" (DIN-style, ASCII — Helvetica has no reliable € glyph).
/// The suffix is the practice currency from [`document_currency`].
pub fn format_eur(cents: i64) -> String {
    let neg = cents < 0;
    let version = cents.abs();
    let euros = version / 100;
    let frac = version % 100;
    let mut grouped = String::new();
    let s = euros.to_string();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let euros_de: String = grouped.chars().rev().collect();
    format!(
        "{}{},{:02} {}",
        if neg { "-" } else { "" },
        euros_de,
        frac,
        document_currency()
    )
}

/// Money for a payment, invoice, or chart PDF: keep the number, end with the
/// practice currency. "120,00", "120,00 USD", and "120,00 €" all become
/// "120,00 MAD" when MAD is selected. Dates and other text are left as written.
pub fn ensure_money_currency(raw: &str) -> String {
    let sanitized = sanitize_pdf_money(raw);
    let trimmed = sanitized.trim();
    if trimmed.is_empty() || trimmed == "-" || trimmed == "—" {
        return trimmed.to_string();
    }
    let mut core = trimmed.to_string();
    if let Some(rest) = strip_known_currency_suffix(&core) {
        core = rest;
    } else if let Some(rest) = strip_known_currency_prefix(&core) {
        core = rest;
    }
    let core = core.trim();
    if !looks_like_money_number(core) {
        return trimmed.to_string();
    }
    format!("{core} {}", document_currency())
}

fn strip_known_currency_suffix(value: &str) -> Option<String> {
    let value = value.trim_end();
    for code in DOCUMENT_CURRENCIES {
        let Some(rest) = value.strip_suffix(code) else {
            continue;
        };
        if rest
            .chars()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric())
        {
            continue;
        }
        return Some(rest.trim_end().to_string());
    }
    None
}

fn strip_known_currency_prefix(value: &str) -> Option<String> {
    let value = value.trim_start();
    for code in DOCUMENT_CURRENCIES {
        let Some(rest) = value.strip_prefix(code) else {
            continue;
        };
        if rest
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric())
        {
            continue;
        }
        return Some(rest.trim_start().to_string());
    }
    None
}

/// "1.234,56", "1,234.56", "70.00", "-12,94". Not a date ("02.11.2026").
fn looks_like_money_number(core: &str) -> bool {
    let t = core
        .trim()
        .trim_start_matches('+')
        .trim_start_matches('-')
        .trim();
    let (head, frac) = if let Some(pair) = t.rsplit_once(',') {
        pair
    } else if let Some(pair) = t.rsplit_once('.') {
        pair
    } else {
        return false;
    };
    frac.len() == 2
        && frac.chars().all(|c| c.is_ascii_digit())
        && !head.is_empty()
        && head.chars().any(|c| c.is_ascii_digit())
        && head
            .chars()
            .all(|c| c.is_ascii_digit() || matches!(c, '.' | ',' | ' ' | '\u{a0}'))
}

/// Make money / label text safe for Helvetica WinAnsi (no zero-width €, no NBSP).
pub fn sanitize_pdf_money(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        match c {
            '€' => {
                let code = document_currency();
                let prev = out.chars().last();
                if prev.map(|p| p.is_ascii_digit()).unwrap_or(false) {
                    if prev != Some(' ') {
                        out.push(' ');
                    }
                    out.push_str(&code);
                } else {
                    out.push_str(&code);
                    let next = chars.get(i + 1).copied();
                    if next.map(|n| n.is_ascii_digit()).unwrap_or(false) {
                        out.push(' ');
                    }
                }
            }
            '\u{00A0}' | '\u{202F}' | '\u{2007}' | '\u{2009}' => out.push(' '),
            '\u{2212}' => out.push('-'),
            other => out.push(other),
        }
        i += 1;
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Truncate a cell so it fits a table field (with `...` ellipsis).
pub fn truncate_cell(s: &str, max_chars: usize) -> String {
    let count = s.chars().count();
    if count <= max_chars {
        return s.to_string();
    }
    let mut t: String = s.chars().take(max_chars.saturating_sub(1)).collect();
    t.push('…');
    t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn winansi_handles_german_umlauts() {
        assert_eq!(winansi_byte('ä'), Some(0xE4));
        assert_eq!(winansi_byte('ö'), Some(0xF6));
        assert_eq!(winansi_byte('ü'), Some(0xFC));
        assert_eq!(winansi_byte('ß'), Some(0xDF));
        assert_eq!(winansi_byte('€'), Some(0x80));
    }

    #[test]
    fn winansi_handles_math_signs() {
        assert_eq!(winansi_byte('×'), Some(0xD7));
        assert_eq!(winansi_byte('÷'), Some(0xF7));
        assert_eq!(winansi_byte('°'), Some(0xB0));
        let op = text_operand("2× täglich");
        assert!(op.starts_with('('), "should stay WinAnsi, got: {op}");
    }

    #[test]
    fn winansi_returns_none_for_unmappable() {
        assert!(winansi_byte('中').is_none());
        assert!(winansi_byte('🦷').is_none());
    }

    #[test]
    fn text_operand_uses_winansi_for_german() {
        let op = text_operand("für 12,50 €");
        assert!(op.starts_with('('));
        assert!(op.contains("\\374") || op.contains("ü"));
        assert!(op.contains("\\200") || op.contains("€"));
    }

    #[test]
    fn arabic_receipt_text_uses_the_embedded_font() {
        let mut pb = PageBuilder::new();
        pb.locale = "ar";
        pb.text(M_LEFT, 16, true, "فاتورة");
        pb.text(M_LEFT, 11, false, "Facture");
        pb.text(M_LEFT, 11, false, "Invoice");
        pb.text(M_LEFT, 11, true, "Rechnung");
        let pages = pb.finish();
        let pdf = emit_pdf_document(
            &pages,
            &PdfDocMeta {
                title: "فاتورة".into(),
                locale: "ar".into(),
                ..Default::default()
            },
            &[],
        )
        .unwrap();
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains("+NotoNaskhArabic"), "arabic font is embedded");
        assert!(
            text.contains("/F4 "),
            "bold arabic run uses the bold arabic font"
        );
        assert!(text.contains("(Facture)"));
        assert!(text.contains("(Invoice)"));
        assert!(text.contains("(Rechnung)"));
        assert!(is_pdf_renderable("فاتورة"));
        assert!(is_pdf_renderable("Rechnung"));
        assert!(!is_pdf_renderable("中文"));
    }

    #[test]
    fn text_operand_never_emits_utf16_into_content_streams() {
        let op = text_operand("中文 ok");
        assert_eq!(op, "(?? ok)");
        assert!(!is_winansi_renderable("مرحبا"));
        assert!(is_winansi_renderable("Zahnärztin – 12,50 €"));
    }

    #[test]
    fn info_string_keeps_unicode() {
        assert!(info_string_operand("中文").starts_with("<FEFF"));
    }

    #[test]
    fn din_5008_form_b_positions() {
        // 45 mm, 90 mm, 105 mm from top.
        assert!((LETTERHEAD_MIN_Y - 714).abs() <= 1);
        assert!((ADDRESS_WINDOW_BOTTOM_Y - 587).abs() <= 1);
        assert!((FOLD_MARK_1_Y - 544).abs() <= 1);
        assert_eq!(M_LEFT, 71);
    }

    #[test]
    fn footer_watermark_and_continuation_are_emitted() {
        let mut pb = PageBuilder::new();
        pb.footer_lines = vec!["Praxis Dr. Test · Steuer-Nr. 12/345/67890".into()];
        pb.watermark = Some("ENTWURF".into());
        pb.letter_marks = true;
        pb.set_continuation("Praxis Dr. Test", "Rechnung", "de");
        pb.text(M_LEFT, 10, false, "Seite eins");
        pb.break_page();
        pb.text(M_LEFT, 10, false, "Seite zwei");
        let pages = pb.finish();
        assert_eq!(pages.len(), 2);
        assert!(pages
            .iter()
            .all(|p| p.contains("Steuer-Nr.") && p.contains("(ENTWURF)")));
        assert!(pages[1].contains("Rechnung \\(Fortsetzung\\)"));
    }

    #[test]
    fn pdf_has_lang_and_dates() {
        let bytes = emit_pdf_document(
            &["".into()],
            &PdfDocMeta {
                title: "Rechnung RE-2026-000001".into(),
                subject: Some("RE-2026-000001".into()),
                author: Some("Praxis Dr. Test".into()),
                locale: "de".into(),
            },
            &[],
        )
        .unwrap();
        let s = String::from_utf8_lossy(&bytes);
        assert!(s.contains("/Lang (de-DE)"));
        assert!(s.contains("/CreationDate (D:"));
        assert!(s.contains("/DisplayDocTitle true"));
        assert!(s.contains("Seite 1 von 1"));
    }

    #[test]
    fn format_date_dmy_converts_iso() {
        assert_eq!(format_date_dmy("2026-04-19"), "19.04.2026");
        assert_eq!(format_date_dmy("invalid"), "invalid");
        assert_eq!(format_date_dmy(""), "");
    }

    #[test]
    fn format_eur_groups_thousands() {
        assert_eq!(format_eur(0), "0,00 EUR");
        assert_eq!(format_eur(1250), "12,50 EUR");
        assert_eq!(format_eur(1234567), "12.345,67 EUR");
        assert_eq!(format_eur(-100), "-1,00 EUR");
    }

    #[test]
    fn sanitize_pdf_money_replaces_euro_glyph() {
        assert_eq!(sanitize_pdf_money("€99.00"), "EUR 99.00");
        assert_eq!(sanitize_pdf_money("0,00 €"), "0,00 EUR");
        assert_eq!(sanitize_pdf_money("79,00\u{00A0}€"), "79,00 EUR");
    }

    #[test]
    fn ensure_money_currency_uses_practice_code() {
        assert_eq!(ensure_money_currency("120,00"), "120,00 EUR");
        assert_eq!(ensure_money_currency("120,00 USD"), "120,00 EUR");
        assert_eq!(ensure_money_currency("USD 120.00"), "120.00 EUR");
        assert_eq!(ensure_money_currency("45,00 €"), "45,00 EUR");
        assert_eq!(ensure_money_currency("-12,94"), "-12,94 EUR");
        assert_eq!(ensure_money_currency("Checkup"), "Checkup");
        assert_eq!(ensure_money_currency("02.11.2026"), "02.11.2026");
        assert_eq!(ensure_money_currency("-"), "-");
    }

    #[test]
    fn table_row_band_covers_ascent_above_baseline() {
        let baseline = 500;
        let font = 9;
        let h = table_row_height(1, 12, font);
        let ascent = table_font_ascent(font);
        let y_bottom = baseline + ascent - h;
        let y_top = y_bottom + h;
        assert!(
            y_top > baseline,
            "band top {y_top} must be above baseline {baseline}"
        );
        assert!(
            y_bottom < baseline,
            "band bottom {y_bottom} must be below baseline"
        );
        assert_eq!(y_top - baseline, ascent);
    }

    #[test]
    fn wrap_soft_keeps_words_intact() {
        let lines = wrap_soft("Hello World Foo Bar", 10);
        assert!(lines.iter().all(|l| l.chars().count() <= 10));
    }

    #[test]
    fn wrap_text_hyphenates_long_compounds() {
        let lines = wrap_text("Insurance number patient card", 14);
        assert!(lines.len() >= 2);
    }

    #[test]
    fn approx_text_width_scales_with_size() {
        let a = approx_text_width("Hallo", 10);
        let b = approx_text_width("Hallo", 20);
        assert!(b > a);
    }

    #[test]
    fn page_builder_produces_at_least_one_page() {
        let pb = PageBuilder::new();
        let pages = pb.finish();
        assert_eq!(pages.len(), 1);
    }

    #[test]
    fn emit_multipage_pdf_writes_valid_pdf() {
        let mut pb = PageBuilder::new();
        pb.text(M_LEFT, 12, false, "Hello");
        let pages = pb.finish();
        let bytes = emit_multipage_pdf(&pages, "Test").unwrap();
        assert!(bytes.starts_with(b"%PDF-1.4"));
        assert!(bytes.ends_with(b"%%EOF\n"));
        let s = String::from_utf8_lossy(&bytes);
        assert!(s.contains("Seite 1 von 1"));
    }
}
