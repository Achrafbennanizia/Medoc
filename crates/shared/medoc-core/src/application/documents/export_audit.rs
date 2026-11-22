//! Audit trail for every file that leaves the encrypted database
//! (§ 630f BGB access traceability, Art. 30/32 GDPR).
//!
//! Called by the save commands themselves, so a UI path cannot skip it.

use serde::Deserialize;
use sqlx::SqlitePool;

use crate::application::auth_service::Session;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::issued_document::sha256_hex;

/// Context the UI sends with a save request.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportContext {
    /// e.g. `chart`, `receipt`, `patients_csv`, `report:statistics`, `audit_csv`
    pub kind: String,
    /// `pdf` | `csv` | `json` | `xml` | `zip`
    pub format: String,
    /// Main entity (patient id, payment id …) when there is one.
    #[serde(default)]
    pub entity_id: Option<String>,
    /// Registry number when the file is an issued document.
    #[serde(default)]
    pub document_number: Option<String>,
}

pub async fn log_export(
    pool: &SqlitePool,
    session: &Session,
    ctx: &ExportContext,
    destination: &str,
    bytes: &[u8],
) -> Result<(), AppError> {
    // Every MeDoc PDF carries a document id; logging it maps a file found
    // later (preview, export, issued copy) back to this export.
    let uid = if ctx.format == "pdf" {
        crate::infrastructure::pdf::document_uid_of(bytes)
    } else {
        None
    };
    let details = format!(
        "kind={} format={} bytes={} sha256={} nr={} uid={} dest={}",
        ctx.kind,
        ctx.format,
        bytes.len(),
        sha256_hex(bytes),
        ctx.document_number.as_deref().unwrap_or("-"),
        uid.as_deref().unwrap_or("-"),
        // Only the file name — full paths can contain the user's name.
        std::path::Path::new(destination)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("-"),
    );
    audit_repo::create(
        pool,
        &session.user_id,
        "EXPORT_FILE",
        &ctx.kind,
        ctx.entity_id.as_deref(),
        Some(&details),
    )
    .await
}

/// Neutralise spreadsheet formula injection (OWASP "CSV injection"):
/// cells starting with `= + - @` (or tab / CR) are prefixed with `'`.
pub fn csv_safe_cell(raw: &str) -> String {
    match raw.chars().next() {
        Some('=' | '+' | '-' | '@' | '\t' | '\r') => format!("'{raw}"),
        _ => raw.to_string(),
    }
}

/// RFC 4180 quoting + formula neutralisation for one cell.
pub fn csv_cell(raw: &str, delimiter: char) -> String {
    let v = csv_safe_cell(raw);
    if v.contains(delimiter) || v.contains('"') || v.contains('\n') || v.contains('\r') {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formula_cells_are_neutralised() {
        assert_eq!(csv_safe_cell("=HYPERLINK(\"x\")"), "'=HYPERLINK(\"x\")");
        assert_eq!(csv_safe_cell("-12,50"), "'-12,50");
        assert_eq!(csv_safe_cell("Müller"), "Müller");
        assert_eq!(csv_cell("a;b", ';'), "\"a;b\"");
        assert_eq!(csv_cell("line\rbreak", ','), "\"line\rbreak\"");
    }
}
