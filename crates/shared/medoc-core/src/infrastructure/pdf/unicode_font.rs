//! Compatibility layer over [`super::text`] / [`super::fonts`].
//!
//! Older call sites asked "does this string need the Arabic font?". The text
//! engine now decides per run (Helvetica, Noto Naskh Arabic, Noto Sans) and
//! orders mixed Arabic/Latin text with the Unicode bidi algorithm, so these
//! helpers only forward.

/// True when Helvetica alone cannot draw the string.
pub fn needs_unicode(s: &str) -> bool {
    !super::text::is_helvetica_only(&super::text::prepare(s))
}

pub fn contains_arabic(s: &str) -> bool {
    super::text::contains_arabic(s)
}

/// True when some embedded font has a glyph for `ch`.
pub fn has_glyph(ch: char) -> bool {
    super::fonts::any_has_glyph(ch)
}

/// Width as drawn (shaped, bidi-ordered).
pub fn width_pt(text: &str, font_size: i32) -> f64 {
    super::text::width_pt(text, f64::from(font_size), false, true)
}

/// Content-stream operators that draw `text` with its left edge at `(x, y)`.
pub fn positioned_ops(x: i32, y: i32, font_size: i32, text: &str) -> String {
    super::text::draw_ops(
        f64::from(x),
        f64::from(y),
        text,
        f64::from(font_size),
        false,
        true,
    )
}
