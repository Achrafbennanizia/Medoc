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

/// Left content margin — DIN 5008: 25 mm = 71 pt; we use 50 pt for more
/// table width, while remaining compatible with window envelopes.
pub const M_LEFT: i32 = 50;
/// Right content margin — symmetric.
pub const M_RIGHT: i32 = 545;
/// Top content start (PDF Y-axis: 0 at bottom, 842 at top).
pub const M_TOP: i32 = 810;
/// Bottom margin (content ends here; below only page number and optional footer).
pub const M_BOTTOM: i32 = 60;

/// Content width = M_RIGHT − M_LEFT.
pub const CONTENT_WIDTH: i32 = M_RIGHT - M_LEFT;

/// Y of the return-address line in the window envelope (DIN 5008 A: 50 mm from top).
pub const SENDER_HINT_Y: i32 = 720;
/// Y of the first address-field line (DIN 5008 A: ~55 mm).
pub const ADDRESS_WINDOW_Y: i32 = 700;
/// Height of the address field (DIN 5008 A: 45 mm = ~128 pt).
pub const ADDRESS_WINDOW_HEIGHT: i32 = 128;

/// Y where the page-number footer is rendered.
pub const PAGE_NUMBER_Y: i32 = 30;
/// Y where the signature footer area begins.
pub const SIGNATURE_FOOTER_Y: i32 = 90;

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/// Map a Unicode code point to WinAnsi (Helvetica Type-1).
///
/// Covers all characters relevant for German practice text — when not
/// mapped, `None` signals the caller to switch **the entire string**
/// to UTF-16BE hex (PDF hex literal `<…>`).
fn winansi_byte(ch: char) -> Option<u8> {
    if ch.is_ascii() {
        return Some(ch as u8);
    }
    Some(match ch {
        '\u{00A0}' => 0xA0,
        '\u{00A1}' => 0xA1,
        '\u{00A2}' => 0xA2,
        '\u{00A3}' => 0xA3,
        '\u{00A4}' => 0xA4,
        '\u{00A5}' => 0xA5,
        '\u{00A6}' => 0xA6,
        '\u{00A7}' => 0xA7,
        '\u{00A8}' => 0xA8,
        '\u{00A9}' => 0xA9,
        '\u{00AA}' => 0xAA,
        '\u{00AB}' => 0xAB,
        '\u{00AC}' => 0xAC,
        '\u{00AD}' => 0xAD,
        '\u{00AE}' => 0xAE,
        '\u{00AF}' => 0xAF,
        '\u{00B0}' => 0xB0,
        '\u{00B1}' => 0xB1,
        '\u{00B2}' => 0xB2,
        '\u{00B3}' => 0xB3,
        '\u{00B4}' => 0xB4,
        '\u{00B5}' => 0xB5,
        '\u{00B6}' => 0xB6,
        '\u{00B7}' => 0xB7,
        '\u{00B8}' => 0xB8,
        '\u{00B9}' => 0xB9,
        '\u{00BA}' => 0xBA,
        '\u{00BB}' => 0xBB,
        '\u{00BC}' => 0xBC,
        '\u{00BD}' => 0xBD,
        '\u{00BE}' => 0xBE,
        '\u{00BF}' => 0xBF,
        // German Umlauts
        'Ä' => 0xC4,
        'Å' => 0xC5,
        'Ö' => 0xD6,
        'Ø' => 0xD8,
        'Ü' => 0xDC,
        'ß' => 0xDF,
        'ä' => 0xE4,
        'å' => 0xE5,
        'ö' => 0xF6,
        'ø' => 0xF8,
        'ü' => 0xFC,
        'É' => 0xC9,
        'È' => 0xC8,
        'Ê' => 0xCA,
        'é' => 0xE9,
        'è' => 0xE8,
        'ê' => 0xEA,
        'ç' => 0xE7,
        'Ç' => 0xC7,
        'ñ' => 0xF1,
        'Ñ' => 0xD1,
        '\u{00D7}' => 0xD7, // × Multiplikationszeichen
        '\u{00F7}' => 0xF7, // ÷ Divisionszeichen
        // CP1252 (WinAnsi) extensions
        '€' => 0x80,
        '\u{201A}' => 0x82, // ‚ low single quote
        'ƒ' => 0x83,
        '\u{201E}' => 0x84, // „ low double quote
        '\u{2026}' => 0x85, // …
        '\u{2020}' => 0x86, // †
        '\u{2021}' => 0x87, // ‡
        '\u{02C6}' => 0x88, // ˆ
        '\u{2030}' => 0x89, // ‰
        'Š' => 0x8A,
        '\u{2039}' => 0x8B, // ‹
        'Œ' => 0x8C,
        'Ž' => 0x8E,
        '\u{2018}' => 0x91, // '
        '\u{2019}' => 0x92, // '
        '\u{201C}' => 0x93, // "
        '\u{201D}' => 0x94, // "
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
        // Mathematik / typographische Striche → ASCII-Fallback
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

/// Encode a text literal for the PDF content stream.
///
/// **Rule:** If **every** character is WinAnsi-mappable, write a literal
/// `(…)`. If **at least one** character is not, write the **complete**
/// string as UTF-16BE hex `<FEFF…>` (otherwise unmappable characters
/// are lost or become `?`).
///
/// Note: Helvetica Type-1 fonts only support WinAnsi glyphs.
/// Pure Unicode hex strings render as empty boxes in most viewers —
/// but that is better than silent data loss.
pub fn text_operand(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    for ch in s.chars() {
        match winansi_byte(ch) {
            Some(b) => bytes.push(b),
            None => {
                // At least one character not mappable → entire string as
                // UTF-16BE-Hex schreiben.
                let mut hex = String::from("<FEFF");
                for unit in s.encode_utf16() {
                    let _ = write!(hex, "{:04X}", unit);
                }
                hex.push('>');
                return hex;
            }
        }
    }
    format!("({})", pdf_escape_winansi_bytes(&bytes))
}

/// Rough text width of a line in PDF points — for right/center alignment.
///
/// Helvetica average: ~0.50–0.55 × fontsize per character. We use 0.52
/// and round. Umlauts count like ASCII letters (WinAnsi byte = 1).
pub fn approx_text_width(s: &str, font_size: i32) -> i32 {
    let cw = (font_size as f32 * 0.52).round() as i32;
    let n = s.chars().count() as i32;
    n * cw
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
        }
    }

    /// Use a different top-of-page start (e.g. after letterhead).
    pub fn with_page_top(mut self, page_top: i32) -> Self {
        self.page_top = page_top;
        self.y = page_top;
        self
    }

    /// Force a page break — the next write starts
    /// at `y = self.page_top`.
    pub fn break_page(&mut self) {
        if !self.cur.is_empty() {
            self.pages.push(std::mem::take(&mut self.cur));
        }
        self.y = self.page_top;
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
        let font = if bold { "F2" } else { "F1" };
        let op = text_operand(s);
        let _ = writeln!(
            self.cur,
            "BT /{font} {size} Tf {x} {y} Td {op} Tj ET",
            font = font,
            size = size,
            x = x,
            y = self.y,
            op = op,
        );
    }

    /// Text right-aligned to right margin `x_right`.
    pub fn text_right(&mut self, x_right: i32, size: i32, bold: bool, s: &str) {
        let w = approx_text_width(s, size);
        let x = (x_right - w).max(M_LEFT);
        self.text(x, size, bold, s);
    }

    /// Text centered between `M_LEFT` and `M_RIGHT`.
    pub fn text_center(&mut self, size: i32, bold: bool, s: &str) {
        let w = approx_text_width(s, size);
        let x = M_LEFT + (CONTENT_WIDTH - w) / 2;
        self.text(x.max(M_LEFT), size, bold, s);
    }

    /// Multi-line paragraph with soft wrap (`wrap_soft`). Automatically uses
    /// `advance(size + 4)` per line and handles page breaks itself.
    pub fn paragraph(&mut self, text: &str, size: i32, max_chars: usize, indent: i32) {
        for raw_line in text.split('\n') {
            if raw_line.trim().is_empty() {
                self.advance(size / 2);
                continue;
            }
            for chunk in wrap_soft(raw_line, max_chars) {
                self.ensure_space(size + 6);
                self.text(M_LEFT + indent, size, false, &chunk);
                self.advance(size + 4);
            }
        }
    }

    /// Horizontal line at the current `y` position.
    pub fn hline(&mut self, x1: i32, x2: i32) {
        let _ = writeln!(self.cur, "{} {} m {} {} l S", x1, self.y, x2, self.y);
    }

    /// Horizontal line at an arbitrary `y` position (page element, e.g.
    /// letterhead divider).
    pub fn hline_at(&mut self, x1: i32, y: i32, x2: i32) {
        let _ = writeln!(self.cur, "{} {} m {} {} l S", x1, y, x2, y);
    }

    /// Filled rectangle (grayscale). `y_bottom` is the bottom edge.
    pub fn fill_rect(&mut self, x: i32, y_bottom: i32, w: i32, h: i32, gray: f64) {
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
    pub fn table_header_band(&mut self, x: i32, y_text_baseline: i32, w: i32) {
        // Start ~2 pt above baseline, 14 pt tall — fits fs=8..10.
        self.fill_rect(x, y_text_baseline - 4, w, 16, 0.92);
    }

    /// Finish the current stream and return all pages.
    /// Guarantees at least one page (even if empty) so `emit_multipage_pdf`
    /// does not crash.
    pub fn finish(mut self) -> Vec<String> {
        if !self.cur.is_empty() {
            self.pages.push(self.cur);
        }
        if self.pages.is_empty() {
            self.pages.push(String::new());
        }
        self.pages
    }
}

// ---------------------------------------------------------------------------
// PDF-Datei zusammenbauen
// ---------------------------------------------------------------------------

/// Write n pages as a PDF-1.4 file with embedded Helvetica + Helvetica-Bold
/// and an automatic "Seite X von Y" footer.
///
/// Typically called after `let pages = page_builder.finish();`.
pub fn emit_multipage_pdf(page_streams: &[String], pdf_title: &str) -> Result<Vec<u8>, AppError> {
    let n = page_streams.len().max(1);
    let font_regular_id = 3 + n * 2;
    let font_bold_id = font_regular_id + 1;
    let info_id = font_bold_id + 1;

    let mut out: Vec<u8> = Vec::new();
    let mut offsets: Vec<usize> = Vec::new();

    out.extend_from_slice(b"%PDF-1.4\n");
    out.extend_from_slice(b"%\xE2\xE3\xCF\xD3\n"); // binary marker

    // 1 0 obj — Catalog
    offsets.push(out.len());
    out.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

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

    // 3 0 obj .. — Page + Content per page
    for i in 0..n {
        let page_id = 3 + i * 2;
        let content_id = 4 + i * 2;

        let mut stream = page_streams.get(i).cloned().unwrap_or_default();
        append_page_number_footer(&mut stream, i, n);
        let bytes = stream.as_bytes();

        offsets.push(out.len());
        out.extend_from_slice(
            format!(
                "{p} 0 obj\n<< /Type /Page /Parent 2 0 R \
                 /MediaBox [0 0 {w} {h}] \
                 /Resources << /Font << /F1 {f} 0 R /F2 {fb} 0 R >> >> \
                 /Contents {c} 0 R >>\nendobj\n",
                p = page_id,
                w = PAGE_WIDTH,
                h = PAGE_HEIGHT,
                f = font_regular_id,
                fb = font_bold_id,
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

    // Info-Dictionary
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{} 0 obj\n<< /Title {} /Producer (MeDoc) /Creator (MeDoc) >>\nendobj\n",
            info_id,
            text_operand(pdf_title),
        )
        .as_bytes(),
    );

    // xref
    let xref_pos = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n", offsets.len() + 1).as_bytes());
    out.extend_from_slice(b"0000000000 65535 f \n");
    for off in &offsets {
        out.extend_from_slice(format!("{:010} 00000 n \n", off).as_bytes());
    }

    // trailer
    out.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info {} 0 R >>\nstartxref\n{}\n%%EOF\n",
            offsets.len() + 1,
            info_id,
            xref_pos,
        )
        .as_bytes(),
    );

    Ok(out)
}

fn append_page_number_footer(stream: &mut String, page_index: usize, page_total: usize) {
    let label = format!("Seite {} von {}", page_index + 1, page_total);
    let op = text_operand(&label);
    // Centered in the footer.
    let x = (PAGE_WIDTH - approx_text_width(&label, 9)) / 2;
    let _ = writeln!(
        stream,
        "BT /F1 9 Tf {x} {y} Td {op} Tj ET",
        x = x,
        y = PAGE_NUMBER_Y,
        op = op,
    );
}

// ---------------------------------------------------------------------------
// Text-Helfer: Umbruch und Hyphenation
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

/// German flowing-text wrap — also breaks long compounds at syllable points
/// (prefix/suffix heuristic + vowel/consonant change) with a hyphen.
pub fn wrap_de(text: &str, max_chars: usize) -> Vec<String> {
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
        "be", "ge", "ver", "zer", "er", "emp", "ent", "auf", "aus", "ein", "über", "unter", "voll",
        "teil", "haus", "grund", "haupt", "neben", "zwischen",
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

/// ISO `YYYY-MM-DD` → DIN `DD.MM.YYYY`. Other inputs returned unchanged.
pub fn format_date_de(iso: &str) -> String {
    let d = iso.trim();
    if d.len() >= 10 && d.as_bytes().get(4) == Some(&b'-') && d.as_bytes().get(7) == Some(&b'-') {
        return format!("{}.{}.{}", &d[8..10], &d[5..7], &d[0..4]);
    }
    d.to_string()
}

/// Cent value → "1.234,56 €" (DIN 5008 / German number format).
pub fn format_eur_de(cents: i64) -> String {
    let neg = cents < 0;
    let v = cents.abs();
    let euros = v / 100;
    let frac = v % 100;
    let mut grouped = String::new();
    let s = euros.to_string();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let euros_de: String = grouped.chars().rev().collect();
    format!("{}{},{:02} €", if neg { "-" } else { "" }, euros_de, frac)
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
    fn text_operand_falls_back_to_utf16_for_cjk() {
        let op = text_operand("中文");
        assert!(op.starts_with("<FEFF"));
        assert!(op.ends_with('>'));
    }

    #[test]
    fn format_date_de_converts_iso() {
        assert_eq!(format_date_de("2026-04-19"), "19.04.2026");
        assert_eq!(format_date_de("invalid"), "invalid");
        assert_eq!(format_date_de(""), "");
    }

    #[test]
    fn format_eur_de_groups_thousands() {
        assert_eq!(format_eur_de(0), "0,00 €");
        assert_eq!(format_eur_de(1250), "12,50 €");
        assert_eq!(format_eur_de(1234567), "12.345,67 €");
        assert_eq!(format_eur_de(-100), "-1,00 €");
    }

    #[test]
    fn wrap_soft_keeps_words_intact() {
        let lines = wrap_soft("Hallo Welt Foo Bar", 10);
        assert!(lines.iter().all(|l| l.chars().count() <= 10));
    }

    #[test]
    fn wrap_de_hyphenates_long_compounds() {
        let lines = wrap_de("Versicherungsnummer Patientenkarte", 14);
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
        assert!(s.contains("Seite 1 von 1") || s.contains("(Seite"));
    }
}
