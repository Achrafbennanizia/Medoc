use std::fmt::Display;
use std::future::Future;

use serde::{Deserialize, Serialize};

use super::sanitizer;

const MAX_FIELD_LEN: usize = 160;
const MAX_DETAIL_LEN: usize = 256;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogStep {
    pub flow: String,
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
}

#[derive(Debug, Clone)]
struct SanitizedWorkflowLogStep {
    flow: String,
    step: String,
    route: Option<String>,
    action: Option<String>,
    outcome: Option<String>,
    correlation_id: Option<String>,
    detail: Option<String>,
}

impl WorkflowLogStep {
    fn sanitize(self) -> SanitizedWorkflowLogStep {
        SanitizedWorkflowLogStep {
            flow: sanitize_token(&self.flow, "ui.workflow", MAX_FIELD_LEN),
            step: sanitize_step(&self.step),
            route: self.route.as_deref().map(redact_route),
            action: self
                .action
                .as_deref()
                .map(|v| sanitize_token(v, "action", MAX_FIELD_LEN)),
            outcome: self
                .outcome
                .as_deref()
                .map(|v| sanitize_token(v, "outcome", MAX_FIELD_LEN)),
            correlation_id: self
                .correlation_id
                .as_deref()
                .map(|v| sanitize_token(v, "corr", MAX_FIELD_LEN)),
            detail: self
                .detail
                .as_deref()
                .map(|v| sanitize_text(v, MAX_DETAIL_LEN)),
        }
    }
}

fn sanitize_text(raw: &str, max_len: usize) -> String {
    let masked = sanitizer::sanitize(raw);
    let single_line = masked.replace(['\n', '\r', '\t'], " ");
    let compact = single_line.trim();
    if compact.len() <= max_len {
        compact.to_string()
    } else {
        format!("{}...", &compact[..max_len])
    }
}

fn sanitize_token(raw: &str, fallback: &str, max_len: usize) -> String {
    let lowered = sanitize_text(raw, max_len).to_lowercase();
    let normalized: String = lowered
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.' | '/') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let compact = normalized.trim_matches('_').to_string();
    if compact.is_empty() {
        fallback.to_string()
    } else {
        compact
    }
}

fn sanitize_step(raw: &str) -> String {
    let candidate = sanitize_token(raw, "custom", 40);
    match candidate.as_str() {
        "route_enter" | "primary_action" | "success" | "cancel" | "error" => candidate,
        _ => "custom".to_string(),
    }
}

fn sanitize_service_name(raw: &str) -> String {
    sanitize_token(raw, "application.service", MAX_FIELD_LEN)
}

fn looks_like_dynamic_id(segment: &str) -> bool {
    let s = segment.trim();
    if s.len() >= 4 && s.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }
    s.len() >= 8 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn redact_route(raw: &str) -> String {
    let clean = sanitize_text(raw, MAX_FIELD_LEN);
    let path = clean.split('?').next().unwrap_or_default();
    let mut out = String::new();
    for part in path.split('/') {
        if part.is_empty() {
            continue;
        }
        out.push('/');
        if looks_like_dynamic_id(part) {
            out.push_str(":id");
        } else {
            out.push_str(part);
        }
    }
    if out.is_empty() {
        "/".to_string()
    } else {
        out
    }
}

/// Write a sanitized workflow step into the dedicated `workflow.log` channel.
pub fn record_ui_step(step: WorkflowLogStep) {
    let s = step.sanitize();
    crate::log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        flow = %s.flow,
        step = %s.step,
        route = ?s.route,
        action = ?s.action,
        outcome = ?s.outcome,
        correlation_id = ?s.correlation_id,
        detail = ?s.detail,
    );
}

/// Record a backend Tauri command lifecycle step on the workflow channel.
pub fn record_tauri_command_received(command: &str) {
    let action = sanitize_token(command, "tauri.command", MAX_FIELD_LEN);
    crate::log_workflow!(
        info,
        event = "TAURI_COMMAND_DISPATCH",
        flow = "tauri.command",
        step = "primary_action",
        action = %action,
        outcome = "received",
    );
}

/// Record a backend Tauri command lifecycle step on the workflow channel.
pub fn record_tauri_command_dispatch(command: &str, handled: bool) {
    let action = sanitize_token(command, "tauri.command", MAX_FIELD_LEN);
    if handled {
        crate::log_workflow!(
            info,
            event = "TAURI_COMMAND_DISPATCH",
            flow = "tauri.command",
            step = "success",
            action = %action,
            outcome = "handled",
        );
    } else {
        crate::log_workflow!(
            warn,
            event = "TAURI_COMMAND_DISPATCH",
            flow = "tauri.command",
            step = "error",
            action = %action,
            outcome = "unhandled",
        );
    }
}

/// Record start of an application/service call.
pub fn record_service_call_start(service: &str, operation: &str) {
    let flow = sanitize_service_name(service);
    let action = sanitize_token(operation, "call", MAX_FIELD_LEN);
    crate::log_workflow!(
        info,
        event = "APPLICATION_SERVICE_CALL",
        flow = %flow,
        step = "primary_action",
        action = %action,
        outcome = "start",
    );
}

/// Record completion of an application/service call.
pub fn record_service_call_result<T, E: Display>(
    service: &str,
    operation: &str,
    result: &Result<T, E>,
) {
    let flow = sanitize_service_name(service);
    let action = sanitize_token(operation, "call", MAX_FIELD_LEN);
    match result {
        Ok(_) => crate::log_workflow!(
            info,
            event = "APPLICATION_SERVICE_CALL",
            flow = %flow,
            step = "success",
            action = %action,
            outcome = "ok",
        ),
        Err(err) => crate::log_workflow!(
            warn,
            event = "APPLICATION_SERVICE_CALL",
            flow = %flow,
            step = "error",
            action = %action,
            outcome = "error",
            detail = %sanitize_text(&err.to_string(), MAX_DETAIL_LEN),
        ),
    }
}

/// Run an async application/service call with start/result workflow telemetry.
pub async fn run_service_call_async<T, E, F, Fut>(
    service: &str,
    operation: &str,
    run: F,
) -> Result<T, E>
where
    E: Display,
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    record_service_call_start(service, operation);
    let result = run().await;
    record_service_call_result(service, operation, &result);
    result
}

/// Run a sync application/service call with start/result workflow telemetry.
pub fn run_service_call<T, E, F>(service: &str, operation: &str, run: F) -> Result<T, E>
where
    E: Display,
    F: FnOnce() -> Result<T, E>,
{
    record_service_call_start(service, operation);
    let result = run();
    record_service_call_result(service, operation, &result);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_redacts_dynamic_segments() {
        assert_eq!(
            redact_route("/patienten/550e8400-e29b-41d4-a716-446655440000/rezept/9981"),
            "/patienten/:id/rezept/:id"
        );
    }

    #[test]
    fn step_is_allowlisted() {
        assert_eq!(sanitize_step("primary_action"), "primary_action");
        assert_eq!(sanitize_step("something-else"), "custom");
    }

    #[test]
    fn token_masks_secrets() {
        assert_eq!(
            sanitize_token("token=super-secret", "fallback", 64),
            "token"
        );
    }

    #[test]
    fn service_name_is_normalized() {
        assert_eq!(
            sanitize_service_name("Application::Akte::PDF Export"),
            "application__akte__pdf_export"
        );
    }
}
