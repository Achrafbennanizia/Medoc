use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Attest {
    pub id: String,
    pub patient_id: String,
    pub arzt_id: String,
    pub typ: String,
    pub inhalt: String,
    pub gueltig_von: NaiveDate,
    pub gueltig_bis: NaiveDate,
    pub ausgestellt_am: NaiveDate,
    pub created_at: NaiveDateTime,
    pub icd10_code: Option<String>,
    pub erst_oder_folge: Option<String>,
    pub arbeitgeber: Option<String>,
    pub ausstellender_arzt_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAttest {
    pub patient_id: String,
    pub arzt_id: String,
    pub typ: String,
    pub inhalt: String,
    pub gueltig_von: NaiveDate,
    pub gueltig_bis: NaiveDate,
    pub icd10_code: Option<String>,
    pub erst_oder_folge: Option<String>,
    pub arbeitgeber: Option<String>,
    pub ausstellender_arzt_id: Option<String>,
}
