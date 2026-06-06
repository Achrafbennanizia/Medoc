use crate::domain::enums::{Geschlecht, PatientStatus};
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub geburtsdatum: NaiveDate,
    pub geschlecht: String,
    pub versicherungsnummer: String,
    pub telefon: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreatePatient {
    pub name: String,
    pub geburtsdatum: NaiveDate,
    pub geschlecht: Geschlecht,
    pub versicherungsnummer: String,
    pub telefon: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePatient {
    pub name: Option<String>,
    pub telefon: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
    pub status: Option<PatientStatus>,
}
