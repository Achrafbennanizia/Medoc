use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnamnesisForm {
    pub id: String,
    pub patient_id: String,
    pub answers: String, // JSON string
    pub signed: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct SaveAnamnesisForm {
    pub patient_id: String,
    pub answers: serde_json::Value,
    pub signed: bool,
}
