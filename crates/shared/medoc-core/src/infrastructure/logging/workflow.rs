//! Workflow telemetry sink for UI/backend lifecycle events.
//!
//! Every event is sanitised before it reaches `workflow.log` to avoid writing
//! patient PII or secret-like values.

use chrono::Utc;
use serde::{Deserialize, Serialize};

use super::sanitizer;
use crate::log_workflow;

const MAX_FIELD_LEN: usize = 160;
const MAX_DETAILS_LEN: usize = 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEvent {
    pub workflow: String,
    pub step: String,
    pub stage: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub details: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub ts_ms: Option<i64>,
}

fn truncate(value: String, limit: usize) -> String {
    value.chars().take(limit).collect()
}

fn sanitize_required(value: &str) -> String {
    let source = value.trim();
    let source = if source.is_empty() { "unknown" } else { source };
    truncate(sanitizer::sanitize(source), MAX_FIELD_LEN)
}

fn sanitize_optional(value: Option<String>, limit: usize) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(truncate(sanitizer::sanitize(trimmed), limit))
        }
    })
}

impl WorkflowEvent {
    pub fn sanitized(self) -> Self {
        Self {
            workflow: sanitize_required(&self.workflow),
            step: sanitize_required(&self.step),
            stage: sanitize_required(&self.stage),
            route: sanitize_optional(self.route, MAX_FIELD_LEN),
            action: sanitize_optional(self.action, MAX_FIELD_LEN),
            status: sanitize_optional(self.status, MAX_FIELD_LEN),
            details: sanitize_optional(self.details, MAX_DETAILS_LEN),
            duration_ms: self.duration_ms,
            ts_ms: self.ts_ms,
        }
    }
}

pub fn emit(event: WorkflowEvent) {
    let event = event.sanitized();
    let ts_ms = event.ts_ms.unwrap_or_else(|| Utc::now().timestamp_millis());

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %event.workflow,
        step = %event.step,
        stage = %event.stage,
        route = ?event.route,
        action = ?event.action,
        status = ?event.status,
        details = ?event.details,
        duration_ms = ?event.duration_ms,
        ts_ms = ts_ms,
    );
}

#[cfg(test)]
mod tests {
    use super::WorkflowEvent;

    #[test]
    fn sanitizes_secret_like_fields() {
        let event = WorkflowEvent {
            workflow: "login".into(),
            step: "submit".into(),
            stage: "error".into(),
            route: Some("/login".into()),
            action: Some("authenticate".into()),
            status: Some("failed".into()),
            details: Some("password=hunter2 token=secret123".into()),
            duration_ms: Some(123),
            ts_ms: Some(1),
        };
        let sanitized = event.sanitized();
        let details = sanitized.details.expect("details");
        assert!(details.contains("password=***"));
        assert!(!details.contains("hunter2"));
        assert!(!details.contains("secret123"));
    }

    #[test]
    fn normalizes_empty_required_fields() {
        let event = WorkflowEvent {
            workflow: "   ".into(),
            step: "".into(),
            stage: "   ".into(),
            route: None,
            action: None,
            status: None,
            details: None,
            duration_ms: None,
            ts_ms: None,
        };
        let sanitized = event.sanitized();
        assert_eq!(sanitized.workflow, "unknown");
        assert_eq!(sanitized.step, "unknown");
        assert_eq!(sanitized.stage, "unknown");
    }
}
