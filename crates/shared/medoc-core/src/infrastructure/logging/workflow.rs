// Structured workflow-event logging (NFA-LOG workflow channel).
//
// Frontend and backend emit route/action/transition events here so operators
// can reconstruct user workflows without relying on unstructured text logs.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStage {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
    DomainTransition,
    CommandReceived,
}

impl WorkflowStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            WorkflowStage::RouteEnter => "route_enter",
            WorkflowStage::PrimaryAction => "primary_action",
            WorkflowStage::Success => "success",
            WorkflowStage::Cancel => "cancel",
            WorkflowStage::Error => "error",
            WorkflowStage::DomainTransition => "domain_transition",
            WorkflowStage::CommandReceived => "command_received",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEvent {
    pub workflow: String,
    pub stage: WorkflowStage,
    #[serde(default)]
    pub step: Option<String>,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub user_id: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SanitizedWorkflowEvent {
    pub workflow: String,
    pub stage: WorkflowStage,
    pub step: Option<String>,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    pub error: Option<String>,
    pub user_id: Option<String>,
    pub role: Option<String>,
    pub metadata: Option<Value>,
}

fn sanitize_required(raw: String, fallback: &str) -> String {
    let clean = super::sanitizer::sanitize(raw.trim());
    if clean.is_empty() {
        fallback.to_string()
    } else {
        clean
    }
}

fn sanitize_optional(raw: Option<String>) -> Option<String> {
    raw.map(|v| super::sanitizer::sanitize(v.trim()))
        .filter(|v| !v.is_empty())
}

pub fn sanitize_json_value(value: &Value) -> Value {
    match value {
        Value::String(s) => Value::String(super::sanitizer::sanitize(s)),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(sanitize_json_value)
                .collect::<Vec<Value>>(),
        ),
        Value::Object(obj) => Value::Object(
            obj.iter()
                .map(|(k, v)| (k.clone(), sanitize_json_value(v)))
                .collect::<Map<String, Value>>(),
        ),
        _ => value.clone(),
    }
}

pub fn sanitize_event(event: WorkflowEvent) -> SanitizedWorkflowEvent {
    SanitizedWorkflowEvent {
        workflow: sanitize_required(event.workflow, "workflow"),
        stage: event.stage,
        step: sanitize_optional(event.step),
        route: sanitize_optional(event.route),
        action: sanitize_optional(event.action),
        status: sanitize_optional(event.status),
        error: sanitize_optional(event.error),
        user_id: sanitize_optional(event.user_id),
        role: sanitize_optional(event.role),
        metadata: event.metadata.map(|v| sanitize_json_value(&v)),
    }
}

pub fn emit(event: WorkflowEvent) {
    let event = sanitize_event(event);
    let metadata = event
        .metadata
        .as_ref()
        .map(Value::to_string)
        .unwrap_or_else(|| "{}".to_string());
    tracing::info!(
        target: "medoc::workflow",
        event = "WORKFLOW_EVENT",
        workflow = %event.workflow,
        stage = event.stage.as_str(),
        step = event.step.as_deref().unwrap_or_default(),
        route = event.route.as_deref().unwrap_or_default(),
        action = event.action.as_deref().unwrap_or_default(),
        status = event.status.as_deref().unwrap_or_default(),
        error = event.error.as_deref().unwrap_or_default(),
        user_id = event.user_id.as_deref().unwrap_or_default(),
        role = event.role.as_deref().unwrap_or_default(),
        metadata = %metadata,
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitize_json_masks_nested_tokens() {
        let value = json!({
            "message": "password=secret",
            "nested": {
                "token": "api_key=topsecret"
            }
        });
        let sanitized = sanitize_json_value(&value);
        assert_eq!(sanitized["message"], "password=***");
        assert_eq!(sanitized["nested"]["token"], "api_key=***");
    }

    #[test]
    fn sanitize_event_masks_fields_and_preserves_stage() {
        let event = WorkflowEvent {
            workflow: "route password=hidden".into(),
            stage: WorkflowStage::Error,
            step: Some("api_key=abc".into()),
            route: Some("/patienten".into()),
            action: Some("create_patient".into()),
            status: Some("failed".into()),
            error: Some("token=secret".into()),
            user_id: Some("user-1".into()),
            role: Some("ARZT".into()),
            metadata: Some(json!({"details":"license=secret"})),
        };
        let sanitized = sanitize_event(event);
        assert_eq!(sanitized.stage, WorkflowStage::Error);
        assert_eq!(sanitized.workflow, "route password=***");
        assert_eq!(sanitized.step.as_deref(), Some("api_key=***"));
        assert_eq!(sanitized.error.as_deref(), Some("token=***"));
        assert_eq!(
            sanitized.metadata.expect("metadata")["details"],
            "license=***"
        );
    }
}
