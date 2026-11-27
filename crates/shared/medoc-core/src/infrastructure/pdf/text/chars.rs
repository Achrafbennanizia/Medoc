//! Mirrored and substituted characters for right-to-left text (split from `text.rs`).

use super::*;

/// Bidi mirrored glyph for paired punctuation (UAX #9 / BidiMirroring.txt, WinAnsi subset).
pub(super) fn mirror_char(c: char) -> char {
    match c {
        '(' => ')',
        ')' => '(',
        '[' => ']',
        ']' => '[',
        '{' => '}',
        '}' => '{',
        '<' => '>',
        '>' => '<',
        '\u{AB}' => '\u{BB}',
        '\u{BB}' => '\u{AB}',
        '\u{2039}' => '\u{203A}',
        '\u{203A}' => '\u{2039}',
        other => other,
    }
}

/// A character every font lacks becomes its base letter or `?`.
pub(super) fn resolve_char(ch: char) -> char {
    if ch.is_whitespace() || is_joiner(ch) || has_any_glyph(ch) {
        ch
    } else {
        fallback_char(ch)
    }
}
