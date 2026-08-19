use crate::domain::enums::{Sex, PatientStatus};
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub sex: String,
    pub insurance_number: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreatePatient {
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub sex: Sex,
    pub insurance_number: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePatient {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub status: Option<PatientStatus>,
}
