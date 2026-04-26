//! Purchase orders (Bestellungen) for clinical consumables / inventory
//! replenishment. Backs the `bestellungen` page, which previously held only a
//! mocked seed in the frontend.
//!
//! Status lifecycle: `OFFEN` → `UNTERWEGS` → `GELIEFERT` (or `STORNIERT`).
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Bestellung {
    pub id: String,
    /// Human-readable order number (`B-2026-04-0001`). Auto-generated when empty.
    pub bestellnummer: Option<String>,
    pub lieferant: String,
    /// Optional pharma rep / contact at the supplier (per WF 45).
    pub pharmaberater: Option<String>,
    pub artikel: String,
    pub status: String,
    pub erwartet_am: Option<String>,
    pub geliefert_am: Option<String>,
    pub menge: i32,
    pub einheit: Option<String>,
    pub bemerkung: Option<String>,
    /// Auftragssumme bei Erfassung (Lager-Einzelpreis × Menge), für Finanzen/Ausgaben.
    pub gesamtbetrag: Option<f64>,
    pub created_by: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateBestellung {
    pub lieferant: String,
    pub artikel: String,
    pub erwartet_am: Option<String>,
    pub menge: i32,
    pub einheit: Option<String>,
    pub bemerkung: Option<String>,
    #[serde(default)]
    pub bestellnummer: Option<String>,
    #[serde(default)]
    pub pharmaberater: Option<String>,
    /// Optional; UI rechnet aus Produktpreis × Menge.
    #[serde(default)]
    pub gesamtbetrag: Option<f64>,
}

/// Patch DTO for editing existing orders. Each `Some(_)` field replaces the
/// stored value; `None` leaves it untouched. `Some(Some(""))` clears optional
/// fields explicitly.
#[derive(Debug, Deserialize, Default)]
pub struct UpdateBestellung {
    pub lieferant: Option<String>,
    pub artikel: Option<String>,
    pub menge: Option<i32>,
    pub einheit: Option<Option<String>>,
    pub erwartet_am: Option<Option<String>>,
    pub bemerkung: Option<Option<String>>,
    pub bestellnummer: Option<Option<String>>,
    pub pharmaberater: Option<Option<String>>,
}

/// Allowed status transitions enforced by the service layer.
pub const STATUS_OFFEN: &str = "OFFEN";
pub const STATUS_UNTERWEGS: &str = "UNTERWEGS";
pub const STATUS_GELIEFERT: &str = "GELIEFERT";
pub const STATUS_STORNIERT: &str = "STORNIERT";

pub fn is_valid_status(s: &str) -> bool {
    matches!(s, STATUS_OFFEN | STATUS_UNTERWEGS | STATUS_GELIEFERT | STATUS_STORNIERT)
}
