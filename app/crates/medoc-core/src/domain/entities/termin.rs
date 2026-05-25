use crate::domain::enums::{TerminArt, TerminStatus};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Termin {
    pub id: String,
    pub datum: String,
    pub uhrzeit: String,
    pub art: String,
    pub status: String,
    pub notizen: Option<String>,
    pub beschwerden: Option<String>,
    pub patient_id: String,
    pub arzt_id: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateTermin {
    pub datum: String,
    pub uhrzeit: String,
    pub art: TerminArt,
    pub patient_id: String,
    pub arzt_id: String,
    pub notizen: Option<String>,
    pub beschwerden: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTermin {
    pub datum: Option<String>,
    pub uhrzeit: Option<String>,
    pub art: Option<TerminArt>,
    pub status: Option<TerminStatus>,
    pub notizen: Option<String>,
    pub beschwerden: Option<String>,
    pub arzt_id: Option<String>,
}
