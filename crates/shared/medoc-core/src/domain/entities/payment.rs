use crate::domain::enums::PaymentMethod;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Payment {
    pub id: String,
    pub patient_id: String,
    pub amount: f64,
    pub payment_method: String,
    pub status: String,
    pub service_item_id: Option<String>,
    pub description: Option<String>,
    pub treatment_id: Option<String>,
    pub examination_id: Option<String>,
    /// Expected total (e.g. from Treatment.total_cost), for PARTIALLY_PAID/PAID.
    pub amount_expected: Option<f64>,
    /// Day-close / cash check: manually confirmed (0/1).
    pub cash_verified: i64,
    pub created_at: NaiveDateTime,
}

/// Only outstanding / partially paid payments may be edited.
#[derive(Debug, Deserialize)]
pub struct UpdatePayment {
    pub id: String,
    pub amount: f64,
    pub payment_method: PaymentMethod,
    pub service_item_id: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePayment {
    pub patient_id: String,
    pub amount: f64,
    pub payment_method: PaymentMethod,
    pub service_item_id: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub treatment_id: Option<String>,
    #[serde(default)]
    pub examination_id: Option<String>,
    #[serde(default)]
    pub amount_expected: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceSheet {
    pub income: f64,
    pub outstanding: f64,
    pub cancelled: f64,
    pub payment_count: i64,
}
