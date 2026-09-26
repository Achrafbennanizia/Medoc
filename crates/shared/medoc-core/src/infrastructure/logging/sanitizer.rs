// PII / secret sanitiser (NFA-LOG-08)
//
// Used to scrub strings before they enter a log record. Frees the rest of
// the codebase from having to remember which fields are sensitive.

use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::OnceLock;

use crate::error::AppError;

fn token_re() -> Option<&'static Regex> {
    static R: OnceLock<Option<Regex>> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)(password|password|token|secret|api[_-]?key|license|license)\s*[:=]\s*\S+")
            .ok()
    })
    .as_ref()
}

fn jwt_re() -> Option<&'static Regex> {
    static R: OnceLock<Option<Regex>> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+").ok())
        .as_ref()
}

/// Mask any obvious secret patterns inside a free-form string. If the static
/// regexes fail to compile (impossible at runtime for hard-coded literals,
/// but never panic) the input is returned unchanged.
pub fn sanitize(input: &str) -> String {
    let masked = match token_re() {
        Some(re) => re.replace_all(input, "$1=***").into_owned(),
        None => input.to_string(),
    };
    match jwt_re() {
        Some(re) => re.replace_all(&masked, "eyJ***").into_owned(),
        None => masked,
    }
}

const WORKFLOW_TEXT_MAX_CHARS: usize = 240;
const WORKFLOW_ARRAY_MAX_ITEMS: usize = 40;

fn truncate_chars(input: &str, max_chars: usize) -> String {
    if input.chars().count() <= max_chars {
        return input.to_string();
    }
    let truncated: String = input.chars().take(max_chars).collect();
    format!("{truncated}...")
}

fn workflow_sensitive_key(key: &str) -> bool {
    let lowered = key.to_ascii_lowercase();
    [
        "patient",
        "chart",
        "diagnosis",
        "finding",
        "dob",
        "birth",
        "phone",
        "email",
        "address",
        "insurance",
        "kvnr",
        "name",
    ]
    .iter()
    .any(|needle| lowered.contains(needle))
}

/// Workflow logs are intentionally strict: all free-form text is sanitized and
/// bounded, and sensitive patient-oriented fields are redacted by key name.
pub fn sanitize_workflow_text(input: &str) -> String {
    truncate_chars(&sanitize(input), WORKFLOW_TEXT_MAX_CHARS)
}

/// Recursively sanitize workflow metadata payloads before they are written to
/// `workflow.log`.
pub fn sanitize_workflow_value(value: &Value) -> Value {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => value.clone(),
        Value::String(s) => Value::String(sanitize_workflow_text(s)),
        Value::Array(items) => {
            let mut sanitized = Vec::new();
            for item in items.iter().take(WORKFLOW_ARRAY_MAX_ITEMS) {
                sanitized.push(sanitize_workflow_value(item));
            }
            if items.len() > WORKFLOW_ARRAY_MAX_ITEMS {
                sanitized.push(Value::String(format!(
                    "...{} more items",
                    items.len() - WORKFLOW_ARRAY_MAX_ITEMS
                )));
            }
            Value::Array(sanitized)
        }
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (key, nested) in map {
                if workflow_sensitive_key(key) {
                    out.insert(key.clone(), Value::String("[REDACTED]".into()));
                } else {
                    out.insert(key.clone(), sanitize_workflow_value(nested));
                }
            }
            Value::Object(out)
        }
    }
}

#[derive(Debug, Serialize)]
pub struct LogRedactionReport {
    pub scanned: usize,
    pub redacted_files: Vec<String>,
    pub errors: Vec<String>,
}

fn log_dir_candidates() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(raw) = std::env::var("MEDOC_LOG_DIR") {
        dirs.push(PathBuf::from(raw));
    }
    if let Ok(d) = crate::infrastructure::logging::log_dir() {
        dirs.push(d.to_path_buf());
    }
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join("medoc-data").join("logs"));
    }
    dirs.push(PathBuf::from("./medoc-data/logs"));
    dirs
}

/// Replace a patient id in rolling log files (best-effort; skips unreadable files).
pub fn redact_patient_id_in_logs(patient_id: &str) -> Result<LogRedactionReport, AppError> {
    if patient_id.trim().is_empty() {
        return Err(AppError::Validation("patient_id missing".into()));
    }
    let replacement = format!(
        "[REDACTED-patient-{}]",
        &patient_id[..patient_id.len().min(8)]
    );
    let mut report = LogRedactionReport {
        scanned: 0,
        redacted_files: Vec::new(),
        errors: Vec::new(),
    };
    let mut seen = std::collections::HashSet::new();
    for log_dir in log_dir_candidates() {
        if !log_dir.is_dir() {
            continue;
        }
        let entries = match std::fs::read_dir(&log_dir) {
            Ok(e) => e,
            Err(e) => {
                report.errors.push(format!("{}: {e}", log_dir.display()));
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if !seen.insert(path.clone()) {
                continue;
            }
            report.scanned += 1;
            let Ok(content) = std::fs::read_to_string(&path) else {
                report
                    .errors
                    .push(format!("Read failed: {}", path.display()));
                continue;
            };
            if !content.contains(patient_id) {
                continue;
            }
            let redacted = content.replace(patient_id, &replacement);
            if let Err(e) = std::fs::write(&path, redacted) {
                report.errors.push(format!("{}: {e}", path.display()));
            } else if let Some(name) = path.file_name() {
                report
                    .redacted_files
                    .push(name.to_string_lossy().into_owned());
            }
        }
    }
    Ok(report)
}

/// Mask a token-like value so only the prefix remains.
pub fn mask_token(value: &str) -> String {
    if value.len() <= 4 {
        "***".to_string()
    } else {
        format!("{}***", &value[..4])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn masks_passwords() {
        let s = sanitize("user=alice password=hunter2 ok");
        assert!(s.contains("password=***"));
        assert!(!s.contains("hunter2"));
    }

    #[test]
    fn masks_jwt() {
        let s = sanitize("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
        assert!(s.contains("eyJ***"));
    }

    #[test]
    fn workflow_value_redacts_sensitive_fields() {
        let input = json!({
            "patientId": "pat-123",
            "route": "/patients/42",
            "nested": {
                "dateOfBirth": "2000-01-01",
                "action": "open_chart",
            }
        });
        let sanitized = sanitize_workflow_value(&input);
        assert_eq!(sanitized["patientId"], "[REDACTED]");
        assert_eq!(sanitized["nested"]["dateOfBirth"], "[REDACTED]");
        assert_eq!(sanitized["route"], "/patients/42");
        assert_eq!(sanitized["nested"]["action"], "open_chart");
    }

    #[test]
    fn workflow_text_masks_token_patterns() {
        let text = sanitize_workflow_text("password=secret-value");
        assert_eq!(text, "password=***");
    }
}
