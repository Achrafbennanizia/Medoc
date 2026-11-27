use super::*;

#[test]
fn contract_pro_rata() {
    let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
    // 1200 €/year over a 365-day year.
    let q = contract_share_cents(1200.0, "YEAR", None, None, d("2026-01-01"), d("2026-12-31"));
    assert_eq!(q, 120000);
    // Monthly 100 € for one quarter (90 days) ≈ 295,89 €.
    let m = contract_share_cents(100.0, "MONTH", None, None, d("2026-01-01"), d("2026-03-31"));
    assert_eq!(m, 29589);
    // Contract ended before the period.
    assert_eq!(
        contract_share_cents(
            50.0,
            "MONTH",
            None,
            Some(d("2025-12-31")),
            d("2026-01-01"),
            d("2026-03-31")
        ),
        0
    );
}

fn sample_report() -> PeriodReport {
    PeriodReport {
        from: "2026-01-01".into(),
        to: "2026-01-31".into(),
        kind: "MONTH".into(),
        income_cents: 15000,
        income_by_method: vec![
            Amount {
                label: "CASH".into(),
                cents: 10000,
            },
            Amount {
                label: "BANK_TRANSFER".into(),
                cents: 5000,
            },
        ],
        income_by_month: vec![Amount {
            label: "2026-01".into(),
            cents: 15000,
        }],
        invoiced_cents: 0,
        invoice_count: 0,
        cancellation_cents: 0,
        cancellation_count: 0,
        open_receivables_cents: 0,
        open_receivables_count: 0,
        expenses_cents: 1200,
        expenses_estimate_cents: 0,
        expenses: vec![ExpenseLine {
            source: "CASH".into(),
            date: "2026-01-15".into(),
            label: "Gloves".into(),
            cents: 1200,
            estimate: false,
            voucher: Some("12".into()),
        }],
        result_cents: 13800,
        unclosed_days: Vec::new(),
    }
}

/// WinAnsi octal escapes (`\351` → é) so French and German labels are searchable.
fn decode_pdf(pdf: &[u8]) -> String {
    let mut out = String::with_capacity(pdf.len());
    let mut i = 0;
    while i < pdf.len() {
        let b = pdf[i];
        if b == b'\\' && i + 1 < pdf.len() {
            let n = pdf[i + 1];
            if n.is_ascii_digit()
                && i + 3 < pdf.len()
                && pdf[i + 2].is_ascii_digit()
                && pdf[i + 3].is_ascii_digit()
            {
                let v = (n - b'0') as u32 * 64
                    + (pdf[i + 2] - b'0') as u32 * 8
                    + (pdf[i + 3] - b'0') as u32;
                out.push(char::from_u32(v).unwrap_or('?'));
                i += 4;
                continue;
            }
            if matches!(n, b'(' | b')' | b'\\') {
                out.push(n as char);
                i += 2;
                continue;
            }
        }
        out.push(char::from(b));
        i += 1;
    }
    out
}

#[test]
fn pdf_labels_follow_every_document_language() {
    let profile = PracticeProfile {
        name: "Practice".into(),
        ..PracticeProfile::default()
    };
    let report = sample_report();
    let cases = [
        ("de", "Betriebseinnahmen", "Bar", "Beleg 12", "ENTWURF"),
        ("en", "Practice income", "Cash", "Voucher 12", "DRAFT"),
        (
            "fr",
            "Recettes du cabinet",
            "Espèces",
            "Pièce 12",
            "BROUILLON",
        ),
    ];
    for (locale, income, method, voucher, draft) in cases {
        let mut input = report_input(&profile, locale, &report, "");
        input.watermark = Some(
            crate::infrastructure::pdf::i18n::t(
                locale,
                crate::infrastructure::pdf::i18n::Phrase::Draft,
            )
            .into(),
        );
        let pdf = render_report_pdf(&input).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"), "{locale}");
        let text = decode_pdf(&pdf);
        assert!(text.contains(income), "{locale} missing {income}");
        assert!(text.contains(method), "{locale} missing {method}");
        assert!(text.contains(voucher), "{locale} missing {voucher}");
        assert!(text.contains(draft), "{locale} missing {draft}");
    }
    let mut ar = report_input(&profile, "ar", &report, "");
    ar.watermark = Some(
        crate::infrastructure::pdf::i18n::t("ar", crate::infrastructure::pdf::i18n::Phrase::Draft)
            .into(),
    );
    let pdf = render_report_pdf(&ar).unwrap();
    let text = decode_pdf(&pdf);
    assert!(
        text.contains("/NotoNaskhArabic") || text.contains("/F3 "),
        "arabic font"
    );
    assert!(!text.contains("Betriebseinnahmen"), "ar still German");
    assert!(!text.contains("Beleg 12"), "ar voucher");
    assert!(!text.contains("ENTWURF"), "ar draft watermark");
}
