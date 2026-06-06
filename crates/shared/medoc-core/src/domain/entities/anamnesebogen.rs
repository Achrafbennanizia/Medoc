use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Anamnesebogen {
    pub id: String,
    pub patient_id: String,
    pub antworten: String, // JSON string
    pub unterschrieben: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct SaveAnamnesebogen {
    pub patient_id: String,
    pub antworten: serde_json::Value,
    pub unterschrieben: bool,
}
