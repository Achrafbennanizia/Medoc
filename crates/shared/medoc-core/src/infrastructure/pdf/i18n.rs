//! Document languages and the wording the server adds to PDFs.
//!
//! The UI sends the text it already translated (titles, labels, rows). This
//! module covers everything the **server** writes itself: footer, patient
//! panel, privacy notice, copy line, page numbers, watermarks, invoice /
//! cash-book / period-report chrome.
//!
//! ## Adding a language
//!
//! 1. Add `locales/<code>.json` next to this file with **every** key of
//!    `locales/en.json` (the `every_catalog_has_every_key` test fails
//!    otherwise, so a document can never fall back to another language).
//! 2. Add one [`LocaleSpec`] line to [`LOCALES`] (code, `/Lang` tag, direction).
//! 3. Add the same code to the UI catalogs (`packages/shared/locales`) and to
//!    `SUPPORTED_LOCALES` in `packages/shared/src/lib/i18n.ts`.
//!
//! A script without glyphs in the embedded fonts (e.g. Hebrew) also needs
//! one entry in `fonts::FONTS`.

use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};

/// One document language.
pub struct LocaleSpec {
    /// Code used everywhere in MeDoc (`de`, `en`, `fr`, `ar`).
    pub code: &'static str,
    /// BCP 47 tag written to the PDF catalog (`/Lang`).
    pub lang_tag: &'static str,
    /// Right-to-left reading (page layout is mirrored).
    pub rtl: bool,
    catalog: &'static str,
}

macro_rules! locale {
    ($code:literal, $tag:literal, $rtl:expr) => {
        LocaleSpec {
            code: $code,
            lang_tag: $tag,
            rtl: $rtl,
            catalog: include_str!(concat!("locales/", $code, ".json")),
        }
    };
}

/// Every language a document can be issued in. The first entry is the
/// default when nothing (or something unknown) is requested.
pub static LOCALES: &[LocaleSpec] = &[
    locale!("de", "de-DE", false),
    locale!("en", "en", false),
    locale!("fr", "fr-FR", false),
    locale!("ar", "ar", true),
];

/// Language used when a key is missing in the requested catalog (should not
/// happen — see the completeness test) and for unknown requests.
pub const DEFAULT_LOCALE: &str = "de";
const FALLBACK_CHAIN: &[&str] = &["en", "de"];

static CATALOGS: LazyLock<HashMap<&'static str, HashMap<String, String>>> = LazyLock::new(|| {
    LOCALES
        .iter()
        .map(|spec| {
            let map: HashMap<String, String> = serde_json::from_str(spec.catalog)
                .unwrap_or_else(|e| panic!("pdf locale {}: {e}", spec.code));
            (spec.code, map)
        })
        .collect()
});

pub fn spec(code: &str) -> Option<&'static LocaleSpec> {
    LOCALES.iter().find(|s| s.code == code)
}

/// Normalise what a caller sent (`"ar"`, `"ar-MA"`, `"fr_FR"`, `"\"en\""`,
/// `"DE"`) to a supported code. `None` when the language is not supported.
pub fn known_locale(requested: &str) -> Option<&'static str> {
    let raw = requested
        .trim()
        .trim_matches('"')
        .trim()
        .to_ascii_lowercase();
    if raw.is_empty() {
        return None;
    }
    let raw = raw.replace('_', "-");
    if let Some(s) = LOCALES.iter().find(|s| s.code == raw) {
        return Some(s.code);
    }
    let primary = raw.split('-').next().unwrap_or("");
    LOCALES.iter().find(|s| s.code == primary).map(|s| s.code)
}

/// Supported code for `requested`, or [`DEFAULT_LOCALE`].
pub fn locale_or_default(requested: &str) -> &'static str {
    known_locale(requested).unwrap_or(DEFAULT_LOCALE)
}

pub fn is_rtl(locale: &str) -> bool {
    known_locale(locale).and_then(spec).is_some_and(|s| s.rtl)
}

pub fn lang_tag(locale: &str) -> &'static str {
    spec(locale_or_default(locale)).map_or("de-DE", |s| s.lang_tag)
}

pub fn supported_codes() -> impl Iterator<Item = &'static str> {
    LOCALES.iter().map(|s| s.code)
}

static DEFAULT_DOCUMENT_LOCALE: Mutex<&'static str> = Mutex::new(DEFAULT_LOCALE);

/// The practice's document language (Settings), kept in memory for render
/// paths that receive no language (template previews). Updated whenever the
/// setting is read.
pub fn set_default_document_locale(requested: &str) {
    if let Some(code) = known_locale(requested) {
        if let Ok(mut guard) = DEFAULT_DOCUMENT_LOCALE.lock() {
            *guard = code;
        }
    }
}

pub fn default_document_locale() -> &'static str {
    DEFAULT_DOCUMENT_LOCALE
        .lock()
        .map(|g| *g)
        .unwrap_or(DEFAULT_LOCALE)
}

static MISSING: LazyLock<Mutex<HashSet<&'static str>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

/// Catalog text for `key` in `locale`.
pub fn tr(locale: &str, key: &str) -> &'static str {
    let code = locale_or_default(locale);
    let lookup = |c: &str| CATALOGS.get(c).and_then(|m| m.get(key)).map(String::as_str);
    if let Some(s) = lookup(code) {
        return s;
    }
    for c in FALLBACK_CHAIN {
        if let Some(s) = lookup(c) {
            tracing_missing(code, key);
            return s;
        }
    }
    // Unknown key: return it (interned once) so the gap is visible.
    let mut missing = MISSING.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(k) = missing.get(key) {
        return k;
    }
    let leaked: &'static str = Box::leak(key.to_string().into_boxed_str());
    missing.insert(leaked);
    leaked
}

fn tracing_missing(locale: &str, key: &str) {
    tracing::warn!(event = "PDF_I18N_KEY_MISSING", locale, key);
}

/// [`tr`] with `{name}` placeholders replaced.
pub fn trf(locale: &str, key: &str, args: &[(&str, &str)]) -> String {
    let mut s = tr(locale, key).to_string();
    for (name, value) in args {
        s = s.replace(&format!("{{{name}}}"), value);
    }
    s
}

/// Fixed phrases used across documents.
#[derive(Clone, Copy, Debug)]
pub enum Phrase {
    Chamber,
    TaxNo,
    VatId,
    Patient,
    Address,
    DateOfBirth,
    InsuranceNo,
    InvoiceNo,
    ReceiptNo,
    Privacy,
    Stamp,
    Continued,
    CopyEmployer,
    CopyInsurer,
    CopyPatient,
    BankDetails,
    DetailType,
    DetailPeriod,
    DetailDetails,
    Draft,
    Copy,
    NoTableRows,
    DocumentNo,
    CreatedAt,
    CreatedBy,
    Clinician,
    EmptyExport,
    PrivacyHeading,
    ChartPrivacy,
    NoEntries,
    Summary,
    Confirmation,
    MasterData,
    ChartStatus,
    Diagnosis,
    Findings,
    Treatments,
    NoneRecorded,
    NoTreatments,
    PatientChart,
    DocumentId,
    DocumentType,
    Preview,
}

impl Phrase {
    pub const ALL: [Phrase; 43] = [
        Phrase::Chamber,
        Phrase::TaxNo,
        Phrase::VatId,
        Phrase::Patient,
        Phrase::Address,
        Phrase::DateOfBirth,
        Phrase::InsuranceNo,
        Phrase::InvoiceNo,
        Phrase::ReceiptNo,
        Phrase::Privacy,
        Phrase::Stamp,
        Phrase::Continued,
        Phrase::CopyEmployer,
        Phrase::CopyInsurer,
        Phrase::CopyPatient,
        Phrase::BankDetails,
        Phrase::DetailType,
        Phrase::DetailPeriod,
        Phrase::DetailDetails,
        Phrase::Draft,
        Phrase::Copy,
        Phrase::NoTableRows,
        Phrase::DocumentNo,
        Phrase::CreatedAt,
        Phrase::CreatedBy,
        Phrase::Clinician,
        Phrase::EmptyExport,
        Phrase::PrivacyHeading,
        Phrase::ChartPrivacy,
        Phrase::NoEntries,
        Phrase::Summary,
        Phrase::Confirmation,
        Phrase::MasterData,
        Phrase::ChartStatus,
        Phrase::Diagnosis,
        Phrase::Findings,
        Phrase::Treatments,
        Phrase::NoneRecorded,
        Phrase::NoTreatments,
        Phrase::PatientChart,
        Phrase::DocumentId,
        Phrase::DocumentType,
        Phrase::Preview,
    ];

    pub fn key(self) -> &'static str {
        match self {
            Phrase::Chamber => "common.chamber",
            Phrase::TaxNo => "common.tax_no",
            Phrase::VatId => "common.vat_id",
            Phrase::Patient => "common.patient",
            Phrase::Address => "common.address",
            Phrase::DateOfBirth => "common.date_of_birth",
            Phrase::InsuranceNo => "common.insurance_no",
            Phrase::InvoiceNo => "common.invoice_no",
            Phrase::ReceiptNo => "common.receipt_no",
            Phrase::Privacy => "common.privacy",
            Phrase::Stamp => "common.stamp",
            Phrase::Continued => "common.continued",
            Phrase::CopyEmployer => "common.copy_employer",
            Phrase::CopyInsurer => "common.copy_insurer",
            Phrase::CopyPatient => "common.copy_patient",
            Phrase::BankDetails => "common.bank_details",
            Phrase::DetailType => "common.detail_type",
            Phrase::DetailPeriod => "common.detail_period",
            Phrase::DetailDetails => "common.detail_details",
            Phrase::Draft => "common.draft",
            Phrase::Copy => "common.copy",
            Phrase::NoTableRows => "common.no_table_rows",
            Phrase::DocumentNo => "common.document_no",
            Phrase::CreatedAt => "common.created_at",
            Phrase::CreatedBy => "common.created_by",
            Phrase::Clinician => "common.clinician",
            Phrase::EmptyExport => "common.empty_export",
            Phrase::PrivacyHeading => "common.privacy_heading",
            Phrase::ChartPrivacy => "common.chart_privacy",
            Phrase::NoEntries => "common.no_entries",
            Phrase::Summary => "common.summary",
            Phrase::Confirmation => "common.confirmation",
            Phrase::MasterData => "common.master_data",
            Phrase::ChartStatus => "common.chart_status",
            Phrase::Diagnosis => "common.diagnosis",
            Phrase::Findings => "common.findings",
            Phrase::Treatments => "common.treatments",
            Phrase::NoneRecorded => "common.none_recorded",
            Phrase::NoTreatments => "common.no_treatments",
            Phrase::PatientChart => "common.patient_chart",
            Phrase::DocumentId => "common.document_id",
            Phrase::DocumentType => "common.document_type",
            Phrase::Preview => "common.preview",
        }
    }
}

pub fn t(locale: &str, phrase: Phrase) -> &'static str {
    tr(locale, phrase.key())
}

/// A watermark written in any language ("ENTWURF", "KOPIE", "DRAFT" …) in
/// the document language. Callers that hard-coded the German words
/// (previews, reprints, receivables) now print "BROUILLON" / "نسخة".
pub fn localize_watermark(watermark: &str, locale: &str) -> String {
    let w = watermark.trim();
    for phrase in [Phrase::Draft, Phrase::Copy] {
        if CATALOGS.values().any(|cat| {
            cat.get(phrase.key())
                .is_some_and(|v| v.eq_ignore_ascii_case(w))
        }) {
            return t(locale, phrase).to_string();
        }
    }
    w.to_string()
}

/// Known wordings of the default VAT exemption notice (any language, old
/// and new). A stored default is replaced by the document language's text;
/// a notice the practice wrote itself is printed as written.
pub fn is_default_vat_notice(text: &str) -> bool {
    let norm = |s: &str| {
        s.trim()
            .trim_end_matches('.')
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase()
    };
    let n = norm(text);
    if n.is_empty() {
        return true;
    }
    const LEGACY: &[&str] = &[
        "Umsatzsteuerfrei gem. § 4 Nr. 14 Buchst. a UStG",
        "Umsatzsteuerfrei gem. § 4 Nr. 14 UStG",
        "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG",
        "VAT exempt pursuant to § 4 No. 14 UStG",
        "VAT-exempt under § 4 No. 14 UStG",
        "Exonéré de TVA conformément au § 4 n° 14 UStG",
        "Exonéré de TVA selon § 4 n° 14 UStG",
        "معفى من ضريبة القيمة المضافة وفق § 4 رقم 14 UStG",
    ];
    LEGACY.iter().any(|l| norm(l) == n)
        || CATALOGS
            .values()
            .filter_map(|c| c.get("invoice.vat_exempt_default"))
            .any(|v| norm(v) == n)
}

/// "Seite 1 von 3" / "صفحة 1 من 3".
pub fn page_label(locale: &str, page: usize, total: usize) -> String {
    trf(
        locale,
        "common.page_of",
        &[("page", &page.to_string()), ("total", &total.to_string())],
    )
}

/// Legacy positional chooser (`de`, `en`, `fr`, `ar`), kept for callers
/// outside the PDF module. New code must use catalog keys ([`tr`]); a
/// language added to [`LOCALES`] only gets the English string here.
pub fn pick<'a>(locale: &str, de: &'a str, en: &'a str, fr: &'a str, ar: &'a str) -> &'a str {
    match locale_or_default(locale) {
        "de" => de,
        "fr" => fr,
        "ar" => ar,
        _ => en,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_catalog_has_every_key() {
        let en = CATALOGS.get("en").expect("en catalog");
        for spec in LOCALES {
            let cat = CATALOGS.get(spec.code).expect("catalog");
            let missing: Vec<&String> = en.keys().filter(|k| !cat.contains_key(*k)).collect();
            assert!(missing.is_empty(), "{}: missing {missing:?}", spec.code);
            let extra: Vec<&String> = cat.keys().filter(|k| !en.contains_key(*k)).collect();
            assert!(extra.is_empty(), "{}: unknown keys {extra:?}", spec.code);
            for (k, v) in cat {
                assert!(!v.trim().is_empty(), "{}: empty {k}", spec.code);
                // Placeholders must match the English template.
                let ph = |s: &str| {
                    let mut v: Vec<String> = s
                        .split('{')
                        .skip(1)
                        .filter_map(|p| p.split('}').next().map(String::from))
                        .collect();
                    v.sort();
                    v
                };
                assert_eq!(ph(v), ph(&en[k]), "{}: placeholders of {k}", spec.code);
            }
        }
    }

    #[test]
    fn arabic_catalog_is_arabic() {
        let ar = CATALOGS.get("ar").unwrap();
        for (k, v) in ar {
            // Ignore {placeholders}.
            let text: String = v
                .split('{')
                .enumerate()
                .map(|(i, part)| {
                    if i == 0 {
                        part
                    } else {
                        part.split_once('}').map_or("", |p| p.1)
                    }
                })
                .collect();
            let letters = text.chars().filter(|c| c.is_alphabetic()).count();
            let arabic = text
                .chars()
                .filter(|c| ('\u{0600}'..='\u{06FF}').contains(c))
                .count();
            // Legal references (BGB, GOZ, UStG) may stay Latin, the wording may not.
            assert!(
                letters == 0 || arabic * 2 >= letters,
                "ar {k} is not Arabic: {v}"
            );
        }
    }

    #[test]
    fn every_phrase_resolves_for_all_locales() {
        for code in supported_codes() {
            for phrase in Phrase::ALL {
                let s = t(code, phrase);
                assert!(!s.is_empty() && s != phrase.key(), "{code:?} {phrase:?}");
            }
            assert!(!page_label(code, 1, 2).is_empty());
        }
    }

    #[test]
    fn locale_codes_are_normalised() {
        assert_eq!(known_locale("ar-MA"), Some("ar"));
        assert_eq!(known_locale("fr_FR"), Some("fr"));
        assert_eq!(known_locale("\"EN\""), Some("en"));
        assert_eq!(known_locale("de-AT"), Some("de"));
        assert_eq!(known_locale("xx"), None);
        assert_eq!(locale_or_default(""), "de");
        assert!(is_rtl("ar-SA"));
        assert!(!is_rtl("fr"));
    }

    #[test]
    fn legacy_pick_still_works() {
        assert_eq!(pick("fr", "de", "en", "fr", "ar"), "fr");
        assert_eq!(pick("ar", "de", "en", "fr", "ar"), "ar");
        assert_eq!(pick("xx", "de", "en", "fr", "ar"), "de");
    }

    #[test]
    fn templates_fill_placeholders() {
        assert_eq!(page_label("fr", 2, 5), "Page 2 sur 5");
        assert_eq!(
            trf(
                "de",
                "invoice.vat_line",
                &[("rate", "19"), ("net", "10,00 EUR")]
            ),
            "zzgl. 19 % USt auf 10,00 EUR"
        );
    }

    #[test]
    fn watermarks_and_vat_defaults_follow_the_document_language() {
        assert_eq!(localize_watermark("ENTWURF", "fr"), "BROUILLON");
        assert_eq!(localize_watermark("KOPIE", "ar"), "نسخة");
        assert_eq!(localize_watermark("DRAFT", "de"), "ENTWURF");
        assert_eq!(localize_watermark("MUSTER", "en"), "MUSTER");
        assert!(is_default_vat_notice("Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG"));
        assert!(is_default_vat_notice("VAT-exempt under § 4 No. 14 (a) UStG."));
        assert!(!is_default_vat_notice("Kleinunternehmer gem. § 19 UStG"));
    }
}
