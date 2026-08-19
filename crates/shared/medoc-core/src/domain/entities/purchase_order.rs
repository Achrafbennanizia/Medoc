//! Purchase orders (PurchaseOrders) for clinical consumables / inventory
//! replenishment. Backs the `purchase-orders` page, which previously held only a
//! mocked seed in the frontend.
//!
//! Status lifecycle: `OPEN` → `IN_TRANSIT` → `DELIVERED` (or `CANCELLED`).
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PurchaseOrder {
    pub id: String,
    /// Human-readable order number (`B-2026-04-0001`). Auto-generated when empty.
    pub order_number: Option<String>,
    pub supplier: String,
    /// Optional pharma rep / contact at the supplier (per WF 45).
    pub pharma_consultant: Option<String>,
    pub item: String,
    pub status: String,
    pub expected_on: Option<String>,
    pub delivered_on: Option<String>,
    pub quantity: i32,
    pub unit: Option<String>,
    pub remark: Option<String>,
    /// Order total at capture (stock unit price × quantity), for finance/expenses.
    pub total_amount: Option<f64>,
    pub created_by: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreatePurchaseOrder {
    pub supplier: String,
    pub item: String,
    pub expected_on: Option<String>,
    pub quantity: i32,
    pub unit: Option<String>,
    pub remark: Option<String>,
    #[serde(default)]
    pub order_number: Option<String>,
    #[serde(default)]
    pub pharma_consultant: Option<String>,
    /// Optional; UI derives from product price × quantity.
    #[serde(default)]
    pub total_amount: Option<f64>,
}

/// Patch DTO for editing existing orders. Each `Some(_)` field replaces the
/// stored value; `None` leaves it untouched. `Some(Some(""))` clears optional
/// fields explicitly.
#[derive(Debug, Deserialize, Default)]
pub struct UpdatePurchaseOrder {
    pub supplier: Option<String>,
    pub item: Option<String>,
    pub quantity: Option<i32>,
    pub unit: Option<Option<String>>,
    pub expected_on: Option<Option<String>>,
    pub remark: Option<Option<String>>,
    pub order_number: Option<Option<String>>,
    pub pharma_consultant: Option<Option<String>>,
}

/// Allowed status transitions enforced by the service layer.
pub const STATUS_OPEN: &str = "OPEN";
pub const STATUS_IN_TRANSIT: &str = "IN_TRANSIT";
pub const STATUS_DELIVERED: &str = "DELIVERED";
pub const STATUS_CANCELLED: &str = "CANCELLED";

pub fn is_valid_status(s: &str) -> bool {
    matches!(
        s,
        STATUS_OPEN | STATUS_IN_TRANSIT | STATUS_DELIVERED | STATUS_CANCELLED
    )
}
