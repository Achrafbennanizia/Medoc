//! Persisted day-close runs (cash reconciliation, metrics) — one row per close protocol.
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DayCloseProtocol {
    pub id: String,
    pub as_of_date: String,
    pub counted_eur: Option<f64>,
    pub system_cash_eur: f64,
    pub system_income_eur: f64,
    pub variance_eur: Option<f64>,
    /// 0/1: counted amount equals system cash total (client tolerance).
    pub cash_matches: i64,
    /// Count of relevant day payments (paid / partial, not cancelled).
    pub day_payment_count: i64,
    /// Of those, marked cash-desk verified.
    pub cash_verified_count: i64,
    /// 0/1: all relevant day payments verified.
    pub all_payments_verified: i64,
    #[serde(default)]
    pub note: Option<String>,
    pub recorded_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateDayCloseProtocol {
    pub as_of_date: String,
    pub counted_eur: Option<f64>,
    pub system_cash_eur: f64,
    pub system_income_eur: f64,
    pub variance_eur: Option<f64>,
    pub cash_matches: i64,
    pub day_payment_count: i64,
    pub cash_verified_count: i64,
    pub all_payments_verified: i64,
    #[serde(default)]
    pub note: Option<String>,
}
