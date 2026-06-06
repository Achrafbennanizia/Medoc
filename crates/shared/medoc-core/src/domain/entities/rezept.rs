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
    pub pzn: Option<String>,
    pub darreichungsform: Option<String>,
    pub packungsgroesse: Option<String>,
    pub menge: Option<i32>,
    pub aut_idem: Option<bool>,
    pub rezept_typ: Option<String>,
    pub icd10_code: Option<String>,
    pub verordnender_arzt_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRezept {
    pub id: String,
    pub medikament: String,
    pub wirkstoff: Option<String>,
    pub dosierung: String,
    pub dauer: String,
    pub hinweise: Option<String>,
    pub pzn: Option<String>,
    pub darreichungsform: Option<String>,
    pub packungsgroesse: Option<String>,
    pub menge: Option<i32>,
    pub aut_idem: Option<bool>,
    pub rezept_typ: Option<String>,
    pub icd10_code: Option<String>,
    pub verordnender_arzt_id: Option<String>,
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
    pub pzn: Option<String>,
    pub darreichungsform: Option<String>,
    pub packungsgroesse: Option<String>,
    pub menge: Option<i32>,
    pub aut_idem: Option<bool>,
    pub rezept_typ: Option<String>,
    pub icd10_code: Option<String>,
    pub verordnender_arzt_id: Option<String>,
}
