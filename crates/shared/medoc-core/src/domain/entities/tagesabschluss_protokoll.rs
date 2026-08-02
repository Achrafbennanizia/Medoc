//! Persisted day-close runs (cash reconciliation, metrics) — one row per close protocol.
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TagesabschlussProtokoll {
    pub id: String,
    pub stichtag: String,
    pub gezaehlt_eur: Option<f64>,
    pub bar_laut_system_eur: f64,
    pub einnahmen_laut_system_eur: f64,
    pub abweichung_eur: Option<f64>,
    /// 0/1: counted amount equals system cash total (client tolerance).
    pub bar_stimmt: i64,
    /// Count of relevant day payments (paid / partial, not cancelled).
    pub anzahl_zahlungen_tag: i64,
    /// Of those, marked cash-desk verified.
    pub anzahl_kasse_geprueft: i64,
    /// 0/1: all relevant day payments verified.
    pub alle_zahlungen_geprueft: i64,
    pub notiz: Option<String>,
    pub protokolliert_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateTagesabschlussProtokoll {
    pub stichtag: String,
    pub gezaehlt_eur: Option<f64>,
    pub bar_laut_system_eur: f64,
    pub einnahmen_laut_system_eur: f64,
    pub abweichung_eur: Option<f64>,
    pub bar_stimmt: i64,
    pub anzahl_zahlungen_tag: i64,
    pub anzahl_kasse_geprueft: i64,
    pub alle_zahlungen_geprueft: i64,
    pub notiz: Option<String>,
}
