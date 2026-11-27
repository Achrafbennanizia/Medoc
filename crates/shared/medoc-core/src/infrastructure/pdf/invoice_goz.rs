//! Dental invoice (Liquidation) in the structure of **Anlage 2 GOZ**.
//!
//! Columns: Datum | Region/Zahn | Nr. | Leistungsbeschreibung | Anz. | Faktor | Betrag.
//! The practice currency is printed after each amount, not in the column title.
//! grouped into GOZ fees, GOÄ fees, § 9 expenses (material, external lab),
//! each with a subtotal; then net/VAT per rate (UStG § 14 Abs. 4 Nr. 7–8)
//! and the amount due. Chrome labels follow `Invoice.locale` (`de`|`en`|`fr`|`ar`).
//!
//! The model is (de)serialisable so the issued invoice can be stored
//! verbatim in `issued_document.payload_json` and re-rendered later.

use serde::{Deserialize, Deserializer, Serialize};

/// `null` in the UI payload means "not set". `#[serde(default)]` only covers
/// a missing key, so an explicit null on a string or enum fails the command
/// with `invalid type: null, expected a string`.
fn null_as_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    Ok(Option::<T>::deserialize(deserializer)?.unwrap_or_default())
}

use super::core::{
    emit_pdf_document, format_date_dmy, format_eur, pdf_locale, PageBuilder, PdfDocMeta, M_BOTTOM,
    M_LEFT, M_RIGHT,
};
use super::goz::{compute_totals, FACTOR_JUSTIFICATION_THRESHOLD};
use super::i18n::{t, tr, trf, Phrase};
use super::letterhead::{emit_letterhead, Letterhead, MetaRow};
use super::logo::PdfLogo;
use super::metrics::wrap_to_width;
use crate::error::AppError;

/// Which fee schedule / expense group a line belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeeSchedule {
    #[default]
    Goz,
    Goae,
    /// § 9 GOZ — practice material.
    Material,
    /// § 9 GOZ — external laboratory.
    Lab,
    /// Other non-fee items (e.g. Wegegeld § 8).
    Other,
}

impl FeeSchedule {
    pub fn is_fee(self) -> bool {
        matches!(self, FeeSchedule::Goz | FeeSchedule::Goae)
    }

    fn heading(self, locale: &str) -> &'static str {
        match self {
            FeeSchedule::Goz => tr(locale, "invoice.fees_under_goz"),
            FeeSchedule::Goae => tr(locale, "invoice.fees_under_goae"),
            FeeSchedule::Material => tr(locale, "invoice.expenses_material"),
            FeeSchedule::Lab => tr(locale, "invoice.expenses_lab"),
            FeeSchedule::Other => tr(locale, "invoice.other_items"),
        }
    }

    const ORDER: [FeeSchedule; 5] = [
        FeeSchedule::Goz,
        FeeSchedule::Goae,
        FeeSchedule::Material,
        FeeSchedule::Lab,
        FeeSchedule::Other,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceKind {
    #[default]
    Invoice,
    /// Stornorechnung — negative amounts, references the original number.
    Cancellation,
}

/// One invoice line.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct InvoiceLine {
    /// Service description (understandable wording, § 10 Abs. 2 Nr. 2 GOZ).
    #[serde(default, deserialize_with = "null_as_default")]
    pub description: String,
    /// Line amount in cents (unit fee × quantity, net).
    #[serde(default, deserialize_with = "null_as_default")]
    pub amount_cents: i64,
    /// Fee number ("0010", "2197", GOÄ "Ä1").
    pub goz_nr: Option<String>,
    /// Increase factor.
    pub factor: Option<f64>,
    /// Unit price in cents (informational).
    pub unit_price_cents: Option<i64>,
    pub quantity: Option<i32>,
    /// Tooth / region (FDI).
    pub tooth_nr: Option<String>,
    /// ISO date of the service.
    pub treatment_date: Option<String>,
    /// VAT rate in percent (0 = exempt).
    pub vat_percent: Option<f64>,
    /// Kind of material (shown as sub-line).
    pub material: Option<String>,
    /// Justification for factor > 2.3 (§ 10 Abs. 3 GOZ).
    pub diagnosis_reason: Option<String>,
    #[serde(default, deserialize_with = "null_as_default")]
    pub fee_schedule: FeeSchedule,
    /// Points of the fee number — used to recompute the amount.
    pub points: Option<u32>,
    /// Analog billing (§ 6 Abs. 1 GOZ): number of the service the fee is
    /// taken from. `goz_nr` then holds the analog number.
    pub analog_of: Option<String>,
    /// Reference to an agreement under § 2 Abs. 1 und 2 GOZ (factor > 3.5).
    pub agreement_ref: Option<String>,
    /// Receipt for expenses above 25,56 EUR is attached.
    #[serde(default, deserialize_with = "null_as_default")]
    pub receipt_attached: bool,
    /// Billed record (`treatment:<id>` / `examination:<id>`). Used to prevent
    /// billing the same service twice and to match payments to the invoice.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_ref: Option<String>,
}

impl InvoiceLine {
    /// Construct a minimal line (all GOZ fields empty).
    pub fn simple(description: impl Into<String>, amount_cents: i64) -> Self {
        Self {
            description: description.into(),
            amount_cents,
            fee_schedule: FeeSchedule::Other,
            ..Default::default()
        }
    }
}

/// Legal identifiers a Moroccan invoice must carry (CGI art. 145-III). Present on an
/// invoice ⇒ it is rendered in the Moroccan format ([`super::invoice_ma`]), also on reprints.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct MoroccoIds {
    pub ice: Option<String>,
    pub if_number: Option<String>,
    pub tp: Option<String>,
    pub rc: Option<String>,
    pub cnss: Option<String>,
    pub inpe: Option<String>,
}

/// Complete invoice (UStG § 14 Abs. 4 + GOZ § 10).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Invoice {
    #[serde(default, deserialize_with = "null_as_default")]
    pub kind: InvoiceKind,
    #[serde(default, deserialize_with = "null_as_default")]
    pub number: String,
    /// ISO issue date.
    #[serde(default, deserialize_with = "null_as_default")]
    pub date: String,
    #[serde(default, deserialize_with = "null_as_default")]
    pub recipient_name: String,
    #[serde(default, deserialize_with = "null_as_default")]
    pub recipient_address: Vec<String>,
    /// Treated person (may differ from the recipient, e.g. a child).
    #[serde(default, deserialize_with = "null_as_default")]
    pub patient_name: String,
    /// ISO date of birth of the treated person.
    pub patient_birth_date: Option<String>,
    #[serde(default, deserialize_with = "null_as_default")]
    pub practice_name: String,
    #[serde(default, deserialize_with = "null_as_default")]
    pub practice_address: Vec<String>,
    /// Full letterhead (name, address, contact, BSNR/ZANR), filled by the
    /// server. When empty, it is built from name + address + ids.
    #[serde(default, deserialize_with = "null_as_default")]
    pub practice_lines: Vec<String>,
    /// DIN footer (identity, chamber, tax no., bank), filled by the server.
    #[serde(default, deserialize_with = "null_as_default")]
    pub footer_lines: Vec<String>,
    #[serde(default, deserialize_with = "null_as_default")]
    pub lines: Vec<InvoiceLine>,
    pub note: Option<String>,
    pub clinician_name: Option<String>,
    pub clinician_zanr: Option<String>,
    pub practice_bsnr: Option<String>,
    /// Steuernummer.
    pub tax_number: Option<String>,
    /// USt-IdNr.
    pub vat_id: Option<String>,
    pub bank_details: Option<Vec<String>>,
    pub payment_terms_text: Option<String>,
    /// Exemption notice, e.g. "Umsatzsteuerfrei gem. § 4 Nr. 14 UStG".
    pub vat_notice: Option<String>,
    /// ISO due date (invoice date + payment term), filled by the server.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
    /// Original invoice number (cancellations).
    pub cancels_number: Option<String>,
    /// Original invoice date (cancellations).
    pub cancels_date: Option<String>,
    /// "ENTWURF" (preview) / "KOPIE" (reprint) — never stored.
    #[serde(skip)]
    pub watermark: Option<String>,
    #[serde(skip)]
    pub logo: Option<PdfLogo>,
    /// Document language (`de`|`en`|`fr`|`ar`). Filled by the issuer from Settings.
    #[serde(default, deserialize_with = "null_as_default")]
    pub locale: String,
    #[serde(default, deserialize_with = "null_as_default")]
    pub rtl: bool,
    /// Moroccan practice identifiers, filled by the server; `Some` selects the Moroccan format.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub morocco: Option<MoroccoIds>,
}

impl Invoice {
    /// Gross total (net + VAT) in cents.
    pub fn total_cents(&self) -> i64 {
        compute_totals(self).gross
    }

    fn service_period(&self) -> Option<String> {
        let mut dates: Vec<&str> = self
            .lines
            .iter()
            .filter_map(|l| l.treatment_date.as_deref())
            .filter(|d| d.len() >= 10)
            .map(|d| &d[..10])
            .collect();
        dates.sort_unstable();
        let first = *dates.first()?;
        let last = *dates.last()?;
        Some(if first == last {
            format_date_dmy(first)
        } else {
            format!("{} – {}", format_date_dmy(first), format_date_dmy(last))
        })
    }
}

/// "12,94 EUR" (German decimal comma, thousands dot, practice currency).
pub fn fmt_amount(cents: i64) -> String {
    format_eur(cents)
}

fn fmt_factor(f: f64) -> String {
    let s = if ((f * 100.0).round() as i64) % 10 == 0 {
        format!("{f:.1}")
    } else {
        format!("{f:.2}")
    };
    s.replace('.', ",")
}

mod table;
#[allow(unused_imports)]
pub use table::*;

/// Render an invoice (or cancellation invoice). Call [`super::goz::validate_invoice`]
/// first — the issuing service does this before allocating the number.
pub fn render_goz_invoice(inv: &Invoice) -> Result<Vec<u8>, AppError> {
    let cancellation = inv.kind == InvoiceKind::Cancellation;
    let locale = pdf_locale(&inv.locale);
    let rtl = inv.rtl || super::i18n::is_rtl(locale);
    let totals = compute_totals(inv);
    let mut pb = PageBuilder::new();
    pb.locale = locale;
    pb.rtl = rtl;
    pb.watermark = inv.watermark.clone();

    // ---- Letterhead -------------------------------------------------------
    let mut practice = if inv.practice_lines.is_empty() {
        vec![inv.practice_name.clone()]
    } else {
        inv.practice_lines.clone()
    };
    if inv.practice_lines.is_empty() {
        practice.extend(inv.practice_address.iter().cloned());
        for id in [
            inv.practice_bsnr.as_deref().map(|b| format!("BSNR {b}")),
            inv.clinician_zanr.as_deref().map(|z| format!("ZANR {z}")),
        ]
        .into_iter()
        .flatten()
        .filter(|s| s.len() > 5)
        {
            practice.push(id);
        }
    }

    let invoice_no_label = if cancellation {
        tr(locale, "invoice.cancellation_no")
    } else {
        t(locale, Phrase::InvoiceNo)
    };
    let mut meta = vec![
        MetaRow::new(invoice_no_label, &inv.number),
        MetaRow::new(
            tr(locale, "invoice.invoice_date"),
            format_date_dmy(&inv.date),
        ),
    ];
    if !cancellation {
        if let Some(d) = inv.due_date.as_deref().filter(|d| !d.trim().is_empty()) {
            meta.push(MetaRow::new(
                tr(locale, "invoice.due_by"),
                format_date_dmy(d),
            ));
        }
    }
    if let Some(p) = inv.service_period() {
        meta.push(MetaRow::new(tr(locale, "invoice.service_period"), p));
    }
    if !inv.patient_name.trim().is_empty() {
        let born = tr(locale, "invoice.born");
        let dob = inv
            .patient_birth_date
            .as_deref()
            .map(|d| format!(", {born} {}", format_date_dmy(d)))
            .unwrap_or_default();
        meta.push(MetaRow::new(
            tr(locale, "invoice.treated_person"),
            format!("{}{dob}", inv.patient_name),
        ));
    }
    if let Some(c) = inv
        .clinician_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        meta.push(MetaRow::new(t(locale, Phrase::Clinician), c));
    }

    let mut recipient = vec![inv.recipient_name.clone()];
    recipient.extend(inv.recipient_address.iter().cloned());

    let lh = Letterhead {
        practice_lines: &practice,
        meta_rows: &meta,
        address_lines: &recipient,
        show_sender_hint: true,
        logo: inv.logo.as_ref(),
        rtl,
        locale,
        ..Default::default()
    };
    emit_letterhead(&mut pb, &lh);

    // DIN footer: identity, tax, bank on every page.
    let mut footer = if !inv.footer_lines.is_empty() {
        inv.footer_lines.clone()
    } else {
        Vec::new()
    };
    if footer.is_empty() {
        footer.push(format!(
            "{} · {}",
            inv.practice_name,
            inv.practice_address.join(", ")
        ));
        let tax: Vec<String> = [
            inv.tax_number
                .as_deref()
                .map(|tax| format!("{} {tax}", t(locale, Phrase::TaxNo))),
            inv.vat_id
                .as_deref()
                .map(|vat| format!("{} {vat}", t(locale, Phrase::VatId))),
        ]
        .into_iter()
        .flatten()
        .collect();
        if !tax.is_empty() {
            footer.push(tax.join(" · "));
        }
        if let Some(bank) = inv.bank_details.as_ref().filter(|b| !b.is_empty()) {
            footer.push(bank.join(" · "));
        }
    }
    pb.footer_lines.extend(footer);

    let title = if cancellation {
        tr(locale, "invoice.cancellation_invoice")
    } else {
        tr(locale, "invoice.invoice")
    };
    pb.set_continuation(
        &inv.practice_name,
        &format!("{title} {}", inv.number),
        locale,
    );

    // ---- Title --------------------------------------------------------------
    pb.text(M_LEFT, 16, true, title);
    pb.advance(18);
    let has_goz = inv.lines.iter().any(|l| l.fee_schedule == FeeSchedule::Goz);
    let has_goae = inv
        .lines
        .iter()
        .any(|l| l.fee_schedule == FeeSchedule::Goae);
    let basis = match (has_goz, has_goae) {
        (true, true) => tr(locale, "invoice.billing_goz_goae"),
        (true, false) => tr(locale, "invoice.billing_goz"),
        (false, true) => tr(locale, "invoice.billing_goae"),
        _ => "",
    };
    if !basis.is_empty() {
        pb.text(M_LEFT, 9, false, basis);
        pb.advance(14);
    }
    if cancellation {
        let orig = inv.cancels_number.as_deref().unwrap_or("-");
        let date = inv
            .cancels_date
            .as_deref()
            .map(|d| format!(" {} {}", tr(locale, "invoice.dated"), format_date_dmy(d)))
            .unwrap_or_default();
        pb.wrapped(
            M_LEFT,
            9,
            false,
            &trf(
                locale,
                "invoice.cancellation_text",
                &[("orig", orig), ("date", &date)],
            ),
            M_RIGHT - M_LEFT,
        );
    }
    pb.advance(4);

    // ---- Table, grouped by schedule ---------------------------------------
    let factor_col = inv.lines.iter().any(|l| l.factor.is_some());
    emit_table_header(&mut pb, locale, factor_col);
    for schedule in FeeSchedule::ORDER {
        let lines: Vec<&InvoiceLine> = inv
            .lines
            .iter()
            .filter(|l| l.fee_schedule == schedule)
            .collect();
        if lines.is_empty() {
            continue;
        }
        pb.ensure_space(30);
        pb.text(M_LEFT, 8, true, schedule.heading(locale));
        pb.advance(11);
        let mut sum = 0;
        for l in lines {
            emit_line(&mut pb, l, locale, factor_col);
            sum += l.amount_cents;
        }
        emit_sum_row(
            &mut pb,
            &format!(
                "{} {}",
                tr(locale, "invoice.subtotal"),
                short_label(schedule, locale)
            ),
            sum,
            false,
            true,
        );
        pb.advance(4);
    }

    // ---- Totals --------------------------------------------------------------
    pb.ensure_space(70);
    pb.advance(4);
    pb.hline(M_LEFT + 250, M_RIGHT);
    pb.advance(3);
    pb.hline(M_LEFT + 250, M_RIGHT);
    pb.advance(13);
    let total_label = if cancellation {
        tr(locale, "invoice.cancellation_amount")
    } else {
        tr(locale, "invoice.invoice_total")
    };
    if totals.vat_groups.is_empty() {
        emit_sum_row(&mut pb, total_label, totals.gross, true, false);
    } else {
        emit_sum_row(
            &mut pb,
            tr(locale, "invoice.net_amount"),
            totals.net,
            false,
            false,
        );
        for (rate, net, tax) in &totals.vat_groups {
            let rate_s = fmt_factor(*rate as f64 / 100.0)
                .trim_end_matches(",0")
                .to_string();
            emit_sum_row(
                &mut pb,
                &trf(
                    locale,
                    "invoice.vat_line",
                    &[("rate", &rate_s), ("net", &fmt_amount(*net))],
                ),
                *tax,
                false,
                false,
            );
        }
        emit_sum_row(&mut pb, total_label, totals.gross, true, true);
    }

    // ---- Notices -------------------------------------------------------------
    pb.advance(6);
    let width = M_RIGHT - M_LEFT;
    let exempt_part = inv
        .lines
        .iter()
        .any(|l| l.vat_percent.unwrap_or(0.0) <= 0.0);
    if exempt_part {
        if let Some(n) = inv.vat_notice.as_deref().filter(|s| !s.trim().is_empty()) {
            let text = if totals.vat_groups.is_empty() {
                n.to_string()
            } else {
                trf(locale, "invoice.items_without_vat", &[("notice", n)])
            };
            pb.wrapped(M_LEFT, 9, false, &text, width);
        }
    }
    if !cancellation {
        if let Some(terms) = inv
            .payment_terms_text
            .as_deref()
            .filter(|s| !s.trim().is_empty())
        {
            pb.wrapped(M_LEFT, 9, false, terms, width);
        }
        // § 286 Abs. 3 S. 1 Hs. 2 BGB: a consumer only falls into default
        // 30 days after receipt if the invoice says so. German law: German practices only.
        if super::i18n::legal_jurisdiction(locale) == "de" {
            pb.wrapped(
                M_LEFT,
                9,
                false,
                tr(locale, "invoice.default_notice_bgb_286"),
                width,
            );
        }
        // Payment details in the body, not only in the footer, so the
        // patient can transfer without searching the small print.
        if let Some(bank) = inv.bank_details.as_ref().filter(|b| !b.is_empty()) {
            pb.advance(4);
            pb.wrapped(
                M_LEFT,
                9,
                false,
                &trf(
                    locale,
                    "invoice.transfer_request",
                    &[("number", &inv.number)],
                ),
                width,
            );
            // Holder + bank on one line, IBAN + BIC on the next.
            let (head, tail): (Vec<&String>, Vec<&String>) = bank
                .iter()
                .partition(|l| !l.starts_with("IBAN") && !l.starts_with("BIC"));
            for part in [head, tail] {
                if !part.is_empty() {
                    let line: Vec<&str> = part.iter().map(|s| s.as_str()).collect();
                    pb.wrapped(M_LEFT, 9, true, &line.join(" · "), width);
                }
            }
        }
    }
    if let Some(n) = inv.note.as_deref().filter(|s| !s.trim().is_empty()) {
        pb.advance(4);
        pb.wrapped(M_LEFT, 9, false, n, width);
    }

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

fn short_label(s: FeeSchedule, locale: &str) -> &'static str {
    match s {
        FeeSchedule::Goz => "GOZ",
        FeeSchedule::Goae => "GOÄ",
        FeeSchedule::Material => tr(locale, "invoice.materials"),
        FeeSchedule::Lab => tr(locale, "invoice.external_lab"),
        FeeSchedule::Other => tr(locale, "invoice.other"),
    }
}

#[cfg(test)]
pub(super) mod tests {
    use super::super::goz::{unit_fee_cents, validate_invoice};
    use super::*;

    #[test]
    fn null_strings_from_the_ui_deserialize_as_empty() {
        let raw = r#"{
            "number": null,
            "date": "2026-11-10",
            "recipient_name": "Ada",
            "recipient_address": null,
            "practice_name": null,
            "practice_address": [],
            "patient_name": null,
            "locale": null,
            "rtl": null,
            "kind": null,
            "note": null,
            "lines": [{
                "description": null,
                "amount_cents": 1294,
                "fee_schedule": null,
                "tooth_nr": null,
                "treatment_date": null
            }]
        }"#;
        let inv: Invoice = serde_json::from_str(raw).expect("invoice json");
        assert_eq!(inv.number, "");
        assert_eq!(inv.locale, "");
        assert!(!inv.rtl);
        assert_eq!(inv.kind, InvoiceKind::Invoice);
        assert!(inv.note.is_none());
        assert_eq!(inv.lines.len(), 1);
        assert_eq!(inv.lines[0].description, "");
        assert_eq!(inv.lines[0].fee_schedule, FeeSchedule::Goz);
        assert!(inv.lines[0].tooth_nr.is_none());
    }

    pub fn sample() -> Invoice {
        Invoice {
            number: "RE-2026-000001".into(),
            date: "2026-06-02".into(),
            recipient_name: "Max Muster".into(),
            recipient_address: vec!["Musterweg 1".into(), "10115 Berlin".into()],
            patient_name: "Lena Muster".into(),
            patient_birth_date: Some("2014-03-01".into()),
            practice_name: "Zahnarztpraxis Dr. Beispiel".into(),
            practice_address: vec!["Hauptstraße 2".into(), "10115 Berlin".into()],
            clinician_name: Some("Dr. Maria Beispiel".into()),
            practice_bsnr: Some("123456789".into()),
            clinician_zanr: Some("987654321".into()),
            tax_number: Some("12/345/67890".into()),
            bank_details: Some(vec![
                "IBAN DE89 3704 0044 0532 0130 00".into(),
                "BIC COBADEFFXXX".into(),
            ]),
            vat_notice: Some("Umsatzsteuerfrei gem. § 4 Nr. 14 UStG.".into()),
            payment_terms_text: Some("Zahlbar innerhalb von 14 Tagen ohne Abzug.".into()),
            lines: vec![
                InvoiceLine {
                    description: "Eingehende Untersuchung".into(),
                    goz_nr: Some("0010".into()),
                    points: Some(100),
                    factor: Some(2.3),
                    amount_cents: unit_fee_cents(FeeSchedule::Goz, 100, 2.3),
                    treatment_date: Some("2026-05-20".into()),
                    ..Default::default()
                },
                InvoiceLine {
                    description: "Testposition Füllung, dreiflächig".into(),
                    goz_nr: Some("9999".into()),
                    points: Some(1_000),
                    factor: Some(3.0),
                    amount_cents: unit_fee_cents(FeeSchedule::Goz, 1_000, 3.0),
                    tooth_nr: Some("36".into()),
                    treatment_date: Some("2026-05-27".into()),
                    diagnosis_reason: Some(
                        "Erschwerte Trockenlegung bei subgingivaler Ausdehnung".into(),
                    ),
                    ..Default::default()
                },
                InvoiceLine {
                    description: "Komposit-Material".into(),
                    fee_schedule: FeeSchedule::Material,
                    amount_cents: 3_200,
                    material: Some("Komposit, Charge 4711".into()),
                    receipt_attached: true,
                    treatment_date: Some("2026-05-27".into()),
                    ..Default::default()
                },
            ],
            ..Default::default()
        }
    }

    #[test]
    fn valid_sample_passes_and_renders_german_form() {
        let inv = sample();
        validate_invoice(&inv).expect("valid");
        let pdf = render_goz_invoice(&inv).unwrap();
        let s = String::from_utf8_lossy(&pdf);
        for needle in [
            "Rechnung",
            "Leistungsbeschreibung",
            "Zwischensumme GOZ",
            "Rechnungsbetrag",
            "Behandelte Person",
            "Steuer-Nr. 12/345/67890",
            "Begr\\374ndung",
            "Leistungszeitraum",
            "12,94 EUR",
        ] {
            assert!(s.contains(needle), "missing {needle}");
        }
    }

    #[test]
    fn rejects_factor_above_2_3_without_reason_and_wrong_amount() {
        let mut inv = sample();
        inv.lines[1].diagnosis_reason = None;
        inv.lines[0].amount_cents += 50;
        let err = validate_invoice(&inv).unwrap_err().to_string();
        assert!(err.contains("error.invoice.line_factor_reason"));
        assert!(err.contains("error.invoice.line_amount_mismatch"));
    }

    #[test]
    fn rejects_missing_patient_dob_and_service_date() {
        let mut inv = sample();
        inv.patient_birth_date = None;
        inv.lines[0].treatment_date = None;
        let err = validate_invoice(&inv).unwrap_err().to_string();
        assert!(err.contains("error.invoice.patient_identity_missing"));
        assert!(err.contains("error.invoice.line_date"));
    }

    #[test]
    fn taxable_line_needs_tax_id_and_shows_vat() {
        let mut inv = sample();
        inv.tax_number = None;
        inv.lines[2].vat_percent = Some(19.0);
        assert!(validate_invoice(&inv)
            .unwrap_err()
            .to_string()
            .contains("error.invoice.tax_id_missing"));
        inv.tax_number = Some("12/345/67890".into());
        validate_invoice(&inv).unwrap();
        let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
        assert!(s.contains("zzgl. 19 % USt"));
        assert_eq!(inv.total_cents(), compute_totals(&inv).net + 608);
    }

    #[test]
    fn cancellation_references_original() {
        let mut inv = sample();
        inv.kind = InvoiceKind::Cancellation;
        inv.number = "ST-2026-000001".into();
        inv.cancels_number = Some("RE-2026-000001".into());
        for l in &mut inv.lines {
            l.amount_cents = -l.amount_cents;
        }
        validate_invoice(&inv).unwrap();
        let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
        assert!(s.contains("Stornorechnung"));
        assert!(s.contains("RE-2026-000001"));
    }

    #[test]
    fn long_invoice_repeats_header_on_every_page() {
        let mut inv = sample();
        let base = inv.lines[0].clone();
        inv.lines = (0..80).map(|_| base.clone()).collect();
        let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
        let pages = s.matches("/Type /Page ").count();
        assert!(pages >= 3);
        assert_eq!(s.matches("(Leistungsbeschreibung)").count(), pages);
    }

    #[test]
    fn invoice_chrome_follows_document_locale() {
        let markers = [
            ("de", "Rechnung", "Leistungsbeschreibung", "Rechnungsbetrag"),
            ("en", "Invoice", "Service description", "Invoice total"),
            (
                "fr",
                "Facture",
                "Description des prestations",
                "Montant de la facture",
            ),
        ];
        for (locale, title, desc, total) in markers {
            let mut inv = sample();
            inv.locale = locale.into();
            let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
            assert!(s.contains(title), "locale={locale} missing title {title}");
            assert!(s.contains(desc), "locale={locale} missing desc {desc}");
            assert!(s.contains(total), "locale={locale} missing total {total}");
        }
        let mut ar = sample();
        ar.locale = "ar".into();
        ar.rtl = true;
        let pdf = render_goz_invoice(&ar).unwrap();
        let s = String::from_utf8_lossy(&pdf);
        assert!(
            s.contains("+NotoNaskhArabic") || s.contains("/F3 "),
            "ar invoice missing arabic font"
        );
        assert!(s.contains("/Lang (ar)"), "ar invoice /Lang");
    }

    #[test]
    fn legal_sub_lines_follow_the_document_language() {
        let mut inv = sample();
        inv.locale = "fr".into();
        inv.watermark = Some("ENTWURF".into());
        let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
        assert!(s.contains("Justificatif joint."), "receipt line in French");
        assert!(
            s.contains("Justification \\(\\247 10 al. 3 GOZ\\)"),
            "justification in French"
        );
        assert!(!s.contains("Beleg liegt bei"), "no German sub-line");
        assert!(!s.contains("Begr\\374ndung"), "no German justification");
        assert!(s.contains("(BROUILLON)"), "German watermark word localised");
    }

    #[test]
    fn invoice_carries_a_document_id() {
        let inv = sample();
        let uid = "4f1c2b8e-1111-4222-8333-944455556666";
        let pdf = super::super::core::with_document_uid(uid, || render_goz_invoice(&inv)).unwrap();
        assert_eq!(
            super::super::core::document_uid_of(&pdf).as_deref(),
            Some(uid)
        );
        let s = String::from_utf8_lossy(&pdf);
        assert!(
            s.contains(&format!("Dokument-ID: {uid}")),
            "id printed in the footer"
        );
        assert!(s.contains("/ID [<4F1C2B8E111142228333944455556666>"));
        // Without a fixed id every render still gets one.
        let other = render_goz_invoice(&inv).unwrap();
        assert!(super::super::core::document_uid_of(&other).is_some());
        assert_ne!(
            super::super::core::document_uid_of(&other).as_deref(),
            Some(uid)
        );
    }
}
