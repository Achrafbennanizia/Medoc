//! Glyph widths for the two base-14 fonts MeDoc uses (Helvetica, Helvetica-Bold).
//!
//! Values are the advance widths from Adobe's Core14 AFM files (units of
//! 1/1000 em). Replaces the old `chars × 0.52 × size` guess, which made
//! right-aligned amounts and column wrapping drift.
//!
//! When the renderer moves to embedded fonts (PDF/A, Arabic), this module is
//! replaced by the font's own `hmtx` table.

/// Advance width of `ch` in 1/1000 em.
///
/// Every WinAnsi character has its own AFM width (the old table guessed 556
/// for Æ, œ, «, », ¿ … and right-aligned French amounts drifted).
pub fn glyph_width(ch: char, bold: bool) -> u32 {
    let c = ch as u32;
    if (32..=126).contains(&c) {
        let idx = (c - 32) as usize;
        return if bold {
            BOLD_ASCII[idx]
        } else {
            REGULAR_ASCII[idx]
        } as u32;
    }
    match super::core::winansi_byte(ch) {
        Some(b) if b >= 0x80 => {
            let idx = usize::from(b - 0x80);
            u32::from(if bold {
                BOLD_HIGH[idx]
            } else {
                REGULAR_HIGH[idx]
            })
        }
        Some(b) if (32..=126).contains(&b) => glyph_width(b as char, bold),
        _ => 556,
    }
}

/// Width of `s` in PDF points at `font_size`.
pub fn text_width_pt(s: &str, font_size: i32, bold: bool) -> f64 {
    let units: u32 = s.chars().map(|c| glyph_width(c, bold)).sum();
    f64::from(units) * f64::from(font_size) / 1000.0
}

/// Width as drawn: Helvetica metrics for WinAnsi text, shaped width otherwise.
fn advance_pt(s: &str, font_size: i32, bold: bool) -> f64 {
    super::text::width_pt(s, f64::from(font_size), bold, false)
}

/// Largest prefix (in chars) of `s` that fits into `max_pt`.
pub fn fit_chars(s: &str, font_size: i32, bold: bool, max_pt: f64) -> usize {
    // Shaped scripts must measure the shaped prefix — summing isolated letter
    // widths breaks words at the wrong place.
    let chars: Vec<char> = s.chars().collect();
    let mut lo = 0usize;
    let mut hi = chars.len();
    while lo < hi {
        let mid = (lo + hi).div_ceil(2);
        let prefix: String = chars[..mid].iter().collect();
        if advance_pt(&prefix, font_size, bold) <= max_pt {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    // Never split a base letter from the combining mark that follows it.
    while lo > 0 && lo < chars.len() && is_combining(chars[lo]) {
        lo -= 1;
    }
    lo
}

fn is_combining(c: char) -> bool {
    matches!(c, '\u{0300}'..='\u{036F}' | '\u{064B}'..='\u{065F}' | '\u{0670}' | '\u{06D6}'..='\u{06ED}')
}

/// Wrap on whitespace so that every line fits into `max_pt`. Words longer
/// than the line are hard-broken (never silently clipped).
pub fn wrap_to_width(text: &str, font_size: i32, bold: bool, max_pt: f64) -> Vec<String> {
    let mut out = Vec::new();
    for paragraph in text.split('\n') {
        let trimmed = paragraph.trim_end();
        if trimmed.is_empty() {
            out.push(String::new());
            continue;
        }
        let mut cur = String::new();
        for word in trimmed.split_whitespace() {
            let candidate = if cur.is_empty() {
                word.to_string()
            } else {
                format!("{cur} {word}")
            };
            if advance_pt(&candidate, font_size, bold) <= max_pt {
                cur = candidate;
                continue;
            }
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            // A word that fits on its own line moves there whole.
            if advance_pt(word, font_size, bold) <= max_pt {
                cur = word.to_string();
                continue;
            }
            // Word alone too long → hard break (shaped fit for Arabic).
            let mut rest: String = word.to_string();
            while advance_pt(&rest, font_size, bold) > max_pt {
                let n = fit_chars(&rest, font_size, bold, max_pt).max(1);
                let head: String = rest.chars().take(n).collect();
                out.push(head);
                rest = rest.chars().skip(n).collect();
            }
            cur = rest;
        }
        if !cur.is_empty() {
            out.push(cur);
        }
    }
    if out.is_empty() {
        out.push(String::new());
    }
    out
}

#[rustfmt::skip]
const REGULAR_ASCII: [u16; 95] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // ' '..'/'
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556,                               // 0..9
    278, 278, 584, 584, 584, 556, 1015,                                             // :..@
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,                // A..M
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,                // N..Z
    278, 278, 278, 469, 556, 333,                                                   // [..`
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,                // a..m
    556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,                // n..z
    334, 260, 334, 584,                                                             // {..~
];

#[rustfmt::skip]
const BOLD_ASCII: [u16; 95] = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    333, 333, 584, 584, 584, 611, 975,
    722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
    333, 278, 333, 584, 556, 333,
    556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889,
    611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
    389, 280, 389, 584,
];

/// Helvetica widths for WinAnsi 0x80–0xFF (Adobe Core14 AFM; 0 = unused code).
#[rustfmt::skip]
const REGULAR_HIGH: [u16; 128] = [
    556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,   // 0x80
    0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,  // 0x90
    278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, // 0xA0
    400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, // 0xB0
    667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // 0xC0
    722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // 0xD0
    556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, // 0xE0
    556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500, // 0xF0
];

/// Helvetica-Bold widths for WinAnsi 0x80–0xFF.
#[rustfmt::skip]
const BOLD_HIGH: [u16; 128] = [
    556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,   // 0x80
    0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,  // 0x90
    278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, // 0xA0
    400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, // 0xB0
    722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // 0xC0
    722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // 0xD0
    556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, // 0xE0
    611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556, // 0xF0
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digits_are_tabular() {
        assert_eq!(
            text_width_pt("1111", 10, false),
            text_width_pt("8888", 10, false)
        );
    }

    #[test]
    fn bold_is_wider_for_lowercase() {
        assert!(text_width_pt("abc", 10, true) > text_width_pt("abc", 10, false));
    }

    #[test]
    fn umlaut_matches_base() {
        assert_eq!(glyph_width('ä', false), glyph_width('a', false));
    }

    #[test]
    fn french_and_nordic_letters_have_real_widths() {
        assert_eq!(glyph_width('Æ', false), 1000);
        assert_eq!(glyph_width('œ', false), 944);
        assert_eq!(glyph_width('à', false), glyph_width('a', false));
        assert_eq!(glyph_width('ô', true), glyph_width('o', true));
        assert_eq!(glyph_width('«', false), 556);
    }

    #[test]
    fn arabic_wraps_without_overflow() {
        let text = "يحتوي هذا المستند على بيانات مريض سرية ولا يُفصح عنها إلا بموافقة صريحة من المريض";
        let lines = wrap_to_width(text, 9, false, 120.0);
        assert!(lines.len() > 2);
        for l in &lines {
            assert!(advance_pt(l, 9, false) <= 120.0 + 0.01, "{l}");
        }
    }

    #[test]
    fn wrap_never_exceeds_width() {
        let lines = wrap_to_width(
            "Zahnfleischbluten Parodontalbehandlungsplanung extrem langes Wort",
            9,
            false,
            60.0,
        );
        assert!(lines.iter().all(|l| text_width_pt(l, 9, false) <= 60.0));
        assert!(lines.len() > 2);
    }
}
