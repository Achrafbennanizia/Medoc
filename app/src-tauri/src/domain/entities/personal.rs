use crate::domain::enums::Rolle;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Minimal staff row for Arzt dropdowns (no e-mail / hash).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AerztSummary {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Personal {
    pub id: String,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub passwort_hash: String,
    pub rolle: String,
    pub taetigkeitsbereich: Option<String>,
    pub fachrichtung: Option<String>,
    pub telefon: Option<String>,
    pub verfuegbar: bool,
    #[serde(skip_serializing)]
    pub totp_secret: Option<String>,
    pub totp_enrolled_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreatePersonal {
    pub name: String,
    pub email: String,
    pub passwort: String,
    pub rolle: Rolle,
    pub taetigkeitsbereich: Option<String>,
    pub fachrichtung: Option<String>,
    pub telefon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePersonal {
    pub name: Option<String>,
    pub email: Option<String>,
    pub rolle: Option<Rolle>,
    pub taetigkeitsbereich: Option<String>,
    pub fachrichtung: Option<String>,
    pub telefon: Option<String>,
    pub verfuegbar: Option<bool>,
}

/// Selbstpflege (Einstellungen » Konto) — keine Rolle / kein `verfuegbar`.
#[derive(Debug, Deserialize)]
pub struct UpdateOwnProfile {
    pub name: Option<String>,
    pub email: Option<String>,
    pub taetigkeitsbereich: Option<String>,
    pub fachrichtung: Option<String>,
    pub telefon: Option<String>,
}
