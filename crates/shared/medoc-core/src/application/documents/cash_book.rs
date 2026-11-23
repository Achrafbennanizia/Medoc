//! Cash book and day close (Kassenbuch / Tagesabschluss).
//!
//! All figures are computed here from the cash journal (`payment_receipt`)
//! and the cash movements; the client only supplies what a person counted.
//!
//! Rules (GoBD Rz. 111 ff., AEAO zu § 146 AO):
//! * cash is recorded daily; a closing covers the journal lines whose
//!   `local_day` is the chosen day. Earlier unclosed days stay open for
//!   their own closing,
//! * Soll-Bestand = Anfangsbestand + Bareinnahmen ± Einlagen/Entnahmen,
//!   Anfangsbestand = counted cash of the previous closing,
//! * a counted amount is mandatory; a difference needs a written reason,
//! * a closing is final. Mistakes are fixed by a correction protocol that
//!   references the original; nothing is edited or deleted,
//! * each closing issues a numbered Kassenbericht (TB-YYYY-nnnnnn).

use std::collections::BTreeMap;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use sqlx::{SqliteConnection, SqlitePool};

use super::finance_schema;
use super::issue::{
    after_insert, now_iso, require_permission, year_now, DocKind, IssuedPdf, WATERMARK_COPY,
};
use super::practice_profile::{practice_logo, resolve_document_locale, PracticeProfile};
use crate::application::auth_service::Session;
use crate::domain::services::pricing::euros_to_cents;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::issued_document::{
    self as repo, sha256_hex, IssuedDocument,
};
use crate::infrastructure::database::repos::billing::payment as payment_repo;
use crate::infrastructure::database::sync_outbox;
use crate::infrastructure::pdf::{
    render_report_pdf, ReportPdfInput, ReportPdfSection, ReportPdfSummaryRow,
};

/// Cash desk permissions (see `domain::access`). Without an access profile
/// they decide exactly as `finance.read` / `finance.write` /
/// `finance.day_close.write` did before.
pub const PERM_READ: &str = "cash.read";
pub const PERM_CLOSE: &str = "cash.day_close";
pub const PERM_CASH: &str = "cash.create";
/// Reversing a booking voids it: full cash desk access.
pub const PERM_REVERSE: &str = "cash.delete";

/// Euro coins and notes in cents, largest first.
pub const DENOMINATIONS: [i64; 15] = [
    50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
];

macro_rules! immediate_tx {
    ($pool:expr, |$conn:ident| $body:block) => {{
        let mut conn_guard = $pool.acquire().await?;
        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *conn_guard)
            .await?;
        let result: Result<_, AppError> = async {
            let $conn: &mut SqliteConnection = &mut *conn_guard;
            $body
        }
        .await;
        match result {
            Ok(v) => {
                sqlx::query("COMMIT").execute(&mut *conn_guard).await?;
                Ok::<_, AppError>(v)
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK").execute(&mut *conn_guard).await;
                Err(e)
            }
        }
    }};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct JournalLine {
    pub id: String,
    pub payment_id: String,
    pub patient_id: String,
    pub patient_name: Option<String>,
    pub amount_cents: i64,
    pub method: String,
    pub kind: String,
    /// UTC `YYYY-MM-DD HH:MM:SS`.
    pub received_at: String,
    pub local_day: String,
    /// Quittung number if one was issued for the payment.
    pub receipt_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CashMovement {
    pub id: String,
    pub kind: String,
    pub amount_cents: i64,
    pub direction: i64,
    pub reason: String,
    pub receipt_ref: Option<String>,
    pub reverses_id: Option<String>,
    pub occurred_at: String,
    pub local_day: String,
    pub created_by: String,
    pub day_close_id: Option<String>,
}

impl CashMovement {
    fn signed(&self) -> i64 {
        self.amount_cents * self.direction
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastClose {
    pub id: String,
    pub as_of_date: String,
    pub closing_cents: i64,
    pub document_number: Option<String>,
}

/// Everything the closing will contain, computed from the database.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCloseDraft {
    pub as_of_date: String,
    pub period_from: String,
    pub last_close: Option<LastClose>,
    pub already_closed: bool,
    pub opening_cents: i64,
    pub cash_receipts_cents: i64,
    pub cash_movements_cents: i64,
    pub expected_cents: i64,
    pub card_cents: i64,
    pub transfer_cents: i64,
    pub other_cents: i64,
    pub receipt_count: i64,
    /// Cash bookings not yet ticked as checked at the desk.
    pub unverified_count: i64,
    /// Lines dated before `as_of_date` that were never closed.
    pub late_count: i64,
    pub receipts: Vec<JournalLine>,
    pub movements: Vec<CashMovement>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CloseDayArgs {
    pub as_of_date: String,
    /// Counted cash in cents. Ignored when `denominations` is given.
    pub counted_cents: Option<i64>,
    /// Count per denomination: `{"5000": 3, "200": 7}` (keys in cents).
    pub denominations: Option<BTreeMap<String, i64>>,
    /// Total of the card terminal's end-of-day report (Kassenschnitt).
    pub card_terminal_cents: Option<i64>,
    pub note: Option<String>,
    /// Document language requested by the client; None → Settings language.
    pub locale: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCloseResult {
    pub protocol_id: String,
    pub draft: DayCloseDraft,
    pub counted_cents: i64,
    pub variance_cents: i64,
    pub report: IssuedPdf,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CashMovementArgs {
    /// OPENING_FLOAT | DEPOSIT | WITHDRAWAL | BANK_DEPOSIT | EXPENSE
    pub kind: String,
    pub amount_cents: i64,
    pub reason: String,
    pub receipt_ref: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn today_local() -> NaiveDate {
    Local::now().date_naive()
}

fn parse_day(s: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::validation_code("error.day_close.bad_date"))
}

/// "1,234.56 EUR" — comma groups thousands, and the point is always followed
/// by exactly two digits (cents). A thousands point (`1.234,56`) reads as
/// three digits after the decimal.
pub fn fmt_eur(cents: i64) -> String {
    let neg = cents < 0;
    let c = cents.unsigned_abs();
    let euros = (c / 100).to_string();
    let mut grouped = String::new();
    for (i, ch) in euros.chars().enumerate() {
        if i > 0 && (euros.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(ch);
    }
    format!(
        "{}{}.{:02} {}",
        if neg { "-" } else { "" },
        grouped,
        c % 100,
        crate::infrastructure::pdf::document_currency()
    )
}

/// UTC `YYYY-MM-DD HH:MM:SS` → local `dd.mm.yyyy HH:MM`.
fn local_time(utc: &str) -> String {
    chrono::NaiveDateTime::parse_from_str(utc.get(..19).unwrap_or(utc), "%Y-%m-%d %H:%M:%S")
        .map(|t| {
            t.and_utc()
                .with_timezone(&Local)
                .format("%d.%m.%Y %H:%M")
                .to_string()
        })
        .unwrap_or_else(|_| utc.to_string())
}

fn movement_direction(kind: &str) -> Result<i64, AppError> {
    match kind {
        "OPENING_FLOAT" | "DEPOSIT" => Ok(1),
        "WITHDRAWAL" | "BANK_DEPOSIT" | "EXPENSE" => Ok(-1),
        _ => Err(AppError::validation_code(
            "error.cash_book.bad_movement_kind",
        )),
    }
}

fn movement_label(kind: &str, locale: &str) -> &'static str {
    use crate::infrastructure::pdf::i18n::tr;
    match kind {
        "OPENING_FLOAT" => tr(locale, "cash.opening_float"),
        "DEPOSIT" => tr(locale, "cash.deposit"),
        "WITHDRAWAL" => tr(locale, "cash.withdrawal"),
        "BANK_DEPOSIT" => tr(locale, "cash.bank_deposit"),
        "EXPENSE" => tr(locale, "cash.cash_expense"),
        _ => tr(locale, "cash.movement_reversal"),
    }
}

fn method_label(m: &str, locale: &str) -> &'static str {
    use crate::infrastructure::pdf::i18n::tr;
    match m {
        "CASH" => tr(locale, "cash.cash"),
        "CARD" => tr(locale, "cash.card"),
        "BANK_TRANSFER" => tr(locale, "cash.bank_transfer"),
        _ => tr(locale, "cash.invoice"),
    }
}

fn kind_label(k: &str, locale: &str) -> &'static str {
    use crate::infrastructure::pdf::i18n::tr;
    match k {
        "RECEIPT" => tr(locale, "cash.payment"),
        "REVERSAL" => tr(locale, "cash.kind_reversal"),
        "CORRECTION" => tr(locale, "cash.correction"),
        _ => tr(locale, "cash.carried_over"),
    }
}

async fn last_final_close(
    pool: &SqlitePool,
    before_or_on: Option<&str>,
) -> Result<Option<LastClose>, AppError> {
    let row: Option<(String, String, Option<i64>, Option<i64>, Option<f64>, Option<f64>, Option<String>)> =
        sqlx::query_as(
            "SELECT id, as_of_date, counted_cents, expected_cents, counted_eur, system_cash_eur, document_number
               FROM day_close_protocol
              WHERE status = 'FINAL' AND (?1 IS NULL OR as_of_date <= ?1)
              ORDER BY as_of_date DESC, recorded_at DESC LIMIT 1",
        )
        .bind(before_or_on)
        .fetch_optional(pool)
        .await?;
    Ok(
        row.map(|(id, d, counted, expected, counted_eur, sys_eur, nr)| {
            // Closing balance = what was counted; legacy rows only have euros.
            let closing = counted
                .or(expected)
                .or_else(|| counted_eur.map(euros_to_cents))
                .or_else(|| sys_eur.map(euros_to_cents))
                .unwrap_or(0);
            LastClose {
                id,
                as_of_date: d,
                closing_cents: closing,
                document_number: nr,
            }
        }),
    )
}

const RECEIPT_SQL: &str = "\
SELECT r.id, r.payment_id, r.patient_id, p.name AS patient_name, r.amount_cents, r.method,
       r.kind, r.received_at, r.local_day,
       (SELECT d.document_number FROM issued_document d
         WHERE d.kind = 'RECEIPT' AND d.source_id = r.payment_id LIMIT 1) AS receipt_number
  FROM payment_receipt r LEFT JOIN patient p ON p.id = r.patient_id
 WHERE ";

async fn receipts(
    pool: &SqlitePool,
    filter: &'static str,
    bind: &str,
) -> Result<Vec<JournalLine>, AppError> {
    let sql = format!("{RECEIPT_SQL}{filter} ORDER BY r.received_at, r.rowid");
    Ok(sqlx::query_as::<_, JournalLine>(&sql)
        .bind(bind)
        .fetch_all(pool)
        .await?)
}

async fn open_receipts(pool: &SqlitePool, day: &str) -> Result<Vec<JournalLine>, AppError> {
    receipts(pool, "r.day_close_id IS NULL AND r.local_day = ?1", day).await
}

async fn closed_receipts(pool: &SqlitePool, close_id: &str) -> Result<Vec<JournalLine>, AppError> {
    receipts(pool, "r.day_close_id = ?1", close_id).await
}

const MOVEMENT_SQL: &str = "\
SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
       local_day, created_by, day_close_id
  FROM cash_movement WHERE ";

async fn movements(
    pool: &SqlitePool,
    filter: &'static str,
    bind: &str,
) -> Result<Vec<CashMovement>, AppError> {
    let sql = format!("{MOVEMENT_SQL}{filter} ORDER BY occurred_at, rowid");
    Ok(sqlx::query_as::<_, CashMovement>(&sql)
        .bind(bind)
        .fetch_all(pool)
        .await?)
}

async fn open_movements(pool: &SqlitePool, day: &str) -> Result<Vec<CashMovement>, AppError> {
    movements(pool, "day_close_id IS NULL AND local_day = ?1", day).await
}

async fn closed_movements(
    pool: &SqlitePool,
    close_id: &str,
) -> Result<Vec<CashMovement>, AppError> {
    movements(pool, "day_close_id = ?1", close_id).await
}

fn build_draft(
    as_of_date: &str,
    last: Option<LastClose>,
    already_closed: bool,
    receipts: Vec<JournalLine>,
    movements: Vec<CashMovement>,
    unverified_count: i64,
) -> DayCloseDraft {
    let sum = |m: &str| -> i64 {
        receipts
            .iter()
            .filter(|r| r.method == m)
            .map(|r| r.amount_cents)
            .sum()
    };
    let cash = sum("CASH");
    let card = sum("CARD");
    let transfer = sum("BANK_TRANSFER");
    let other: i64 = receipts
        .iter()
        .filter(|r| !matches!(r.method.as_str(), "CASH" | "CARD" | "BANK_TRANSFER"))
        .map(|r| r.amount_cents)
        .sum();
    let mov: i64 = movements.iter().map(CashMovement::signed).sum();
    let opening = last.as_ref().map(|l| l.closing_cents).unwrap_or(0);
    let period_from = receipts
        .iter()
        .map(|r| r.local_day.as_str())
        .chain(movements.iter().map(|m| m.local_day.as_str()))
        .filter(|d| *d <= as_of_date)
        .min()
        .unwrap_or(as_of_date)
        .to_string();
    let late_count = receipts
        .iter()
        .filter(|r| r.local_day.as_str() < as_of_date)
        .count() as i64
        + movements
            .iter()
            .filter(|m| m.local_day.as_str() < as_of_date)
            .count() as i64;
    DayCloseDraft {
        as_of_date: as_of_date.to_string(),
        period_from: if period_from.as_str() > as_of_date {
            as_of_date.to_string()
        } else {
            period_from
        },
        last_close: last,
        already_closed,
        opening_cents: opening,
        cash_receipts_cents: cash,
        cash_movements_cents: mov,
        expected_cents: opening + cash + mov,
        card_cents: card,
        transfer_cents: transfer,
        other_cents: other,
        receipt_count: receipts.len() as i64,
        unverified_count,
        late_count,
        receipts,
        movements,
    }
}

// ---------------------------------------------------------------------------
// Prepare / close / correct
// ---------------------------------------------------------------------------

/// Preview of the closing for `as_of_date` (nothing is written except
/// journal repairs from `reconcile`).
pub async fn prepare(
    pool: &SqlitePool,
    session: &Session,
    as_of_date: &str,
) -> Result<DayCloseDraft, AppError> {
    require_permission(session, PERM_READ)?;
    finance_schema::ensure(pool).await?;
    let day = parse_day(as_of_date)?.format("%Y-%m-%d").to_string();
    let already: Option<String> = sqlx::query_scalar(
        "SELECT id FROM day_close_protocol WHERE status = 'FINAL' AND as_of_date = ?1",
    )
    .bind(&day)
    .fetch_optional(pool)
    .await?;
    if let Some(id) = already {
        // Recorded day: read the locked lines. Reconciling the whole journal
        // here only rewrites open payments and makes selecting a closing slow.
        return protocol_draft(pool, &id).await;
    }
    finance_schema::reconcile(pool).await?;
    let verify = require_permission(session, PERM_CLOSE).is_ok();
    load_open_draft(pool, &day, verify).await
}

/// Open lines for `day` only. When `verify_cash` is set, that day's cash
/// payments are marked checked so a new closing does not wait on a manual tick.
async fn load_open_draft(
    pool: &SqlitePool,
    day: &str,
    verify_cash: bool,
) -> Result<DayCloseDraft, AppError> {
    let last = last_final_close(pool, Some(day)).await?;
    let receipts = open_receipts(pool, day).await?;
    if verify_cash {
        verify_day_cash(pool, &receipts).await?;
    }
    let movements = open_movements(pool, day).await?;
    let unverified = unverified_cash_count(pool, &receipts).await?;
    Ok(build_draft(
        day, last, false, receipts, movements, unverified,
    ))
}

async fn verify_day_cash(pool: &SqlitePool, receipts: &[JournalLine]) -> Result<(), AppError> {
    let mut ids: Vec<String> = receipts
        .iter()
        .filter(|r| r.method == "CASH" && r.amount_cents > 0)
        .map(|r| r.payment_id.clone())
        .collect();
    ids.sort();
    ids.dedup();
    if ids.is_empty() {
        return Ok(());
    }
    payment_repo::set_cash_verified_for_ids(pool, &ids, 1).await?;
    Ok(())
}

async fn unverified_cash_count(
    pool: &SqlitePool,
    receipts: &[JournalLine],
) -> Result<i64, AppError> {
    let mut ids: Vec<&str> = receipts
        .iter()
        .filter(|r| r.method == "CASH" && r.amount_cents > 0)
        .map(|r| r.payment_id.as_str())
        .collect();
    ids.sort_unstable();
    ids.dedup();
    if ids.is_empty() {
        return Ok(0);
    }
    let mut sql = String::from(
        "SELECT COUNT(*) FROM payment WHERE COALESCE(cash_verified, 0) = 1 AND id IN (",
    );
    for i in 0..ids.len() {
        if i > 0 {
            sql.push(',');
        }
        sql.push('?');
    }
    sql.push(')');
    let mut q = sqlx::query_scalar::<_, i64>(&sql);
    for id in &ids {
        q = q.bind(*id);
    }
    let verified = q.fetch_one(pool).await?;
    Ok(ids.len() as i64 - verified)
}

async fn protocol_draft(pool: &SqlitePool, id: &str) -> Result<DayCloseDraft, AppError> {
    let (as_of, corrects): (String, Option<String>) =
        sqlx::query_as("SELECT as_of_date, corrects_id FROM day_close_protocol WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound("DayCloseProtocol".into()))?;
    // A correction re-uses the items of the protocol it corrects.
    let items_id = root_protocol(pool, id, corrects).await?;
    let prev_day = parse_day(&as_of)?
        .pred_opt()
        .map(|d| d.format("%Y-%m-%d").to_string());
    let last = match prev_day {
        Some(d) => last_final_close(pool, Some(&d)).await?,
        None => None,
    };
    let receipts = closed_receipts(pool, &items_id).await?;
    let movements = closed_movements(pool, &items_id).await?;
    let unverified = unverified_cash_count(pool, &receipts).await?;
    Ok(build_draft(
        &as_of, last, true, receipts, movements, unverified,
    ))
}

async fn root_protocol(
    pool: &SqlitePool,
    id: &str,
    mut corrects: Option<String>,
) -> Result<String, AppError> {
    let mut root = id.to_string();
    let mut guard = 0;
    while let Some(c) = corrects {
        root = c.clone();
        corrects = sqlx::query_scalar("SELECT corrects_id FROM day_close_protocol WHERE id = ?1")
            .bind(&c)
            .fetch_optional(pool)
            .await?
            .flatten();
        guard += 1;
        if guard > 50 {
            break;
        }
    }
    Ok(root)
}

fn counted_from_args(args: &CloseDayArgs) -> Result<(i64, Option<String>), AppError> {
    if let Some(d) = args.denominations.as_ref().filter(|d| !d.is_empty()) {
        let mut total = 0i64;
        let mut clean = BTreeMap::new();
        for (k, n) in d {
            let value: i64 = k
                .trim()
                .parse()
                .map_err(|_| AppError::validation_code("error.day_close.bad_denomination"))?;
            if !DENOMINATIONS.contains(&value) || *n < 0 {
                return Err(AppError::validation_code(
                    "error.day_close.bad_denomination",
                ));
            }
            if *n > 0 {
                total += value * n;
                clean.insert(value, *n);
            }
        }
        if let Some(c) = args.counted_cents {
            if c != total {
                return Err(AppError::validation_code("error.day_close.count_mismatch"));
            }
        }
        let json = serde_json::to_string(&clean).map_err(|e| AppError::Internal(e.to_string()))?;
        return Ok((total, Some(json)));
    }
    match args.counted_cents {
        Some(c) if c >= 0 => Ok((c, None)),
        Some(_) => Err(AppError::validation_code("error.day_close.bad_amount")),
        None => Err(AppError::validation_code(
            "error.day_close.counted_required",
        )),
    }
}

struct ProtocolValues<'a> {
    draft: &'a DayCloseDraft,
    counted: i64,
    denominations_json: Option<String>,
    card_terminal: Option<i64>,
    note: Option<String>,
    corrects: Option<(String, Option<String>)>,
    locale: Option<String>,
}

/// Record the closing for `as_of_date`, lock its journal lines and issue the
/// numbered Kassenbericht — one transaction.
pub async fn close_day(
    pool: &SqlitePool,
    session: &Session,
    args: CloseDayArgs,
) -> Result<DayCloseResult, AppError> {
    require_permission(session, PERM_CLOSE)?;
    finance_schema::ensure(pool).await?;
    repo::ensure_numbering_authority(pool).await?;
    let day_date = parse_day(&args.as_of_date)?;
    if day_date > today_local() {
        return Err(AppError::validation_code("error.day_close.future_date"));
    }
    let day = day_date.format("%Y-%m-%d").to_string();
    if let Some(last) = last_final_close(pool, None).await? {
        if last.as_of_date == day {
            return Err(AppError::validation_code("error.day_close.already_closed"));
        }
        if last.as_of_date > day {
            return Err(AppError::validation_code_params(
                "error.day_close.later_close_exists",
                &[("date", super::format_dmy(&last.as_of_date).as_str())],
            ));
        }
    }
    let (counted, denominations_json) = counted_from_args(&args)?;
    finance_schema::reconcile(pool).await?;
    let draft = load_open_draft(pool, &day, true).await?;
    let note = args
        .note
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from);
    if counted != draft.expected_cents && note.is_none() {
        return Err(AppError::validation_code(
            "error.day_close.variance_note_required",
        ));
    }
    if let Some(t) = args.card_terminal_cents {
        if t != draft.card_cents && note.is_none() {
            return Err(AppError::validation_code(
                "error.day_close.variance_note_required",
            ));
        }
    }
    record(
        pool,
        session,
        ProtocolValues {
            draft: &draft,
            counted,
            denominations_json,
            card_terminal: args.card_terminal_cents,
            note,
            corrects: None,
            locale: args.locale.clone(),
        },
    )
    .await
}

/// Correct the latest closing (wrong count, missing reason). Creates a new
/// protocol + Kassenbericht that references the original; the original is
/// marked CORRECTED and stays readable.
pub async fn correct_day_close(
    pool: &SqlitePool,
    session: &Session,
    protocol_id: &str,
    args: CloseDayArgs,
) -> Result<DayCloseResult, AppError> {
    require_permission(session, PERM_CLOSE)?;
    finance_schema::ensure(pool).await?;
    repo::ensure_numbering_authority(pool).await?;
    let (as_of, status, number): (String, String, Option<String>) = sqlx::query_as(
        "SELECT as_of_date, status, document_number FROM day_close_protocol WHERE id = ?1",
    )
    .bind(protocol_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("DayCloseProtocol".into()))?;
    if status != "FINAL" {
        return Err(AppError::validation_code("error.day_close.not_correctable"));
    }
    let latest = last_final_close(pool, None).await?;
    if latest.map(|l| l.id) != Some(protocol_id.to_string()) {
        // Later closings carried this balance forward.
        return Err(AppError::validation_code(
            "error.day_close.only_latest_correctable",
        ));
    }
    let note = args
        .note
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from);
    if note.is_none() {
        return Err(AppError::validation_code(
            "error.day_close.correction_reason_required",
        ));
    }
    let (counted, denominations_json) = counted_from_args(&args)?;
    let draft = protocol_draft(pool, protocol_id).await?;
    record(
        pool,
        session,
        ProtocolValues {
            draft: &draft,
            counted,
            denominations_json,
            card_terminal: args.card_terminal_cents,
            note,
            corrects: Some((protocol_id.to_string(), number)),
            locale: args.locale.clone(),
        },
    )
    .await
    .map(|mut r| {
        r.draft.as_of_date = as_of;
        r
    })
}

async fn record(
    pool: &SqlitePool,
    session: &Session,
    v: ProtocolValues<'_>,
) -> Result<DayCloseResult, AppError> {
    let draft = v.draft;
    let variance = v.counted - draft.expected_cents;
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    let locale = resolve_document_locale(pool, v.locale.as_deref()).await;
    let logo = practice_logo(pool).await;
    let id = uuid::Uuid::new_v4().to_string();
    let issued_at = now_iso();
    let total_income: i64 = draft.receipts.iter().map(|r| r.amount_cents).sum();
    let verified = draft.receipt_count - draft.unverified_count;
    let items_close_id = v.corrects.as_ref().map(|(c, _)| c.clone());

    let (doc, bytes) = immediate_tx!(pool, |conn| {
        if let Some((orig, _)) = &v.corrects {
            sqlx::query("UPDATE day_close_protocol SET status = 'CORRECTED' WHERE id = ?1 AND status = 'FINAL'")
                .bind(orig)
                .execute(&mut *conn)
                .await?;
        }
        sqlx::query(
            "INSERT INTO day_close_protocol
                (id, as_of_date, counted_eur, system_cash_eur, system_income_eur, variance_eur,
                 cash_matches, day_payment_count, cash_verified_count, all_payments_verified, note,
                 status, period_from, opening_cents, cash_receipts_cents, cash_movements_cents,
                 expected_cents, counted_cents, variance_cents, card_cents, card_terminal_cents,
                 transfer_cents, other_cents, receipt_count, denominations_json, closed_by,
                 closed_by_name, corrects_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'FINAL', ?12, ?13, ?14, ?15,
                     ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)",
        )
        .bind(&id)
        .bind(&draft.as_of_date)
        .bind(v.counted as f64 / 100.0)
        .bind(draft.expected_cents as f64 / 100.0)
        .bind(total_income as f64 / 100.0)
        .bind(variance as f64 / 100.0)
        .bind(i64::from(variance == 0))
        .bind(draft.receipt_count)
        .bind(verified.max(0))
        .bind(i64::from(draft.unverified_count == 0))
        .bind(&v.note)
        .bind(&draft.period_from)
        .bind(draft.opening_cents)
        .bind(draft.cash_receipts_cents)
        .bind(draft.cash_movements_cents)
        .bind(draft.expected_cents)
        .bind(v.counted)
        .bind(variance)
        .bind(draft.card_cents)
        .bind(v.card_terminal)
        .bind(draft.transfer_cents)
        .bind(draft.other_cents)
        .bind(draft.receipt_count)
        .bind(&v.denominations_json)
        .bind(&session.user_id)
        .bind(&session.name)
        .bind(v.corrects.as_ref().map(|(c, _)| c.clone()))
        .execute(&mut *conn)
        .await?;

        if items_close_id.is_none() {
            // Lock exactly the lines shown in the draft.
            for r in &draft.receipts {
                sqlx::query("UPDATE payment_receipt SET day_close_id = ?1 WHERE id = ?2 AND day_close_id IS NULL")
                    .bind(&id)
                    .bind(&r.id)
                    .execute(&mut *conn)
                    .await?;
            }
            for m in &draft.movements {
                sqlx::query("UPDATE cash_movement SET day_close_id = ?1 WHERE id = ?2 AND day_close_id IS NULL")
                    .bind(&id)
                    .bind(&m.id)
                    .execute(&mut *conn)
                    .await?;
            }
        }

        let number = repo::next_number(conn, DocKind::DailyReport.prefix_for(profile.jurisdiction()), year_now()).await?;
        let mut input = report_input(
            &profile,
            locale,
            draft,
            &ReportMeta {
                number: &number,
                counted: v.counted,
                variance,
                card_terminal: v.card_terminal,
                denominations_json: v.denominations_json.as_deref(),
                note: v.note.as_deref(),
                closed_by: &session.name,
                closed_at: &Local::now().format("%d.%m.%Y %H:%M").to_string(),
                corrects_number: v.corrects.as_ref().and_then(|(_, n)| n.as_deref()),
            },
        );
        input.logo = logo.clone();
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes =
            crate::infrastructure::pdf::with_document_uid(&doc_id, || render_report_pdf(&input))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: DocKind::DailyReport.as_db().into(),
            document_number: number.clone(),
            source_table: Some("day_close_protocol".into()),
            source_id: Some(id.clone()),
            copy_variant: "ORIGINAL".into(),
            patient_id: None,
            sha256: sha256_hex(&bytes),
            payload_json: serde_json::to_string(&input)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        sqlx::query(
            "UPDATE day_close_protocol SET document_id = ?1, document_number = ?2 WHERE id = ?3",
        )
        .bind(&doc.id)
        .bind(&number)
        .bind(&id)
        .execute(&mut *conn)
        .await?;
        Ok((doc, bytes))
    })?;

    after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
    if let Err(e) = audit_repo::create(
        pool,
        &session.user_id,
        if v.corrects.is_some() {
            "CORRECT"
        } else {
            "CREATE"
        },
        "DayCloseProtocol",
        Some(&id),
        Some(&format!(
            "as_of_date={} expected={} counted={} variance={} nr={}",
            draft.as_of_date, draft.expected_cents, v.counted, variance, doc.document_number
        )),
    )
    .await
    {
        tracing::error!(event = "DAY_CLOSE_AUDIT_FAILED", error = %e);
    }
    let body = serde_json::json!({ "id": id, "as_of_date": draft.as_of_date }).to_string();
    let _ = sync_outbox::record_or_noop(pool, "day_close_protocol", &id, "INSERT", &body).await;
    // The cash lines this close locked: other devices must see them as closed.
    for m in &draft.movements {
        if let Err(e) =
            sync_outbox::record_or_noop(pool, "cash_movement", &m.id, "UPDATE", "").await
        {
            tracing::warn!(event = "CASH_MOVEMENT_OUTBOX_FAILED", id = %m.id, error = %e);
        }
    }

    Ok(DayCloseResult {
        protocol_id: id,
        draft: draft.clone(),
        counted_cents: v.counted,
        variance_cents: variance,
        report: IssuedPdf {
            document_id: Some(doc.id),
            document_number: Some(doc.document_number),
            sha256: doc.sha256,
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        },
    })
}

struct ReportMeta<'a> {
    number: &'a str,
    counted: i64,
    variance: i64,
    card_terminal: Option<i64>,
    denominations_json: Option<&'a str>,
    note: Option<&'a str>,
    closed_by: &'a str,
    closed_at: &'a str,
    corrects_number: Option<&'a str>,
}

fn report_input(
    profile: &PracticeProfile,
    locale: &'static str,
    d: &DayCloseDraft,
    m: &ReportMeta<'_>,
) -> ReportPdfInput {
    let l = |key: &str| crate::infrastructure::pdf::i18n::tr(locale, key).to_string();
    let period = if d.period_from == d.as_of_date {
        super::format_dmy(&d.as_of_date)
    } else {
        format!(
            "{} – {}",
            super::format_dmy(&d.period_from),
            super::format_dmy(&d.as_of_date)
        )
    };
    let mut summary = vec![ReportPdfSummaryRow {
        label: l("cash.period"),
        value: period,
    }];
    if let Some(n) = m.corrects_number {
        summary.push(ReportPdfSummaryRow {
            label: l("cash.corrects"),
            value: n.to_string(),
        });
    }
    let carry = d
        .last_close
        .as_ref()
        .and_then(|c| c.document_number.clone())
        .map(|n| format!(" ({} {n})", l("cash.carried_from")))
        .unwrap_or_default();
    let row = |label: String, cents: i64| ReportPdfSummaryRow {
        label,
        value: fmt_eur(cents),
    };
    summary.push(row(
        format!("{}{carry}", l("cash.opening_balance")),
        d.opening_cents,
    ));
    summary.push(row(l("cash.cash_receipts_net"), d.cash_receipts_cents));
    // Movements by kind.
    let mut by_kind: BTreeMap<&str, i64> = BTreeMap::new();
    for mv in &d.movements {
        *by_kind.entry(mv.kind.as_str()).or_default() += mv.signed();
    }
    for (k, v) in &by_kind {
        let sign = if *v >= 0 { "+" } else { "−" };
        summary.push(row(format!("{sign} {}", movement_label(k, locale)), *v));
    }
    summary.push(row(l("cash.expected_cash"), d.expected_cents));
    summary.push(row(l("cash.counted_cash"), m.counted));
    summary.push(row(l("cash.cash_variance"), m.variance));
    summary.push(row(l("cash.card_payments_system"), d.card_cents));
    if let Some(t) = m.card_terminal {
        summary.push(row(l("cash.card_terminal_total"), t));
        summary.push(row(l("cash.card_variance"), t - d.card_cents));
    }
    summary.push(row(l("cash.bank_transfers"), d.transfer_cents));
    if d.other_cents != 0 {
        summary.push(row(l("cash.other_methods"), d.other_cents));
    }
    summary.push(ReportPdfSummaryRow {
        label: l("cash.number_of_entries"),
        value: (d.receipt_count + d.movements.len() as i64).to_string(),
    });
    if d.late_count > 0 {
        summary.push(ReportPdfSummaryRow {
            label: l("cash.of_which_late_entries"),
            value: d.late_count.to_string(),
        });
    }
    summary.push(ReportPdfSummaryRow {
        label: l("cash.closed_by"),
        value: format!("{} · {}", m.closed_by, m.closed_at),
    });
    if let Some(n) = m.note {
        summary.push(ReportPdfSummaryRow {
            label: l("cash.reason_note"),
            value: n.to_string(),
        });
    }

    // Kassenbuch: cash lines in time order with running balance.
    enum Line<'a> {
        R(&'a JournalLine),
        M(&'a CashMovement),
    }
    let mut lines: Vec<(String, Line<'_>)> = d
        .receipts
        .iter()
        .filter(|r| r.method == "CASH")
        .map(|r| (r.received_at.clone(), Line::R(r)))
        .collect();
    lines.extend(
        d.movements
            .iter()
            .map(|mv| (mv.occurred_at.clone(), Line::M(mv))),
    );
    lines.sort_by(|a, b| a.0.cmp(&b.0));
    let mut balance = d.opening_cents;
    let mut cash_rows = vec![vec![
        String::new(),
        l("cash.opening_balance"),
        String::new(),
        String::new(),
        String::new(),
        fmt_eur(balance),
    ]];
    for (_, line) in &lines {
        let (when, text, beleg, amount) = match line {
            Line::R(r) => (
                local_time(&r.received_at),
                format!(
                    "{} · {}",
                    kind_label(&r.kind, locale),
                    r.patient_name.clone().unwrap_or_else(|| r
                        .patient_id
                        .chars()
                        .take(8)
                        .collect())
                ),
                r.receipt_number
                    .clone()
                    .unwrap_or_else(|| r.payment_id.chars().take(8).collect()),
                r.amount_cents,
            ),
            Line::M(mv) => (
                local_time(&mv.occurred_at),
                if mv
                    .reason
                    .trim()
                    .eq_ignore_ascii_case(movement_label(&mv.kind, locale))
                {
                    mv.reason.clone()
                } else {
                    format!("{}: {}", movement_label(&mv.kind, locale), mv.reason)
                },
                mv.receipt_ref.clone().unwrap_or_default(),
                mv.signed(),
            ),
        };
        balance += amount;
        let (inc, out) = if amount >= 0 {
            (fmt_eur(amount), String::new())
        } else {
            (String::new(), fmt_eur(-amount))
        };
        cash_rows.push(vec![when, text, beleg, inc, out, fmt_eur(balance)]);
    }
    let mut sections = vec![ReportPdfSection {
        title: l("cash.cash_book"),
        headers: vec![
            l("cash.time"),
            l("cash.entry"),
            l("cash.voucher"),
            l("cash.in"),
            l("cash.out"),
            l("cash.balance"),
        ],
        rows: cash_rows,
        column_weights: Some(vec![3, 6, 2, 3, 3, 3]),
    }];
    let non_cash: Vec<Vec<String>> = d
        .receipts
        .iter()
        .filter(|r| r.method != "CASH")
        .map(|r| {
            vec![
                local_time(&r.received_at),
                r.patient_name
                    .clone()
                    .unwrap_or_else(|| r.patient_id.chars().take(8).collect()),
                method_label(&r.method, locale).to_string(),
                kind_label(&r.kind, locale).to_string(),
                fmt_eur(r.amount_cents),
            ]
        })
        .collect();
    if !non_cash.is_empty() {
        sections.push(ReportPdfSection {
            title: l("cash.non_cash_payments"),
            headers: vec![
                l("cash.time"),
                l("cash.patient"),
                l("cash.method"),
                l("cash.entry"),
                l("cash.amount"),
            ],
            rows: non_cash,
            column_weights: Some(vec![3, 5, 2, 2, 3]),
        });
    }
    if let Some(json) = m.denominations_json {
        if let Ok(map) = serde_json::from_str::<BTreeMap<i64, i64>>(json) {
            let mut rows: Vec<Vec<String>> = DENOMINATIONS
                .iter()
                .filter_map(|v| map.get(v).map(|n| (*v, *n)))
                .map(|(v, n)| vec![fmt_eur(v), n.to_string(), fmt_eur(v * n)])
                .collect();
            rows.push(vec![l("cash.total"), String::new(), fmt_eur(m.counted)]);
            sections.push(ReportPdfSection {
                title: l("cash.cash_count"),
                headers: vec![l("cash.denomination"), l("cash.count"), l("cash.amount")],
                rows,
                column_weights: None,
            });
        }
    }

    ReportPdfInput {
        doc_title: format!(
            "{} {}",
            l("cash.cash_report"),
            super::format_dmy(&d.as_of_date)
        ),
        generated_at: Local::now().format("%d.%m.%Y %H:%M").to_string(),
        practice_name: profile.name.trim().to_string(),
        practice_address: profile.document_address_lines(),
        summary,
        sections,
        report_kind: Some("daily_report".into()),
        locale: Some(locale.into()),
        document_number: Some(m.number.to_string()),
        watermark: None,
        signatures: vec![
            l("cash.cashier_date_signature"),
            l("cash.checked_by_date_signature"),
        ],
        footer_lines: profile.footer_lines(locale),
        logo: None,
    }
}

/// Cash report for a recorded closing. A stored document is reprinted as a
/// copy. An older closing that never received a document is issued one from
/// the figures that were saved, then returned as the original.
pub async fn report_copy(
    pool: &SqlitePool,
    session: &Session,
    protocol_id: &str,
) -> Result<IssuedPdf, AppError> {
    require_permission(session, PERM_READ)?;
    finance_schema::ensure(pool).await?;
    match protocol_document_id(pool, protocol_id).await? {
        Some(doc_id) => reprint_stored(pool, session, &doc_id).await,
        None => match issue_missing_report(pool, session, protocol_id).await? {
            MissingReport::Issued(pdf) => Ok(pdf),
            MissingReport::Already(doc_id) => reprint_stored(pool, session, &doc_id).await,
        },
    }
}

async fn protocol_document_id(
    pool: &SqlitePool,
    protocol_id: &str,
) -> Result<Option<String>, AppError> {
    let row: Option<Option<String>> =
        sqlx::query_scalar("SELECT document_id FROM day_close_protocol WHERE id = ?1")
            .bind(protocol_id)
            .fetch_optional(pool)
            .await?;
    match row {
        None => Err(AppError::NotFound("DayCloseProtocol".into())),
        Some(id) => Ok(id),
    }
}

async fn reprint_stored(
    pool: &SqlitePool,
    session: &Session,
    doc_id: &str,
) -> Result<IssuedPdf, AppError> {
    let doc = repo::find_by_id(pool, doc_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Document".into()))?;
    let mut input: ReportPdfInput = serde_json::from_str(&doc.payload_json)
        .map_err(|e| AppError::Internal(format!("stored report: {e}")))?;
    input.watermark = Some(WATERMARK_COPY.into());
    input.logo = practice_logo(pool).await;
    let bytes = render_report_pdf(&input)?;
    let sha = sha256_hex(&bytes);
    repo::record_reprint(pool, &doc.id, &sha, &session.user_id).await?;
    Ok(IssuedPdf {
        document_id: Some(doc.id),
        document_number: Some(doc.document_number),
        sha256: sha,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: true,
    })
}

enum MissingReport {
    Issued(IssuedPdf),
    Already(String),
}

#[derive(sqlx::FromRow)]
struct StoredClose {
    as_of_date: String,
    recorded_at: String,
    note: Option<String>,
    closed_by_name: Option<String>,
    counted_eur: Option<f64>,
    system_cash_eur: f64,
    period_from: Option<String>,
    opening_cents: Option<i64>,
    cash_receipts_cents: Option<i64>,
    cash_movements_cents: Option<i64>,
    expected_cents: Option<i64>,
    counted_cents: Option<i64>,
    card_cents: Option<i64>,
    card_terminal_cents: Option<i64>,
    transfer_cents: Option<i64>,
    other_cents: Option<i64>,
    denominations_json: Option<String>,
    corrects_id: Option<String>,
}

/// Build and store the cash report for a closing that predates numbered documents.
async fn issue_missing_report(
    pool: &SqlitePool,
    session: &Session,
    protocol_id: &str,
) -> Result<MissingReport, AppError> {
    let row: Option<StoredClose> = sqlx::query_as(
        "SELECT as_of_date, recorded_at, note, closed_by_name, counted_eur, system_cash_eur,
                period_from, opening_cents, cash_receipts_cents, cash_movements_cents, expected_cents,
                counted_cents, card_cents, card_terminal_cents, transfer_cents, other_cents,
                denominations_json, corrects_id
           FROM day_close_protocol WHERE id = ?1",
    )
    .bind(protocol_id)
    .fetch_optional(pool)
    .await?;
    let row = row.ok_or_else(|| AppError::NotFound("DayCloseProtocol".into()))?;
    let receipts = closed_receipts(pool, protocol_id).await?;
    let movements = closed_movements(pool, protocol_id).await?;
    let expected = row
        .expected_cents
        .unwrap_or_else(|| euros_to_cents(row.system_cash_eur));
    let counted = row
        .counted_cents
        .or_else(|| row.counted_eur.map(euros_to_cents))
        .unwrap_or(expected);
    let cash = row.cash_receipts_cents.unwrap_or(0);
    let mov = row.cash_movements_cents.unwrap_or(0);
    let opening = row.opening_cents.unwrap_or(expected - cash - mov);
    let draft = DayCloseDraft {
        as_of_date: row.as_of_date.clone(),
        period_from: row
            .period_from
            .clone()
            .unwrap_or_else(|| row.as_of_date.clone()),
        last_close: None,
        already_closed: true,
        opening_cents: opening,
        cash_receipts_cents: cash,
        cash_movements_cents: mov,
        expected_cents: expected,
        card_cents: row.card_cents.unwrap_or(0),
        transfer_cents: row.transfer_cents.unwrap_or(0),
        other_cents: row.other_cents.unwrap_or(0),
        receipt_count: receipts.len() as i64,
        unverified_count: 0,
        late_count: 0,
        receipts,
        movements,
    };
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    let locale = resolve_document_locale(pool, None).await;
    let note = row
        .note
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let closed_by = row
        .closed_by_name
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| session.name.clone());
    let closed_at = local_time(&row.recorded_at);
    let corrects_number: Option<String> = match &row.corrects_id {
        Some(id) => {
            sqlx::query_scalar("SELECT document_number FROM day_close_protocol WHERE id = ?1")
                .bind(id)
                .fetch_optional(pool)
                .await?
                .flatten()
        }
        None => None,
    };
    let variance = counted - expected;
    let issued_at = now_iso();
    let logo = practice_logo(pool).await;
    repo::ensure_numbering_authority(pool).await?;

    let outcome = immediate_tx!(pool, |conn| {
        let existing: Option<String> =
            sqlx::query_scalar("SELECT document_id FROM day_close_protocol WHERE id = ?1")
                .bind(protocol_id)
                .fetch_optional(&mut *conn)
                .await?
                .flatten();
        if let Some(id) = existing {
            return Ok(MissingReport::Already(id));
        }
        let number = repo::next_number(conn, DocKind::DailyReport.prefix_for(profile.jurisdiction()), year_now()).await?;
        let mut input = report_input(
            &profile,
            locale,
            &draft,
            &ReportMeta {
                number: &number,
                counted,
                variance,
                card_terminal: row.card_terminal_cents,
                denominations_json: row.denominations_json.as_deref(),
                note: note.as_deref(),
                closed_by: &closed_by,
                closed_at: &closed_at,
                corrects_number: corrects_number.as_deref(),
            },
        );
        input.logo = logo.clone();
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes =
            crate::infrastructure::pdf::with_document_uid(&doc_id, || render_report_pdf(&input))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: DocKind::DailyReport.as_db().into(),
            document_number: number.clone(),
            source_table: Some("day_close_protocol".into()),
            source_id: Some(protocol_id.to_string()),
            copy_variant: "ORIGINAL".into(),
            patient_id: None,
            sha256: sha256_hex(&bytes),
            payload_json: serde_json::to_string(&input)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        let updated = sqlx::query(
            "UPDATE day_close_protocol SET document_id = ?1, document_number = ?2 WHERE id = ?3 AND document_id IS NULL",
        )
        .bind(&doc.id)
        .bind(&number)
        .bind(protocol_id)
        .execute(&mut *conn)
        .await?;
        if updated.rows_affected() != 1 {
            return Err(AppError::validation_code("error.day_close.immutable"));
        }
        Ok(MissingReport::Issued(IssuedPdf {
            document_id: Some(doc.id.clone()),
            document_number: Some(doc.document_number.clone()),
            sha256: doc.sha256.clone(),
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        }))
    })?;

    if let MissingReport::Issued(ref pdf) = outcome {
        if let Some(doc_id) = &pdf.document_id {
            if let Ok(Some(doc)) = repo::find_by_id(pool, doc_id).await {
                after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
            }
        }
        // The protocol now points at its report: replicate that link too.
        if let Err(e) =
            sync_outbox::record_or_noop(pool, "day_close_protocol", protocol_id, "UPDATE", "").await
        {
            tracing::warn!(event = "DAY_CLOSE_OUTBOX_FAILED", error = %e);
        }
    }
    Ok(outcome)
}

// ---------------------------------------------------------------------------
// Cash movements
// ---------------------------------------------------------------------------

pub async fn record_cash_movement(
    pool: &SqlitePool,
    session: &Session,
    args: CashMovementArgs,
) -> Result<CashMovement, AppError> {
    require_permission(session, PERM_CASH)?;
    finance_schema::ensure(pool).await?;
    let kind = args.kind.trim().to_uppercase();
    let direction = movement_direction(&kind)?;
    if args.amount_cents <= 0 {
        return Err(AppError::validation_code("error.cash_book.bad_amount"));
    }
    let reason = args.reason.trim();
    if reason.is_empty() {
        return Err(AppError::validation_code("error.cash_book.reason_required"));
    }
    if kind == "EXPENSE"
        && args
            .receipt_ref
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
    {
        // GoBD: no booking without a voucher (Belegprinzip).
        return Err(AppError::validation_code(
            "error.cash_book.voucher_required",
        ));
    }
    insert_movement(
        pool,
        session,
        &kind,
        direction,
        args.amount_cents,
        reason,
        args.receipt_ref.as_deref(),
        None,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn insert_movement(
    pool: &SqlitePool,
    session: &Session,
    kind: &str,
    direction: i64,
    amount: i64,
    reason: &str,
    receipt_ref: Option<&str>,
    reverses: Option<&str>,
) -> Result<CashMovement, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    // The line and its outbox entry commit together, so the main device's
    // day close sees cash booked on any device.
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO cash_movement (id, kind, amount_cents, direction, reason, receipt_ref, reverses_id,
                                    occurred_at, local_day, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, strftime('%Y-%m-%d %H:%M:%S','now'),
                 date('now','localtime'), ?8)",
    )
    .bind(&id)
    .bind(kind)
    .bind(amount)
    .bind(direction)
    .bind(reason)
    .bind(receipt_ref.map(str::trim).filter(|s| !s.is_empty()))
    .bind(reverses)
    .bind(&session.user_id)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "cash_movement",
        &id,
        "INSERT",
    )
    .await?;
    tx.commit().await?;
    let _ = audit_repo::create(
        pool,
        &session.user_id,
        "CREATE",
        "CashMovement",
        Some(&id),
        Some(&format!("kind={kind} cents={} dir={direction}", amount)),
    )
    .await;
    Ok(sqlx::query_as::<_, CashMovement>(
        "SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
                local_day, created_by, day_close_id FROM cash_movement WHERE id = ?1",
    )
    .bind(&id)
    .fetch_one(pool)
    .await?)
}

/// Book the opposite of a movement (it stays in the journal).
pub async fn reverse_cash_movement(
    pool: &SqlitePool,
    session: &Session,
    id: &str,
    reason: &str,
) -> Result<CashMovement, AppError> {
    require_permission(session, PERM_REVERSE)?;
    finance_schema::ensure(pool).await?;
    if reason.trim().is_empty() {
        return Err(AppError::validation_code("error.cash_book.reason_required"));
    }
    let orig = sqlx::query_as::<_, CashMovement>(
        "SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
                local_day, created_by, day_close_id FROM cash_movement WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("CashMovement".into()))?;
    let already: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cash_movement WHERE reverses_id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await?;
    if orig.kind == "REVERSAL" || already > 0 {
        return Err(AppError::validation_code(
            "error.cash_book.already_reversed",
        ));
    }
    insert_movement(
        pool,
        session,
        "REVERSAL",
        -orig.direction,
        orig.amount_cents,
        reason.trim(),
        orig.receipt_ref.as_deref(),
        Some(id),
    )
    .await
}

pub async fn list_cash_movements(
    pool: &SqlitePool,
    session: &Session,
    from: &str,
    to: &str,
) -> Result<Vec<CashMovement>, AppError> {
    require_permission(session, PERM_READ)?;
    finance_schema::ensure(pool).await?;
    Ok(sqlx::query_as::<_, CashMovement>(
        "SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
                local_day, created_by, day_close_id
           FROM cash_movement WHERE local_day BETWEEN ?1 AND ?2 ORDER BY occurred_at DESC",
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn euro_formatting() {
        assert_eq!(fmt_eur(0), "0.00 EUR");
        assert_eq!(fmt_eur(123456), "1,234.56 EUR");
        assert_eq!(fmt_eur(-5), "-0.05 EUR");
        assert_eq!(fmt_eur(100_000_000), "1,000,000.00 EUR");
        assert_eq!(fmt_eur(euros_to_cents(12.345)), "12.35 EUR");
    }

    #[test]
    fn denominations_sum_and_validate() {
        let mut d = BTreeMap::new();
        d.insert("5000".into(), 2);
        d.insert("200".into(), 3);
        let args = CloseDayArgs {
            denominations: Some(d.clone()),
            ..Default::default()
        };
        assert_eq!(counted_from_args(&args).unwrap().0, 10600);
        let bad = CloseDayArgs {
            denominations: Some(d),
            counted_cents: Some(1),
            ..Default::default()
        };
        assert!(counted_from_args(&bad).is_err());
        let none = CloseDayArgs::default();
        assert!(counted_from_args(&none).is_err(), "a count is mandatory");
    }
}
