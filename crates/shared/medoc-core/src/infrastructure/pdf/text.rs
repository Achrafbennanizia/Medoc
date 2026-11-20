//! Text engine for every string MeDoc draws into a PDF.
//!
//! One line of text goes through four steps:
//!
//! 1. **Prepare** — Unicode NFC, Arabic presentation forms back to letters,
//!    exotic spaces/dashes to plain ones, symbols without a glyph to a
//!    readable stand-in ("≥" → ">="), emoji and invisible format characters
//!    dropped. macOS input (NFD "e" + U+0301) becomes "é" and stays Helvetica.
//! 2. **Bidi** — the Unicode Bidirectional Algorithm (UAX #9) orders the runs
//!    visually. An Arabic sentence with a date, a number or a Latin word in
//!    it reads correctly instead of being drawn in typing order.
//! 3. **Fonts** — WinAnsi words use Helvetica (`/F1`, `/F2`). Arabic script
//!    uses Noto Naskh Arabic, anything else Noto Sans (see [`super::fonts`]).
//! 4. **Shaping** — embedded-font runs are shaped with rustybuzz (HarfBuzz):
//!    Arabic letters join, lam-alef ligatures form, marks sit on their base,
//!    and brackets mirror inside right-to-left runs.
//!
//! [`width_pt`] and [`draw_ops`] use the same layout, so a measured string
//! is drawn exactly as wide as it was measured.

use std::fmt::Write as _;

use rustybuzz::{script, Direction, UnicodeBuffer};
use unicode_bidi::{BidiInfo, Level};
use unicode_normalization::char::decompose_canonical;
use unicode_normalization::UnicodeNormalization;

use super::fonts::{self, FontRole, LoadedFace};

// ---------------------------------------------------------------------------
// Character classes
// ---------------------------------------------------------------------------

pub fn is_arabic_char(c: char) -> bool {
    matches!(
        c,
        '\u{0600}'..='\u{06FF}'
            | '\u{0750}'..='\u{077F}'
            | '\u{0870}'..='\u{08FF}'
            | '\u{FB50}'..='\u{FDFF}'
            | '\u{FE70}'..='\u{FEFF}'
    )
}

/// Right-to-left letters of any script (Arabic, Hebrew, Syriac, Thaana, NKo …).
pub fn is_rtl_char(c: char) -> bool {
    is_arabic_char(c)
        || matches!(
            c,
            '\u{0590}'..='\u{05FF}' | '\u{0700}'..='\u{074F}' | '\u{0780}'..='\u{07FF}'
                | '\u{0800}'..='\u{086F}' | '\u{FB1D}'..='\u{FB4F}'
        )
}

pub fn contains_arabic(s: &str) -> bool {
    s.chars().any(is_arabic_char)
}

/// Bidi controls: kept for the algorithm, never drawn.
fn is_bidi_control(c: char) -> bool {
    matches!(
        c,
        '\u{200E}' | '\u{200F}' | '\u{061C}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}'
    )
}

/// Joiners matter for Arabic/Persian shaping; the shaper hides them.
fn is_joiner(c: char) -> bool {
    matches!(c, '\u{200C}' | '\u{200D}')
}

/// Pictographs and emoji components. They carry no meaning on a medical or
/// financial document and no embedded font covers them, so they are dropped
/// instead of blocking the whole document.
fn is_pictograph(c: char) -> bool {
    matches!(
        c,
        '\u{1F000}'..='\u{1FAFF}'
            | '\u{2600}'..='\u{26FF}'
            | '\u{2700}'..='\u{27BF}'
            | '\u{2B00}'..='\u{2BFF}'
            | '\u{FE00}'..='\u{FE0F}'
            | '\u{E0020}'..='\u{E007F}'
    ) && !matches!(
        c,
        '\u{2713}' | '\u{2714}' | '\u{2717}' | '\u{2718}' | '\u{2611}' | '\u{2612}'
    )
}

/// Stand-ins for symbols none of the fonts can draw.
fn substitute(c: char) -> Option<&'static str> {
    Some(match c {
        '\u{2190}' => "<-",
        '\u{2192}' => "->",
        '\u{2194}' => "<->",
        '\u{21D2}' => "=>",
        '\u{21D0}' => "<=",
        '\u{2264}' => "<=",
        '\u{2265}' => ">=",
        '\u{2260}' => "!=",
        '\u{2248}' => "~",
        '\u{2713}' | '\u{2714}' | '\u{2611}' => "x",
        '\u{2717}' | '\u{2718}' | '\u{2612}' => "-",
        '\u{221A}' => "sqrt",
        '\u{2211}' => "\u{03A3}",
        '\u{2116}' => "No.",
        '\u{2122}' => "TM",
        '\u{2044}' | '\u{2215}' => "/",
        '\u{2027}' | '\u{2219}' | '\u{22C5}' => "\u{00B7}",
        '\u{2032}' => "'",
        '\u{2033}' => "\"",
        '\u{FFFD}' => "?",
        _ => return None,
    })
}

// ---------------------------------------------------------------------------
// 1. Prepare
// ---------------------------------------------------------------------------

/// Normalise a string for drawing. Never changes letters, digits or words —
/// only how they are encoded (NFC, presentation forms) and invisible or
/// pictographic characters.
pub fn prepare(text: &str) -> String {
    // Arabic presentation forms (copied from old PDFs) → base letters so the
    // shaper can join them. Everything else: canonical composition (NFC).
    let mut expanded = String::with_capacity(text.len());
    for c in text.chars() {
        if matches!(c, '\u{FB50}'..='\u{FDFF}' | '\u{FE70}'..='\u{FEFF}') && c != '\u{FEFF}' {
            expanded.extend(c.to_string().nfkc());
        } else {
            expanded.push(c);
        }
    }
    let mut out = String::with_capacity(expanded.len());
    for c in expanded.nfc() {
        match c {
            '\t' | '\n' | '\r' | '\u{2028}' | '\u{2029}' | '\u{0085}' => out.push(' '),
            // Spaces of every width → one space (NBSP stays a space too).
            '\u{00A0}' | '\u{2000}'..='\u{200A}' | '\u{202F}' | '\u{205F}' | '\u{3000}' => {
                out.push(' ')
            }
            '\u{2010}' | '\u{2011}' | '\u{2212}' | '\u{FE63}' | '\u{FF0D}' => out.push('-'),
            '\u{2012}' | '\u{2015}' => out.push('\u{2013}'),
            // Soft hyphen, BOM, zero-width space, word joiner, object replacement.
            '\u{00AD}' | '\u{FEFF}' | '\u{200B}' | '\u{2060}' | '\u{FFFC}' => {}
            c if c.is_control() => {}
            c if is_pictograph(c) => {}
            c => {
                if let Some(s) = substitute(c).filter(|_| !has_any_glyph(c)) {
                    out.push_str(s);
                } else {
                    out.push(c);
                }
            }
        }
    }
    out
}

fn has_any_glyph(c: char) -> bool {
    super::core::winansi_byte(c).is_some() || fonts::any_has_glyph(c)
}

/// Last resort for a character no font has: its base letter ("ǚ" → "u"),
/// else `?`.
fn fallback_char(c: char) -> char {
    let mut base = None;
    decompose_canonical(c, |d| {
        if base.is_none() {
            base = Some(d);
        }
    });
    match base {
        Some(b) if b != c && has_any_glyph(b) => b,
        _ => '?',
    }
}

/// Characters of `text` that cannot be drawn by any font, after
/// [`prepare`]. Empty means the string renders exactly.
pub fn unsupported_chars(text: &str) -> Vec<char> {
    let mut out: Vec<char> = prepare(text)
        .chars()
        .filter(|&c| !(c.is_whitespace() || is_bidi_control(c) || is_joiner(c) || has_any_glyph(c)))
        .collect();
    out.sort_unstable();
    out.dedup();
    out
}

pub fn is_renderable(text: &str) -> bool {
    unsupported_chars(text).is_empty()
}

/// True when Helvetica alone can draw the (prepared) string.
pub fn is_helvetica_only(prepared: &str) -> bool {
    prepared
        .chars()
        .all(|c| c.is_whitespace() || super::core::winansi_byte(c).is_some())
}

// ---------------------------------------------------------------------------
// 2–4. Layout
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ShapedGlyph {
    pub gid: u16,
    /// Position relative to the piece origin, in points.
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone)]
pub enum Piece {
    /// WinAnsi text drawn with Helvetica.
    Base { text: String, bold: bool, x: f64 },
    /// Shaped glyphs of one embedded font.
    Glyphs {
        res: &'static str,
        glyphs: Vec<ShapedGlyph>,
        x: f64,
    },
}

#[derive(Debug, Clone, Default)]
pub struct LineLayout {
    pub pieces: Vec<Piece>,
    pub width: f64,
}

/// Lay out one line. `rtl_context` = the document reads right to left: a
/// line that contains any right-to-left letter then gets a right-to-left
/// base direction; otherwise the first strong character decides (UAX #9 P2).
pub fn layout(text: &str, size: f64, bold: bool, rtl_context: bool) -> LineLayout {
    let prepared = prepare(text);
    let mut line = LineLayout::default();
    if prepared.is_empty() {
        return line;
    }
    if is_helvetica_only(&prepared) && !prepared.chars().any(is_bidi_control) {
        let w = super::metrics::text_width_pt(&prepared, size_i(size), bold);
        line.pieces.push(Piece::Base {
            text: prepared,
            bold,
            x: 0.0,
        });
        line.width = w;
        return line;
    }

    let has_rtl = prepared.chars().any(is_rtl_char);
    let base_level = if rtl_context && has_rtl {
        Some(Level::rtl())
    } else if has_rtl {
        None // first strong character decides
    } else {
        Some(Level::ltr())
    };
    let bidi = BidiInfo::new(&prepared, base_level);
    let mut pen = 0.0f64;
    for para in &bidi.paragraphs {
        let (levels, runs) = bidi.visual_runs(para, para.range.clone());
        for run in runs {
            let rtl = levels[run.start].is_rtl();
            let run_text: String = prepared[run.clone()]
                .chars()
                .filter(|c| !is_bidi_control(*c))
                .collect();
            if run_text.is_empty() {
                continue;
            }
            let segments = itemize(&run_text, bold, rtl);
            // Segments are in logical order; a right-to-left run is laid out
            // from its last segment to its first.
            let ordered: Vec<&Segment> = if rtl {
                segments.iter().rev().collect()
            } else {
                segments.iter().collect()
            };
            for seg in ordered {
                pen += place_segment(&mut line, seg, size, bold, rtl, pen);
            }
        }
    }
    line.width = pen;
    line
}

fn size_i(size: f64) -> i32 {
    size.round() as i32
}

struct Segment {
    text: String,
    /// `None` = Helvetica.
    face: Option<&'static LoadedFace>,
}

/// Split a bidi run into font segments.
///
/// Left-to-right runs keep whole words in Helvetica when every character of
/// the word is WinAnsi, so a single "Ł" does not switch the whole line to
/// another font. Right-to-left runs never use Helvetica: their neutrals
/// (spaces, colons, brackets) stay in the Arabic font so they shape and
/// mirror with the letters around them.
fn itemize(run: &str, bold: bool, rtl: bool) -> Vec<Segment> {
    let mut out: Vec<Segment> = Vec::new();
    let push = |out: &mut Vec<Segment>, ch: char, face: Option<&'static LoadedFace>| {
        if let Some(last) = out.last_mut() {
            let same = match (last.face, face) {
                (None, None) => true,
                (Some(a), Some(b)) => std::ptr::eq(a, b),
                _ => false,
            };
            if same {
                last.text.push(ch);
                return;
            }
        }
        out.push(Segment {
            text: ch.to_string(),
            face,
        });
    };

    if rtl {
        let mut current: Option<&'static LoadedFace> = None;
        for ch in run.chars() {
            let ch = resolve_char(ch);
            // Neutrals follow the font of the text around them; a run that
            // starts with a space or a bracket still prefers the Arabic font.
            let face = match current {
                Some(f)
                    if (ch.is_whitespace() || is_joiner(ch) || !ch.is_alphanumeric())
                        && f.has_glyph(ch) =>
                {
                    Some(f)
                }
                _ => fonts::face_for(ch, FontRole::Arabic, bold),
            };
            match face {
                Some(f) => {
                    current = Some(f);
                    push(&mut out, ch, Some(f));
                }
                None => push(&mut out, ch, None),
            }
        }
        return out;
    }

    // Left to right: word by word.
    let mut word = String::new();
    let flush = |out: &mut Vec<Segment>, word: &mut String| {
        if word.is_empty() {
            return;
        }
        if word.chars().all(|c| super::core::winansi_byte(c).is_some()) {
            for ch in word.chars() {
                push(out, ch, None);
            }
        } else {
            let mut current: Option<&'static LoadedFace> = None;
            for ch in word.chars() {
                let ch = resolve_char(ch);
                let role = if is_arabic_char(ch) {
                    FontRole::Arabic
                } else {
                    FontRole::Universal
                };
                let face = match current {
                    Some(f) if f.has_glyph(ch) && !is_arabic_char(ch) => Some(f),
                    _ => fonts::face_for(ch, role, bold),
                };
                if face.is_some() {
                    current = face;
                }
                push(out, ch, face);
            }
        }
        word.clear();
    };
    for ch in run.chars() {
        if ch.is_whitespace() {
            flush(&mut out, &mut word);
            push(&mut out, ' ', None);
        } else {
            word.push(ch);
        }
    }
    flush(&mut out, &mut word);
    out
}

/// A character every font lacks becomes its base letter or `?`.
fn resolve_char(ch: char) -> char {
    if ch.is_whitespace() || is_joiner(ch) || has_any_glyph(ch) {
        ch
    } else {
        fallback_char(ch)
    }
}

fn place_segment(
    line: &mut LineLayout,
    seg: &Segment,
    size: f64,
    bold: bool,
    rtl: bool,
    pen: f64,
) -> f64 {
    match seg.face {
        None => {
            // Helvetica: WinAnsi only (anything else became "?").
            let text: String = seg
                .text
                .chars()
                .map(|c| {
                    if c.is_whitespace() || super::core::winansi_byte(c).is_some() {
                        c
                    } else {
                        '?'
                    }
                })
                .collect();
            let w = super::metrics::text_width_pt(&text, size_i(size), bold);
            // Merge with a directly preceding Helvetica piece of the same weight.
            if let Some(Piece::Base {
                text: prev,
                bold: pb,
                x,
            }) = line.pieces.last_mut()
            {
                let prev_w = super::metrics::text_width_pt(prev, size_i(size), *pb);
                if *pb == bold && (*x + prev_w - pen).abs() < 0.01 {
                    prev.push_str(&text);
                    return w;
                }
            }
            line.pieces.push(Piece::Base { text, bold, x: pen });
            w
        }
        Some(face) => {
            let (glyphs, w) = shape(face, &seg.text, size, rtl);
            line.pieces.push(Piece::Glyphs {
                res: face.res,
                glyphs,
                x: pen,
            });
            w
        }
    }
}

fn shape(face: &'static LoadedFace, text: &str, size: f64, rtl: bool) -> (Vec<ShapedGlyph>, f64) {
    let scale = size / face.upem;
    let mut buffer = UnicodeBuffer::new();
    buffer.push_str(text);
    buffer.guess_segment_properties();
    buffer.set_direction(if rtl {
        Direction::RightToLeft
    } else {
        Direction::LeftToRight
    });
    if contains_arabic(text) {
        buffer.set_script(script::ARABIC);
    }
    let output = rustybuzz::shape(&face.face, &[], buffer);
    let infos = output.glyph_infos();
    let positions = output.glyph_positions();

    // Text behind each cluster, for the ToUnicode map.
    let mut starts: Vec<usize> = infos.iter().map(|i| i.cluster as usize).collect();
    starts.sort_unstable();
    starts.dedup();
    let cluster_text = |c: usize| -> &str {
        let next = starts
            .iter()
            .copied()
            .find(|&s| s > c)
            .unwrap_or(text.len());
        text.get(c..next).unwrap_or("")
    };

    let mut glyphs = Vec::with_capacity(infos.len());
    let mut pen = 0.0f64;
    let mut seen_cluster: Option<u32> = None;
    for (info, pos) in infos.iter().zip(positions) {
        let gid = info.glyph_id as u16;
        if gid != 0 {
            if seen_cluster != Some(info.cluster) {
                let t: String = cluster_text(info.cluster as usize)
                    .chars()
                    .filter(|c| !is_joiner(*c))
                    .collect();
                fonts::remember_unicode(face.res, gid, &t);
            }
            glyphs.push(ShapedGlyph {
                gid,
                x: pen + f64::from(pos.x_offset) * scale,
                y: f64::from(pos.y_offset) * scale,
            });
        }
        seen_cluster = Some(info.cluster);
        pen += f64::from(pos.x_advance) * scale;
    }
    (glyphs, pen)
}

// ---------------------------------------------------------------------------
// Public helpers used by the page builder
// ---------------------------------------------------------------------------

/// Width in points of `text` as it will be drawn.
pub fn width_pt(text: &str, size: f64, bold: bool, rtl_context: bool) -> f64 {
    layout(text, size, bold, rtl_context).width
}

/// Content-stream operators that draw `text` with its left edge at `(x, y)`.
pub fn draw_ops(x: f64, y: f64, text: &str, size: f64, bold: bool, rtl_context: bool) -> String {
    let line = layout(text, size, bold, rtl_context);
    draw_layout(x, y, &line, size)
}

pub fn draw_layout(x: f64, y: f64, line: &LineLayout, size: f64) -> String {
    let mut out = String::new();
    let fs = fmt_num(size);
    for piece in &line.pieces {
        match piece {
            Piece::Base { text, bold, x: px } => {
                if text.trim().is_empty() {
                    continue;
                }
                let font = if *bold { "F2" } else { "F1" };
                let _ = writeln!(
                    out,
                    "BT /{font} {fs} Tf {} {} Td {} Tj ET",
                    fmt_num(x + px),
                    fmt_num(y),
                    super::core::text_operand(text)
                );
            }
            Piece::Glyphs { res, glyphs, x: px } => {
                if glyphs.is_empty() {
                    continue;
                }
                let _ = write!(out, "BT /{res} {fs} Tf");
                let (mut lx, mut ly) = (0.0f64, 0.0f64);
                for (i, g) in glyphs.iter().enumerate() {
                    let gx = x + px + g.x;
                    let gy = y + g.y;
                    let (dx, dy) = if i == 0 { (gx, gy) } else { (gx - lx, gy - ly) };
                    let _ = write!(
                        out,
                        " {} {} Td <{:04X}> Tj",
                        fmt_num(dx),
                        fmt_num(dy),
                        g.gid
                    );
                    lx = gx;
                    ly = gy;
                }
                out.push_str(" ET\n");
            }
        }
    }
    out
}

/// Compact number for content streams ("12", "12.5", "-3.25").
fn fmt_num(v: f64) -> String {
    let r = (v * 100.0).round() / 100.0;
    if (r - r.round()).abs() < 1e-9 {
        format!("{}", r.round() as i64)
    } else {
        let s = format!("{r:.2}");
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn order_of_pieces(text: &str, rtl: bool) -> Vec<String> {
        layout(text, 10.0, false, rtl)
            .pieces
            .iter()
            .map(|p| match p {
                Piece::Base { text, .. } => format!("H:{text}"),
                Piece::Glyphs { res, .. } => format!("G:{res}"),
            })
            .collect()
    }

    #[test]
    fn german_text_stays_one_helvetica_piece() {
        let l = layout("Zahnärztin – 12,50 €", 10.0, false, false);
        assert_eq!(l.pieces.len(), 1);
        assert!(matches!(l.pieces[0], Piece::Base { .. }));
    }

    #[test]
    fn nfd_input_is_composed_and_stays_helvetica() {
        // "é" typed as e + U+0301 (macOS).
        let l = layout("Re\u{301}sume\u{301}", 10.0, false, false);
        assert!(matches!(l.pieces[..], [Piece::Base { .. }]));
    }

    #[test]
    fn french_letters_missing_from_the_old_table_stay_helvetica() {
        for s in [
            "à", "â", "î", "ï", "ô", "û", "ù", "ë", "ÿ", "æ", "Œ", "À", "Ô",
        ] {
            assert!(is_helvetica_only(&prepare(s)), "{s}");
        }
    }

    #[test]
    fn narrow_no_break_space_from_intl_is_a_space() {
        assert_eq!(prepare("1\u{202F}234,56"), "1 234,56");
        assert!(is_helvetica_only(&prepare("1\u{202F}234,56\u{00A0}€")));
    }

    #[test]
    fn polish_and_turkish_names_use_noto_sans_for_that_word_only() {
        let p = order_of_pieces("Patient Łukasz Wójcik", false);
        assert_eq!(p, vec!["H:Patient ", "G:F5", "H: Wójcik"]);
        assert!(is_renderable("Ğül Şahin, Đorđe, Ærøskøbing, Ωμέγα, Жанна"));
    }

    #[test]
    fn arabic_with_numbers_is_ordered_right_to_left() {
        // "page 1 of 2": visual order left→right must be "2", "من", "1", "صفحة".
        let l = layout("صفحة 1 من 2", 10.0, false, true);
        let kinds: Vec<String> = l
            .pieces
            .iter()
            .map(|p| match p {
                Piece::Base { text, .. } => text.trim().to_string(),
                Piece::Glyphs { .. } => "AR".into(),
            })
            .filter(|s| !s.is_empty())
            .collect();
        assert_eq!(kinds, vec!["2", "AR", "1", "AR"]);
    }

    #[test]
    fn latin_inside_arabic_keeps_reading_order() {
        // § 630f BGB inside an Arabic sentence stays one left-to-right run.
        let l = layout("بيانات سرية وفق § 630f BGB وفق القانون", 8.0, false, true);
        let latin: Vec<&str> = l
            .pieces
            .iter()
            .filter_map(|p| match p {
                Piece::Base { text, .. } => Some(text.as_str()),
                _ => None,
            })
            .collect();
        assert!(latin.iter().any(|t| t.contains("630f BGB")), "{latin:?}");
    }

    #[test]
    fn arabic_presentation_forms_are_reshaped() {
        // ﻣﺮﺣﺒﺎ (presentation forms) == مرحبا after preparation.
        assert_eq!(prepare("\u{FEE3}\u{FEAE}\u{FEA3}\u{FE92}\u{FE8E}"), "مرحبا");
    }

    #[test]
    fn emoji_and_invisible_characters_never_block_a_document() {
        assert!(is_renderable("Kontrolle 👍 in 2 Wochen\u{200B}\u{FEFF}"));
        assert_eq!(prepare("a\u{00AD}b👍\u{FE0F}"), "ab");
    }

    #[test]
    fn symbols_without_glyph_get_a_readable_stand_in() {
        assert_eq!(prepare("≥ 2 → ok ✓"), ">= 2 -> ok x");
    }

    #[test]
    fn unsupported_script_is_reported() {
        assert_eq!(unsupported_chars("中文"), vec!['中', '文']);
    }

    #[test]
    fn width_matches_draw() {
        for (s, rtl) in [("Rechnung 12,00 EUR", false), ("المبلغ 12,00 EUR", true)] {
            let l = layout(s, 9.0, true, rtl);
            assert!(l.width > 10.0);
            assert_eq!(l.width, width_pt(s, 9.0, true, rtl));
        }
    }

    #[test]
    fn arabic_letters_join() {
        let joined = width_pt("المريض", 12.0, false, true);
        let isolated: f64 = "المريض"
            .chars()
            .map(|c| width_pt(&c.to_string(), 12.0, false, true))
            .sum();
        assert!((joined - isolated).abs() > 0.5, "{joined} vs {isolated}");
    }

    #[test]
    fn bold_arabic_uses_the_bold_font() {
        let ops = draw_ops(0.0, 0.0, "فاتورة", 12.0, true, true);
        assert!(ops.contains("/F4 "), "{ops}");
    }

    #[test]
    fn bidi_isolates_from_phone_formatting_are_not_drawn() {
        let ops = draw_ops(
            0.0,
            0.0,
            "هاتف \u{2066}+49 30 123\u{2069}",
            9.0,
            false,
            true,
        );
        assert!(ops.contains("(+49 30 123)"), "{ops}");
    }
}
