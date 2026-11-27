use super::*;

#[test]
fn helvetica_fallback_in_rtl_run_is_reversed_and_mirrored() {
    let mut line = LineLayout::default();
    let seg = Segment {
        text: " (".into(),
        face: None,
    };
    place_segment(&mut line, &seg, 10.0, false, true, 0.0);
    match &line.pieces[0] {
        Piece::Base { text, .. } => assert_eq!(text, ") "),
        _ => panic!("expected a Helvetica piece"),
    }
}

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
