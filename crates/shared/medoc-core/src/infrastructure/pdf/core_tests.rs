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
