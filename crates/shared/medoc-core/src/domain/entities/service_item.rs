use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ServiceItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub price: f64,
    pub active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateServiceItem {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub price: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateServiceItem {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub price: Option<f64>,
    pub active: Option<bool>,
}
