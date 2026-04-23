use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Untersuchung {
    pub id: String,
    pub akte_id: String,
    pub beschwerden: Option<String>,
    pub ergebnisse: Option<String>,
    pub diagnose: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateUntersuchung {
    pub akte_id: String,
    pub beschwerden: Option<String>,
    pub ergebnisse: Option<String>,
    pub diagnose: Option<String>,
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
}

#[derive(Debug, Deserialize)]
pub struct CreateBehandlung {
    pub akte_id: String,
    pub art: String,
    pub beschreibung: Option<String>,
    pub zaehne: Option<String>,
    pub material: Option<String>,
    pub notizen: Option<String>,
}
