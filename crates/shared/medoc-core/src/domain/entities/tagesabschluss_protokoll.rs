//! Persisted Tagesabschluss runs (Bargeldabgleich, Kennzahlen) — pro Protokollierung eine Zeile.
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
    /// 0/1: gezählter Betrag = Bar-Summe laut System (Toleranz im Client).
    pub bar_stimmt: i64,
    /// Anzahl der relevanten Tageszahlungen (bezahlt / teilbezahlt, nicht storniert).
    pub anzahl_zahlungen_tag: i64,
    /// Davon als kassengeprüft markiert.
    pub anzahl_kasse_geprueft: i64,
    /// 0/1: alle relevanten Tageszahlungen geprüft.
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
