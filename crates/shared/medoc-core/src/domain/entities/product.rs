use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub price: f64,
    pub stock: i32,
    pub min_stock: i32,
    pub active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateProduct {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub price: f64,
    pub stock: i32,
    pub min_stock: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProduct {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub price: Option<f64>,
    pub stock: Option<i32>,
    pub min_stock: Option<i32>,
    pub active: Option<bool>,
}
