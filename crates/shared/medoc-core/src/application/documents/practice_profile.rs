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

mod header_fields;
pub use header_fields::*;
mod document_settings;
pub use document_settings::*;

pub const PRACTICE_KV_KEY: &str = "invoice.practice.v1";
pub const DOCUMENT_LOCALE_KV_KEY: &str = "documents.locale.v1";
/// Ordered header fields from Settings → System. Missing means the official letterhead.
pub const DOCUMENT_HEADER_LAYOUT_KV_KEY: &str = "documents.header_layout.v1";

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

    /// Minimal letterhead for documents with no legal content requirements (receipts, reminders,
    /// reports, record exports, leaflets): who the practice is and how to reach it. No
    /// practitioner, no professional or tax numbers, no bank details, whatever the saved header
    /// table says.
    pub fn minimal_letterhead_lines(&self) -> Vec<String> {
        let mut out = Vec::new();
        let name = self.name.trim();
        if !name.is_empty() {
            out.push(name.to_string());
        }
        out.extend(self.minimal_address_lines());
        out
    }

    /// [`Self::minimal_letterhead_lines`] without the practice name (reports print it apart).
    pub fn minimal_address_lines(&self) -> Vec<String> {
        let mut out = self.address_lines();
        if let Some(t) = opt(&self.phone) {
            out.push(format!("{} {t}", header_label("phone")));
        }
        if let Some(t) = opt(&self.email) {
            out.push(t.to_string());
        }
        out
    }

    /// Minimal footer: practice name and address.
    pub fn minimal_footer_lines(&self, locale: &str) -> Vec<String> {
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
                chamber: None,
            },
            locale,
        )
    }

    /// Signature block without professional numbers: name and title.
    pub fn minimal_signature_lines(&self) -> Vec<String> {
        let Some(name) = opt(&self.clinician_name) else {
            return Vec::new();
        };
        let mut v = vec![name.to_string()];
        if let Some(t) = opt(&self.professional_title) {
            v.push(t.to_string());
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

#[cfg(test)]
#[path = "practice_profile_tests.rs"]
mod tests;
