use serde::Deserialize;

use crate::error::AppError;
use crate::infrastructure::logging::workflow::{self, WorkflowEvent, WorkflowStage};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEventInput {
    pub route: String,
    pub action: String,
    pub stage: WorkflowStage,
    pub detail: Option<String>,
    pub correlation_id: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(payload), fields(stage = ?payload.stage))]
pub fn log_workflow_event(payload: WorkflowLogEventInput) -> Result<(), AppError> {
    workflow::emit(WorkflowEvent {
        source: "ui".to_string(),
        route: payload.route,
        action: payload.action,
        stage: payload.stage,
        detail: payload.detail,
        correlation_id: payload.correlation_id,
    });
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_workflow_commands {
    () => {
        $crate::commands::workflow_commands::log_workflow_event,
    };
}
