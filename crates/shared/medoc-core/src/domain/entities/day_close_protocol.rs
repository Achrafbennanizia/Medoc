//! Persisted day-close runs (cash reconciliation, metrics) — one row per close protocol.
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DayCloseProtocol {
    pub id: String,
    pub as_of_date: String,
    pub counted_eur: Option<f64>,
    pub system_cash_eur: f64,
    #[serde(alias = "income_laut_system_eur", alias = "incomeLautSystemEur")]
    pub system_income_eur: f64,
    #[serde(alias = "abweichung_eur", alias = "abweichungEur")]
    pub variance_eur: Option<f64>,
    /// 0/1: counted amount equals system cash total (client tolerance).
    pub cash_matches: i64,
    /// Count of relevant day payments (paid / partial, not cancelled).
    #[serde(alias = "anzahl_payments_tag", alias = "anzahlPaymentsTag")]
    pub day_payment_count: i64,
    /// Of those, marked cash-desk verified.
    #[serde(alias = "anzahl_cash_geprueft", alias = "anzahlCashGeprueft")]
    pub cash_verified_count: i64,
    /// 0/1: all relevant day payments verified.
    #[serde(alias = "alle_payments_geprueft", alias = "allePaymentsGeprueft")]
    pub all_payments_verified: i64,
    #[serde(default, alias = "notiz")]
    pub note: Option<String>,
    #[serde(alias = "protokolliert_at", alias = "protokolliertAt")]
    pub recorded_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateDayCloseProtocol {
    pub as_of_date: String,
    pub counted_eur: Option<f64>,
    pub system_cash_eur: f64,
    #[serde(alias = "income_laut_system_eur", alias = "incomeLautSystemEur")]
    pub system_income_eur: f64,
    #[serde(alias = "abweichung_eur", alias = "abweichungEur")]
    pub variance_eur: Option<f64>,
    pub cash_matches: i64,
    #[serde(alias = "anzahl_payments_tag", alias = "anzahlPaymentsTag")]
    pub day_payment_count: i64,
    #[serde(alias = "anzahl_cash_geprueft", alias = "anzahlCashGeprueft")]
    pub cash_verified_count: i64,
    #[serde(alias = "alle_payments_geprueft", alias = "allePaymentsGeprueft")]
    pub all_payments_verified: i64,
    #[serde(default, alias = "notiz")]
    pub note: Option<String>,
}
