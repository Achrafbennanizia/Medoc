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

mod document_lines;

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
}

mod document_settings;
#[allow(unused_imports)]
pub use document_settings::*;

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
    fn second_doctor_signs_with_own_id_and_the_practice_bsnr() {
        let de = PracticeProfile {
            name: "Praxis".into(),
            addr: "Street 1".into(),
            country: Some("DE".into()),
            clinician_name: Some("Dr. Anna Berger".into()),
            zanr: Some("987654321".into()),
            bsnr: Some("123456789".into()),
            ..PracticeProfile::default()
        };
        assert_eq!(
            de.signature_lines_for("Dr. Karim Alaoui", Some("Zahnarzt"), Some("111222333")),
            vec![
                "Dr. Karim Alaoui".to_string(),
                "Zahnarzt".to_string(),
                "ZANR 111222333 · BSNR 123456789".to_string(),
            ]
        );
        // Never the practice clinician's ZANR on another doctor's block.
        assert_eq!(
            de.signature_lines_for("Dr. Karim Alaoui", None, None),
            vec!["Dr. Karim Alaoui".to_string(), "BSNR 123456789".to_string()]
        );
        let ma = PracticeProfile {
            country: Some("MA".into()),
            ma_inpe: Some("000".into()),
            ..de
        };
        assert_eq!(
            ma.signature_lines_for("Dr. Salma B.", Some("Chirurgien-dentiste"), Some("555")),
            vec![
                "Dr. Salma B.".to_string(),
                "Chirurgien-dentiste".to_string(),
                "INPE 555".to_string(),
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
