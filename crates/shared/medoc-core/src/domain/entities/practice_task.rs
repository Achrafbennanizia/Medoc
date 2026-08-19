use serde::{Deserialize, Serialize};

/// FA-AUFG-01 — bidirectional practice tasks (evolved from `practice_ticket`).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PracticeTask {
    pub id: String,
    pub patient_id: Option<String>,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    /// `RECEPTION` = reception inbox (pool); otherwise target physician via `assignee_user_id`.
    pub assignee_role: Option<String>,
    pub assignee_user_id: Option<String>,
    pub created_by: String,
    pub treatment_id: Option<String>,
    pub examination_id: Option<String>,
    pub service_name: Option<String>,
    pub total_cost: Option<f64>,
    pub payment_id: Option<String>,
    pub done_note: Option<String>,
    pub return_reason: Option<String>,
    pub status: String,
    pub legacy_ticket_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PracticeTaskComment {
    pub id: String,
    pub task_id: String,
    pub author_id: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddPracticeTaskCommentArgs {
    pub task_id: String,
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePracticeTask {
    #[serde(default)]
    pub patient_id: Option<String>,
    pub kind: String,
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    /// Target reception (physician → REZ).
    #[serde(default)]
    pub assignee_role: Option<String>,
    /// Target physician (REZ → PHYSICIAN).
    #[serde(default)]
    pub assignee_user_id: Option<String>,
    #[serde(default)]
    pub treatment_id: Option<String>,
    #[serde(default)]
    pub examination_id: Option<String>,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub total_cost: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionPracticeTaskArgs {
    pub id: String,
    pub status: String,
    #[serde(default, alias = "doneNotiz", alias = "done_notiz")]
    pub done_note: Option<String>,
    #[serde(default)]
    pub payment_id: Option<String>,
    #[serde(default)]
    pub return_reason: Option<String>,
}

/// Admin: edit task (title, assignment, status).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePracticeTaskAdmin {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub assignee_role: Option<String>,
    #[serde(default)]
    pub assignee_user_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}
