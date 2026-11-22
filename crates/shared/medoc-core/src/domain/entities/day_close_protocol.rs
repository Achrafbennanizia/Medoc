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
    // ---- Server-computed closing (NULL on protocols recorded before) ----
    #[sqlx(default)]
    #[serde(default)]
    pub status: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub period_from: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub opening_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub cash_receipts_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub cash_movements_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub expected_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub counted_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub variance_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub card_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub card_terminal_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub transfer_cents: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub receipt_count: Option<i64>,
    #[sqlx(default)]
    #[serde(default)]
    pub closed_by_name: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub document_number: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub corrects_id: Option<String>,
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
