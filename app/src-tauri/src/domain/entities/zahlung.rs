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
    pub behandlung_id: Option<String>,
    pub untersuchung_id: Option<String>,
    /// Erwarteter Gesamtbetrag (z. B. aus Behandlung.gesamtkosten), für TEILBEZAHLT/BEZAHLT.
    pub betrag_erwartet: Option<f64>,
    /// Tagesabschluss / Kassensturz: manuell bestätigt (0/1).
    pub kasse_geprueft: i64,
    pub created_at: NaiveDateTime,
}

/// Nur ausstehende / teilbezahlte Zahlungen dürfen inhaltlich geändert werden.
#[derive(Debug, Deserialize)]
pub struct UpdateZahlung {
    pub id: String,
    pub betrag: f64,
    pub zahlungsart: ZahlungsArt,
    pub leistung_id: Option<String>,
    pub beschreibung: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateZahlung {
    pub patient_id: String,
    pub betrag: f64,
    pub zahlungsart: ZahlungsArt,
    pub leistung_id: Option<String>,
    pub beschreibung: Option<String>,
    #[serde(default)]
    pub behandlung_id: Option<String>,
    #[serde(default)]
    pub untersuchung_id: Option<String>,
    #[serde(default)]
    pub betrag_erwartet: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bilanz {
    pub einnahmen: f64,
    pub ausstehend: f64,
    pub storniert: f64,
    pub anzahl_zahlungen: i64,
}
