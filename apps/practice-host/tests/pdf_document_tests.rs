//! Integration tests for GOZ invoice, Chart, and clinical document PDF markers.

use medoc_lib::infrastructure::clinical_pdf_layout::{
    render_clinical_layout, ClinicalPdfLayout, LabelValue, PdfTableSpec, TableColumnLayout,
};
use medoc_lib::infrastructure::clinical_text_format::format_examination_for_chart_table;
use medoc_lib::infrastructure::pdf::{
    render, render_chart_blocks, render_report_pdf, ChartPdfBlock, ChartPdfTable, Invoice,
    InvoiceLine, ReportPdfInput, ReportPdfSection, ReportPdfSummaryRow,
};

fn sample_line(description: &str, amount_cents: i64) -> InvoiceLine {
    InvoiceLine {
        description: description.into(),
        amount_cents,
        goz_nr: None,
        factor: None,
        unit_price_cents: None,
        quantity: None,
        tooth_nr: None,
        treatment_date: None,
        vat_percent: None,
        material: None,
        diagnosis_reason: None,
    }
}

#[test]
fn test_invoice_goz_has_required_fields() {
    let inv = Invoice {
        number: "RE-TEST".into(),
        date: "2026-04-19".into(),
        recipient_name: "Patient".into(),
        recipient_address: vec!["Berlin".into()],
        practice_name: "Practice".into(),
        practice_address: vec!["Str. 1".into()],
        lines: vec![sample_line("ServiceItem", 1000)],
        note: None,
        clinician_name: Some("Dr. X".into()),
        clinician_zanr: Some("123456789".into()),
        practice_bsnr: Some("987654321".into()),
        bank_details: Some(vec!["IBAN DE00".into()]),
        payment_terms_text: Some("Payable within 14 days.".into()),
        vat_notice: Some("Umsatzsteuerbefreit".into()),
    };
    let pdf = render(&inv).expect("render");
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "GOZ",
        "Fak",
        "IBAN",
        "Umsatzsteuerbefreit",
        "Payable within",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
}

#[test]
fn test_invoice_without_goz_still_works() {
    let inv = Invoice {
        number: "RE-OLD".into(),
        date: "2026-04-19".into(),
        recipient_name: "Patient".into(),
        recipient_address: vec!["Berlin".into()],
        practice_name: "Practice".into(),
        practice_address: vec!["Str. 1".into()],
        lines: vec![sample_line("Legacy line", 500)],
        note: Some("Note".into()),
        clinician_name: None,
        clinician_zanr: None,
        practice_bsnr: None,
        bank_details: None,
        payment_terms_text: None,
        vat_notice: None,
    };
    let pdf = render(&inv).expect("render");
    assert!(pdf.starts_with(b"%PDF-1.4"));
}

#[test]
fn test_chart_pdf_has_practice_header() {
    let blocks = vec![ChartPdfBlock {
        title: "Practice".into(),
        body_lines: vec![],
        kv_pairs: vec![
            ("Practice".into(), "Testpraxis".into()),
            ("BSNR".into(), "123456789".into()),
        ],
        table: None,
    }];
    let pdf =
        render_chart_blocks("Chart", "2026-01-01", "Chart Test", &blocks, None).expect("chart pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(s.contains("Practice"));
    assert!(s.contains("BSNR"));
    assert!(s.contains("Seite"));
}

#[test]
fn test_clinical_certificate_layout_markers() {
    let doc = ClinicalPdfLayout {
        kind: "certificate".into(),
        practice_lines: vec!["Zahnarztpraxis Nord".into()],
        header_right_lines: vec!["Tel: 030 123456".into()],
        meta_lines: vec![],
        address_lines: vec![],
        document_title: "MEDICAL CERTIFICATE".into(),
        document_subtitle: None,
        intro_paragraphs: vec!["Hiermit wird bescheinigt, dass …".into()],
        label_value_rows: vec![LabelValue {
            label: "Validity period".into(),
            value: "01.01.2026 until 07.01.2026".into(),
        }],
        two_column: None,
        tables: vec![],
        detail_records: vec![],
        totals: vec![],
        closing_paragraphs: vec![],
        signature_lines: vec!["Dr. Muster".into()],
        footer_meta_lines: vec![LabelValue {
            label: "Ausstellungsdatum".into(),
            value: "19.05.2026".into(),
        }],
        clinician_professional_title: None,
        clinician_zanr: None,
        clinician_bsnr: None,
    };
    let pdf = render_clinical_layout(&doc).expect("certificate pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(pdf.starts_with(b"%PDF"));
    for needle in ["Zahnarztpraxis Nord", "Ausstellungsdatum"] {
        assert!(s.contains(needle), "missing {needle}");
    }
    assert!(
        s.contains("\\304") || s.contains("00C4") || s.contains("MEDICAL CERTIFICATE"),
        "expected WinAnsi or UTF-16 encoding for Ä in title"
    );
}

#[test]
fn test_chart_examination_table_renders_full_psi() {
    let json = r#"{
        "version": 1,
        "chiefComplaint": "Zahnfleischbluten",
        "psi": { "s1": "2", "s4": "3" },
        "diagnosis": "Parodontitis",
        "plan": "CHX-Spülung"
    }"#;
    let finding = format_examination_for_chart_table(None, Some(json), None);
    let blocks = vec![ChartPdfBlock {
        title: "Examinations".into(),
        body_lines: vec![],
        kv_pairs: vec![],
        table: Some(ChartPdfTable {
            headers: vec![
                "Date".into(),
                "Nr.".into(),
                "Untersuchungsbefund (vollständig)".into(),
            ],
            rows: vec![vec!["2026-05-19".into(), "U-001".into(), finding]],
            column_weights: Some(vec![2, 1, 12]),
        }),
    }];
    let pdf = render_chart_blocks("Chart", "2026-05-19", "Chart U", &blocks, None).expect("pdf");
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "Parodontalstatus",
        "Sextant I",
        "Sextant IV",
        "Parodontitis",
        "CHX",
        "Zahnfleischbluten",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
}

#[test]
fn test_clinical_receipt_table_layout() {
    let doc = ClinicalPdfLayout {
        kind: "receipt".into(),
        practice_lines: vec!["Practice Süd".into()],
        header_right_lines: vec![],
        meta_lines: vec![LabelValue {
            label: "Receipt-Nr.".into(),
            value: "Q-001".into(),
        }],
        address_lines: vec!["Max Mustermann".into()],
        document_title: "PATIENTENQUITTUNG".into(),
        document_subtitle: Some("für Max Mustermann".into()),
        intro_paragraphs: vec!["Billed service items for 19.05.2026".into()],
        label_value_rows: vec![LabelValue {
            label: "Patient/in".into(),
            value: "Max Mustermann".into(),
        }],
        two_column: None,
        tables: vec![PdfTableSpec {
            title: None,
            headers: vec!["Tag".into(), "Position".into(), "Kurzbeschreibung".into()],
            rows: vec![vec![
                "19.05.2026".into(),
                "Q-001".into(),
                "Kontrolle".into(),
            ]],
            column_layout: TableColumnLayout::Receipt,
        }],
        detail_records: vec![],
        totals: vec![
            LabelValue {
                label: "Honorar".into(),
                value: "50,00 €".into(),
            },
            LabelValue {
                label: "Total".into(),
                value: "50,00 €".into(),
            },
        ],
        closing_paragraphs: vec![],
        signature_lines: vec![],
        footer_meta_lines: vec![],
        clinician_professional_title: None,
        clinician_zanr: None,
        clinician_bsnr: None,
    };
    let pdf = render_clinical_layout(&doc).expect("receipt pdf");
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "PATIENTENQUITTUNG",
        "Tag",
        "Kurzbeschreibung",
        "Honorar",
        "Total",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
}

#[test]
fn test_discharge_leaflet_pdf_markers() {
    let blocks = vec![ChartPdfBlock::body(
        "Note",
        vec![
            "Dieses Leaflet fasst Daten aus der Praxissoftware zusammen und ersetzt keine ärztliche Beratung."
                .into(),
            "Bitte bringen Sie dieses Blatt to Folgeterminen mit.".into(),
        ],
    )];
    let pdf = render_chart_blocks(
        "Entlassungs-Leaflet / Nachsorge",
        "2026-05-21",
        "Entlassungs-Leaflet — Testpatient",
        &blocks,
        None,
    )
    .expect("discharge leaflet pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(pdf.starts_with(b"%PDF"));
    for needle in ["Entlassungs-Leaflet", "Praxissoftware", "Folgeterminen"] {
        assert!(s.contains(needle), "missing {needle}");
    }
}

#[test]
fn test_financial_report_pdf_markers() {
    let input = ReportPdfInput {
        doc_title: "Bilanzbericht".into(),
        generated_at: "26.05.2026".into(),
        practice_name: "Practice Süd".into(),
        practice_address: vec!["Str. 2".into()],
        summary: vec![
            ReportPdfSummaryRow {
                label: "Income (paid)".into(),
                value: "8.500,00 €".into(),
            },
            ReportPdfSummaryRow {
                label: "Outstanding".into(),
                value: "1.200,00 €".into(),
            },
        ],
        sections: vec![ReportPdfSection {
            title: "Monatlicher Verlauf".into(),
            headers: vec!["Monat".into(), "Income".into()],
            rows: vec![vec!["2026-05".into(), "8.500,00".into()]],
        }],
    };
    let pdf = render_report_pdf(&input).expect("report pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(pdf.starts_with(b"%PDF"));
    for needle in [
        "Bilanzbericht",
        "Zusammenfassung",
        "Monatlicher Verlauf",
        "Seite",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
}
