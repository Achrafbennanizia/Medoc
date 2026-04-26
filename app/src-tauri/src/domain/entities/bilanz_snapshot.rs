//! Persisted output of the Bilanz-Assistent (FA-FIN-09/10).
//!
//! The wizard now writes a single immutable snapshot row per closing run; the
//! frontend can list, view, or audit prior snapshots without re-running the
//! workflow against live data.

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BilanzSnapshot {
    pub id: String,
    pub created_by: String,
    pub zeitraum: String,
    pub typ: String,
    pub label: String,
    pub einnahmen_cents: i64,
    pub ausgaben_cents: i64,
    pub saldo_cents: i64,
    pub payload: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateBilanzSnapshot {
    pub zeitraum: String,
    pub typ: String,
    pub label: String,
    pub einnahmen_cents: i64,
    pub ausgaben_cents: i64,
    /// Arbitrary JSON document with the full wizard state (selected payments,
    /// vertraege, ausgaben, stammdaten, …). Stored verbatim as a string so the
    /// schema does not have to evolve every time the wizard adds a field.
    pub payload: serde_json::Value,
}
