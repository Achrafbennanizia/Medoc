use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Untersuchung {
    pub id: String,
    pub akte_id: String,
    pub beschwerden: Option<String>,
    pub ergebnisse: Option<String>,
    pub diagnose: Option<String>,
    pub untersuchungsnummer: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateUntersuchung {
    pub akte_id: String,
    pub beschwerden: Option<String>,
    pub ergebnisse: Option<String>,
    pub diagnose: Option<String>,
    #[serde(default)]
    pub untersuchungsnummer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Behandlung {
    pub id: String,
    pub akte_id: String,
    pub art: String,
    pub beschreibung: Option<String>,
    pub zaehne: Option<String>,
    pub material: Option<String>,
    pub notizen: Option<String>,
    pub created_at: NaiveDateTime,
    pub kategorie: Option<String>,
    pub leistungsname: Option<String>,
    pub behandlungsnummer: Option<String>,
    pub sitzung: Option<i64>,
    pub behandlung_status: Option<String>,
    pub gesamtkosten: Option<f64>,
    pub termin_erforderlich: Option<i64>,
    pub behandlung_datum: Option<String>,
}

/// Vollständiges Update einer bestehenden Behandlungszeile (Aktenverlauf).
#[derive(Debug, Deserialize)]
pub struct UpdateBehandlung {
    pub id: String,
    pub art: String,
    pub beschreibung: Option<String>,
    pub zaehne: Option<String>,
    pub material: Option<String>,
    pub notizen: Option<String>,
    #[serde(default)]
    pub kategorie: Option<String>,
    #[serde(default)]
    pub leistungsname: Option<String>,
    #[serde(default)]
    pub behandlungsnummer: Option<String>,
    #[serde(default)]
    pub sitzung: Option<i64>,
    #[serde(default)]
    pub behandlung_status: Option<String>,
    #[serde(default)]
    pub gesamtkosten: Option<f64>,
    #[serde(default)]
    pub termin_erforderlich: Option<bool>,
    #[serde(default)]
    pub behandlung_datum: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUntersuchung {
    pub id: String,
    pub beschwerden: Option<String>,
    pub ergebnisse: Option<String>,
    pub diagnose: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBehandlung {
    pub akte_id: String,
    pub art: String,
    pub beschreibung: Option<String>,
    pub zaehne: Option<String>,
    pub material: Option<String>,
    pub notizen: Option<String>,
    #[serde(default)]
    pub kategorie: Option<String>,
    #[serde(default)]
    pub leistungsname: Option<String>,
    #[serde(default)]
    pub behandlungsnummer: Option<String>,
    #[serde(default)]
    pub sitzung: Option<i64>,
    #[serde(default)]
    pub behandlung_status: Option<String>,
    #[serde(default)]
    pub gesamtkosten: Option<f64>,
    #[serde(default)]
    pub termin_erforderlich: Option<bool>,
    #[serde(default)]
    pub behandlung_datum: Option<String>,
}
