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

fn reminder_title(level: i64) -> &'static str {
    match level {
        1 => "ZAHLUNGSERINNERUNG",
        2 => "1. MAHNUNG",
        _ => "2. MAHNUNG",
    }
}

fn reminder_layout(
    profile: &PracticeProfile,
    inv: &Invoice,
    row: &InvoiceStatusRow,
    level: i64,
    number: Option<&str>,
    fee: i64,
    pay_by: &str,
) -> Value {
    let today = Local::now().format("%d.%m.%Y").to_string();
    // The registry number is printed by the layout from `documentNumber`.
    let mut meta = vec![json!({"label": "Datum", "value": today})];
    meta.push(json!({"label": "Zu Rechnung", "value": row.document_number}));
    let intro = match level {
        1 => format!(
            "sicher ist Ihnen im Alltag entgangen, dass unsere Rechnung {} vom {} noch nicht vollständig beglichen ist. \
             Bitte überweisen Sie den offenen Betrag bis zum {}.",
            row.document_number, super::format_dmy(&row.date), super::format_dmy(pay_by)
        ),
        2 => format!(
            "leider konnten wir zu unserer Rechnung {} vom {} trotz unserer Zahlungserinnerung keinen vollständigen \
             Zahlungseingang feststellen. Sie befinden sich mit der Zahlung in Verzug (§ 286 BGB). \
             Bitte überweisen Sie den offenen Betrag bis zum {}.",
            row.document_number, super::format_dmy(&row.date), super::format_dmy(pay_by)
        ),
        _ => format!(
            "trotz Zahlungserinnerung und Mahnung ist unsere Rechnung {} vom {} weiterhin offen. \
             Wir bitten Sie letztmalig, den offenen Betrag bis zum {} zu überweisen. \
             Nach Ablauf dieser Frist werden wir die Forderung ohne weitere Ankündigung gerichtlich \
             oder durch ein Inkassounternehmen geltend machen; die dadurch entstehenden Kosten gehen zu Ihren Lasten.",
            row.document_number, super::format_dmy(&row.date), super::format_dmy(pay_by)
        ),
    };
    let mut totals = vec![
        json!({"label": "Rechnungsbetrag", "value": fmt_eur(row.total_cents)}),
        json!({"label": "Bereits gezahlt", "value": fmt_eur(row.paid_cents)}),
        json!({"label": "Offener Betrag", "value": fmt_eur(row.open_cents)}),
    ];
    if fee > 0 {
        totals.push(json!({"label": "Mahngebühr", "value": fmt_eur(fee)}));
    }
    totals
        .push(json!({"label": "Zu zahlen", "value": fmt_eur(row.open_cents + fee), "total": true}));
    let mut closing = vec![];
    let bank = profile.bank_lines();
    if !bank.is_empty() {
        closing.push(format!(
            "Bankverbindung: {}. Verwendungszweck: {}",
            bank.join(" · "),
            row.document_number
        ));
    }
    closing.push(
        "Sollten Sie den Betrag in den letzten Tagen bereits überwiesen haben, betrachten Sie dieses Schreiben bitte als gegenstandslos."
            .into(),
    );
    closing
        .push("Bei Fragen zur Rechnung erreichen Sie uns gern telefonisch oder per E-Mail.".into());
    let mut address = vec![inv.recipient_name.clone()];
    address.extend(inv.recipient_address.iter().cloned());
    json!({
        "kind": "reminder",
        "practiceLines": profile.minimal_letterhead_lines(),
        "footerLines": profile.minimal_footer_lines("de"),
        "addressLines": address,
        "documentTitle": reminder_title(level),
        "documentNumber": number,
        "metaLines": meta,
        "introParagraphs": ["Sehr geehrte Damen und Herren,", intro],
        "tables": [{
            "title": "Offene Rechnung",
            "headers": ["Rechnung", "Rechnungsdatum", "Fällig seit", "Behandelte Person", "Offen"],
            "rows": [[
                row.document_number,
                super::format_dmy(&row.date),
                row.due_date.as_deref().map(super::format_dmy).unwrap_or_default(),
                row.patient_name,
                fmt_eur(row.open_cents),
            ]]
        }],
        "totals": totals,
        "closingParagraphs": closing,
        "signatureLines": profile.minimal_signature_lines(),
        "locale": "de",
    })
}

/// Issue (or preview) the next reminder for an overdue invoice.
pub async fn issue_reminder(
    pool: &SqlitePool,
    session: &Session,
    args: ReminderArgs,
) -> Result<IssuedPdf, AppError> {
    require_permission(
        session,
        if args.preview {
            "billing.read"
        } else {
            "billing.create"
        },
    )?;
    finance_schema::ensure(pool).await?;
    let row = invoice_status(pool, session, &args.invoice_document_id).await?;
    if row.kind != "INVOICE" || row.status != "ISSUED" {
        return Err(AppError::validation_code("error.reminder.not_remindable"));
    }
    let level = row
        .next_reminder_level
        .ok_or_else(|| AppError::validation_code("error.reminder.not_due"))?;
    if args.fee_cents < 0 || (args.fee_cents > 0 && level < 2) {
        // A fee needs default (Verzug); the first reminder establishes it.
        return Err(AppError::validation_code("error.reminder.fee_not_allowed"));
    }
    let days = args.days.unwrap_or(DEFAULT_REMINDER_DAYS).clamp(7, 30);
    let pay_by = (today() + chrono::Duration::days(days))
        .format("%Y-%m-%d")
        .to_string();
    let inv: Invoice = serde_json::from_value(row.invoice.clone()).unwrap_or_default();
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    let logo = practice_logo(pool).await;

    let render = |v: &Value| -> Result<Vec<u8>, AppError> {
        let layout: ClinicalPdfLayout = serde_json::from_value(v.clone())
            .map_err(|e| AppError::Internal(format!("reminder layout: {e}")))?;
        render_clinical_layout_with_logo(&layout, logo.as_ref())
    };

    if args.preview {
        let mut v = reminder_layout(&profile, &inv, &row, level, None, args.fee_cents, &pay_by);
        v["watermark"] = Value::String(WATERMARK_PREVIEW.into());
        let bytes = render(&v)?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: sha256_hex(&bytes),
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        });
    }

    repo::ensure_numbering_authority(pool).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let mut conn_guard = pool.acquire().await?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *conn_guard)
        .await?;
    let result: Result<(String, Vec<u8>, String), AppError> = async {
        let conn: &mut SqliteConnection = &mut conn_guard;
        // Re-check inside the lock: two clicks must not send two reminders.
        let existing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM payment_reminder WHERE invoice_document_id = ?1 AND level >= ?2",
        )
        .bind(&row.document_id)
        .bind(level)
        .fetch_one(&mut *conn)
        .await?;
        if existing > 0 {
            return Err(AppError::validation_code("error.reminder.not_due"));
        }
        let number = repo::next_number(conn, reminder_prefix(profile.jurisdiction()), year_now()).await?;
        let v = reminder_layout(&profile, &inv, &row, level, Some(&number), args.fee_cents, &pay_by);
        // The reminder PDF carries `payment_reminder.id` as its document id.
        let bytes = crate::infrastructure::pdf::with_document_uid(&id, || render(&v))?;
        let sha = sha256_hex(&bytes);
        sqlx::query(
            "INSERT INTO payment_reminder (id, invoice_document_id, invoice_number, patient_id, level,
                document_number, open_cents, fee_cents, pay_by, sha256, payload_json, issued_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        )
        .bind(&id)
        .bind(&row.document_id)
        .bind(&row.document_number)
        .bind(&row.patient_id)
        .bind(level)
        .bind(&number)
        .bind(row.open_cents)
        .bind(args.fee_cents)
        .bind(&pay_by)
        .bind(&sha)
        .bind(v.to_string())
        .bind(&session.user_id)
        .execute(&mut *conn)
        .await?;
        Ok((number, bytes, sha))
    }
    .await;
    let (number, bytes, sha) = match result {
        Ok(v) => {
            sqlx::query("COMMIT").execute(&mut *conn_guard).await?;
            v
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *conn_guard).await;
            return Err(e);
        }
    };
    drop(conn_guard);
    if let Err(e) = crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "payment_reminder",
        &id,
        "INSERT",
        "",
    )
    .await
    {
        tracing::warn!(event = "PAYMENT_REMINDER_OUTBOX_FAILED", error = %e);
    }
    let _ = audit_repo::create(
        pool,
        &session.user_id,
        "ISSUE_DOCUMENT",
        "PAYMENT_REMINDER",
        Some(&id),
        Some(&format!(
            "nr={number} invoice={} level={level} open={} sha256={sha}",
            row.document_number, row.open_cents
        )),
    )
    .await;
    Ok(IssuedPdf {
        document_id: Some(id),
        document_number: Some(number),
        sha256: sha,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ReminderRow {
    pub id: String,
    pub invoice_document_id: String,
    pub invoice_number: String,
    pub level: i64,
    pub document_number: String,
    pub open_cents: i64,
    pub fee_cents: i64,
    pub pay_by: String,
    pub issued_by: String,
    pub issued_at: String,
}

pub async fn list_reminders(
    pool: &SqlitePool,
    session: &Session,
    invoice_document_id: &str,
) -> Result<Vec<ReminderRow>, AppError> {
    require_permission(session, "billing.read")?;
    finance_schema::ensure(pool).await?;
    Ok(sqlx::query_as::<_, ReminderRow>(
        "SELECT id, invoice_document_id, invoice_number, level, document_number, open_cents, fee_cents,
                pay_by, issued_by, issued_at
           FROM payment_reminder WHERE invoice_document_id = ?1 ORDER BY level",
    )
    .bind(invoice_document_id)
    .fetch_all(pool)
    .await?)
}

/// Print a reminder again ("KOPIE").
pub async fn reminder_copy(
    pool: &SqlitePool,
    session: &Session,
    reminder_id: &str,
) -> Result<IssuedPdf, AppError> {
    require_permission(session, "billing.read")?;
    finance_schema::ensure(pool).await?;
    let (number, payload): (String, String) =
        sqlx::query_as("SELECT document_number, payload_json FROM payment_reminder WHERE id = ?1")
            .bind(reminder_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Reminder".into()))?;
    let mut v: Value =
        serde_json::from_str(&payload).map_err(|e| AppError::Internal(e.to_string()))?;
    v["watermark"] = Value::String(WATERMARK_COPY.into());
    let layout: ClinicalPdfLayout =
        serde_json::from_value(v).map_err(|e| AppError::Internal(e.to_string()))?;
    let bytes = render_clinical_layout_with_logo(&layout, practice_logo(pool).await.as_ref())?;
    Ok(IssuedPdf {
        document_id: Some(reminder_id.to_string()),
        document_number: Some(number),
        sha256: sha256_hex(&bytes),
        pdf_base64: STANDARD.encode(&bytes),
        reprint: true,
    })
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
