//! Open items (Offene Posten) and payment reminders.
//!
//! An invoice's payment state is derived, never stored: the invoice lines
//! carry `source_ref` (`treatment:<id>` / `examination:<id>`), payments
//! carry the same treatment/examination id. Paid = non-cancelled payments
//! for those records, capped at the invoice total.
//!
//! Reminders (Zahlungserinnerung, 1. Mahnung, 2. Mahnung) are numbered
//! documents (`MA-YYYY-nnnnnn`) stored in `payment_reminder`, immutable,
//! one level after the other and only once the previous deadline passed.

use std::collections::HashMap;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{SqliteConnection, SqlitePool};

use super::cash_book::fmt_eur;
use super::finance_schema;
use super::issue::{require_permission, year_now, WATERMARK_COPY, WATERMARK_PREVIEW};
use super::practice_profile::{practice_logo, PracticeProfile};
use crate::application::auth_service::Session;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::issued_document::{self as repo, sha256_hex};
use crate::infrastructure::pdf::{render_clinical_layout_with_logo, ClinicalPdfLayout, Invoice};

use super::issue::IssuedPdf;

mod reminders;
pub use reminders::*;

pub const REMINDER_PREFIX: &str = "MA";
/// Payment-reminder prefixes: German (Mahnung), French for France and Morocco (relance), English.
pub const REMINDER_PREFIXES: [&str; 3] = [REMINDER_PREFIX, "RP", "REM"];

pub fn reminder_prefix(jurisdiction: Option<&str>) -> &'static str {
    match jurisdiction {
        Some("fr") | Some("ma") => "RP",
        Some("eu") => "REM",
        _ => REMINDER_PREFIX,
    }
}
/// Days the patient gets after each reminder.
pub const DEFAULT_REMINDER_DAYS: i64 = 14;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceStatusRow {
    pub document_id: String,
    pub document_number: String,
    /// INVOICE | CANCELLATION
    pub kind: String,
    /// ISSUED | CANCELLED (registry status)
    pub status: String,
    pub patient_id: Option<String>,
    pub patient_name: String,
    pub recipient_name: String,
    pub date: String,
    pub due_date: Option<String>,
    pub total_cents: i64,
    pub paid_cents: i64,
    pub open_cents: i64,
    /// OPEN | PARTIAL | PAID | OVERDUE | CANCELLED | CANCELLATION | UNLINKED
    pub payment_state: String,
    pub cancels_number: Option<String>,
    pub cancelled_by_number: Option<String>,
    pub reminder_level: i64,
    pub last_reminder_number: Option<String>,
    pub last_reminder_pay_by: Option<String>,
    /// Level the next reminder would have, if one may be sent today.
    pub next_reminder_level: Option<i64>,
    pub issued_at: String,
    /// Full stored invoice (for the read view and drafts).
    pub invoice: Value,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct InvoiceListFilter {
    pub patient_id: Option<String>,
    /// Only invoices with something left to pay.
    pub open_only: bool,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReminderArgs {
    pub invoice_document_id: String,
    pub preview: bool,
    /// Reminder fee in cents (only from the 1. Mahnung on, once in default).
    pub fee_cents: i64,
    /// Days to pay; default 14.
    pub days: Option<i64>,
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}

fn source_refs(inv: &Invoice) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for l in &inv.lines {
        if let Some((t, id)) = l.source_ref.as_deref().and_then(|r| r.split_once(':')) {
            out.push((t.to_string(), id.to_string()));
        }
    }
    out.sort();
    out.dedup();
    out
}

async fn paid_for_refs(pool: &SqlitePool, refs: &[(String, String)]) -> Result<i64, AppError> {
    let mut total = 0i64;
    for (t, id) in refs {
        let col = match t.as_str() {
            "treatment" => "treatment_id",
            "examination" => "examination_id",
            _ => continue,
        };
        let cents: i64 = sqlx::query_scalar(&format!(
            "SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) FROM payment
              WHERE {col} = ?1 AND UPPER(COALESCE(status,'')) <> 'CANCELLED'"
        ))
        .bind(id)
        .fetch_one(pool)
        .await?;
        total += cents;
    }
    Ok(total)
}

#[derive(sqlx::FromRow)]
struct DocRow {
    id: String,
    kind: String,
    document_number: String,
    patient_id: Option<String>,
    payload_json: String,
    status: String,
    cancels_id: Option<String>,
    issued_at: String,
}

async fn last_reminder(
    pool: &SqlitePool,
    invoice_id: &str,
) -> Result<Option<(i64, String, String)>, AppError> {
    Ok(sqlx::query_as(
        "SELECT level, document_number, pay_by FROM payment_reminder
          WHERE invoice_document_id = ?1 ORDER BY level DESC, issued_at DESC LIMIT 1",
    )
    .bind(invoice_id)
    .fetch_optional(pool)
    .await?)
}

async fn status_row(pool: &SqlitePool, d: DocRow) -> Result<InvoiceStatusRow, AppError> {
    let inv: Invoice = serde_json::from_str(&d.payload_json).unwrap_or_default();
    let invoice_value: Value = serde_json::from_str(&d.payload_json).unwrap_or(Value::Null);
    let total = inv.total_cents();
    let refs = source_refs(&inv);
    let cancelled_by: Option<String> = sqlx::query_scalar(
        "SELECT document_number FROM issued_document WHERE cancels_id = ?1 LIMIT 1",
    )
    .bind(&d.id)
    .fetch_optional(pool)
    .await?;
    let reminder = last_reminder(pool, &d.id).await?;
    let (paid, state) = if d.kind == "CANCELLATION" {
        (0, "CANCELLATION".to_string())
    } else if d.status == "CANCELLED" {
        (0, "CANCELLED".to_string())
    } else if refs.is_empty() {
        (0, "UNLINKED".to_string())
    } else {
        let paid = paid_for_refs(pool, &refs).await?.min(total).max(0);
        let overdue = inv
            .due_date
            .as_deref()
            .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
            .map(|due| today() > due)
            .unwrap_or(false);
        let st = if paid >= total {
            "PAID"
        } else if overdue {
            "OVERDUE"
        } else if paid > 0 {
            "PARTIAL"
        } else {
            "OPEN"
        };
        (paid, st.to_string())
    };
    let open = if matches!(state.as_str(), "OPEN" | "PARTIAL" | "OVERDUE") {
        (total - paid).max(0)
    } else {
        0
    };
    let next_level = next_reminder_level(&state, reminder.as_ref());
    Ok(InvoiceStatusRow {
        document_id: d.id,
        document_number: d.document_number,
        kind: d.kind,
        status: d.status,
        patient_id: d.patient_id,
        patient_name: inv.patient_name.clone(),
        recipient_name: inv.recipient_name.clone(),
        date: inv.date.clone(),
        due_date: inv.due_date.clone(),
        total_cents: total,
        paid_cents: paid,
        open_cents: open,
        payment_state: state,
        cancels_number: inv.cancels_number.clone(),
        cancelled_by_number: cancelled_by,
        reminder_level: reminder.as_ref().map(|r| r.0).unwrap_or(0),
        last_reminder_number: reminder.as_ref().map(|r| r.1.clone()),
        last_reminder_pay_by: reminder.as_ref().map(|r| r.2.clone()),
        next_reminder_level: next_level,
        issued_at: d.issued_at,
        invoice: invoice_value,
    })
}

fn next_reminder_level(state: &str, last: Option<&(i64, String, String)>) -> Option<i64> {
    if state != "OVERDUE" {
        return None;
    }
    match last {
        None => Some(1),
        Some((level, _, pay_by)) => {
            let passed = NaiveDate::parse_from_str(pay_by, "%Y-%m-%d")
                .map(|d| today() > d)
                .unwrap_or(false);
            (passed && *level < 3).then_some(level + 1)
        }
    }
}

/// Invoices and cancellations with their payment state, newest first.
pub async fn list_invoices(
    pool: &SqlitePool,
    session: &Session,
    filter: InvoiceListFilter,
) -> Result<Vec<InvoiceStatusRow>, AppError> {
    require_permission(session, "billing.read")?;
    finance_schema::ensure(pool).await?;
    let limit = filter.limit.unwrap_or(200).clamp(1, 1000);
    let rows = sqlx::query_as::<_, DocRow>(
        "SELECT id, kind, document_number, patient_id, payload_json, status, cancels_id, issued_at
           FROM issued_document
          WHERE kind IN ('INVOICE','CANCELLATION') AND (?1 IS NULL OR patient_id = ?1)
          ORDER BY issued_at DESC LIMIT ?2",
    )
    .bind(filter.patient_id.as_deref())
    .bind(limit)
    .fetch_all(pool)
    .await?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let _ = &r.cancels_id;
        let row = status_row(pool, r).await?;
        if filter.open_only && row.open_cents == 0 {
            continue;
        }
        out.push(row);
    }
    Ok(out)
}

pub async fn invoice_status(
    pool: &SqlitePool,
    session: &Session,
    document_id: &str,
) -> Result<InvoiceStatusRow, AppError> {
    require_permission(session, "billing.read")?;
    finance_schema::ensure(pool).await?;
    let r = sqlx::query_as::<_, DocRow>(
        "SELECT id, kind, document_number, patient_id, payload_json, status, cancels_id, issued_at
           FROM issued_document WHERE id = ?1 AND kind IN ('INVOICE','CANCELLATION')",
    )
    .bind(document_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Invoice".into()))?;
    status_row(pool, r).await
}

/// Open receivables at a cut-off date, for the period report.
pub async fn open_receivables_cents(
    pool: &SqlitePool,
    as_of: &str,
) -> Result<(i64, i64), AppError> {
    let rows = sqlx::query_as::<_, DocRow>(
        "SELECT id, kind, document_number, patient_id, payload_json, status, cancels_id, issued_at
           FROM issued_document WHERE kind = 'INVOICE' AND status = 'ISSUED' AND substr(issued_at,1,10) <= ?1",
    )
    .bind(as_of)
    .fetch_all(pool)
    .await?;
    let mut open = 0i64;
    let mut count = 0i64;
    let mut cache: HashMap<String, i64> = HashMap::new();
    for r in rows {
        let inv: Invoice = serde_json::from_str(&r.payload_json).unwrap_or_default();
        let refs = source_refs(&inv);
        if refs.is_empty() {
            continue;
        }
        let key = format!("{refs:?}");
        let paid = match cache.get(&key) {
            Some(p) => *p,
            None => {
                let p = paid_for_refs(pool, &refs).await?;
                cache.insert(key, p);
                p
            }
        };
        let o = (inv.total_cents() - paid).max(0);
        if o > 0 {
            open += o;
            count += 1;
        }
    }
    Ok((open, count))
}
