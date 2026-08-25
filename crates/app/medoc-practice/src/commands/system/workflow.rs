use std::collections::BTreeMap;

use serde::Deserialize;

use crate::error::AppError;
use crate::infrastructure::logging::sanitizer;
use crate::log_workflow;

const MAX_FIELD_CHARS: usize = 256;
const MAX_META_VALUE_CHARS: usize = 256;
const MAX_META_ENTRIES: usize = 16;
const EMPTY: &str = "-";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStep {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStep {
    fn as_str(&self) -> &'static str {
        match self {
            WorkflowStep::RouteEnter => "route_enter",
            WorkflowStep::PrimaryAction => "primary_action",
            WorkflowStep::Success => "success",
            WorkflowStep::Cancel => "cancel",
            WorkflowStep::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEventInput {
    pub step: WorkflowStep,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
}

fn clamp_chars(input: &str, max_chars: usize) -> String {
    input.chars().take(max_chars).collect()
}

fn strip_control_chars(input: &str) -> String {
    input
        .chars()
        .filter(|ch| !ch.is_control() || *ch == '\n' || *ch == '\t')
        .collect()
}

fn sanitize_text(input: &str, max_chars: usize) -> String {
    let masked = sanitizer::sanitize(input.trim());
    let without_control = strip_control_chars(&masked);
    clamp_chars(without_control.trim(), max_chars)
}

fn sanitize_opt_field(input: Option<String>) -> Option<String> {
    input.and_then(|raw| {
        let cleaned = sanitize_text(&raw, MAX_FIELD_CHARS);
        if cleaned.is_empty() {
            None
        } else {
            Some(cleaned)
        }
    })
}

fn sanitize_metadata_key(raw: &str) -> Option<String> {
    let key: String = raw
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
        .take(48)
        .collect();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

fn sanitize_metadata(input: BTreeMap<String, String>) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for (raw_key, raw_value) in input {
        if out.len() >= MAX_META_ENTRIES {
            break;
        }
        let Some(key) = sanitize_metadata_key(&raw_key) else {
            continue;
        };
        let value = sanitize_text(&raw_value, MAX_META_VALUE_CHARS);
        if value.is_empty() {
            continue;
        }
        out.insert(key, value);
    }
    out
}

#[tauri::command]
#[tracing::instrument(level = "trace", skip(input))]
pub fn log_workflow_event(input: WorkflowEventInput) -> Result<(), AppError> {
    let route = sanitize_opt_field(input.route);
    let action = sanitize_opt_field(input.action);
    let outcome = sanitize_opt_field(input.outcome);
    let detail = sanitize_opt_field(input.detail);
    let metadata = sanitize_metadata(input.metadata);

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        step = input.step.as_str(),
        route = %route.as_deref().unwrap_or(EMPTY),
        action = %action.as_deref().unwrap_or(EMPTY),
        outcome = %outcome.as_deref().unwrap_or(EMPTY),
        detail = %detail.as_deref().unwrap_or(EMPTY),
        metadata = ?metadata
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_text_masks_known_secret_patterns() {
        let cleaned = sanitize_text("  password=hunter2 token=abc123  ", MAX_FIELD_CHARS);
        assert!(cleaned.contains("password=***"));
        assert!(cleaned.contains("token=***"));
        assert!(!cleaned.contains("hunter2"));
        assert!(!cleaned.contains("abc123"));
    }

    #[test]
    fn sanitize_route_style_metadata_filters_invalid_keys() {
        let mut meta = BTreeMap::new();
        meta.insert("ok.key".into(), "value".into());
        meta.insert("bad key".into(), "drop-me".into());
        let cleaned = sanitize_metadata(meta);
        assert_eq!(cleaned.get("ok.key").map(String::as_str), Some("value"));
        assert!(cleaned.get("badkey").is_some());
    }

    #[test]
    fn sanitize_opt_field_drops_blank_values() {
        assert_eq!(sanitize_opt_field(Some("   ".into())), None);
        assert_eq!(sanitize_opt_field(None), None);
    }
}
