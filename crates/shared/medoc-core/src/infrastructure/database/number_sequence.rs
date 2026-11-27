//! Gap-free document numbers (F76/F85).
//!
//! The master device owns every sequence. Replicas must not allocate locally:
//! they call `medoc_sync::numbering::allocate_document_number`, which POSTs
//! `/api/v1/sync/number` on the master. `number_sequence` is `DeviceLocal`,
//! so these counters never sync and never fight over last-write-wins.

use chrono::NaiveDate;
use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppError;

pub const TABLE: &str = "number_sequence";

pub mod blocks;

/// Legacy per-day invoice counters, used once as a floor so numbering
/// continues after the existing values instead of restarting at 1.
const LEGACY_INVOICE_COUNTERS_KEY: &str = "finance.document_counters.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NumberStyle {
    /// `PREFIX-YYYY-NNNN`, one sequence per prefix and year.
    Yearly,
    /// `PREFIX-YYYYMMDD-NNNNNN`, one sequence per prefix and day (RE/BR/QU).
    Daily,
    /// `PREFIX-YYYY-MM-NNNN`, one sequence per prefix and month (purchase orders `B`).
    Monthly,
}

impl NumberStyle {
    pub fn parse(s: Option<&str>) -> Result<Self, AppError> {
        match s.map(|v| v.trim().to_ascii_lowercase()).as_deref() {
            None | Some("") | Some("yearly") => Ok(Self::Yearly),
            Some("daily") => Ok(Self::Daily),
            Some("monthly") => Ok(Self::Monthly),
            Some(other) => Err(AppError::Validation(format!(
                "unknown number style {other}"
            ))),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Yearly => "yearly",
            Self::Daily => "daily",
            Self::Monthly => "monthly",
        }
    }
}

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS number_sequence (
            prefix TEXT NOT NULL,
            year INTEGER NOT NULL,
            last_value INTEGER NOT NULL,
            PRIMARY KEY (prefix, year)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

fn parse_day(ymd: &str) -> Result<NaiveDate, AppError> {
    let head = ymd
        .trim()
        .get(..10)
        .ok_or_else(|| AppError::Validation("Date must be in yyyy-MM-dd format".into()))?;
    NaiveDate::parse_from_str(head, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Date must be in yyyy-MM-dd format".into()))
}

fn normalize_prefix(prefix: &str) -> Result<String, AppError> {
    let p = prefix.trim().to_ascii_uppercase();
    if p.is_empty() || p.len() > 16 || !p.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(AppError::Validation(
            "prefix must be 1-16 letters or digits".into(),
        ));
    }
    Ok(p)
}

/// Allocate `PREFIX-YYYY-NNNN` under `BEGIN IMMEDIATE` (kept for existing callers).
pub async fn allocate_number(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
) -> Result<String, AppError> {
    allocate_styled(pool, prefix, ymd, NumberStyle::Yearly).await
}

/// Allocate the next number for `prefix` on day `ymd` in the given style.
/// Runs on the device that owns the sequence (the master in a cluster).
pub async fn allocate_styled(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
) -> Result<String, AppError> {
    let range = advance(pool, prefix, ymd, style, 1).await?;
    format_number(&range.prefix, style, &range.day, range.first)
}

/// Numbers `first..=last` taken from one sequence in one step.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NumberRange {
    pub prefix: String,
    /// `yyyy-MM-dd` the numbers are formatted with.
    pub day: String,
    pub first: i64,
    pub last: i64,
}

/// The sequence key a number of `style` on `day` belongs to: (scope, year).
fn scope_of(prefix: &str, style: NumberStyle, day: &NaiveDate) -> (String, i32) {
    let year: i32 = day.format("%Y").to_string().parse().unwrap_or(0);
    let scope = match style {
        NumberStyle::Yearly => prefix.to_string(),
        NumberStyle::Daily => format!("{prefix}@{}", day.format("%Y%m%d")),
        NumberStyle::Monthly => format!("{prefix}@{year}{}", day.format("%m")),
    };
    (scope, year)
}

/// `n` formatted the way `style` writes it for `day` (`yyyy-MM-dd`).
pub fn format_number(
    prefix: &str,
    style: NumberStyle,
    ymd: &str,
    n: i64,
) -> Result<String, AppError> {
    let day = parse_day(ymd)?;
    let year = day.format("%Y");
    Ok(match style {
        NumberStyle::Yearly => format!("{prefix}-{year}-{n:04}"),
        NumberStyle::Daily => format!("{prefix}-{}-{n:06}", day.format("%Y%m%d")),
        NumberStyle::Monthly => format!("{prefix}-{year}-{}-{n:04}", day.format("%m")),
    })
}

/// Take `count` numbers from the sequence of `prefix` / `style` / `ymd` under `BEGIN IMMEDIATE`.
async fn advance(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
    count: i64,
) -> Result<NumberRange, AppError> {
    let prefix = normalize_prefix(prefix)?;
    let day = parse_day(ymd)?;
    let (scope, year) = scope_of(&prefix, style, &day);

    let mut tx: Transaction<'_, Sqlite> = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;
    let last: Option<i64> = sqlx::query_scalar(
        "SELECT last_value FROM number_sequence WHERE prefix = ?1 AND year = ?2",
    )
    .bind(&scope)
    .bind(year)
    .fetch_optional(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    let floor = match last {
        Some(_) => 0,
        None => {
            // A counter this device never had (first issue, or a hub that took over as primary,
            // T4.4): continue after every number already seen, in documents and in number blocks.
            let docs = legacy_floor(&mut tx, &prefix, style, &day).await?;
            let held = blocks_floor(&mut tx, &scope, year).await?;
            let floor = docs.max(held);
            if crate::edition::CORE_CAPS.multi_admin && floor > 0 && took_over(&mut tx).await {
                if let Some(missing) =
                    gap_check(&mut tx, &prefix, style, &day, &scope, year, floor).await?
                {
                    drop(tx);
                    return Err(record_open_gap(pool, &scope, year, missing).await);
                }
            }
            floor
        }
    };
    let first = last.unwrap_or(0).max(floor) + 1;
    let through = first + count.max(1) - 1;
    sqlx::query(
        "INSERT INTO number_sequence (prefix, year, last_value) VALUES (?1, ?2, ?3)
         ON CONFLICT(prefix, year) DO UPDATE SET last_value = excluded.last_value",
    )
    .bind(&scope)
    .bind(year)
    .bind(through)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(NumberRange {
        prefix,
        day: day.format("%Y-%m-%d").to_string(),
        first,
        last: through,
    })
}

/// Highest number of any block this device holds or reserved for this sequence.
async fn blocks_floor(
    tx: &mut Transaction<'_, Sqlite>,
    scope: &str,
    year: i32,
) -> Result<i64, AppError> {
    match sqlx::query_scalar::<_, Option<i64>>(
        "SELECT MAX(last_value) FROM number_block WHERE scope = ?1 AND year = ?2",
    )
    .bind(scope)
    .bind(year)
    .fetch_one(&mut **tx)
    .await
    {
        Ok(v) => Ok(v.unwrap_or(0)),
        Err(sqlx::Error::Database(e)) if e.message().contains("no such table") => Ok(0),
        Err(e) => Err(AppError::Database(e)),
    }
}

/// `app_kv` key: the admin saw the gap in this sequence and lets numbering continue.
pub fn gap_ack_key(scope: &str, year: i32) -> String {
    format!("numbering.gap_ack.v1:{scope}:{year}")
}

/// Numbers in `1..=floor` that are neither in a document nor in a number block (T4.4).
/// Ranges, oldest first; at most 20.
pub fn missing_ranges(mut seen: Vec<i64>, blocks: &[(i64, i64)], floor: i64) -> Vec<(i64, i64)> {
    for &(a, b) in blocks {
        seen.extend(a.max(1)..=b.min(floor));
    }
    seen.retain(|n| (1..=floor).contains(n));
    seen.sort_unstable();
    seen.dedup();
    let mut out = Vec::new();
    let mut expect = 1;
    for n in seen.into_iter().chain(std::iter::once(floor + 1)) {
        if n > expect {
            out.push((expect, n - 1));
            if out.len() == 20 {
                break;
            }
        }
        expect = n + 1;
    }
    out
}

/// `app_kv` key: set when this device switched from replica to primary (hub replacement, T4.4).
pub const TAKEOVER_KV: &str = "numbering.takeover.v1";

/// Called by the deployment change that makes this hub the primary.
pub async fn mark_takeover(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(TAKEOVER_KV)
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    tracing::warn!(target: "medoc::sync", event = "NUMBERING_TAKEOVER");
    Ok(())
}

async fn took_over(tx: &mut Transaction<'_, Sqlite>) -> bool {
    matches!(
        sqlx::query_scalar::<_, String>("SELECT value FROM app_kv WHERE key = ?1")
            .bind(TAKEOVER_KV)
            .fetch_optional(&mut **tx)
            .await,
        Ok(Some(_))
    )
}

/// `app_kv` key: gaps found and not acknowledged yet, `{"<scope>:<year>": "<missing>"}`.
pub const OPEN_GAPS_KV: &str = "numbering.gaps_open.v1";

async fn record_open_gap(pool: &SqlitePool, scope: &str, year: i32, missing: String) -> AppError {
    let mut open = open_gaps(pool).await;
    open.insert(format!("{scope}:{year}"), missing.clone());
    let _ = sqlx::query(
        "INSERT INTO app_kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(OPEN_GAPS_KV)
    .bind(serde_json::to_string(&open).unwrap_or_default())
    .execute(pool)
    .await;
    AppError::validation_code_params(
        "error.numbering.gap_found",
        &[("sequence", scope.to_string()), ("missing", missing)],
    )
}

/// Gaps waiting for an admin, keyed `"<scope>:<year>"`.
pub async fn open_gaps(pool: &SqlitePool) -> std::collections::BTreeMap<String, String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM app_kv WHERE key = ?1")
        .bind(OPEN_GAPS_KV)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default()
}

/// The admin checked the gap (e.g. documents lost with the old primary): numbering continues.
pub async fn acknowledge_gap(pool: &SqlitePool, key: &str) -> Result<bool, AppError> {
    let mut open = open_gaps(pool).await;
    if open.remove(key).is_none() {
        return Ok(false);
    }
    let (scope, year) = key
        .rsplit_once(':')
        .and_then(|(s, y)| Some((s, y.parse::<i32>().ok()?)))
        .ok_or_else(|| AppError::Validation("invalid sequence".into()))?;
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    for (k, v) in [
        (gap_ack_key(scope, year), chrono::Utc::now().to_rfc3339()),
        (OPEN_GAPS_KV.to_string(), serde_json::to_string(&open).unwrap_or_default()),
    ] {
        sqlx::query(
            "INSERT INTO app_kv (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(k)
        .bind(v)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }
    tx.commit().await.map_err(AppError::Database)?;
    Ok(true)
}

/// Before the first number of a sequence on this device: the numbers below the floor that are
/// unaccounted for (`Some(list)`), unless the admin acknowledged them (`gap_ack_key`). Only
/// sequences whose documents this module can list are checked (daily invoices, monthly orders).
async fn gap_check(
    tx: &mut Transaction<'_, Sqlite>,
    prefix: &str,
    style: NumberStyle,
    day: &NaiveDate,
    scope: &str,
    year: i32,
    floor: i64,
) -> Result<Option<String>, AppError> {
    let (sql, like) = match style {
        NumberStyle::Daily => (
            "SELECT document_number FROM invoice_document WHERE document_number LIKE ?1",
            format!("{prefix}-{}-%", day.format("%Y%m%d")),
        ),
        NumberStyle::Monthly => (
            "SELECT order_number FROM purchase_order WHERE order_number LIKE ?1",
            format!("{prefix}-{}-%", day.format("%Y-%m")),
        ),
        NumberStyle::Yearly => return Ok(None),
    };
    let acked: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
        .bind(gap_ack_key(scope, year))
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    if acked.is_some() {
        return Ok(None);
    }
    let rows: Vec<Option<String>> = match sqlx::query_scalar(sql).bind(&like).fetch_all(&mut **tx).await {
        Ok(r) => r,
        Err(sqlx::Error::Database(e)) if e.message().contains("no such table") => return Ok(None),
        Err(e) => return Err(AppError::Database(e)),
    };
    let seen: Vec<i64> = rows
        .into_iter()
        .flatten()
        .filter_map(|n| n.rsplit('-').next().and_then(|s| s.parse::<i64>().ok()))
        .collect();
    let blocks: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT first_value, last_value FROM number_block WHERE scope = ?1 AND year = ?2",
    )
    .bind(scope)
    .bind(year)
    .fetch_all(&mut **tx)
    .await
    .unwrap_or_default();
    let missing = missing_ranges(seen, &blocks, floor);
    if missing.is_empty() {
        return Ok(None);
    }
    let list = missing
        .iter()
        .map(|(a, b)| if a == b { a.to_string() } else { format!("{a}–{b}") })
        .collect::<Vec<_>>()
        .join(", ");
    tracing::error!(target: "medoc::sync", event = "NUMBERING_GAP_FOUND", scope, year, missing = %list);
    Ok(Some(list))
}

/// Highest number already handed out before this sequence existed.
async fn legacy_floor(
    tx: &mut Transaction<'_, Sqlite>,
    prefix: &str,
    style: NumberStyle,
    day: &NaiveDate,
) -> Result<i64, AppError> {
    match style {
        NumberStyle::Daily => {
            let raw: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
                .bind(LEGACY_INVOICE_COUNTERS_KEY)
                .fetch_optional(&mut **tx)
                .await
                .map_err(AppError::Database)?;
            let from_kv = raw
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                .and_then(|v| {
                    v.get("days")?
                        .get(day.format("%Y-%m-%d").to_string())?
                        .get(prefix.to_ascii_lowercase())?
                        .as_i64()
                })
                .unwrap_or(0);
            let like = format!("{prefix}-{}-%", day.format("%Y%m%d"));
            let from_docs = max_suffix(
                tx,
                "SELECT document_number FROM invoice_document WHERE document_number LIKE ?1",
                &like,
            )
            .await?;
            Ok(from_kv.max(from_docs))
        }
        NumberStyle::Monthly => {
            let like = format!("{prefix}-{}-%", day.format("%Y-%m"));
            max_suffix(
                tx,
                "SELECT order_number FROM purchase_order WHERE order_number LIKE ?1",
                &like,
            )
            .await
        }
        NumberStyle::Yearly => Ok(0),
    }
}

async fn max_suffix(
    tx: &mut Transaction<'_, Sqlite>,
    sql: &str,
    like: &str,
) -> Result<i64, AppError> {
    let rows: Vec<Option<String>> = match sqlx::query_scalar(sql)
        .bind(like)
        .fetch_all(&mut **tx)
        .await
    {
        Ok(r) => r,
        Err(sqlx::Error::Database(e)) if e.message().contains("no such table") => return Ok(0),
        Err(e) => return Err(AppError::Database(e)),
    };
    Ok(rows
        .into_iter()
        .flatten()
        .filter_map(|n| n.rsplit('-').next().and_then(|s| s.parse::<i64>().ok()))
        .max()
        .unwrap_or(0))
}

/// F85: unique document numbers. Created only when existing data has no
/// duplicates; duplicates are logged for an operator to resolve instead of
/// being renamed silently (a rename on one device would diverge from others).
pub async fn ensure_unique_number_indexes(pool: &SqlitePool) -> Result<(), AppError> {
    for (index, table, column) in [
        (
            "ux_purchase_order_order_number",
            "purchase_order",
            "order_number",
        ),
        (
            "ux_invoice_document_number",
            "invoice_document",
            "document_number",
        ),
    ] {
        let exists: Option<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
                .bind(table)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;
        if exists.is_none() {
            continue;
        }
        let dups: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM (SELECT {column} FROM {table}
              WHERE {column} IS NOT NULL AND {column} <> ''
              GROUP BY {column} HAVING COUNT(*) > 1)"
        ))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if dups > 0 {
            tracing::warn!(
                target: "medoc::migration",
                event = "DUPLICATE_DOCUMENT_NUMBERS",
                table = table,
                duplicates = dups
            );
            continue;
        }
        sqlx::query(&format!(
            "CREATE UNIQUE INDEX IF NOT EXISTS {index} ON {table} ({column})
             WHERE {column} IS NOT NULL AND {column} <> ''"
        ))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }
    Ok(())
}

#[cfg(test)]
mod gap_tests {
    use super::missing_ranges;

    #[test]
    fn documents_and_blocks_account_for_numbers() {
        assert!(missing_ranges(vec![1, 2, 3], &[], 3).is_empty());
        assert_eq!(missing_ranges(vec![1, 4], &[], 5), vec![(2, 3), (5, 5)]);
        // Unused numbers of a block are accounted for (listed as void in the period report).
        assert!(missing_ranges(vec![1, 2], &[(3, 10)], 10).is_empty());
    }
}
