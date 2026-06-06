use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Leistung {
    pub id: String,
    pub name: String,
    pub beschreibung: Option<String>,
    pub kategorie: String,
    pub preis: f64,
    pub aktiv: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateLeistung {
    pub name: String,
    pub beschreibung: Option<String>,
    pub kategorie: String,
    pub preis: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLeistung {
    pub name: Option<String>,
    pub beschreibung: Option<String>,
    pub kategorie: Option<String>,
    pub preis: Option<f64>,
    pub aktiv: Option<bool>,
}
