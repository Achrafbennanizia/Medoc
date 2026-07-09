use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::log_workflow;

use super::sanitizer;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStep {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStep {
    pub fn as_str(self) -> &'static str {
        match self {
            WorkflowStep::RouteEnter => "route_enter",
            WorkflowStep::PrimaryAction => "primary_action",
            WorkflowStep::Success => "success",
            WorkflowStep::Cancel => "cancel",
            WorkflowStep::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEvent {
    pub workflow: String,
    pub step: WorkflowStep,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

fn sanitize_text(raw: Option<String>) -> Option<String> {
    raw.map(|value| sanitizer::sanitize(value.trim()))
        .and_then(|value| if value.is_empty() { None } else { Some(value) })
}

fn sanitize_json(value: Value) -> Value {
    match value {
        Value::String(text) => Value::String(sanitizer::sanitize(&text)),
        Value::Array(values) => Value::Array(values.into_iter().map(sanitize_json).collect()),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| (sanitizer::sanitize(&key), sanitize_json(value)))
                .collect(),
        ),
        other => other,
    }
}

fn sanitize_event(event: WorkflowEvent) -> WorkflowEvent {
    let workflow = sanitizer::sanitize(event.workflow.trim());
    WorkflowEvent {
        workflow: if workflow.is_empty() {
            "ui.unknown".to_string()
        } else {
            workflow
        },
        step: event.step,
        route: sanitize_text(event.route),
        action: sanitize_text(event.action),
        status: sanitize_text(event.status),
        message: sanitize_text(event.message),
        metadata: event.metadata.map(sanitize_json),
    }
}

pub fn emit_frontend_event(event: WorkflowEvent) {
    let event = sanitize_event(event);
    let metadata = event.metadata.unwrap_or(Value::Null);
    log_workflow!(
        info,
        event = "FRONTEND_WORKFLOW_STEP",
        workflow = %event.workflow,
        step = event.step.as_str(),
        route = event.route.as_deref().unwrap_or_default(),
        action = event.action.as_deref().unwrap_or_default(),
        status = event.status.as_deref().unwrap_or_default(),
        message = event.message.as_deref().unwrap_or_default(),
        metadata = %metadata,
    );
}

pub fn emit_backend_command_received(command: &str) {
    log_workflow!(
        info,
        event = "BACKEND_COMMAND_RECEIVED",
        command = %sanitizer::sanitize(command),
    );
}

pub fn emit_backend_command_dispatched(command: &str, handled: bool) {
    log_workflow!(
        info,
        event = "BACKEND_COMMAND_DISPATCHED",
        command = %sanitizer::sanitize(command),
        handled,
    );
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{sanitize_event, WorkflowEvent, WorkflowStep};

    #[test]
    fn sanitize_event_masks_secret_like_fields() {
        let event = WorkflowEvent {
            workflow: "ui.login".into(),
            step: WorkflowStep::Error,
            route: Some("/login".into()),
            action: Some("submit".into()),
            status: Some("failed".into()),
            message: Some(
                "password=hunter2 token=abc123 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig"
                    .into(),
            ),
            metadata: None,
        };
        let sanitized = sanitize_event(event);
        let message = sanitized.message.expect("message preserved");
        assert!(message.contains("password=***"));
        assert!(message.contains("token=***"));
        assert!(message.contains("eyJ***"));
        assert!(!message.contains("hunter2"));
        assert!(!message.contains("abc123"));
    }

    #[test]
    fn sanitize_event_masks_nested_metadata_strings() {
        let event = WorkflowEvent {
            workflow: "ui.patient.create".into(),
            step: WorkflowStep::PrimaryAction,
            route: Some("/patienten/neu".into()),
            action: Some("create_patient".into()),
            status: Some("started".into()),
            message: None,
            metadata: Some(json!({
                "note": "api_key=supersecret",
                "nested": {
                    "token": "token=topsecret"
                },
                "array": ["password=sensitive", 42]
            })),
        };
        let sanitized = sanitize_event(event);
        let metadata = sanitized.metadata.expect("metadata preserved").to_string();
        assert!(metadata.contains("api_key=***"));
        assert!(metadata.contains("token=***"));
        assert!(metadata.contains("password=***"));
        assert!(!metadata.contains("supersecret"));
        assert!(!metadata.contains("topsecret"));
        assert!(!metadata.contains("sensitive"));
    }
}
