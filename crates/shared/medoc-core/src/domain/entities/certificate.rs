use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Certificate {
    pub id: String,
    pub patient_id: String,
    pub physician_id: String,
    pub kind: String,
    pub body_text: String,
    pub valid_from: NaiveDate,
    pub valid_until: NaiveDate,
    pub issued_at: NaiveDate,
    pub created_at: NaiveDateTime,
    pub icd10_code: Option<String>,
    pub first_or_follow_up: Option<String>,
    pub employer: Option<String>,
    pub issuing_physician_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCertificate {
    pub patient_id: String,
    pub physician_id: String,
    pub kind: String,
    pub body_text: String,
    pub valid_from: NaiveDate,
    pub valid_until: NaiveDate,
    pub icd10_code: Option<String>,
    pub first_or_follow_up: Option<String>,
    pub employer: Option<String>,
    pub issuing_physician_id: Option<String>,
}
