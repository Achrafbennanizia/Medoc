//! Persisted output of the balance-sheet wizard (FA-FIN-09/10).
//!
//! The wizard now writes a single immutable snapshot row per closing run; the
//! frontend can list, view, or audit prior snapshots without re-running the
//! workflow against live data.

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BalanceSheetSnapshot {
    pub id: String,
    pub created_by: String,
    pub period: String,
    pub kind: String,
    pub label: String,
    pub income_cents: i64,
    pub expenses_cents: i64,
    pub balance_cents: i64,
    pub payload: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateBalanceSheetSnapshot {
    pub period: String,
    pub kind: String,
    pub label: String,
    pub income_cents: i64,
    pub expenses_cents: i64,
    /// Arbitrary JSON document with the full wizard state (selected payments,
    /// contracts, expenses, master data, …). Stored verbatim as a string so the
    /// schema does not have to evolve every time the wizard adds a field.
    pub payload: serde_json::Value,
}
