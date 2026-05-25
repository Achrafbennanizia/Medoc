//! Integration tests for GOZ invoice, Akte, and clinical document PDF markers.

use medoc_lib::infrastructure::clinical_pdf_layout::{
    render_clinical_layout, ClinicalPdfLayout, LabelValue, PdfTableSpec, TableColumnLayout,
};
use medoc_lib::infrastructure::clinical_text_format::format_untersuchung_for_akte_table;
use medoc_lib::infrastructure::pdf::{
    render, render_akte_blocks, AktePdfBlock, AktePdfTable, Invoice, InvoiceLine,
};

fn sample_line(description: &str, amount_cents: i64) -> InvoiceLine {
    InvoiceLine {
        description: description.into(),
        amount_cents,
        goz_nr: None,
        faktor: None,
        einzelpreis_cents: None,
        menge: None,
        zahn_nr: None,
        behandlungsdatum: None,
        ust_prozent: None,
        material: None,
        diagnose_begruendung: None,
    }
}

#[test]
fn test_invoice_goz_has_required_fields() {
    let inv = Invoice {
        number: "RE-TEST".into(),
        date: "2026-04-19".into(),
        recipient_name: "Patient".into(),
        recipient_address: vec!["Berlin".into()],
        practice_name: "Praxis".into(),
        practice_address: vec!["Str. 1".into()],
        lines: vec![sample_line("Leistung", 1000)],
        note: None,
        behandler_name: Some("Dr. X".into()),
        behandler_zanr: Some("123456789".into()),
        praxis_bsnr: Some("987654321".into()),
        bankverbindung: Some(vec!["IBAN DE00".into()]),
        zahlungsziel_text: Some("Zahlbar innerhalb von 14 Tagen.".into()),
        ust_hinweis: Some("Umsatzsteuerbefreit".into()),
    };
    let pdf = render(&inv).expect("render");
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "GOZ",
        "Fak",
        "IBAN",
        "Umsatzsteuerbefreit",
        "Zahlbar innerhalb",
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
        practice_name: "Praxis".into(),
        practice_address: vec!["Str. 1".into()],
        lines: vec![sample_line("Legacy line", 500)],
        note: Some("Hinweis".into()),
        behandler_name: None,
        behandler_zanr: None,
        praxis_bsnr: None,
        bankverbindung: None,
        zahlungsziel_text: None,
        ust_hinweis: None,
    };
    let pdf = render(&inv).expect("render");
    assert!(pdf.starts_with(b"%PDF-1.4"));
}

#[test]
fn test_akte_pdf_has_praxis_header() {
    let blocks = vec![AktePdfBlock {
        title: "Praxis".into(),
        body_lines: vec![],
        kv_pairs: vec![
            ("Praxis".into(), "Testpraxis".into()),
            ("BSNR".into(), "123456789".into()),
        ],
        table: None,
    }];
    let pdf =
        render_akte_blocks("Akte", "2026-01-01", "Akte Test", &blocks, None).expect("akte pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(s.contains("Praxis"));
    assert!(s.contains("BSNR"));
    assert!(s.contains("Seite"));
}

#[test]
fn test_clinical_attest_layout_markers() {
    let doc = ClinicalPdfLayout {
        kind: "attest".into(),
        praxis_lines: vec!["Zahnarztpraxis Nord".into()],
        header_right_lines: vec!["Tel: 030 123456".into()],
        meta_lines: vec![],
        address_lines: vec![],
        document_title: "ÄRZTLICHES ATTEST".into(),
        document_subtitle: None,
        intro_paragraphs: vec!["Hiermit wird bescheinigt, dass …".into()],
        label_value_rows: vec![LabelValue {
            label: "Gültigkeitszeitraum".into(),
            value: "01.01.2026 bis 07.01.2026".into(),
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
        behandler_berufsbezeichnung: None,
        behandler_zanr: None,
        behandler_bsnr: None,
    };
    let pdf = render_clinical_layout(&doc).expect("attest pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(pdf.starts_with(b"%PDF"));
    for needle in ["Zahnarztpraxis Nord", "Ausstellungsdatum"] {
        assert!(s.contains(needle), "missing {needle}");
    }
    assert!(
        s.contains("\\304") || s.contains("00C4") || s.contains("ÄRZTLICHES ATTEST"),
        "expected WinAnsi or UTF-16 encoding for Ä in title"
    );
}

#[test]
fn test_akte_untersuchung_table_renders_full_psi() {
    let json = r#"{
        "version": 1,
        "chiefComplaint": "Zahnfleischbluten",
        "psi": { "s1": "2", "s4": "3" },
        "diagnosis": "Parodontitis",
        "plan": "CHX-Spülung"
    }"#;
    let befund = format_untersuchung_for_akte_table(None, Some(json), None);
    let blocks = vec![AktePdfBlock {
        title: "Untersuchungen".into(),
        body_lines: vec![],
        kv_pairs: vec![],
        table: Some(AktePdfTable {
            headers: vec![
                "Datum".into(),
                "Nr.".into(),
                "Untersuchungsbefund (vollständig)".into(),
            ],
            rows: vec![vec!["2026-05-19".into(), "U-001".into(), befund]],
            column_weights: Some(vec![2, 1, 12]),
        }),
    }];
    let pdf = render_akte_blocks("Akte", "2026-05-19", "Akte U", &blocks, None).expect("pdf");
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
fn test_clinical_quittung_table_layout() {
    let doc = ClinicalPdfLayout {
        kind: "quittung".into(),
        praxis_lines: vec!["Praxis Süd".into()],
        header_right_lines: vec![],
        meta_lines: vec![LabelValue {
            label: "Quittung-Nr.".into(),
            value: "Q-001".into(),
        }],
        address_lines: vec!["Max Mustermann".into()],
        document_title: "PATIENTENQUITTUNG".into(),
        document_subtitle: Some("für Max Mustermann".into()),
        intro_paragraphs: vec!["Abgerechnete Leistung für 19.05.2026".into()],
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
            column_layout: TableColumnLayout::Quittung,
        }],
        detail_records: vec![],
        totals: vec![
            LabelValue {
                label: "Honorar".into(),
                value: "50,00 €".into(),
            },
            LabelValue {
                label: "Gesamt".into(),
                value: "50,00 €".into(),
            },
        ],
        closing_paragraphs: vec![],
        signature_lines: vec![],
        footer_meta_lines: vec![],
        behandler_berufsbezeichnung: None,
        behandler_zanr: None,
        behandler_bsnr: None,
    };
    let pdf = render_clinical_layout(&doc).expect("quittung pdf");
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "PATIENTENQUITTUNG",
        "Tag",
        "Kurzbeschreibung",
        "Honorar",
        "Gesamt",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
}

#[test]
fn test_discharge_merkblatt_pdf_markers() {
    let blocks = vec![AktePdfBlock::body(
        "Hinweis",
        vec![
            "Dieses Merkblatt fasst Daten aus der Praxissoftware zusammen und ersetzt keine ärztliche Beratung."
                .into(),
            "Bitte bringen Sie dieses Blatt zu Folgeterminen mit.".into(),
        ],
    )];
    let pdf = render_akte_blocks(
        "Entlassungs-Merkblatt / Nachsorge",
        "2026-05-21",
        "Entlassungs-Merkblatt — Testpatient",
        &blocks,
        None,
    )
    .expect("discharge merkblatt pdf");
    let s = String::from_utf8_lossy(&pdf);
    assert!(pdf.starts_with(b"%PDF"));
    for needle in ["Entlassungs-Merkblatt", "Praxissoftware", "Folgeterminen"] {
        assert!(s.contains(needle), "missing {needle}");
    }
}
