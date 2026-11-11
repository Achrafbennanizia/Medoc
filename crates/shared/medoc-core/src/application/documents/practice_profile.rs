//! Practice master data for official documents — read **only** from the
//! database (`app_kv` key `invoice.practice.v1`), never from the frontend.
//!
//! Legal identity fields (address, tax number, BSNR/ZANR, bank) are never
//! masked on official documents; the "privacy" toggles in Settings only apply
//! to screen previews.

use serde::Deserialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use crate::infrastructure::pdf::{footer_lines_for_practice, PdfLogo, PracticeFooter};

pub const PRACTICE_KV_KEY: &str = "invoice.practice.v1";
pub const DOCUMENT_LOCALE_KV_KEY: &str = "documents.locale.v1";

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
}

fn opt(s: &Option<String>) -> Option<&str> {
    s.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

impl PracticeProfile {
    pub async fn load(pool: &SqlitePool) -> Result<Self, AppError> {
        let raw = app_kv_repo::get(pool, PRACTICE_KV_KEY)
            .await?
            .unwrap_or_default();
        let p: PracticeProfile = serde_json::from_str(&raw).unwrap_or_default();
        crate::infrastructure::pdf::set_document_currency(p.currency.as_deref().unwrap_or("EUR"));
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

    /// Letterhead lines: name, address, contact (no masking).
    pub fn letterhead_lines(&self) -> Vec<String> {
        let mut out = vec![self.name.trim().to_string()];
        out.extend(self.address_lines());
        if let Some(t) = opt(&self.phone) {
            out.push(format!("Tel. {t}"));
        }
        if let Some(t) = opt(&self.fax) {
            out.push(format!("Fax {t}"));
        }
        if let Some(t) = opt(&self.email) {
            out.push(t.to_string());
        }
        if let Some(w) = opt(&self.web) {
            out.push(
                w.trim_start_matches("https://")
                    .trim_start_matches("http://")
                    .to_string(),
            );
        }
        if let Some(b) = opt(&self.bsnr) {
            out.push(format!("BSNR {b}"));
        }
        if let Some(z) = opt(&self.zanr) {
            out.push(format!("ZANR {z}"));
        }
        out
    }

    /// Lines under the practice name: address, phone, fax, and the other
    /// letterhead fields. Reports print the name separately.
    pub fn document_address_lines(&self) -> Vec<String> {
        self.letterhead_lines().into_iter().skip(1).collect()
    }

    pub fn bank_lines(&self) -> Vec<String> {
        let mut v = Vec::new();
        if let Some(h) = opt(&self.account_holder) {
            v.push(format!("Kontoinhaber: {h}"));
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
        let ids: Vec<String> = [
            opt(&self.zanr).map(|z| format!("ZANR {z}")),
            opt(&self.bsnr).map(|b| format!("BSNR {b}")),
        ]
        .into_iter()
        .flatten()
        .collect();
        if !ids.is_empty() {
            v.push(ids.join(" · "));
        }
        v
    }

    pub fn payment_terms_text(&self) -> String {
        let days = self.payment_terms_days.unwrap_or(14).max(1);
        format!("Zahlbar innerhalb von {days} Tagen nach Rechnungsdatum ohne Abzug.")
    }

    pub fn vat_notice(&self) -> String {
        opt(&self.vat_exemption_notice)
            .map(String::from)
            .unwrap_or_else(|| "Umsatzsteuerfrei gem. § 4 Nr. 14 Buchst. a UStG.".into())
    }
}

/// Document language chosen in Settings (default German).
pub async fn document_locale(pool: &SqlitePool) -> &'static str {
    let raw = app_kv_repo::get(pool, DOCUMENT_LOCALE_KV_KEY)
        .await
        .ok()
        .flatten()
        .unwrap_or_default();
    crate::infrastructure::pdf::pdf_locale(raw.trim().trim_matches('"'))
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
                "Praxis",
                "Street 1",
                "12345 City",
                "Tel. 030 1",
                "Fax 030 2",
                "a@b.de",
                "BSNR 123456789",
                "ZANR 987654321",
            ]
        );
        assert!(profile.letterhead_lines().iter().all(|line| !line.contains('·')));
        assert!(profile.document_address_lines().iter().any(|line| line == "Fax 030 2"));
        assert!(!profile.document_address_lines().iter().any(|line| line == "Praxis"));
        let footer = profile.footer_lines("de");
        assert!(footer.iter().any(|line| line.starts_with("Praxis · Street 1, 12345 City")));
        assert_eq!(
            profile.signature_lines(),
            vec![
                "Dr. Anna Berger".to_string(),
                "Zahnärztin".to_string(),
                "ZANR 987654321 · BSNR 123456789".to_string(),
            ]
        );
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
