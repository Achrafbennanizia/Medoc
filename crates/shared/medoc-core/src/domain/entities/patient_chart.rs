use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PatientChart {
    pub id: String,
    pub patient_id: String,
    pub status: String,
    pub diagnosis: Option<String>,
    pub findings: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
