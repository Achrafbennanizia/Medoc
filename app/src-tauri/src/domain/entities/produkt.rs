use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Produkt {
    pub id: String,
    pub name: String,
    pub beschreibung: Option<String>,
    pub kategorie: String,
    pub preis: f64,
    pub bestand: i32,
    pub mindestbestand: i32,
    pub aktiv: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateProdukt {
    pub name: String,
    pub beschreibung: Option<String>,
    pub kategorie: String,
    pub preis: f64,
    pub bestand: i32,
    pub mindestbestand: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProdukt {
    pub name: Option<String>,
    pub beschreibung: Option<String>,
    pub kategorie: Option<String>,
    pub preis: Option<f64>,
    pub bestand: Option<i32>,
    pub mindestbestand: Option<i32>,
    pub aktiv: Option<bool>,
}
