//! Practice master data for official documents — read **only** from the
//! database (`app_kv` key `invoice.practice.v1`), never from the frontend.
//!
//! Legal identity fields (address, tax number, BSNR/ZANR, bank) are never
//! masked on official documents; the "privacy" toggles in Settings only apply
//! to screen previews.

use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use crate::infrastructure::pdf::{footer_lines_for_practice, PdfLogo, PracticeFooter};

pub const PRACTICE_KV_KEY: &str = "invoice.practice.v1";
pub const DOCUMENT_LOCALE_KV_KEY: &str = "documents.locale.v1";
/// Ordered header fields from Settings → System. Missing means the official letterhead.
pub const DOCUMENT_HEADER_LAYOUT_KV_KEY: &str = "documents.header_layout.v1";

/// Official letterhead order. Keep in step with `DEFAULT_PDF_HEADER_FIELDS`
/// in `packages/shared/src/lib/document-header-layout.ts`.
/// Default letterhead per country. German practices print BSNR / ZANR; Moroccan ones print
/// ICE / IF / TP / RC / CNSS / INPE (CGI art. 145); France and the rest of the EU print neither.
const DEFAULT_HEADER_FIELDS: &[&str] = &[
    "name", "address", "phone", "fax", "email", "web", "bsnr", "zanr",
];
const DEFAULT_HEADER_FIELDS_MA: &[&str] =
    &["name", "address", "phone", "fax", "email", "web", "ma_ids"];
const DEFAULT_HEADER_FIELDS_FR: &[&str] =
    &["name", "address", "phone", "fax", "email", "web", "fr_ids"];
const DEFAULT_HEADER_FIELDS_OTHER: &[&str] = &["name", "address", "phone", "fax", "email", "web"];

/// Header labels in the document language (the old ones were German on every document).
fn header_label(key: &str) -> &'static str {
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

const HEADER_FIELD_KEYS: &[&str] = &[
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

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PracticeProfile {
    pub name: String,
    pub addr: String,
    pub phone: Option<String>,
    pub fax: Option<String>,
    pub email: Option<String>,
    pub web: Option<String>,
    pub tax_number: Option<String>,
    pub vat_id: Option<String>,
    pub clinician_name: Option<String>,
    pub professional_title: Option<String>,
    pub zanr: Option<String>,
    pub bsnr: Option<String>,
    pub bank_iban: Option<String>,
    pub bank_bic: Option<String>,
    pub bank_name: Option<String>,
    pub account_holder: Option<String>,
    pub chamber: Option<String>,
    pub kzv: Option<String>,
    pub payment_terms_days: Option<u32>,
    /// ISO 4217 code chosen in Settings → Practice. Empty means EUR.
    pub currency: Option<String>,
    pub vat_exemption_notice: Option<String>,
    pub emergency_phone: Option<String>,
    pub kv_number: Option<String>,
    pub opening_hours: Option<String>,
    /// Practice country for legal wording on documents: "MA", "DE", "FR" or "EU".
    pub country: Option<String>,
    /// Morocco (CGI art. 145): Identifiant Commun de l'Entreprise.
    pub ma_ice: Option<String>,
    /// Identifiant fiscal.
    pub ma_if: Option<String>,
    /// Taxe professionnelle (ex-patente) number.
    pub ma_tp: Option<String>,
    /// Registre du commerce (only when the practice is a company).
    pub ma_rc: Option<String>,
    pub ma_cnss: Option<String>,
    /// Identifiant national des professionnels de santé.
    pub ma_inpe: Option<String>,
    /// France: répertoire partagé des professionnels de santé (11 digits), required on prescriptions.
    pub fr_rpps: Option<String>,
    /// France: SIRET of the practice (14 digits), required on invoices of a business.
    pub fr_siret: Option<String>,
    /// Saved PDF header table, two cells per row. Empty means the official pairs.
    #[serde(skip)]
    pub header_rows: Vec<[Option<String>; 2]>,
}

fn opt(s: &Option<String>) -> Option<&str> {
    s.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

impl PracticeProfile {
    pub async fn load(pool: &SqlitePool) -> Result<Self, AppError> {
        let raw = app_kv_repo::get(pool, PRACTICE_KV_KEY)
            .await?
            .unwrap_or_default();
        let mut p: PracticeProfile = serde_json::from_str(&raw).unwrap_or_default();
        crate::infrastructure::pdf::set_document_currency(p.currency.as_deref().unwrap_or("EUR"));
        crate::infrastructure::pdf::i18n::set_document_jurisdiction(p.jurisdiction());
        p.header_rows = match app_kv_repo::get(pool, DOCUMENT_HEADER_LAYOUT_KV_KEY).await {
            Ok(Some(layout)) => parse_header_rows(&layout),
            _ => Vec::new(),
        };
        Ok(p)
    }

    pub fn currency_code(&self) -> String {
        let raw = self.currency.as_deref().unwrap_or("EUR");
        crate::infrastructure::pdf::set_document_currency(raw);
        crate::infrastructure::pdf::document_currency()
    }

    /// Fails with a stable i18n code when fields required on every official
    /// document are missing (name, address, clinician).
    pub fn require_complete(&self) -> Result<(), AppError> {
        if self.name.trim().is_empty() || self.addr.trim().is_empty() {
            return Err(AppError::validation_code(
                "error.documents.practice_incomplete",
            ));
        }
        Ok(())
    }

    pub fn address_lines(&self) -> Vec<String> {
        self.addr
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .map(String::from)
            .collect()
    }

    /// Letterhead lines, one field per line, in table order (left cell, then
    /// right). A saved table wins; otherwise the official DIN 5008 order is
    /// name, street, city, phone, fax, email, web, BSNR, ZANR.
    pub fn letterhead_lines(&self) -> Vec<String> {
        self.letterhead_lines_for(false)
    }

    /// Letterhead of a prescription or certificate: the practice and the practitioner's
    /// professional id (INPE, RPPS, ZANR/BSNR), without tax ids, bank details, payment terms
    /// or the VAT notice, which belong on invoices only.
    pub fn clinical_letterhead_lines(&self) -> Vec<String> {
        self.letterhead_lines_for(true)
    }

    fn letterhead_lines_for(&self, clinical: bool) -> Vec<String> {
        let mut out = Vec::new();
        for row in self.header_table() {
            for cell in row {
                if let Some(key) = cell.as_deref() {
                    self.push_header_field_for(&mut out, key, clinical);
                }
            }
        }
        out
    }

    fn header_table(&self) -> Vec<[Option<String>; 2]> {
        if !self.header_rows.is_empty() {
            return self.header_rows.clone();
        }
        let mut rows = Vec::new();
        let defaults = if self.is_morocco() {
            DEFAULT_HEADER_FIELDS_MA
        } else if self.jurisdiction() == Some("fr") {
            DEFAULT_HEADER_FIELDS_FR
        } else if self.german_ids() {
            DEFAULT_HEADER_FIELDS
        } else {
            DEFAULT_HEADER_FIELDS_OTHER
        };
        let mut keys = defaults.iter();
        while let Some(left) = keys.next() {
            let right = keys.next().map(|key| (*key).to_string());
            rows.push([Some((*left).to_string()), right]);
        }
        rows
    }

    fn push_header_field(&self, out: &mut Vec<String>, key: &str) {
        self.push_header_field_for(out, key, false);
    }

    fn push_header_field_for(&self, out: &mut Vec<String>, key: &str, clinical: bool) {
        if clinical {
            match key {
                "bank" | "tax" | "payment_terms" | "vat_notice" => return,
                // Moroccan tax ids (ICE, IF, TP, RC, CNSS) are for invoices; INPE identifies the dentist.
                "ma_ids" => {
                    if self.is_morocco() {
                        if let Some(v) = opt(&self.ma_inpe) {
                            out.push(format!("INPE {v}"));
                        }
                    }
                    return;
                }
                // SIRET is for invoices; RPPS identifies the prescriber.
                "fr_ids" => {
                    if self.jurisdiction() == Some("fr") {
                        if let Some(v) = opt(&self.fr_rpps) {
                            out.push(format!("RPPS {v}"));
                        }
                    }
                    return;
                }
                _ => {}
            }
        }
        // A saved header table may still list German numbers after the country changed.
        if matches!(key, "zanr" | "bsnr" | "kv" | "kzv" | "tax") && !self.german_ids() {
            return;
        }
        if key == "ma_ids" && !self.is_morocco() {
            return;
        }
        if key == "fr_ids" && self.jurisdiction() != Some("fr") {
            return;
        }
        match key {
            "fr_ids" => {
                if let Some(v) = opt(&self.fr_rpps) {
                    out.push(format!("RPPS {v}"));
                }
                if let Some(v) = opt(&self.fr_siret) {
                    out.push(format!("SIRET {v}"));
                }
            }
            "ma_ids" => {
                let ids = self.morocco_ids();
                for (label, v) in [
                    ("ICE", &ids.ice),
                    ("IF", &ids.if_number),
                    ("TP", &ids.tp),
                    ("RC", &ids.rc),
                    ("CNSS", &ids.cnss),
                    ("INPE", &ids.inpe),
                ] {
                    if let Some(v) = v.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
                        out.push(format!("{label} {v}"));
                    }
                }
            }
            "name" => {
                let name = self.name.trim();
                if !name.is_empty() {
                    out.push(name.to_string());
                }
            }
            "address" => out.extend(self.address_lines()),
            "phone" => {
                if let Some(t) = opt(&self.phone) {
                    out.push(format!("{} {t}", header_label("phone")));
                }
            }
            "fax" => {
                if let Some(t) = opt(&self.fax) {
                    out.push(format!("{} {t}", header_label("fax")));
                }
            }
            "email" => {
                if let Some(t) = opt(&self.email) {
                    out.push(t.to_string());
                }
            }
            "web" => {
                if let Some(w) = opt(&self.web) {
                    out.push(
                        w.trim_start_matches("https://")
                            .trim_start_matches("http://")
                            .to_string(),
                    );
                }
            }
            "kv" => {
                if let Some(t) = opt(&self.kv_number) {
                    out.push(format!("KV {t}"));
                }
            }
            "tax" => {
                if let Some(t) = opt(&self.tax_number) {
                    out.push(format!("Steuer-Nr. {t}"));
                }
            }
            "hours" => {
                if let Some(t) = opt(&self.opening_hours) {
                    out.push(t.to_string());
                }
            }
            "clinician" => {
                if let Some(t) = opt(&self.clinician_name) {
                    out.push(t.to_string());
                }
                if let Some(t) = opt(&self.professional_title) {
                    out.push(t.to_string());
                }
            }
            "zanr" => {
                if let Some(t) = opt(&self.zanr) {
                    out.push(format!("ZANR {t}"));
                }
            }
            "bsnr" => {
                if let Some(t) = opt(&self.bsnr) {
                    out.push(format!("BSNR {t}"));
                }
            }
            "bank" => out.extend(self.bank_lines()),
            "chamber" => {
                if let Some(t) = opt(&self.chamber) {
                    out.push(t.to_string());
                }
            }
            "kzv" => {
                if let Some(t) = opt(&self.kzv) {
                    out.push(t.to_string());
                }
            }
            "payment_terms" => out.push(self.payment_terms_text()),
            "vat_notice" => out.push(self.vat_notice()),
            "emergency_phone" => {
                if let Some(t) = opt(&self.emergency_phone) {
                    out.push(format!("{} {t}", header_label("emergency")));
                }
            }
            _ => {}
        }
    }

    /// Lines under the practice name. Reports print the name separately, so
    /// cells stay unjoined here.
    pub fn document_address_lines(&self) -> Vec<String> {
        let mut out = Vec::new();
        for row in self.header_table() {
            for cell in row {
                if cell.as_deref() == Some("name") {
                    continue;
                }
                if let Some(key) = cell.as_deref() {
                    self.push_header_field(&mut out, key);
                }
            }
        }
        out
    }

    pub fn bank_lines(&self) -> Vec<String> {
        let mut v = Vec::new();
        if let Some(h) = opt(&self.account_holder) {
            v.push(format!("{} {h}", header_label("holder")));
        }
        if let Some(b) = opt(&self.bank_name) {
            v.push(b.to_string());
        }
        if let Some(i) = opt(&self.bank_iban) {
            v.push(format!("IBAN {i}"));
        }
        if let Some(b) = opt(&self.bank_bic) {
            v.push(format!("BIC {b}"));
        }
        v
    }

    /// Footer of a prescription or certificate: practice, address and chamber only.
    pub fn clinical_footer_lines(&self, locale: &str) -> Vec<String> {
        footer_lines_for_practice(
            &PracticeFooter {
                practice_name: format!(
                    "{} · {}",
                    self.name.trim(),
                    self.address_lines().join(", ")
                ),
                tax_number: None,
                vat_id: None,
                iban: None,
                bic: None,
                bank_name: None,
                chamber: opt(&self.chamber).map(String::from),
            },
            locale,
        )
    }

    pub fn footer_lines(&self, locale: &str) -> Vec<String> {
        footer_lines_for_practice(
            &PracticeFooter {
                practice_name: format!(
                    "{} · {}",
                    self.name.trim(),
                    self.address_lines().join(", ")
                ),
                tax_number: opt(&self.tax_number).map(String::from),
                vat_id: opt(&self.vat_id).map(String::from),
                iban: opt(&self.bank_iban).map(String::from),
                bic: opt(&self.bank_bic).map(String::from),
                bank_name: opt(&self.bank_name).map(String::from),
                chamber: opt(&self.chamber).map(String::from),
            },
            locale,
        )
    }

    /// Signature block lines: name, title, ZANR/BSNR.
    pub fn signature_lines(&self) -> Vec<String> {
        let Some(name) = opt(&self.clinician_name) else {
            return Vec::new();
        };
        let mut v = vec![name.to_string()];
        if let Some(t) = opt(&self.professional_title) {
            v.push(t.to_string());
        }
        let ids: Vec<String> = if self.german_ids() {
            vec![
                opt(&self.zanr).map(|z| format!("ZANR {z}")),
                opt(&self.bsnr).map(|b| format!("BSNR {b}")),
            ]
        } else if self.is_morocco() {
            vec![opt(&self.ma_inpe).map(|i| format!("INPE {i}"))]
        } else if self.jurisdiction() == Some("fr") {
            vec![opt(&self.fr_rpps).map(|r| format!("RPPS {r}"))]
        } else {
            Vec::new()
        }
        .into_iter()
        .flatten()
        .collect();
        if !ids.is_empty() {
            v.push(ids.join(" · "));
        }
        v
    }

    pub fn payment_terms_text(&self) -> String {
        self.payment_terms_text_for("de")
    }

    /// Default payment-terms line in the document language.
    pub fn payment_terms_text_for(&self, locale: &str) -> String {
        let days = self.payment_terms_days.unwrap_or(14).max(1).to_string();
        crate::infrastructure::pdf::i18n::trf(locale, "invoice.payment_terms", &[("days", &days)])
    }

    /// Jurisdiction for legal wording: the chosen country, else Morocco for MAD practices,
    /// else unknown (the document language decides).
    pub fn jurisdiction(&self) -> Option<&'static str> {
        match opt(&self.country).map(|c| c.to_ascii_uppercase()) {
            Some(c) if c == "MA" => Some("ma"),
            Some(c) if c == "DE" => Some("de"),
            Some(c) if c == "FR" => Some("fr"),
            Some(c) if c == "EU" => Some("eu"),
            _ if self.is_morocco() => Some("ma"),
            _ => None,
        }
    }

    /// ZANR / BSNR / KZV / Steuer-Nr. are printed (Germany, or no country on a euro practice).
    pub fn german_ids(&self) -> bool {
        uses_german_ids(opt(&self.country), opt(&self.currency))
    }

    /// Practices billing in dirhams get the Moroccan invoice (CGI art. 145) instead of the GOZ one.
    pub fn is_morocco(&self) -> bool {
        let country_ma = opt(&self.country).is_some_and(|c| c.eq_ignore_ascii_case("MA"));
        country_ma
            || self
                .currency
                .as_deref()
                .map(str::trim)
                .is_some_and(|c| c.eq_ignore_ascii_case("MAD"))
    }

    pub fn morocco_ids(&self) -> crate::infrastructure::pdf::MoroccoIds {
        crate::infrastructure::pdf::MoroccoIds {
            ice: opt(&self.ma_ice).map(String::from),
            if_number: opt(&self.ma_if).map(String::from),
            tp: opt(&self.ma_tp).map(String::from),
            rc: opt(&self.ma_rc).map(String::from),
            cnss: opt(&self.ma_cnss).map(String::from),
            inpe: opt(&self.ma_inpe).map(String::from),
        }
    }

    pub fn vat_notice(&self) -> String {
        self.vat_notice_for("de")
    }

    /// VAT notice in the document language. The default notice was stored
    /// in whatever UI language Settings was first opened in and then printed
    /// on every document; it now follows the document. A notice the practice
    /// typed itself is kept as written.
    pub fn vat_notice_for(&self, locale: &str) -> String {
        localized_vat_notice(opt(&self.vat_exemption_notice).unwrap_or(""), locale)
    }
}

/// Default VAT notice → document language; custom text unchanged.
pub fn localized_vat_notice(stored: &str, locale: &str) -> String {
    if crate::infrastructure::pdf::i18n::is_default_vat_notice(stored) {
        crate::infrastructure::pdf::i18n::tr(locale, "invoice.vat_exempt_default").to_string()
    } else {
        stored.trim().to_string()
    }
}

/// Document language chosen in Settings (default German).
pub async fn document_locale(pool: &SqlitePool) -> &'static str {
    let raw = app_kv_repo::get(pool, DOCUMENT_LOCALE_KV_KEY)
        .await
        .ok()
        .flatten()
        .unwrap_or_default();
    let locale = crate::infrastructure::pdf::pdf_locale(raw.trim().trim_matches('"'));
    crate::infrastructure::pdf::i18n::set_default_document_locale(locale);
    locale
}

/// The language a caller asked for (any form: `"ar"`, `"ar-MA"`, `"fr_FR"`),
/// else the Settings language. One rule for every document kind — invoices
/// used to ignore the request and always print the Settings language, while
/// certificates followed the request, so the same click produced documents
/// in two languages.
pub async fn resolve_document_locale(pool: &SqlitePool, requested: Option<&str>) -> &'static str {
    match requested.and_then(crate::infrastructure::pdf::known_pdf_locale) {
        Some(locale) => {
            // Header labels and dates read the current document language.
            crate::infrastructure::pdf::i18n::set_default_document_locale(locale);
            locale
        }
        None => document_locale(pool).await,
    }
}

/// Saved header table. `rows` keeps empty cells. A legacy `fields` list is
/// packed left to right, two per row, at most eight rows.
fn parse_header_rows(raw: &str) -> Vec<[Option<String>; 2]> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
        return Vec::new();
    };
    if let Some(rows) = value.get("rows").and_then(|item| item.as_array()) {
        return parse_row_grid(rows);
    }
    let fields = parse_header_layout_fields(&value);
    let mut rows = Vec::new();
    let mut index = 0;
    while index < fields.len() && rows.len() < 8 {
        let left = Some(fields[index].clone());
        let right = fields.get(index + 1).cloned();
        rows.push([left, right]);
        index += 2;
    }
    rows
}

fn parse_row_grid(rows: &[serde_json::Value]) -> Vec<[Option<String>; 2]> {
    let mut seen = Vec::new();
    let mut out = Vec::new();
    for row in rows.iter().take(8) {
        let mut pair = [None, None];
        if let Some(cells) = row.as_array() {
            for col in 0..2 {
                let Some(key) = cells.get(col).and_then(|item| item.as_str()) else {
                    continue;
                };
                if HEADER_FIELD_KEYS.contains(&key)
                    && !seen.iter().any(|existing: &String| existing == key)
                {
                    pair[col] = Some(key.to_string());
                    seen.push(key.to_string());
                }
            }
        }
        out.push(pair);
    }
    while out
        .last()
        .is_some_and(|row| row[0].is_none() && row[1].is_none())
    {
        out.pop();
    }
    out
}

fn parse_header_layout_fields(value: &serde_json::Value) -> Vec<String> {
    let Some(fields) = value
        .get("fields")
        .and_then(|item| item.as_array())
        .or_else(|| value.as_array())
    else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in fields {
        let Some(key) = item.as_str() else {
            continue;
        };
        if HEADER_FIELD_KEYS.contains(&key) && !out.iter().any(|existing: &String| existing == key)
        {
            out.push(key.to_string());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn letterhead_matches_official_form() {
        let profile = PracticeProfile {
            name: "Praxis".into(),
            addr: "Street 1\n12345 City".into(),
            phone: Some("030 1".into()),
            fax: Some("030 2".into()),
            email: Some("a@b.de".into()),
            clinician_name: Some("Dr. Anna Berger".into()),
            professional_title: Some("Zahnärztin".into()),
            bsnr: Some("123456789".into()),
            zanr: Some("987654321".into()),
            ..PracticeProfile::default()
        };
        assert_eq!(
            profile.letterhead_lines(),
            vec![
                "Praxis".to_string(),
                "Street 1".to_string(),
                "12345 City".to_string(),
                "Tel. 030 1".to_string(),
                "Fax 030 2".to_string(),
                "a@b.de".to_string(),
                "BSNR 123456789".to_string(),
                "ZANR 987654321".to_string(),
            ]
        );
        assert!(profile
            .document_address_lines()
            .iter()
            .any(|line| line == "Fax 030 2"));
        assert!(!profile
            .document_address_lines()
            .iter()
            .any(|line| line == "Praxis"));
        let footer = profile.footer_lines("de");
        assert!(footer
            .iter()
            .any(|line| line.starts_with("Praxis · Street 1, 12345 City")));
        assert_eq!(
            profile.signature_lines(),
            vec![
                "Dr. Anna Berger".to_string(),
                "Zahnärztin".to_string(),
                "ZANR 987654321 · BSNR 123456789".to_string(),
            ]
        );
    }

    #[test]
    fn saved_header_order_replaces_the_official_letterhead() {
        let profile = PracticeProfile {
            name: "Praxis".into(),
            addr: "Street 1".into(),
            phone: Some("030 1".into()),
            clinician_name: Some("Dr. Anna Berger".into()),
            professional_title: Some("Zahnärztin".into()),
            tax_number: Some("12/345".into()),
            header_rows: vec![
                [Some("clinician".into()), Some("phone".into())],
                [Some("name".into()), None],
            ],
            ..PracticeProfile::default()
        };
        assert_eq!(
            profile.letterhead_lines(),
            vec![
                "Dr. Anna Berger".to_string(),
                "Zahnärztin".to_string(),
                "Tel. 030 1".to_string(),
                "Praxis".to_string(),
            ]
        );
        assert_eq!(
            profile.document_address_lines(),
            vec![
                "Dr. Anna Berger".to_string(),
                "Zahnärztin".to_string(),
                "Tel. 030 1".to_string(),
            ]
        );
        assert_eq!(
            parse_header_rows(r#"{"fields":["zanr","name","nope","name"]}"#),
            vec![[Some("zanr".to_string()), Some("name".to_string())]]
        );
        assert_eq!(
            parse_header_rows(r#"{"rows":[["phone",null],["nope","fax"],["fax"]]}"#),
            vec![
                [Some("phone".to_string()), None],
                [None, Some("fax".to_string())],
            ]
        );
        assert!(parse_header_rows("not json").is_empty());
    }
}

pub async fn logo_hidden_on_documents(pool: &SqlitePool) -> bool {
    match app_kv_repo::get(pool, "practice.logo.v1").await {
        Ok(Some(raw)) => !crate::infrastructure::pdf::logo_visible_on_documents(&raw),
        _ => false,
    }
}

pub async fn practice_logo(pool: &SqlitePool) -> Option<PdfLogo> {
    let Ok(Some(raw)) = app_kv_repo::get(pool, "practice.logo.v1").await else {
        return None;
    };
    if !crate::infrastructure::pdf::logo_visible_on_documents(&raw) {
        return None;
    }
    PdfLogo::from_kv_json(&raw)
}
