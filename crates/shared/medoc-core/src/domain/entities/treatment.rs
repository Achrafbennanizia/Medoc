use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Examination {
    pub id: String,
    pub chart_id: String,
    pub chief_complaint: Option<String>,
    pub results: Option<String>,
    pub diagnosis: Option<String>,
    pub examination_number: Option<String>,
    pub created_at: NaiveDateTime,
    /// FA-LEIST-07: billable service line (parity with `treatment`).
    pub category: Option<String>,
    pub service_name: Option<String>,
    pub total_cost: Option<f64>,
    /// FA-LEIST-05: must be set before booking a payment linked via `examination_id`.
    pub released_by_physician_id: Option<String>,
    pub released_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExamination {
    pub chart_id: String,
    pub chief_complaint: Option<String>,
    pub results: Option<String>,
    pub diagnosis: Option<String>,
    #[serde(default)]
    pub examination_number: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub total_cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Treatment {
    pub id: String,
    pub chart_id: String,
    pub kind: String,
    pub description: Option<String>,
    pub teeth: Option<String>,
    pub material: Option<String>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub category: Option<String>,
    pub service_name: Option<String>,
    pub treatment_number: Option<String>,
    pub session_number: Option<i64>,
    pub treatment_status: Option<String>,
    pub total_cost: Option<f64>,
    pub appointment_required: Option<i64>,
    pub treatment_date: Option<String>,
    /// FA-LEIST-05: must be set before booking a payment linked via `treatment_id`.
    pub released_by_physician_id: Option<String>,
    pub released_at: Option<String>,
}

/// Full update of an existing treatment line (chart history).
#[derive(Debug, Deserialize)]
pub struct UpdateTreatment {
    pub id: String,
    pub kind: String,
    pub description: Option<String>,
    pub teeth: Option<String>,
    pub material: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub treatment_number: Option<String>,
    #[serde(default)]
    pub session_number: Option<i64>,
    #[serde(default)]
    pub treatment_status: Option<String>,
    #[serde(default)]
    pub total_cost: Option<f64>,
    #[serde(default)]
    pub appointment_required: Option<bool>,
    #[serde(default)]
    pub treatment_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExamination {
    pub id: String,
    pub chief_complaint: Option<String>,
    pub results: Option<String>,
    pub diagnosis: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub total_cost: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTreatment {
    pub chart_id: String,
    pub kind: String,
    pub description: Option<String>,
    pub teeth: Option<String>,
    pub material: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub treatment_number: Option<String>,
    #[serde(default)]
    pub session_number: Option<i64>,
    #[serde(default)]
    pub treatment_status: Option<String>,
    #[serde(default)]
    pub total_cost: Option<f64>,
    #[serde(default)]
    pub appointment_required: Option<bool>,
    #[serde(default)]
    pub treatment_date: Option<String>,
}
