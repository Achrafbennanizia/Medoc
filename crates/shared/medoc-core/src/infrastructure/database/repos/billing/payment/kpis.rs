//! Finance KPIs and monthly breakdown of payments (split from `payment.rs`).

use super::*;

/// KPI snapshot for the finance dashboard (avoids shipping every payment row).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentFinanceKpis {
    pub income_mtd: f64,
    pub income_prev_mtd: f64,
    pub cancelled_mtd: f64,
    pub cancelled_prev_mtd: f64,
    pub open_count: i64,
    pub open_sum: f64,
}

/// Month-to-date figures. "Previous" is the same days of last month (1st up to today's date),
/// not the whole of last month: a partial month compared with a full one always looked like a drop.
pub async fn finance_kpis(pool: &SqlitePool) -> Result<PaymentFinanceKpis, AppError> {
    let row: (f64, f64, f64, f64, i64, f64) = sqlx::query_as(
        "SELECT
            CAST(COALESCE(SUM(CASE
                WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
                 AND TRIM(UPPER(COALESCE(status,''))) IN ('PAID','PARTIALLY_PAID')
                THEN amount ELSE 0 END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE
                WHEN date(created_at) >= date('now', 'localtime', 'start of month', '-1 month')
                 AND date(created_at) <= date('now', 'localtime', '-1 month')
                 AND TRIM(UPPER(COALESCE(status,''))) IN ('PAID','PARTIALLY_PAID')
                THEN amount ELSE 0 END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE
                WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
                 AND TRIM(UPPER(COALESCE(status,''))) = 'CANCELLED'
                THEN amount ELSE 0 END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE
                WHEN date(created_at) >= date('now', 'localtime', 'start of month', '-1 month')
                 AND date(created_at) <= date('now', 'localtime', '-1 month')
                 AND TRIM(UPPER(COALESCE(status,''))) = 'CANCELLED'
                THEN amount ELSE 0 END), 0) AS REAL),
            COALESCE(SUM(CASE
                WHEN TRIM(UPPER(COALESCE(status,''))) IN ('OUTSTANDING','PARTIALLY_PAID')
                THEN 1 ELSE 0 END), 0),
            CAST(COALESCE(SUM(CASE
                WHEN TRIM(UPPER(COALESCE(status,''))) IN ('OUTSTANDING','PARTIALLY_PAID')
                THEN amount ELSE 0 END), 0) AS REAL)
         FROM payment",
    )
    .fetch_one(pool)
    .await?;
    Ok(PaymentFinanceKpis {
        income_mtd: row.0,
        income_prev_mtd: row.1,
        cancelled_mtd: row.2,
        cancelled_prev_mtd: row.3,
        open_count: row.4,
        open_sum: row.5,
    })
}

/// Last N calendar months of income / outstanding / cancelled (for balance sheet chart).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentMonthBucket {
    pub year_month: String,
    pub income: f64,
    pub outstanding: f64,
    pub cancelled: f64,
}

pub async fn monthly_breakdown(
    pool: &SqlitePool,
    months: u32,
) -> Result<Vec<PaymentMonthBucket>, AppError> {
    use chrono::Datelike;
    // F77/F105: months are practice-local; `created_at` is UTC.
    let months = months.clamp(1, 36) as i32;
    let tz = crate::domain::practice_time::practice_tz(pool).await;
    let today = chrono::Utc::now().with_timezone(&tz).date_naive();
    let (mut y, mut m) = (today.year(), today.month() as i32 - (months - 1));
    while m <= 0 {
        m += 12;
        y -= 1;
    }
    let (from, _) = crate::domain::practice_time::local_month_bounds_utc(y, m as u32, tz);
    let rows: Vec<(String, String, f64)> = sqlx::query_as(
        "SELECT CAST(created_at AS TEXT), TRIM(UPPER(COALESCE(status,''))), CAST(amount AS REAL)
         FROM payment WHERE julianday(created_at) >= julianday(?1)",
    )
    .bind(from.format("%Y-%m-%d %H:%M:%S").to_string())
    .fetch_all(pool)
    .await?;
    let mut buckets: std::collections::BTreeMap<String, (f64, f64, f64)> = Default::default();
    for (created, status, amount) in rows {
        let Some(utc) = parse_db_utc(&created) else {
            continue;
        };
        let ym = utc.with_timezone(&tz).format("%Y-%m").to_string();
        let b = buckets.entry(ym).or_insert((0.0, 0.0, 0.0));
        match status.as_str() {
            "PAID" => b.0 += amount,
            "OUTSTANDING" | "PARTIALLY_PAID" => b.1 += amount,
            "CANCELLED" => b.2 += amount,
            _ => {}
        }
    }
    Ok(buckets
        .into_iter()
        .rev()
        .take(months as usize)
        .map(
            |(year_month, (income, outstanding, cancelled))| PaymentMonthBucket {
                year_month,
                income,
                outstanding,
                cancelled,
            },
        )
        .collect())
}

/// `created_at` as stored: `YYYY-MM-DD HH:MM:SS` (UTC, SQLite CURRENT_TIMESTAMP) or RFC 3339.
pub fn parse_db_utc(raw: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    let t = raw.trim();
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(t) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    for fmt in [
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S",
    ] {
        if let Ok(n) = chrono::NaiveDateTime::parse_from_str(t.trim_end_matches('Z'), fmt) {
            return Some(chrono::DateTime::from_naive_utc_and_offset(n, chrono::Utc));
        }
    }
    None
}
