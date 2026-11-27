//! Moroccan dental invoice (facture / فاتورة), selected when the practice bills in MAD.
//!
//! Content follows the invoicing rules of the Code général des impôts (art. 145-III):
//! seller identity with ICE, IF, TP (and RC / CNSS / INPE when set), sequential number and
//! date, the patient, each act with date, tooth, NGAP code, quantity, unit price and amount,
//! the total excl. VAT, VAT per rate or the exemption notice for medical acts, the total due,
//! and the total in words ("Arrêtée la présente facture…" / "حُصرت هذه الفاتورة…") as
//! Moroccan practice expects. Labels follow `Invoice.locale`; Arabic is laid out right to left.
//!
//! Same data model as the GOZ invoice ([`super::invoice_goz::Invoice`]); GOZ-only fields
//! (factor, points, fee groups) are ignored here.

use super::core::{
    document_currency, emit_pdf_document, pdf_locale, PageBuilder, PdfDocMeta, M_BOTTOM, M_LEFT,
    M_RIGHT,
};
use super::goz::compute_totals;
use super::i18n::{tr, trf};
use super::invoice_goz::{render_goz_invoice, Invoice, InvoiceKind, InvoiceLine, MoroccoIds};
use super::letterhead::{emit_letterhead, Letterhead, MetaRow};
use super::logo::PdfLogo;
use super::metrics::wrap_to_width;
use crate::error::AppError;

/// Render any invoice in the format its practice uses (Moroccan or GOZ).
pub fn render_invoice(inv: &Invoice) -> Result<Vec<u8>, AppError> {
    if inv.morocco.is_some() {
        render_ma_invoice(inv)
    } else {
        render_goz_invoice(inv)
    }
}

// Columns relative to M_LEFT (content width 467 pt).
const X_DATE: i32 = M_LEFT;
const X_TOOTH: i32 = M_LEFT + 52;
const X_CODE: i32 = M_LEFT + 84;
const X_DESC: i32 = M_LEFT + 124;
const DESC_W: i32 = 196;
const X_QTY_R: i32 = M_LEFT + 352;
const X_UNIT_R: i32 = M_LEFT + 406;
const X_AMOUNT_R: i32 = M_RIGHT - 2;
const ROW_FS: i32 = 8;
const ROW_STEP: i32 = 10;

/// ISO date → `DD/MM/YYYY` (Moroccan usage).
fn date_ma(iso: &str) -> String {
    let d = iso.trim();
    if d.len() >= 10 && d.as_bytes()[4] == b'-' && d.as_bytes()[7] == b'-' {
        return format!("{}/{}/{}", &d[8..10], &d[5..7], &d[0..4]);
    }
    d.to_string()
}

/// `125000` → `1 250,00 MAD` (decimal comma, practice currency). The thousands separator is a
/// no-break space: bidi treats it as part of the number, so Arabic pages do not split `1 250,00`.
pub fn money_ma(cents: i64) -> String {
    let neg = cents < 0;
    let abs = cents.unsigned_abs();
    let units = (abs / 100).to_string();
    let mut grouped = String::new();
    for (i, ch) in units.chars().enumerate() {
        if i > 0 && (units.len() - i).is_multiple_of(3) {
            grouped.push('\u{a0}');
        }
        grouped.push(ch);
    }
    format!(
        "{}{grouped},{:02} {}",
        if neg { "-" } else { "" },
        abs % 100,
        document_currency()
    )
}

/// Amount as drawn on the page: on right-to-left pages it is a left-to-right isolate, so the
/// bidi algorithm cannot split "1 250,00" or move the minus sign.
fn money_on(pb: &PageBuilder, cents: i64) -> String {
    if pb.reading_rtl() {
        format!("\u{2066}{}\u{2069}", money_ma(cents))
    } else {
        money_ma(cents)
    }
}

fn identity_parts(ids: &MoroccoIds, locale: &str) -> Vec<String> {
    [
        ("invoice_ma.ice", &ids.ice),
        ("invoice_ma.if", &ids.if_number),
        ("invoice_ma.tp", &ids.tp),
        ("invoice_ma.rc", &ids.rc),
        ("invoice_ma.cnss", &ids.cnss),
        ("invoice_ma.inpe", &ids.inpe),
    ]
    .into_iter()
    .filter_map(|(key, v)| {
        v.as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(|v| format!("{} {v}", tr(locale, key)))
    })
    .collect()
}

fn emit_table_header(pb: &mut PageBuilder, locale: &str) {
    pb.ensure_space(30);
    pb.text(X_DATE + 2, 8, true, tr(locale, "invoice_ma.col_date"));
    pb.text(X_TOOTH, 8, true, tr(locale, "invoice_ma.col_tooth"));
    pb.text(X_CODE, 8, true, tr(locale, "invoice_ma.col_code"));
    pb.text(X_DESC, 8, true, tr(locale, "invoice_ma.col_desc"));
    pb.text_right(X_QTY_R, 8, true, tr(locale, "invoice_ma.col_qty"));
    pb.text_right(X_UNIT_R, 8, true, tr(locale, "invoice_ma.col_unit"));
    pb.text_right(X_AMOUNT_R, 8, true, tr(locale, "invoice_ma.col_amount"));
    pb.advance(4);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(11);
}

fn emit_line(pb: &mut PageBuilder, line: &InvoiceLine, locale: &str) {
    let desc = wrap_to_width(&line.description, ROW_FS, false, f64::from(DESC_W));
    let height = desc.len().max(1) as i32 * ROW_STEP + 4;
    if pb.y - height < M_BOTTOM + 6 {
        pb.break_page();
        emit_table_header(pb, locale);
    }
    let top = pb.y;
    let qty = i64::from(line.quantity.unwrap_or(1).max(1));
    let unit = line.unit_price_cents.unwrap_or(line.amount_cents / qty);
    pb.text(
        X_DATE + 2,
        ROW_FS,
        false,
        &line
            .treatment_date
            .as_deref()
            .map(date_ma)
            .unwrap_or_default(),
    );
    pb.text(
        X_TOOTH,
        ROW_FS,
        false,
        line.tooth_nr.as_deref().unwrap_or(""),
    );
    pb.text(X_CODE, ROW_FS, false, line.goz_nr.as_deref().unwrap_or(""));
    pb.text_right(X_QTY_R, ROW_FS, false, &qty.to_string());
    let (unit, amount) = (money_on(pb, unit), money_on(pb, line.amount_cents));
    pb.text_right(X_UNIT_R, ROW_FS, false, &unit);
    pb.text_right(X_AMOUNT_R, ROW_FS, false, &amount);
    for (i, text) in desc.iter().enumerate() {
        pb.y = top - i as i32 * ROW_STEP;
        pb.text(X_DESC, ROW_FS, false, text);
    }
    pb.y = top - height;
}

fn emit_sum_row(pb: &mut PageBuilder, label: &str, cents: i64, bold: bool) {
    pb.ensure_space(20);
    // Label ends well before the amount column, which holds up to "999 999,99 MAD".
    pb.text_right(X_AMOUNT_R - 90, 9, bold, label);
    let amount = money_on(pb, cents);
    pb.text_right(X_AMOUNT_R, 9, bold, &amount);
    pb.advance(13);
}

/// Render a Moroccan invoice or credit note. Validate with [`super::goz::validate_invoice`] first.
pub fn render_ma_invoice(inv: &Invoice) -> Result<Vec<u8>, AppError> {
    let ids = inv.morocco.clone().unwrap_or_default();
    let credit = inv.kind == InvoiceKind::Cancellation;
    let locale = pdf_locale(&inv.locale);
    let rtl = inv.rtl || super::i18n::is_rtl(locale);
    let totals = compute_totals(inv);
    let mut pb = PageBuilder::new();
    pb.locale = locale;
    pb.rtl = rtl;
    pb.watermark = inv.watermark.clone();

    // ---- Letterhead: practice, invoice meta, patient block -------------------
    let mut practice = if inv.practice_lines.is_empty() {
        let mut p = vec![inv.practice_name.clone()];
        p.extend(inv.practice_address.iter().cloned());
        p
    } else {
        inv.practice_lines.clone()
    };
    // The practice letterhead already lists the ids for a Moroccan practice; add them only if missing.
    let ice_shown = ids
        .ice
        .as_deref()
        .is_some_and(|ice| practice.iter().any(|l| l.contains(ice.trim())));
    if !ice_shown {
        practice.extend(identity_parts(&ids, locale));
    }

    let mut meta = vec![
        MetaRow::new(tr(locale, "invoice_ma.no"), &inv.number),
        MetaRow::new(tr(locale, "invoice_ma.date"), date_ma(&inv.date)),
    ];
    if !credit {
        if let Some(d) = inv.due_date.as_deref().filter(|d| !d.trim().is_empty()) {
            meta.push(MetaRow::new(tr(locale, "invoice_ma.due"), date_ma(d)));
        }
    }
    if !inv.patient_name.trim().is_empty() {
        let dob = inv
            .patient_birth_date
            .as_deref()
            .filter(|d| !d.trim().is_empty())
            .map(|d| format!(", {} {}", tr(locale, "invoice_ma.born"), date_ma(d)))
            .unwrap_or_default();
        meta.push(MetaRow::new(
            tr(locale, "invoice_ma.patient"),
            format!("{}{dob}", inv.patient_name),
        ));
    }
    if let Some(c) = inv
        .clinician_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        meta.push(MetaRow::new(tr(locale, "invoice_ma.practitioner"), c));
    }
    let mut recipient = vec![inv.recipient_name.clone()];
    recipient.extend(inv.recipient_address.iter().cloned());
    emit_letterhead(
        &mut pb,
        &Letterhead {
            practice_lines: &practice,
            meta_rows: &meta,
            address_lines: &recipient,
            show_sender_hint: false,
            logo: inv.logo.as_ref(),
            rtl,
            locale,
            ..Default::default()
        },
    );

    // Identity on every page: CGI art. 145 mentions must stay with each sheet.
    let mut footer = vec![format!(
        "{} · {}",
        inv.practice_name,
        inv.practice_address.join(", ")
    )];
    let id_line = identity_parts(&ids, locale);
    if !id_line.is_empty() {
        footer.push(id_line.join(" · "));
    }
    if let Some(bank) = inv.bank_details.as_ref().filter(|b| !b.is_empty()) {
        footer.push(bank.join(" · "));
    }
    pb.footer_lines.extend(footer);

    let title = tr(
        locale,
        if credit {
            "invoice_ma.credit_note"
        } else {
            "invoice_ma.title"
        },
    );
    pb.set_continuation(
        &inv.practice_name,
        &format!("{title} {}", inv.number),
        locale,
    );
    pb.text(M_LEFT, 16, true, &format!("{title} {}", inv.number));
    pb.advance(20);
    if credit {
        let orig = inv.cancels_number.as_deref().unwrap_or("-");
        let date = inv
            .cancels_date
            .as_deref()
            .map(|d| format!(" ({})", date_ma(d)))
            .unwrap_or_default();
        pb.wrapped(
            M_LEFT,
            9,
            false,
            &trf(
                locale,
                "invoice_ma.cancels",
                &[("orig", orig), ("date", &date)],
            ),
            M_RIGHT - M_LEFT,
        );
        pb.advance(4);
    }

    // ---- Acts -------------------------------------------------------------------
    emit_table_header(&mut pb, locale);
    for line in &inv.lines {
        emit_line(&mut pb, line, locale);
    }

    // ---- Totals -----------------------------------------------------------------
    pb.ensure_space(80);
    pb.hline(M_LEFT + 250, M_RIGHT);
    pb.advance(13);
    emit_sum_row(
        &mut pb,
        tr(locale, "invoice_ma.total_ht"),
        totals.net,
        false,
    );
    for (rate, _net, tax) in &totals.vat_groups {
        let rate_s = format!("{}", *rate as f64 / 100.0).replace('.', ",");
        emit_sum_row(
            &mut pb,
            &trf(locale, "invoice_ma.vat", &[("rate", &rate_s)]),
            *tax,
            false,
        );
    }
    if totals.vat_groups.is_empty() {
        emit_sum_row(&mut pb, tr(locale, "invoice_ma.vat_zero"), 0, false);
    }
    pb.hline(M_LEFT + 250, M_RIGHT);
    pb.advance(13);
    emit_sum_row(
        &mut pb,
        tr(locale, "invoice_ma.total_ttc"),
        totals.gross,
        true,
    );

    // ---- Total in words, VAT notice, terms ----------------------------------------
    pb.advance(8);
    let width = M_RIGHT - M_LEFT;
    let words = amount_in_words(totals.gross, locale);
    pb.wrapped(
        M_LEFT,
        9,
        true,
        &trf(locale, "invoice_ma.amount_words", &[("words", &words)]),
        width,
    );
    pb.advance(4);
    if inv
        .lines
        .iter()
        .any(|l| l.vat_percent.unwrap_or(0.0) <= 0.0)
    {
        let notice = inv
            .vat_notice
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| tr(locale, "invoice_ma.vat_exempt_default"));
        pb.wrapped(M_LEFT, 9, false, notice, width);
    }
    if !credit {
        if let Some(terms) = inv
            .payment_terms_text
            .as_deref()
            .filter(|s| !s.trim().is_empty())
        {
            pb.wrapped(M_LEFT, 9, false, terms, width);
        }
    }
    if let Some(n) = inv.note.as_deref().filter(|s| !s.trim().is_empty()) {
        pb.advance(4);
        pb.wrapped(M_LEFT, 9, false, n, width);
    }

    // ---- Stamp and signature ----------------------------------------------------
    pb.ensure_space(80);
    pb.advance(14);
    let label = tr(locale, "invoice_ma.stamp");
    pb.text_right(M_RIGHT, 9, true, label);
    pb.advance(56);
    pb.hline(M_RIGHT - 170, M_RIGHT);

    let pages = pb.finish();
    let images: Vec<PdfLogo> = inv.logo.clone().into_iter().collect();
    emit_pdf_document(
        &pages,
        &PdfDocMeta {
            title: format!("{title} {}", inv.number),
            subject: Some(inv.number.clone()),
            author: Some(inv.practice_name.clone()),
            locale: locale.into(),
        },
        &images,
    )
}

// ===========================================================================
// Amount in words (French / Arabic; other languages get the French wording)
// ===========================================================================

mod amount_words;
#[allow(unused_imports)]
pub use amount_words::*;

#[cfg(test)]
mod tests {
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
}
