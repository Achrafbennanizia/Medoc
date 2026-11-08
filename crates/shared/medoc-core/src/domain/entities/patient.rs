use crate::domain::enums::{PatientStatus, Sex};
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub sex: String,
    /// Missing on CSV import (F52). Unique when present; SQLite allows several NULLs.
    pub insurance_number: Option<String>,
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
    /// F59: missing = keep, `null` or "" = clear.
    #[serde(default, deserialize_with = "crate::domain::serde_util::double_option")]
    pub phone: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::domain::serde_util::double_option")]
    pub email: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::domain::serde_util::double_option")]
    pub address: Option<Option<String>>,
    pub status: Option<PatientStatus>,
}
