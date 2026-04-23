use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Rezept {
    pub id: String,
    pub patient_id: String,
    pub arzt_id: String,
    pub medikament: String,
    pub wirkstoff: Option<String>,
    pub dosierung: String,
    pub dauer: String,
    pub hinweise: Option<String>,
    pub ausgestellt_am: NaiveDate,
    pub status: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateRezept {
    pub patient_id: String,
    pub arzt_id: String,
    pub medikament: String,
    pub wirkstoff: Option<String>,
    pub dosierung: String,
    pub dauer: String,
    pub hinweise: Option<String>,
}
