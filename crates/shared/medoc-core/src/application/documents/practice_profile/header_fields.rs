//! Letterhead field order per country and the header labels.

/// Official letterhead order. Keep in step with `DEFAULT_PDF_HEADER_FIELDS`
/// in `packages/shared/src/lib/document-header-layout.ts`.
/// Default letterhead per country. German practices print BSNR / ZANR; Moroccan ones print
/// ICE / IF / TP / RC / CNSS / INPE (CGI art. 145); France and the rest of the EU print neither.
pub(super) const DEFAULT_HEADER_FIELDS: &[&str] = &[
    "name", "address", "phone", "fax", "email", "web", "bsnr", "zanr",
];
pub(super) const DEFAULT_HEADER_FIELDS_MA: &[&str] =
    &["name", "address", "phone", "fax", "email", "web", "ma_ids"];
pub(super) const DEFAULT_HEADER_FIELDS_FR: &[&str] =
    &["name", "address", "phone", "fax", "email", "web", "fr_ids"];
pub(super) const DEFAULT_HEADER_FIELDS_OTHER: &[&str] =
    &["name", "address", "phone", "fax", "email", "web"];

/// Header labels in the document language (the old ones were German on every document).
pub(super) fn header_label(key: &str) -> &'static str {
    let locale = crate::infrastructure::pdf::i18n::default_document_locale();
    match (key, locale) {
        ("phone", "fr") => "Tél.",
        ("phone", "ar") => "الهاتف",
        ("phone", _) => "Tel.",
        ("fax", "ar") => "الفاكس",
        ("fax", _) => "Fax",
        ("emergency", "de") => "Notdienst",
        ("emergency", "fr") => "Urgences",
        ("emergency", "ar") => "المستعجلات",
        ("emergency", _) => "Emergency",
        ("holder", "de") => "Kontoinhaber:",
        ("holder", "fr") => "Titulaire du compte :",
        ("holder", "ar") => "صاحب الحساب:",
        ("holder", _) => "Account holder:",
        _ => "",
    }
}

/// German practitioner and practice numbers (ZANR, BSNR, KZV, KV, Steuer-Nr.) belong on German
/// documents only. A practice with no country set keeps the old behaviour unless it bills in dirhams.
pub fn uses_german_ids(country: Option<&str>, currency: Option<&str>) -> bool {
    match country.map(str::trim).filter(|c| !c.is_empty()) {
        Some(c) => c.eq_ignore_ascii_case("DE"),
        None => !currency
            .map(str::trim)
            .is_some_and(|c| c.eq_ignore_ascii_case("MAD")),
    }
}

pub(super) const HEADER_FIELD_KEYS: &[&str] = &[
    "name",
    "address",
    "phone",
    "fax",
    "web",
    "email",
    "kv",
    "tax",
    "hours",
    "clinician",
    "zanr",
    "bsnr",
    "bank",
    "chamber",
    "kzv",
    "payment_terms",
    "vat_notice",
    "emergency_phone",
    "ma_ids",
    "fr_ids",
];
