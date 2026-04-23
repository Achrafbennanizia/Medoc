use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Patientenakte {
    pub id: String,
    pub patient_id: String,
    pub status: String,
    pub diagnose: Option<String>,
    pub befunde: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
