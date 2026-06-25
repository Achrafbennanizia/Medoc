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
        Regex::new(r"(?i)(password|passwort|token|secret|api[_-]?key|license|lizenz)\s*[:=]\s*\S+")
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

fn redact_json_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    [
        "patient",
        "passwort",
        "password",
        "token",
        "secret",
        "api_key",
        "apikey",
        "license",
        "lizenz",
        "email",
        "name",
        "telefon",
        "phone",
        "address",
        "adresse",
        "iban",
        "birth",
        "geburt",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn sanitize_json_inner(value: &Value, parent_key: Option<&str>) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, v) in map {
                if redact_json_key(k) {
                    out.insert(k.clone(), Value::String("[REDACTED]".into()));
                } else {
                    out.insert(k.clone(), sanitize_json_inner(v, Some(k)));
                }
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| sanitize_json_inner(item, parent_key))
                .collect(),
        ),
        Value::String(s) => {
            if parent_key.is_some_and(redact_json_key) {
                Value::String("[REDACTED]".into())
            } else {
                Value::String(sanitize(s))
            }
        }
        _ => value.clone(),
    }
}

/// Recursively sanitize JSON payloads before they are written to any log sink.
/// - Redacts known sensitive keys (`patient*`, `password`, `token`, …)
/// - Scrubs token/JWT-like values from all string leaves
pub fn sanitize_json_value(value: &Value) -> Value {
    sanitize_json_inner(value, None)
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
        return Err(AppError::Validation("patient_id fehlt".into()));
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
                    .push(format!("Lesen fehlgeschlagen: {}", path.display()));
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
    fn sanitize_json_value_redacts_sensitive_keys() {
        let payload = serde_json::json!({
            "patientId": "pat-123",
            "actorEmail": "doc@example.com",
            "route": "/patienten/123",
            "nested": {
                "token": "eyJabc.def.ghi",
                "note": "password=hunter2"
            }
        });
        let redacted = sanitize_json_value(&payload);
        assert_eq!(redacted["patientId"], "[REDACTED]");
        assert_eq!(redacted["actorEmail"], "[REDACTED]");
        assert_eq!(redacted["nested"]["token"], "[REDACTED]");
        assert_eq!(redacted["nested"]["note"], "password=***");
    }
}
