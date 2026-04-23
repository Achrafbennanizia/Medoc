use crate::domain::enums::ZahlungsArt;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Zahlung {
    pub id: String,
    pub patient_id: String,
    pub betrag: f64,
    pub zahlungsart: String,
    pub status: String,
    pub leistung_id: Option<String>,
    pub beschreibung: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateZahlung {
    pub patient_id: String,
    pub betrag: f64,
    pub zahlungsart: ZahlungsArt,
    pub leistung_id: Option<String>,
    pub beschreibung: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bilanz {
    pub einnahmen: f64,
    pub ausstehend: f64,
    pub storniert: f64,
    pub anzahl_zahlungen: i64,
}
