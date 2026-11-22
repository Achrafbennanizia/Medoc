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
const DEFAULT_HEADER_FIELDS: &[&str] = &[
    "name", "address", "phone", "fax", "email", "web", "bsnr", "zanr",
];

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
        let mut out = Vec::new();
        for row in self.header_table() {
            for cell in row {
                if let Some(key) = cell.as_deref() {
                    self.push_header_field(&mut out, key);
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
        let mut keys = DEFAULT_HEADER_FIELDS.iter();
        while let Some(left) = keys.next() {
            let right = keys.next().map(|key| (*key).to_string());
            rows.push([Some((*left).to_string()), right]);
        }
        rows
    }

    fn push_header_field(&self, out: &mut Vec<String>, key: &str) {
        match key {
            "name" => {
                let name = self.name.trim();
                if !name.is_empty() {
                    out.push(name.to_string());
                }
            }
            "address" => out.extend(self.address_lines()),
            "phone" => {
                if let Some(t) = opt(&self.phone) {
                    out.push(format!("Tel. {t}"));
                }
            }
            "fax" => {
                if let Some(t) = opt(&self.fax) {
                    out.push(format!("Fax {t}"));
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
                    out.push(format!("Notdienst {t}"));
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
        self.payment_terms_text_for("de")
    }

    /// Default payment-terms line in the document language.
    pub fn payment_terms_text_for(&self, locale: &str) -> String {
        let days = self.payment_terms_days.unwrap_or(14).max(1).to_string();
        crate::infrastructure::pdf::i18n::trf(locale, "invoice.payment_terms", &[("days", &days)])
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
        Some(locale) => locale,
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
