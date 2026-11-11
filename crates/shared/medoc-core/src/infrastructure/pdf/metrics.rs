//! Glyph widths for the two base-14 fonts MeDoc uses (Helvetica, Helvetica-Bold).
//!
//! Values are the advance widths from Adobe's Core14 AFM files (units of
//! 1/1000 em). Replaces the old `chars × 0.52 × size` guess, which made
//! right-aligned amounts and column wrapping drift.
//!
//! When the renderer moves to embedded fonts (PDF/A, Arabic), this module is
//! replaced by the font's own `hmtx` table.

/// Advance width of `ch` in 1/1000 em.
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
    // Accented letters share the width of their base letter in Helvetica.
    let base = match ch {
        'ä' | 'à' | 'á' | 'â' | 'å' => Some('a'),
        'Ä' | 'À' | 'Á' | 'Â' | 'Å' => Some('A'),
        'ö' | 'ò' | 'ó' | 'ô' | 'ø' => Some('o'),
        'Ö' | 'Ò' | 'Ó' | 'Ô' | 'Ø' => Some('O'),
        'ü' | 'ù' | 'ú' | 'û' => Some('u'),
        'Ü' | 'Ù' | 'Ú' | 'Û' => Some('U'),
        'é' | 'è' | 'ê' | 'ë' => Some('e'),
        'É' | 'È' | 'Ê' | 'Ë' => Some('E'),
        'í' | 'ì' | 'î' | 'ï' => Some('i'),
        'ç' => Some('c'),
        'Ç' => Some('C'),
        'ñ' => Some('n'),
        'Ñ' => Some('N'),
        'š' => Some('s'),
        'Š' => Some('S'),
        'ž' => Some('z'),
        'Ž' => Some('Z'),
        _ => None,
    };
    if let Some(b) = base {
        return glyph_width(b, bold);
    }
    match ch {
        'ß' => 611,
        '€' => 556,
        '§' => 556,
        '°' => 400,
        '×' | '÷' | '±' => 584,
        '–' => 556,
        '—' | '…' | '‰' => 1000,
        '•' => 350,
        '\u{00A0}' => 278,
        '„' | '“' | '”' => {
            if bold {
                500
            } else {
                333
            }
        }
        '‚' | '‘' | '’' => {
            if bold {
                278
            } else {
                222
            }
        }
        '²' | '³' | '¹' => 333,
        '½' | '¼' | '¾' => 834,
        _ => 556,
    }
}

/// Width of `s` in PDF points at `font_size`.
pub fn text_width_pt(s: &str, font_size: i32, bold: bool) -> f64 {
    let units: u32 = s.chars().map(|c| glyph_width(c, bold)).sum();
    f64::from(units) * f64::from(font_size) / 1000.0
}

/// Largest prefix (in chars) of `s` that fits into `max_pt`.
fn advance_pt(s: &str, font_size: i32, bold: bool) -> f64 {
    if super::unicode_font::needs_unicode(s) {
        super::unicode_font::width_pt(s, font_size)
    } else {
        text_width_pt(s, font_size, bold)
    }
}

pub fn fit_chars(s: &str, font_size: i32, bold: bool, max_pt: f64) -> usize {
    let mut acc = 0.0;
    for (i, c) in s.chars().enumerate() {
        let piece: String = c.to_string();
        acc += advance_pt(&piece, font_size, bold);
        if acc > max_pt {
            return i;
        }
    }
    s.chars().count()
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
            // Word alone too long → hard break.
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
