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
            Some(other) => Err(AppError::Validation(format!("unknown number style {other}"))),
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
        return Err(AppError::Validation("prefix must be 1-16 letters or digits".into()));
    }
    Ok(p)
}

/// Allocate `PREFIX-YYYY-NNNN` under `BEGIN IMMEDIATE` (kept for existing callers).
pub async fn allocate_number(pool: &SqlitePool, prefix: &str, ymd: &str) -> Result<String, AppError> {
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
    let prefix = normalize_prefix(prefix)?;
    let day = parse_day(ymd)?;
    let year: i32 = day.format("%Y").to_string().parse().unwrap_or(0);
    let compact = day.format("%Y%m%d").to_string();
    let month = day.format("%m").to_string();
    let scope = match style {
        NumberStyle::Yearly => prefix.clone(),
        NumberStyle::Daily => format!("{prefix}@{compact}"),
        NumberStyle::Monthly => format!("{prefix}@{year}{month}"),
    };

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
        None => legacy_floor(&mut tx, &prefix, style, &day).await?,
    };
    let next = last.unwrap_or(0).max(floor) + 1;
    sqlx::query(
        "INSERT INTO number_sequence (prefix, year, last_value) VALUES (?1, ?2, ?3)
         ON CONFLICT(prefix, year) DO UPDATE SET last_value = excluded.last_value",
    )
    .bind(&scope)
    .bind(year)
    .bind(next)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    tx.commit().await.map_err(AppError::Database)?;

    Ok(match style {
        NumberStyle::Yearly => format!("{prefix}-{year}-{next:04}"),
        NumberStyle::Daily => format!("{prefix}-{compact}-{next:06}"),
        NumberStyle::Monthly => format!("{prefix}-{year:04}-{month}-{next:04}"),
    })
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
            let raw: Option<String> =
                sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
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
        ("ux_purchase_order_order_number", "purchase_order", "order_number"),
        ("ux_invoice_document_number", "invoice_document", "document_number"),
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
