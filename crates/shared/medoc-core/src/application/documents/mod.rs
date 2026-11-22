//! Official documents: issuing, numbering, registry, reprints, export audit.

/// `YYYY-MM-DD` (or a longer timestamp) → `dd.mm.yyyy`. Unknown text is kept.
pub(crate) fn format_dmy(ymd: &str) -> String {
    chrono::NaiveDate::parse_from_str(ymd.get(..10).unwrap_or(ymd), "%Y-%m-%d")
        .map(|d| d.format("%d.%m.%Y").to_string())
        .unwrap_or_else(|_| ymd.to_string())
}

pub mod cash_book;
pub mod export_audit;
pub mod finance_schema;
pub mod issue;
pub mod period_report;
pub mod practice_profile;
pub mod receivables;
