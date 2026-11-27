//! Support bundle (T7.2, docs/architecture/editions-plan.md §11.3).
//!
//! What the admin sends to support: their description, facts about this installation, a health summary and
//! (optionally) the redacted logs, zipped and then sealed to the vendor support key
//! (`infrastructure::support_seal`). The file goes to Downloads; the practice's own mail app sends it, so
//! MeDoc stores no mail password. No patient data is added here: logs are already redacted when written.

use std::io::Write;

use serde::Serialize;
use zip::write::SimpleFileOptions;

use crate::error::AppError;

#[derive(Debug, Clone, Default)]
pub struct BundleInput {
    pub description: String,
    pub error_ref: Option<String>,
    /// Version, edition, OS, device short id… (allow-listed by the caller).
    pub meta: serde_json::Value,
    /// Health summary (§11.5).
    pub health: serde_json::Value,
    /// Zip of the redacted logs, when the admin included them.
    pub logs_zip: Option<Vec<u8>>,
    /// Error counts of the last 30 days (`infrastructure::error_reports`).
    pub errors: Vec<crate::infrastructure::error_reports::ErrorEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleResult {
    pub path: String,
    pub file_name: String,
    pub bytes: u64,
    /// Opens the mail app with subject and body filled in.
    pub mailto: String,
    /// The build has no release support key: the file is readable with the published dev key.
    pub dev_key: bool,
}

/// Files inside the bundle, for the audit entry.
pub fn contents(input: &BundleInput) -> Vec<&'static str> {
    let mut list = vec!["description.txt", "meta.json", "health.json", "errors.json"];
    if input.logs_zip.is_some() {
        list.push("logs.zip");
    }
    list
}

/// The zip that gets sealed.
pub fn build_zip(input: &BundleInput) -> Result<Vec<u8>, AppError> {
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let opts = SimpleFileOptions::default();
    let err = |e: &dyn std::fmt::Display| AppError::Internal(format!("support bundle: {e}"));
    let mut put = |name: &str, bytes: &[u8]| -> Result<(), AppError> {
        zip.start_file(name, opts).map_err(|e| err(&e))?;
        zip.write_all(bytes).map_err(|e| err(&e))
    };
    let mut text = input.description.trim().to_string();
    if let Some(r) = input.error_ref.as_deref().filter(|r| !r.trim().is_empty()) {
        text = format!("Error ref: {}\n\n{text}", r.trim());
    }
    put("description.txt", text.as_bytes())?;
    put(
        "meta.json",
        &serde_json::to_vec_pretty(&input.meta).unwrap_or_default(),
    )?;
    put(
        "health.json",
        &serde_json::to_vec_pretty(&input.health).unwrap_or_default(),
    )?;
    put(
        "errors.json",
        &serde_json::to_vec_pretty(&input.errors).unwrap_or_default(),
    )?;
    if let Some(logs) = &input.logs_zip {
        put("logs.zip", logs)?;
    }
    Ok(zip.finish().map_err(|e| err(&e))?.into_inner())
}

fn safe_ref(error_ref: Option<&str>) -> Option<String> {
    let r: String = error_ref?
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(24)
        .collect();
    (!r.is_empty()).then_some(r)
}

/// `medoc-support-20261124-1932[-MD-APP-003].mdsb`
pub fn file_name(now: chrono::DateTime<chrono::Local>, error_ref: Option<&str>) -> String {
    let stamp = now.format("%Y%m%d-%H%M");
    match safe_ref(error_ref) {
        Some(r) => format!("medoc-support-{stamp}-{r}.mdsb"),
        None => format!("medoc-support-{stamp}.mdsb"),
    }
}

/// `mailto:` for the practice's mail app. `to` empty: the user types the address.
pub fn mailto(
    to: Option<&str>,
    edition: &str,
    version: &str,
    error_ref: Option<&str>,
    file_name: &str,
    body_intro: &str,
) -> String {
    let subject = match safe_ref(error_ref) {
        Some(r) => format!("[MeDoc {edition} {version}] {r}"),
        None => format!("[MeDoc {edition} {version}] Support"),
    };
    let body = format!("{body_intro}\n\n{file_name}\n");
    format!(
        "mailto:{}?subject={}&body={}",
        to.unwrap_or("").trim(),
        urlencoding::encode(&subject),
        urlencoding::encode(&body)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn the_zip_holds_what_the_admin_chose() {
        let input = BundleInput {
            description: "Printer stops".into(),
            error_ref: Some("MD-APP-003".into()),
            logs_zip: Some(b"PK".to_vec()),
            ..Default::default()
        };
        let zip = build_zip(&input).unwrap();
        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip)).unwrap();
        let mut names: Vec<_> = archive.file_names().map(str::to_string).collect();
        names.sort();
        assert_eq!(
            names,
            [
                "description.txt",
                "errors.json",
                "health.json",
                "logs.zip",
                "meta.json"
            ]
        );
        let mut text = String::new();
        archive
            .by_name("description.txt")
            .unwrap()
            .read_to_string(&mut text)
            .unwrap();
        assert!(text.starts_with("Error ref: MD-APP-003"));
        assert_eq!(contents(&input).len(), 5);
    }

    #[test]
    fn names_and_mail_link_carry_only_safe_characters() {
        let now = chrono::Local::now();
        let name = file_name(now, Some("MD-APP-003/../x"));
        assert!(name.ends_with("-MD-APP-003x.mdsb"), "{name}");
        let link = mailto(
            None,
            "solo",
            "0.1.0",
            Some("MD-APP-003"),
            &name,
            "Attach the file",
        );
        assert!(link.starts_with("mailto:?subject=%5BMeDoc%20solo%200.1.0%5D%20MD-APP-003&body="));
        assert!(!link.contains('\n'));
    }
}
