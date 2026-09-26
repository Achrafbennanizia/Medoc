use serde::{Deserialize, Serialize};

use super::sanitizer;

const MAX_ROUTE_LEN: usize = 120;
const MAX_ACTION_LEN: usize = 64;
const MAX_DETAIL_LEN: usize = 160;
const MAX_SOURCE_LEN: usize = 32;
const MAX_CORRELATION_LEN: usize = 64;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStage {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStage {
    pub const fn as_str(self) -> &'static str {
        match self {
            WorkflowStage::RouteEnter => "route_enter",
            WorkflowStage::PrimaryAction => "primary_action",
            WorkflowStage::Success => "success",
            WorkflowStage::Cancel => "cancel",
            WorkflowStage::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEvent {
    pub source: String,
    pub route: String,
    pub action: String,
    pub stage: WorkflowStage,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

impl WorkflowEvent {
    pub fn sanitized(self) -> Self {
        let source = sanitize_ident(&self.source, "ui", MAX_SOURCE_LEN);
        let action = sanitize_ident(&self.action, "unknown_action", MAX_ACTION_LEN);
        let route = sanitize_route(&self.route);
        let detail = self
            .detail
            .as_deref()
            .map(|d| sanitize_free_text(d, MAX_DETAIL_LEN))
            .filter(|d| !d.is_empty());
        let correlation_id = self
            .correlation_id
            .as_deref()
            .map(|c| sanitize_ident(c, "", MAX_CORRELATION_LEN))
            .filter(|c| !c.is_empty());
        Self {
            source,
            route,
            action,
            stage: self.stage,
            detail,
            correlation_id,
        }
    }
}

pub fn emit(event: WorkflowEvent) {
    let clean = event.sanitized();
    crate::log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        source = %clean.source,
        route = %clean.route,
        action = %clean.action,
        stage = clean.stage.as_str(),
        detail = clean.detail.as_deref().unwrap_or(""),
        correlation_id = clean.correlation_id.as_deref().unwrap_or(""),
    );
}

fn sanitize_ident(raw: &str, fallback: &str, max_len: usize) -> String {
    let mut out = sanitizer::sanitize(raw).trim().to_string();
    if out.is_empty() {
        out = fallback.to_string();
    }
    out = out
        .chars()
        .map(|ch| if ch.is_whitespace() { '_' } else { ch })
        .collect();
    if out.len() > max_len {
        out.truncate(max_len);
    }
    out
}

fn sanitize_free_text(raw: &str, max_len: usize) -> String {
    let mut out = sanitizer::sanitize(raw).trim().to_string();
    if out.len() > max_len {
        out.truncate(max_len);
    }
    out
}

fn sanitize_route(raw: &str) -> String {
    let path_only = raw
        .trim()
        .split('?')
        .next()
        .unwrap_or("/")
        .trim()
        .trim_start_matches('/');
    let mut parts = Vec::new();
    for segment in path_only.split('/') {
        let seg = segment.trim();
        if seg.is_empty() {
            continue;
        }
        if looks_dynamic_segment(seg) {
            parts.push(":id".to_string());
        } else {
            parts.push(sanitize_ident(seg, "segment", 24));
        }
    }
    let mut route = if parts.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", parts.join("/"))
    };
    if route.len() > MAX_ROUTE_LEN {
        route.truncate(MAX_ROUTE_LEN);
    }
    route
}

fn looks_dynamic_segment(seg: &str) -> bool {
    let is_numeric_id = seg.chars().all(|c| c.is_ascii_digit()) && seg.len() >= 3;
    if is_numeric_id {
        return true;
    }
    let hex_or_dash = seg.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    hex_or_dash && seg.len() >= 8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_secret_like_detail_payload() {
        let event = WorkflowEvent {
            source: "ui".into(),
            route: "/patients/12345678".into(),
            action: "create_payment".into(),
            stage: WorkflowStage::PrimaryAction,
            detail: Some("password=hunter2".into()),
            correlation_id: Some("corr-1".into()),
        }
        .sanitized();

        assert_eq!(event.route, "/patients/:id");
        assert_eq!(event.detail.as_deref(), Some("password=***"));
    }

    #[test]
    fn canonicalises_dynamic_route_segments() {
        let event = WorkflowEvent {
            source: "ui".into(),
            route: "/patients/9a3f7c0d2b44/orders/4567?tab=1".into(),
            action: "open_drawer".into(),
            stage: WorkflowStage::RouteEnter,
            detail: None,
            correlation_id: None,
        }
        .sanitized();

        assert_eq!(event.route, "/patients/:id/orders/:id");
    }
}
