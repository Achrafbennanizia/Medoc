use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Prescription {
    pub id: String,
    pub patient_id: String,
    pub physician_id: String,
    pub medication: String,
    pub active_ingredient: Option<String>,
    pub dosage: String,
    pub duration: String,
    pub instructions: Option<String>,
    pub issued_at: NaiveDate,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub pzn: Option<String>,
    pub dosage_form: Option<String>,
    pub pack_size: Option<String>,
    pub quantity: Option<i32>,
    pub aut_idem: Option<bool>,
    pub prescription_type: Option<String>,
    pub icd10_code: Option<String>,
    pub prescribing_physician_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrescription {
    pub id: String,
    pub medication: String,
    pub active_ingredient: Option<String>,
    pub dosage: String,
    pub duration: String,
    pub instructions: Option<String>,
    pub pzn: Option<String>,
    pub dosage_form: Option<String>,
    pub pack_size: Option<String>,
    pub quantity: Option<i32>,
    pub aut_idem: Option<bool>,
    pub prescription_type: Option<String>,
    pub icd10_code: Option<String>,
    pub prescribing_physician_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrescription {
    pub patient_id: String,
    pub physician_id: String,
    pub medication: String,
    pub active_ingredient: Option<String>,
    pub dosage: String,
    pub duration: String,
    pub instructions: Option<String>,
    pub pzn: Option<String>,
    pub dosage_form: Option<String>,
    pub pack_size: Option<String>,
    pub quantity: Option<i32>,
    pub aut_idem: Option<bool>,
    pub prescription_type: Option<String>,
    pub icd10_code: Option<String>,
    pub prescribing_physician_id: Option<String>,
}
