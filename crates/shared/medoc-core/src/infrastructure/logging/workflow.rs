use serde::{Deserialize, Serialize};

use super::sanitizer;
use crate::log_workflow;

const MAX_FIELD_LEN: usize = 256;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEventInput {
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone)]
struct WorkflowEvent {
    step: String,
    route: Option<String>,
    action: Option<String>,
    status: Option<String>,
    message: Option<String>,
    error: Option<String>,
    duration_ms: Option<u64>,
}

fn sanitize_text(input: &str) -> String {
    let mut out = sanitizer::sanitize(input)
        .replace(['\n', '\r'], " ")
        .trim()
        .to_string();
    if out.len() > MAX_FIELD_LEN {
        out.truncate(MAX_FIELD_LEN);
    }
    out
}

fn sanitize_opt(input: Option<String>) -> Option<String> {
    input
        .map(|v| sanitize_text(&v))
        .filter(|v| !v.is_empty())
}

fn looks_like_uuid_segment(segment: &str) -> bool {
    if segment.len() != 36 {
        return false;
    }
    for (idx, ch) in segment.chars().enumerate() {
        let is_dash = matches!(idx, 8 | 13 | 18 | 23);
        if is_dash {
            if ch != '-' {
                return false;
            }
        } else if !ch.is_ascii_hexdigit() {
            return false;
        }
    }
    true
}

fn should_mask_route_segment(segment: &str) -> bool {
    if segment.is_empty() {
        return false;
    }
    if looks_like_uuid_segment(segment) {
        return true;
    }
    if segment.chars().all(|ch| ch.is_ascii_digit()) {
        return true;
    }
    // Covers IDs like `pat-12345`, `ticket-ab12`, etc. while preserving
    // ordinary static route fragments such as `patienten` or `tickets`.
    segment.len() >= 8 && segment.contains('-') && segment.chars().any(|ch| ch.is_ascii_digit())
}

fn normalize_route(route: Option<String>) -> Option<String> {
    let raw = sanitize_opt(route)?;
    if !raw.starts_with('/') {
        return Some(raw);
    }
    let mut parts = Vec::new();
    for segment in raw.split('/').filter(|s| !s.is_empty()) {
        if should_mask_route_segment(segment) {
            parts.push(":id".to_string());
        } else {
            parts.push(segment.to_string());
        }
    }
    if parts.is_empty() {
        Some("/".to_string())
    } else {
        Some(format!("/{}", parts.join("/")))
    }
}

fn normalize_step(step: String) -> String {
    match sanitize_text(&step).to_lowercase().as_str() {
        "route_enter" => "route_enter".to_string(),
        "primary_action" => "primary_action".to_string(),
        "success" => "success".to_string(),
        "cancel" => "cancel".to_string(),
        "error" => "error".to_string(),
        _ => "primary_action".to_string(),
    }
}

impl From<WorkflowEventInput> for WorkflowEvent {
    fn from(raw: WorkflowEventInput) -> Self {
        Self {
            step: normalize_step(raw.step),
            route: normalize_route(raw.route),
            action: sanitize_opt(raw.action),
            status: sanitize_opt(raw.status),
            message: sanitize_opt(raw.message),
            error: sanitize_opt(raw.error),
            duration_ms: raw.duration_ms,
        }
    }
}

pub fn record_ui_event(raw: WorkflowEventInput) {
    let event = WorkflowEvent::from(raw);
    log_workflow!(
        info,
        event = "WORKFLOW_UI",
        step = %event.step,
        route = %event.route.as_deref().unwrap_or(""),
        action = %event.action.as_deref().unwrap_or(""),
        status = %event.status.as_deref().unwrap_or(""),
        message = %event.message.as_deref().unwrap_or(""),
        error = %event.error.as_deref().unwrap_or(""),
        duration_ms = event.duration_ms.unwrap_or(0),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_masks_dynamic_route_segments() {
        let normalized =
            normalize_route(Some("/patienten/550e8400-e29b-41d4-a716-446655440000/rezept/pat-1234".into()));
        assert_eq!(normalized.as_deref(), Some("/patienten/:id/rezept/:id"));
    }

    #[test]
    fn event_payload_sanitizes_sensitive_fields() {
        let event = WorkflowEvent::from(WorkflowEventInput {
            step: "error".into(),
            route: Some("/login".into()),
            action: Some("submit_login".into()),
            status: Some("failed".into()),
            message: Some("password=hunter2".into()),
            error: Some("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig".into()),
            duration_ms: Some(12),
        });
        assert_eq!(event.step, "error");
        assert_eq!(event.message.as_deref(), Some("password=***"));
        assert!(event.error.as_deref().is_some_and(|v| v.contains("eyJ***")));
    }

    #[test]
    fn unknown_step_defaults_to_primary_action() {
        let event = WorkflowEvent::from(WorkflowEventInput {
            step: "not-a-real-step".into(),
            route: None,
            action: None,
            status: None,
            message: None,
            error: None,
            duration_ms: None,
        });
        assert_eq!(event.step, "primary_action");
    }
}
