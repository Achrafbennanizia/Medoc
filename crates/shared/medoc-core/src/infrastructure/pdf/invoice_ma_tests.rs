use super::super::invoice_goz::tests::sample;
use super::*;

fn moroccan() -> Invoice {
    let mut inv = sample();
    for l in &mut inv.lines {
        l.fee_schedule = super::super::invoice_goz::FeeSchedule::Other;
    }
    inv.vat_notice = None; // the issuer clears the German default for Moroccan practices
    inv.morocco = Some(MoroccoIds {
        ice: Some("001234567000089".into()),
        if_number: Some("12345678".into()),
        tp: Some("34567890".into()),
        inpe: Some("101234567".into()),
        ..Default::default()
    });
    inv
}

#[test]
fn french_words_follow_the_spelling_rules() {
    assert_eq!(fr_words(21), "vingt et un");
    assert_eq!(fr_words(71), "soixante et onze");
    assert_eq!(fr_words(80), "quatre-vingts");
    assert_eq!(fr_words(99), "quatre-vingt-dix-neuf");
    assert_eq!(fr_words(200), "deux cents");
    assert_eq!(fr_words(250), "deux cent cinquante");
    assert_eq!(fr_words(1250), "mille deux cent cinquante");
    assert_eq!(fr_words(200_000), "deux cent mille");
    assert_eq!(fr_words(9_000), "neuf mille");
    assert_eq!(
        amount_in_words(125_050, "fr"),
        "mille deux cent cinquante dirhams et cinquante centimes"
    );
    assert_eq!(amount_in_words(100_000_000, "fr"), "un million de dirhams");
}

#[test]
fn arabic_words_follow_counting_rules() {
    assert_eq!(ar_words(21), "واحد وعشرون");
    assert_eq!(ar_words(1250), "ألف ومائتان وخمسون");
    assert_eq!(ar_words(3000), "ثلاثة آلاف");
    assert_eq!(ar_words(2000), "ألفان");
    assert_eq!(amount_in_words(500_000, "ar"), "خمسة آلاف درهم");
    assert_eq!(amount_in_words(1_500, "ar"), "خمسة عشر درهماً");
    assert_eq!(amount_in_words(700, "ar"), "سبعة دراهم");
}

#[test]
fn money_uses_spaces_and_a_decimal_comma() {
    crate::infrastructure::pdf::set_document_currency("MAD");
    assert_eq!(money_ma(125_000), "1\u{a0}250,00 MAD");
    assert_eq!(money_ma(-4_550), "-45,50 MAD");
}

#[test]
fn moroccan_invoice_carries_the_legal_mentions() {
    let mut inv = moroccan();
    inv.locale = "fr".into();
    let pdf = render_invoice(&inv).unwrap();
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "(Facture ",
        "ICE 001234567000089",
        "IF 12345678",
        "TP 34567890",
        "Arr\\352t\\351e la pr\\351sente facture",
        "91-VI-1",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
    assert!(!s.contains("GOZ"), "no German fee-schedule wording");
}

#[test]
fn arabic_moroccan_invoice_is_right_to_left() {
    let mut inv = moroccan();
    inv.locale = "ar".into();
    inv.rtl = true;
    let s = String::from_utf8_lossy(&render_invoice(&inv).unwrap()).into_owned();
    assert!(s.contains("/Lang (ar)"));
    assert!(
        s.contains("+NotoNaskhArabic") || s.contains("/F3 "),
        "arabic font embedded"
    );
}
