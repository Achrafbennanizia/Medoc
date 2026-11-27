//! Document language, header layout and logo settings read from app_kv (split from `practice_profile.rs`).

use super::*;

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
pub(super) fn parse_header_rows(raw: &str) -> Vec<[Option<String>; 2]> {
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

pub(super) fn parse_row_grid(rows: &[serde_json::Value]) -> Vec<[Option<String>; 2]> {
    let mut seen = Vec::new();
    let mut out = Vec::new();
    for row in rows.iter().take(8) {
        let mut pair = [None, None];
        if let Some(cells) = row.as_array() {
            for (col, slot) in pair.iter_mut().enumerate() {
                let Some(key) = cells.get(col).and_then(|item| item.as_str()) else {
                    continue;
                };
                if HEADER_FIELD_KEYS.contains(&key)
                    && !seen.iter().any(|existing: &String| existing == key)
                {
                    *slot = Some(key.to_string());
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

pub(super) fn parse_header_layout_fields(value: &serde_json::Value) -> Vec<String> {
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
