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
    #[serde(default)]
    pub updated_at: Option<String>,
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
    #[serde(default)]
    pub updated_at: Option<String>,
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
    // --- GOZ billing (Anlage 2 GOZ) -------------------------------------
    /// `goz` | `goae` | `material` | `lab` | `other`
    #[sqlx(default)]
    #[serde(default)]
    pub fee_schedule: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub goz_nr: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub points: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub factor: Option<f64>,
    /// Justification when factor > 2.3 (§ 10 Abs. 3 GOZ).
    #[sqlx(default)]
    #[serde(default)]
    pub factor_reason: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub quantity: Option<i64>,
    /// § 6 Abs. 1 GOZ analog billing — number of the service the fee is taken from.
    #[sqlx(default)]
    #[serde(default)]
    pub analog_of: Option<String>,
    /// § 2 Abs. 1/2 GOZ agreement reference (factor > 3.5).
    #[sqlx(default)]
    #[serde(default)]
    pub agreement_ref: Option<String>,
}

/// GOZ billing fields of one treatment line (physician sets them).
#[derive(Debug, Clone, Deserialize)]
pub struct TreatmentBilling {
    pub treatment_id: String,
    pub fee_schedule: String,
    pub goz_nr: Option<String>,
    pub points: Option<i64>,
    pub factor: Option<f64>,
    pub factor_reason: Option<String>,
    pub quantity: Option<i64>,
    pub analog_of: Option<String>,
    pub agreement_ref: Option<String>,
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
