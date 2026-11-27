//! Reserved number blocks for the second admin hub (Group, T4.3, editions-plan §4.4).
//!
//! The primary hub owns every sequence. It reserves a block of numbers (default 50) for hub B
//! and moves its own counter past the block, so the two never hand out the same number. Hub B
//! issues from its block only while the primary is unreachable, and asks for a new block when
//! half of the current one is used.
//!
//! `number_block` is device-local on both sides: on the primary a row records what was reserved
//! for which hub; on hub B a row is a block it issues from (`next_value`). Numbers of a block
//! whose period has ended and that were never issued are *void*: [`void_ranges`] lists them for
//! the period report, so a missing number is explained, never silent.

use chrono::NaiveDate;
use sqlx::SqlitePool;

use super::{advance, format_number, normalize_prefix, parse_day, scope_of, NumberStyle};
use crate::error::AppError;

/// Numbers per block when the caller does not say.
pub const DEFAULT_BLOCK_SIZE: i64 = 50;
/// Largest block the primary hands out.
pub const MAX_BLOCK_SIZE: i64 = 200;

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS number_block (
            scope TEXT NOT NULL,
            year INTEGER NOT NULL,
            holder_device_id TEXT NOT NULL,
            prefix TEXT NOT NULL,
            style TEXT NOT NULL,
            day TEXT NOT NULL,
            first_value INTEGER NOT NULL,
            last_value INTEGER NOT NULL,
            next_value INTEGER,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            PRIMARY KEY (scope, year, holder_device_id, first_value)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// A block as the primary sends it to hub B.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberBlock {
    pub prefix: String,
    pub style: String,
    /// `yyyy-MM-dd` the numbers are formatted with.
    pub day: String,
    pub first: i64,
    pub last: i64,
}

/// Primary hub: reserve `size` numbers for `holder` and record the reservation.
pub async fn reserve(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
    size: i64,
    holder: &str,
) -> Result<NumberBlock, AppError> {
    let holder = holder.trim();
    if holder.is_empty() {
        return Err(AppError::Validation(
            "number block needs a holder device".into(),
        ));
    }
    ensure_table(pool).await?;
    let range = advance(pool, prefix, ymd, style, size.clamp(1, MAX_BLOCK_SIZE)).await?;
    let block = NumberBlock {
        prefix: range.prefix,
        style: style.as_str().to_string(),
        day: range.day,
        first: range.first,
        last: range.last,
    };
    insert(pool, &block, holder, None).await?;
    tracing::info!(
        target: "medoc::sync",
        event = "NUMBER_BLOCK_RESERVED",
        prefix = %block.prefix,
        first = block.first,
        last = block.last,
        holder = %holder,
    );
    Ok(block)
}

/// Hub B: keep a block received from the primary.
pub async fn keep(pool: &SqlitePool, block: &NumberBlock, holder: &str) -> Result<(), AppError> {
    if block.first < 1 || block.last < block.first {
        return Err(AppError::Validation("invalid number block".into()));
    }
    NumberStyle::parse(Some(&block.style))?;
    ensure_table(pool).await?;
    insert(pool, block, holder, Some(block.first)).await
}

async fn insert(
    pool: &SqlitePool,
    block: &NumberBlock,
    holder: &str,
    next: Option<i64>,
) -> Result<(), AppError> {
    let style = NumberStyle::parse(Some(&block.style))?;
    let prefix = normalize_prefix(&block.prefix)?;
    let (scope, year) = scope_of(&prefix, style, &parse_day(&block.day)?);
    sqlx::query(
        "INSERT OR IGNORE INTO number_block
            (scope, year, holder_device_id, prefix, style, day, first_value, last_value, next_value)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(scope)
    .bind(year)
    .bind(holder)
    .bind(prefix)
    .bind(style.as_str())
    .bind(&block.day)
    .bind(block.first)
    .bind(block.last)
    .bind(next)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Hub B: numbers still free in its blocks for this sequence.
pub async fn remaining(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
    holder: &str,
) -> Result<i64, AppError> {
    ensure_table(pool).await?;
    let prefix = normalize_prefix(prefix)?;
    let (scope, year) = scope_of(&prefix, style, &parse_day(ymd)?);
    let n: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(last_value - next_value + 1), 0) FROM number_block
         WHERE scope = ?1 AND year = ?2 AND holder_device_id = ?3
           AND next_value IS NOT NULL AND next_value <= last_value",
    )
    .bind(scope)
    .bind(year)
    .bind(holder)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n)
}

/// Hub B, primary unreachable: the next number of its oldest open block, or `None` when it
/// holds no free number for this sequence.
pub async fn take(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
    holder: &str,
) -> Result<Option<String>, AppError> {
    ensure_table(pool).await?;
    let prefix = normalize_prefix(prefix)?;
    let (scope, year) = scope_of(&prefix, style, &parse_day(ymd)?);
    let mut tx = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;
    let row: Option<(i64, i64, String)> = sqlx::query_as(
        "SELECT first_value, next_value, day FROM number_block
         WHERE scope = ?1 AND year = ?2 AND holder_device_id = ?3
           AND next_value IS NOT NULL AND next_value <= last_value
         ORDER BY first_value LIMIT 1",
    )
    .bind(&scope)
    .bind(year)
    .bind(holder)
    .fetch_optional(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    let Some((first, next, day)) = row else {
        return Ok(None);
    };
    sqlx::query(
        "UPDATE number_block SET next_value = next_value + 1
         WHERE scope = ?1 AND year = ?2 AND holder_device_id = ?3 AND first_value = ?4",
    )
    .bind(&scope)
    .bind(year)
    .bind(holder)
    .bind(first)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::sync",
        event = "NUMBER_FROM_BLOCK",
        prefix = %prefix,
        number = next,
    );
    format_number(&prefix, style, &day, next).map(Some)
}

/// Numbers of a block that were never issued and can no longer be: the block's period
/// (day, month or year, by style) ended before `today`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoidRange {
    pub prefix: String,
    pub first: String,
    pub last: String,
    pub count: i64,
}

/// Hub B: void numbers of its expired blocks, for the period report.
pub async fn void_ranges(
    pool: &SqlitePool,
    holder: &str,
    today: NaiveDate,
) -> Result<Vec<VoidRange>, AppError> {
    void_ranges_where(pool, Some(holder), "0000-01-01", "9999-12-31", today).await
}

/// Void numbers of every device's expired blocks reserved on a day in `[from, to]`
/// (`YYYY-MM-DD`). Block rows sync, so any hub sees them all: the period report lists them so a
/// number never goes missing without a trace (editions-plan §4.4).
pub async fn void_ranges_between(
    pool: &SqlitePool,
    from: &str,
    to: &str,
    today: NaiveDate,
) -> Result<Vec<VoidRange>, AppError> {
    void_ranges_where(pool, None, from, to, today).await
}

async fn void_ranges_where(
    pool: &SqlitePool,
    holder: Option<&str>,
    from: &str,
    to: &str,
    today: NaiveDate,
) -> Result<Vec<VoidRange>, AppError> {
    ensure_table(pool).await?;
    let rows: Vec<(String, String, String, i64, i64)> = sqlx::query_as(
        "SELECT prefix, style, day, next_value, last_value FROM number_block
         WHERE (?1 IS NULL OR holder_device_id = ?1) AND substr(day, 1, 10) BETWEEN ?2 AND ?3
           AND next_value IS NOT NULL AND next_value <= last_value
         ORDER BY prefix, day, first_value",
    )
    .bind(holder)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut out = Vec::new();
    for (prefix, style, day, next, last) in rows {
        let style = NumberStyle::parse(Some(&style))?;
        let d = parse_day(&day)?;
        let (scope, year) = scope_of(&prefix, style, &d);
        if (scope.clone(), year) == scope_of(&prefix, style, &today) {
            continue; // still usable
        }
        out.push(VoidRange {
            first: format_number(&prefix, style, &day, next)?,
            last: format_number(&prefix, style, &day, last)?,
            count: last - next + 1,
            prefix,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        super::super::ensure_table(&pool).await.unwrap();
        sqlx::query("CREATE TABLE app_kv (key TEXT PRIMARY KEY, value TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    #[tokio::test]
    async fn primary_and_hub_b_never_issue_the_same_number() {
        let main = pool().await;
        let hub_b = pool().await;
        let day = "2026-11-24";
        let n1 = super::super::allocate_styled(&main, "F", day, NumberStyle::Yearly)
            .await
            .unwrap();
        let block = reserve(&main, "F", day, NumberStyle::Yearly, 3, "hub-b")
            .await
            .unwrap();
        assert_eq!((block.first, block.last), (2, 4));
        let n_main = super::super::allocate_styled(&main, "F", day, NumberStyle::Yearly)
            .await
            .unwrap();
        keep(&hub_b, &block, "hub-b").await.unwrap();
        let mut from_b = Vec::new();
        while let Some(n) = take(&hub_b, "F", day, NumberStyle::Yearly, "hub-b")
            .await
            .unwrap()
        {
            from_b.push(n);
        }
        assert_eq!(n1, "F-2026-0001");
        assert_eq!(n_main, "F-2026-0005");
        assert_eq!(from_b, ["F-2026-0002", "F-2026-0003", "F-2026-0004"]);
        assert_eq!(
            remaining(&hub_b, "F", day, NumberStyle::Yearly, "hub-b")
                .await
                .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn unused_numbers_of_an_ended_day_are_listed_as_void() {
        let hub_b = pool().await;
        let block = NumberBlock {
            prefix: "RE".into(),
            style: "daily".into(),
            day: "2026-11-23".into(),
            first: 10,
            last: 14,
        };
        keep(&hub_b, &block, "hub-b").await.unwrap();
        take(&hub_b, "RE", "2026-11-23", NumberStyle::Daily, "hub-b")
            .await
            .unwrap();
        let same_day = NaiveDate::from_ymd_opt(2026, 11, 23).unwrap();
        assert!(void_ranges(&hub_b, "hub-b", same_day)
            .await
            .unwrap()
            .is_empty());
        let next_day = NaiveDate::from_ymd_opt(2026, 11, 24).unwrap();
        let void = void_ranges(&hub_b, "hub-b", next_day).await.unwrap();
        assert_eq!(void.len(), 1);
        assert_eq!(
            (void[0].first.as_str(), void[0].last.as_str(), void[0].count),
            ("RE-20261123-000011", "RE-20261123-000014", 4)
        );
        // The period report sees every holder's blocks, but only those of its period.
        assert_eq!(
            void_ranges_between(&hub_b, "2026-11-01", "2026-11-30", next_day)
                .await
                .unwrap(),
            void
        );
        assert!(void_ranges_between(&hub_b, "2026-12-01", "2026-12-31", next_day)
            .await
            .unwrap()
            .is_empty());
    }

    #[tokio::test]
    async fn a_block_for_another_day_is_not_used() {
        let hub_b = pool().await;
        let block = NumberBlock {
            prefix: "RE".into(),
            style: "daily".into(),
            day: "2026-11-23".into(),
            first: 1,
            last: 5,
        };
        keep(&hub_b, &block, "hub-b").await.unwrap();
        assert_eq!(
            take(&hub_b, "RE", "2026-11-24", NumberStyle::Daily, "hub-b")
                .await
                .unwrap(),
            None
        );
    }
}
