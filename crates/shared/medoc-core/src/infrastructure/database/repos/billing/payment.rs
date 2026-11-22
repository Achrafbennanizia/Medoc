use crate::domain::entities::payment::{BalanceSheet, CreatePayment, UpdatePayment};
use crate::domain::entities::Payment;
use crate::domain::enums::PaymentMethod;
use crate::domain::services::pricing;
use crate::error::AppError;
use crate::infrastructure::database::repos::clinical::chart as chart_repo;
use crate::infrastructure::database::repos::scheduling::practice_task as practice_task_repo;
use sqlx::SqlitePool;

/// Older databases were created before `payment.updated_at` existed. Reads that
/// decode the column fail with "no column found for name: updated_at" until it is added.
async fn ensure_payment_updated_at(pool: &SqlitePool) -> Result<(), AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('payment') WHERE name = 'updated_at'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if n == 0 {
        sqlx::query("ALTER TABLE payment ADD COLUMN updated_at TEXT")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        // Row stamps for existing installs are filled by
        // `ensure_updated_at_on_synced_tables` in rust_only migrations.
    }
    Ok(())
}

fn compute_payment_status(amount: f64, erwartet: Option<f64>) -> &'static str {
    // Positive expected remaining/due amount (> 0); values ≤ 0 are ignored.
    let exp_positive = erwartet.filter(|e| e.is_finite() && *e > pricing::MONEY_ZERO_EUR);

    if amount <= pricing::MONEY_ZERO_EUR {
        // Open placeholder booking or no payment amount posted yet.
        match exp_positive {
            Some(_) => return "OUTSTANDING",
            None => {
                if matches!(erwartet, Some(e) if e.is_finite() && (-pricing::MONEY_ZERO_EUR..=pricing::MONEY_ZERO_EUR).contains(&e))
                {
                    return "PAID";
                }
                return "OUTSTANDING";
            }
        }
    }
    match exp_positive {
        Some(exp) => {
            if amount + pricing::MONEY_ZERO_EUR >= exp {
                "PAID"
            } else {
                "PARTIALLY_PAID"
            }
        }
        None => "PAID",
    }
}

async fn refresh_payment_status(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    ensure_payment_updated_at(pool).await?;
    let row: Option<(Option<f64>, f64)> = sqlx::query_as(
        "SELECT CAST(amount_expected AS REAL), CAST(amount AS REAL) FROM payment WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    let Some((erw, b)) = row else {
        return Ok(());
    };
    let st = compute_payment_status(b, erw);
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE payment SET status = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2",
    )
        .bind(st)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "payment", id, "UPDATE")
        .await?;
    tx.commit().await?;
    Ok(())
}

/// FA-LEIST-06 placeholder: open booking with amount ≈ 0 that should be filled in place
/// when reception records the real payment (avoid a second “still outstanding” row).
async fn find_zero_amount_open_booking_id(
    pool: &SqlitePool,
    patient_id: &str,
    treatment_id: Option<&str>,
    examination_id: Option<&str>,
) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = if let Some(bid) = treatment_id {
        sqlx::query_as(
            "SELECT id FROM payment
             WHERE patient_id = ?1 AND treatment_id = ?2
               AND amount <= ?3
               AND TRIM(UPPER(COALESCE(status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID')
             ORDER BY datetime(created_at) ASC
             LIMIT 1",
        )
        .bind(patient_id)
        .bind(bid)
        .bind(pricing::MONEY_ZERO_EUR)
        .fetch_optional(pool)
        .await?
    } else if let Some(uid) = examination_id {
        sqlx::query_as(
            "SELECT id FROM payment
             WHERE patient_id = ?1 AND examination_id = ?2
               AND amount <= ?3
               AND TRIM(UPPER(COALESCE(status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID')
             ORDER BY datetime(created_at) ASC
             LIMIT 1",
        )
        .bind(patient_id)
        .bind(uid)
        .bind(pricing::MONEY_ZERO_EUR)
        .fetch_optional(pool)
        .await?
    } else {
        None
    };
    Ok(row.map(|r| r.0))
}

async fn after_payment_may_be_paid(pool: &SqlitePool, payment: &Payment) -> Result<(), AppError> {
    if !payment.status.eq_ignore_ascii_case("PAID") {
        return Ok(());
    }
    practice_task_repo::close_billing_tasks_after_payment_paid(
        pool,
        &payment.id,
        payment.treatment_id.as_deref(),
        payment.examination_id.as_deref(),
    )
    .await
}

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Payment>, AppError> {
    ensure_payment_updated_at(pool).await?;
    let rows = sqlx::query_as::<_, Payment>("SELECT * FROM payment ORDER BY created_at DESC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

/// Filters for paginated payment lists (finance / cash / day-close).
#[derive(Debug, Default, Clone)]
pub struct PaymentListFilter<'a> {
    pub status: Option<&'a str>,
    pub payment_method: Option<&'a str>,
    /// Inclusive practice-local calendar day `YYYY-MM-DD` (F77: converted to UTC bounds).
    pub date_on: Option<&'a str>,
    pub date_from: Option<&'a str>,
    pub date_to: Option<&'a str>,
    /// Practice-local day the money was recorded: `created_at` or a later `updated_at`
    /// (a 0 € booking filled in on a later day).
    pub active_on: Option<&'a str>,
}

pub async fn find_paginated(
    pool: &SqlitePool,
    limit: u32,
    offset: u32,
    sort_dir_sql: &'static str,
    filter: PaymentListFilter<'_>,
) -> Result<(Vec<Payment>, i64), AppError> {
    ensure_payment_updated_at(pool).await?;
    // sort_dir_sql is whitelisted by callers (ASC|DESC only).
    let mut wheres: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();
    if let Some(s) = filter.status {
        if s.contains(',') {
            let parts: Vec<&str> = s
                .split(',')
                .map(str::trim)
                .filter(|x| !x.is_empty())
                .collect();
            if !parts.is_empty() {
                let start = binds.len() + 1;
                for p in &parts {
                    binds.push((*p).to_string());
                }
                let ph: Vec<String> = (0..parts.len())
                    .map(|i| format!("UPPER(?{})", start + i))
                    .collect();
                wheres.push(format!(
                    "TRIM(UPPER(COALESCE(status, ''))) IN ({})",
                    ph.join(", ")
                ));
            }
        } else {
            wheres.push(format!(
                "TRIM(UPPER(COALESCE(status, ''))) = UPPER(?{})",
                binds.len() + 1
            ));
            binds.push(s.to_string());
        }
    }
    if let Some(m) = filter.payment_method {
        wheres.push(format!(
            "TRIM(UPPER(COALESCE(payment_method, ''))) = UPPER(?{})",
            binds.len() + 1
        ));
        binds.push(m.to_string());
    }
    // F77: `created_at` is UTC; a "day" is the practice-local day.
    let tz = crate::domain::practice_time::practice_tz(pool).await;
    let day_start = |ymd: &str| -> Result<String, AppError> {
        let d = chrono::NaiveDate::parse_from_str(ymd.trim(), "%Y-%m-%d")
            .map_err(|_| AppError::Validation("Date must be in yyyy-MM-dd format".into()))?;
        Ok(crate::domain::practice_time::local_day_bounds_utc(d, tz)
            .0
            .format("%Y-%m-%d %H:%M:%S")
            .to_string())
    };
    let day_end = |ymd: &str| -> Result<String, AppError> {
        let d = chrono::NaiveDate::parse_from_str(ymd.trim(), "%Y-%m-%d")
            .map_err(|_| AppError::Validation("Date must be in yyyy-MM-dd format".into()))?;
        Ok(crate::domain::practice_time::local_day_bounds_utc(d, tz)
            .1
            .format("%Y-%m-%d %H:%M:%S")
            .to_string())
    };
    if let Some(d) = filter.active_on {
        let from = day_start(d)?;
        let to = day_end(d)?;
        let i = binds.len();
        wheres.push(format!(
            "(julianday(created_at) >= julianday(?{a}) AND julianday(created_at) < julianday(?{b}) \
              OR (updated_at IS NOT NULL AND julianday(updated_at) >= julianday(?{c}) \
                  AND julianday(updated_at) < julianday(?{d})))",
            a = i + 1,
            b = i + 2,
            c = i + 3,
            d = i + 4,
        ));
        binds.push(from.clone());
        binds.push(to.clone());
        binds.push(from);
        binds.push(to);
    }
    let (from, to) = match filter.date_on {
        Some(d) => (Some(day_start(d)?), Some(day_end(d)?)),
        None => (
            filter.date_from.map(day_start).transpose()?,
            filter.date_to.map(day_end).transpose()?,
        ),
    };
    if let Some(f) = from {
        wheres.push(format!(
            "julianday(created_at) >= julianday(?{})",
            binds.len() + 1
        ));
        binds.push(f);
    }
    if let Some(t) = to {
        wheres.push(format!(
            "julianday(created_at) < julianday(?{})",
            binds.len() + 1
        ));
        binds.push(t);
    }
    let where_sql = if wheres.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", wheres.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM payment {where_sql}");
    let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
    for b in &binds {
        count_q = count_q.bind(b);
    }
    let total = count_q.fetch_one(pool).await?.0;

    let lim_i = binds.len() + 1;
    let off_i = binds.len() + 2;
    let list_sql = format!(
        "SELECT * FROM payment {where_sql} ORDER BY created_at {sort_dir_sql} LIMIT ?{lim_i} OFFSET ?{off_i}"
    );
    let mut list_q = sqlx::query_as::<_, Payment>(&list_sql);
    for b in &binds {
        list_q = list_q.bind(b);
    }
    let rows = list_q
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(pool)
        .await?;
    Ok((rows, total))
}

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

pub async fn finance_kpis(pool: &SqlitePool) -> Result<PaymentFinanceKpis, AppError> {
    let row: (f64, f64, f64, f64, i64, f64) = sqlx::query_as(
        "SELECT
            CAST(COALESCE(SUM(CASE
                WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
                 AND TRIM(UPPER(COALESCE(status,''))) IN ('PAID','PARTIALLY_PAID')
                THEN amount ELSE 0 END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE
                WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime', '-1 month')
                 AND TRIM(UPPER(COALESCE(status,''))) IN ('PAID','PARTIALLY_PAID')
                THEN amount ELSE 0 END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE
                WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
                 AND TRIM(UPPER(COALESCE(status,''))) = 'CANCELLED'
                THEN amount ELSE 0 END), 0) AS REAL),
            CAST(COALESCE(SUM(CASE
                WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime', '-1 month')
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

pub async fn find_by_patient_id(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Payment>, AppError> {
    // Same projection as the finance list (`SELECT *`): works whether or not the
    // database already has `payment.updated_at` (`Payment.updated_at` is
    // `#[sqlx(default)]`). Naming the column here failed on older databases.
    let rows = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payment WHERE patient_id = ?1 ORDER BY created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Patient list: flag “invoice open” without loading all bookings.
pub async fn patient_ids_open_invoice(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT patient_id FROM payment
         WHERE TRIM(UPPER(COALESCE(status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID')
         ORDER BY patient_id",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// A payment on a treatment or examination marks that line released for billing.
/// Rows saved before the release step, or whose automatic release failed, can then be paid.
pub async fn ensure_released_for_payment(
    pool: &SqlitePool,
    staff_id: &str,
    data: &CreatePayment,
) -> Result<(), AppError> {
    if let Some(id) = data
        .treatment_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT released_by_physician_id, released_at FROM treatment WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;
        if let Some((by, at)) = row {
            if !crate::domain::services::pricing::is_released_for_billing(
                by.as_deref(),
                at.as_deref(),
            ) {
                chart_repo::release_treatment_for_billing(pool, id, staff_id).await?;
            }
        }
    }
    if let Some(id) = data
        .examination_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT released_by_physician_id, released_at FROM examination WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;
        if let Some((by, at)) = row {
            if !crate::domain::services::pricing::is_released_for_billing(
                by.as_deref(),
                at.as_deref(),
            ) {
                chart_repo::release_examination_for_billing(pool, id, staff_id).await?;
            }
        }
    }
    Ok(())
}

pub async fn create(pool: &SqlitePool, data: &CreatePayment) -> Result<Payment, AppError> {
    ensure_payment_updated_at(pool).await?;
    let id = uuid::Uuid::new_v4().to_string();
    let payment_method = serde_json::to_string(&data.payment_method)
        .map_err(|e| AppError::Internal(format!("Serialize payment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    if data.treatment_id.is_some() && data.examination_id.is_some() {
        return Err(AppError::validation_code("error.payment.dual_link"));
    }

    let mut amount_expected = data.amount_expected;
    if let Some(ref bid) = data.treatment_id {
        let row: Option<(Option<f64>, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT b.total_cost, b.released_by_physician_id, b.released_at FROM treatment b
             JOIN patient_chart a ON b.chart_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((_, vid, vam)) = row else {
            return Err(AppError::validation_code(
                "error.payment.treatment_not_found",
            ));
        };
        crate::domain::services::pricing::require_released_for_billing(
            vid.as_deref(),
            vam.as_deref(),
            "error.entity.treatment",
        )?;
    }
    if let Some(ref uid) = data.examination_id {
        let ok: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT u.id, u.released_by_physician_id, u.released_at FROM examination u
             JOIN patient_chart a ON u.chart_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((_, vid, vam)) = ok else {
            return Err(AppError::validation_code(
                "error.payment.examination_not_found",
            ));
        };
        crate::domain::services::pricing::require_released_for_billing(
            vid.as_deref(),
            vam.as_deref(),
            "error.entity.examination",
        )?;
    }

    let is_placeholder = data.amount <= pricing::MONEY_ZERO_EUR;
    if data.amount < -pricing::MONEY_ZERO_EUR {
        return Err(AppError::validation_code("error.payment.amount_invalid"));
    }
    if is_placeholder && data.service_item_id.is_some() {
        return Err(AppError::validation_code(
            "error.payment.service_item_positive_required",
        ));
    }

    // F79: the entered amount is what was charged. The catalog price is only
    // the form's initial value; it no longer overwrites a discount or surcharge.
    let amount = if is_placeholder {
        0.0
    } else {
        if let Some(ref lid) = data.service_item_id {
            let exists: Option<i64> =
                sqlx::query_scalar("SELECT 1 FROM service_item WHERE id = ?1")
                    .bind(lid)
                    .fetch_optional(pool)
                    .await?;
            if exists.is_none() {
                return Err(AppError::NotFound("Service item".into()));
            }
        }
        data.amount
    };

    if let Some(ref bid) = data.treatment_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT b.total_cost FROM treatment b
             JOIN patient_chart a ON b.chart_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_paid: f64 = sqlx::query_scalar(
                    "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
                     WHERE treatment_id = ?1 AND patient_id = ?2
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(bid)
                .bind(&data.patient_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                // Parity with UI: `Math.max(0, roundMoney2(gesamt - paidSoFar))`
                let open = pricing::round_money_2(g - sum_paid).max(0.0);
                if amount > open + pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_treatment",
                        &[
                            ("max", &format!("{open:.2}")),
                            ("paid", &format!("{sum_paid:.2}")),
                            ("target", &format!("{g:.2}")),
                        ],
                    ));
                }
                amount_expected = Some(open);
            }
        }
    }

    if let Some(ref uid) = data.examination_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT u.total_cost FROM examination u
             JOIN patient_chart a ON u.chart_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_paid: f64 = sqlx::query_scalar(
                    "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
                     WHERE examination_id = ?1 AND patient_id = ?2
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(uid)
                .bind(&data.patient_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let open = pricing::round_money_2(g - sum_paid).max(0.0);
                if amount > open + pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_examination",
                        &[
                            ("max", &format!("{open:.2}")),
                            ("paid", &format!("{sum_paid:.2}")),
                            ("target", &format!("{g:.2}")),
                        ],
                    ));
                }
                amount_expected = Some(open);
            }
        }
    }

    let status = compute_payment_status(amount, amount_expected);

    // Prefer updating the FA-LEIST-06 0 € open booking instead of inserting a second row.
    if let Some(existing_id) = find_zero_amount_open_booking_id(
        pool,
        &data.patient_id,
        data.treatment_id.as_deref(),
        data.examination_id.as_deref(),
    )
    .await?
    {
        sqlx::query(
            "UPDATE payment SET
                amount = ?1,
                payment_method = ?2,
                status = ?3,
                service_item_id = ?4,
                description = COALESCE(?5, description),
                amount_expected = ?6,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?7",
        )
        .bind(amount)
        .bind(&payment_method)
        .bind(status)
        .bind(&data.service_item_id)
        .bind(&data.description)
        .bind(amount_expected)
        .bind(&existing_id)
        .execute(pool)
        .await?;

        let updated = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
            .bind(&existing_id)
            .fetch_one(pool)
            .await?;
        let body = serde_json::to_string(&updated)
            .unwrap_or_else(|_| format!("{{\"id\":\"{existing_id}\"}}"));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "payment",
            &existing_id,
            "UPDATE",
            &body,
        )
        .await?;
        after_payment_may_be_paid(pool, &updated).await?;
        return Ok(updated);
    }

    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, service_item_id, description, treatment_id, examination_id, amount_expected, cash_verified, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(amount)
    .bind(&payment_method)
    .bind(status)
    .bind(&data.service_item_id)
    .bind(&data.description)
    .bind(&data.treatment_id)
    .bind(&data.examination_id)
    .bind(amount_expected)
    .execute(pool)
    .await?;

    let inserted = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "payment", &id, "INSERT", &body,
    )
    .await?;
    after_payment_may_be_paid(pool, &inserted).await?;
    Ok(inserted)
}

fn open_booking_description(service_name: Option<&str>, _total_cost: Option<f64>) -> String {
    service_name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("")
        .to_string()
}

async fn refresh_zero_open_booking_from_clinical(
    pool: &SqlitePool,
    payment_id: &str,
    amount_expected: Option<f64>,
    description: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE payment SET
            amount_expected = ?1,
            description = ?2,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?3
           AND amount <= ?4
           AND TRIM(UPPER(COALESCE(status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID')",
    )
    .bind(amount_expected)
    .bind(description)
    .bind(payment_id)
    .bind(pricing::PAYMENT_BOOKING_TOLERANCE_EUR)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx, "payment", payment_id, "UPDATE",
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

/// FA-LEIST-06: implicit release + open booking (`OUTSTANDING`, 0 €) for billable treatment.
pub async fn ensure_open_booking_for_billable_treatment(
    pool: &SqlitePool,
    treatment_id: &str,
    physician_staff_id: &str,
) -> Result<(), AppError> {
    let b = chart_repo::find_treatment_by_id(pool, treatment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Treatment".into()))?;
    if !pricing::treatment_has_billable_service_item(b.service_name.as_deref(), b.total_cost) {
        return Ok(());
    }
    if !pricing::is_released_for_billing(
        b.released_by_physician_id.as_deref(),
        b.released_at.as_deref(),
    ) {
        chart_repo::release_treatment_for_billing(pool, treatment_id, physician_staff_id).await?;
    }
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM treatment b
         INNER JOIN patient_chart a ON b.chart_id = a.id
         WHERE b.id = ?1",
    )
    .bind(treatment_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let amount_expected = b
        .total_cost
        .filter(|g| g.is_finite() && *g > pricing::PAYMENT_BOOKING_TOLERANCE_EUR);
    let description = open_booking_description(b.service_name.as_deref(), b.total_cost);

    let existing: Option<(String, f64)> = sqlx::query_as(
        "SELECT id, amount FROM payment
         WHERE patient_id = ?1 AND treatment_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')
         ORDER BY datetime(created_at) ASC
         LIMIT 1",
    )
    .bind(&patient_id)
    .bind(treatment_id)
    .fetch_optional(pool)
    .await?;
    if let Some((id, amt)) = existing {
        if amt <= pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
            refresh_zero_open_booking_from_clinical(pool, &id, amount_expected, &description)
                .await?;
        }
        return Ok(());
    }

    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(description),
            treatment_id: Some(treatment_id.to_string()),
            examination_id: None,
            amount_expected,
        },
    )
    .await?;
    Ok(())
}

/// FA-LEIST-06/07: implicit release + open booking for billable examination.
pub async fn ensure_open_booking_for_billable_examination(
    pool: &SqlitePool,
    examination_id: &str,
    physician_staff_id: &str,
) -> Result<(), AppError> {
    let u = chart_repo::find_examination_by_id(pool, examination_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Examination".into()))?;
    if !pricing::treatment_has_billable_service_item(u.service_name.as_deref(), u.total_cost) {
        return Ok(());
    }
    if !pricing::is_released_for_billing(
        u.released_by_physician_id.as_deref(),
        u.released_at.as_deref(),
    ) {
        chart_repo::release_examination_for_billing(pool, examination_id, physician_staff_id)
            .await?;
    }
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM examination u
         INNER JOIN patient_chart a ON u.chart_id = a.id
         WHERE u.id = ?1",
    )
    .bind(examination_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let amount_expected = u
        .total_cost
        .filter(|g| g.is_finite() && *g > pricing::PAYMENT_BOOKING_TOLERANCE_EUR);
    let description = open_booking_description(u.service_name.as_deref(), u.total_cost);

    let existing: Option<(String, f64)> = sqlx::query_as(
        "SELECT id, amount FROM payment
         WHERE patient_id = ?1 AND examination_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')
         ORDER BY datetime(created_at) ASC
         LIMIT 1",
    )
    .bind(&patient_id)
    .bind(examination_id)
    .fetch_optional(pool)
    .await?;
    if let Some((id, amt)) = existing {
        if amt <= pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
            refresh_zero_open_booking_from_clinical(pool, &id, amount_expected, &description)
                .await?;
        }
        return Ok(());
    }

    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(description),
            treatment_id: None,
            examination_id: Some(examination_id.to_string()),
            amount_expected,
        },
    )
    .await?;
    Ok(())
}

/// First open booking (0 €) if no payments exist yet for this examination.
pub async fn ensure_placeholder_for_examination(
    pool: &SqlitePool,
    examination_id: &str,
) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM examination u
         INNER JOIN patient_chart a ON u.chart_id = a.id
         WHERE u.id = ?1",
    )
    .bind(examination_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM payment
         WHERE patient_id = ?1 AND examination_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
    )
    .bind(&patient_id)
    .bind(examination_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: None,
            treatment_id: None,
            examination_id: Some(examination_id.to_string()),
            amount_expected: None,
        },
    )
    .await?;
    Ok(())
}

pub async fn update_fields(pool: &SqlitePool, data: &UpdatePayment) -> Result<Payment, AppError> {
    ensure_payment_updated_at(pool).await?;
    let row: Option<(String, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT status, treatment_id, examination_id, patient_id FROM payment WHERE id = ?1",
    )
    .bind(&data.id)
    .fetch_optional(pool)
    .await?;
    let Some((st, treatment_id, examination_id, patient_id)) = row else {
        return Err(AppError::NotFound("Payment".into()));
    };
    if st != "OUTSTANDING" && st != "PARTIALLY_PAID" {
        return Err(AppError::validation_code(
            "error.payment.edit_locked_status",
        ));
    }
    let payment_method = serde_json::to_string(&data.payment_method)
        .map_err(|e| AppError::Internal(format!("Serialize payment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();
    if data.amount <= 0.0 {
        return Err(AppError::validation_code(
            "error.payment.amount_must_be_positive",
        ));
    }

    if let Some(ref bid) = treatment_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT b.total_cost FROM treatment b
             JOIN patient_chart a ON b.chart_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_others: f64 = sqlx::query_scalar(
                    "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
                     WHERE treatment_id = ?1 AND patient_id = ?2 AND id != ?3
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(bid)
                .bind(&patient_id)
                .bind(&data.id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let max_for_row = pricing::round_money_2(g - sum_others).max(0.0);
                if data.amount > max_for_row + pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_edit_treatment",
                        &[("max", &format!("{max_for_row:.2}"))],
                    ));
                }
            }
        }
    }

    if let Some(ref uid) = examination_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT u.total_cost FROM examination u
             JOIN patient_chart a ON u.chart_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_others: f64 = sqlx::query_scalar(
                    "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
                     WHERE examination_id = ?1 AND patient_id = ?2 AND id != ?3
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(uid)
                .bind(&patient_id)
                .bind(&data.id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let max_for_row = pricing::round_money_2(g - sum_others).max(0.0);
                if data.amount > max_for_row + pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_edit_examination",
                        &[("max", &format!("{max_for_row:.2}"))],
                    ));
                }
            }
        }
    }

    sqlx::query(
        "UPDATE payment SET amount = ?1, payment_method = ?2, service_item_id = ?3, description = ?4,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?5",
    )
    .bind(data.amount)
    .bind(&payment_method)
    .bind(&data.service_item_id)
    .bind(&data.description)
    .bind(&data.id)
    .execute(pool)
    .await?;

    refresh_payment_status(pool, &data.id).await?;

    let updated = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
        .bind(&data.id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Payment".into()))?;
    let body =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", data.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "payment", &data.id, "UPDATE", &body,
    )
    .await?;
    after_payment_may_be_paid(pool, &updated).await?;
    Ok(updated)
}

pub async fn delete_if_pending(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM payment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    let st = row.ok_or(AppError::NotFound("Payment".into()))?.0;
    // F74: a partially paid payment holds money already received; deleting it
    // loses the booking. Only an untouched OUTSTANDING payment may be deleted.
    if st != "OUTSTANDING" {
        return Err(AppError::validation_code(
            "error.payment.delete_locked_status",
        ));
    }
    let n = sqlx::query("DELETE FROM payment WHERE id = ?1 AND status = 'OUTSTANDING'")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::validation_code(
            "error.payment.delete_locked_status",
        ));
    }
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "payment",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> Result<Payment, AppError> {
    ensure_payment_updated_at(pool).await?;
    // F75: only known statuses and allowed transitions.
    let current: Option<String> = sqlx::query_scalar("SELECT status FROM payment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    let current = current.ok_or_else(|| AppError::NotFound("Payment".into()))?;
    let (_, next) = crate::domain::status::PaymentStatus::require_transition(&current, status)?;
    let status = next.as_str();
    sqlx::query(
        "UPDATE payment SET status = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2",
    )
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;

    let updated = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Payment".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "payment", id, "UPDATE", &body,
    )
    .await?;
    after_payment_may_be_paid(pool, &updated).await?;
    Ok(updated)
}

pub async fn get_balance_sheet(pool: &SqlitePool) -> Result<BalanceSheet, AppError> {
    let income: (f64,) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment WHERE status = 'PAID'",
    )
    .fetch_one(pool)
    .await?;

    let outstanding: (f64,) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment WHERE status IN ('OUTSTANDING', 'PARTIALLY_PAID')",
    )
    .fetch_one(pool)
    .await?;

    let cancelled: (f64,) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment WHERE status = 'CANCELLED'",
    )
    .fetch_one(pool)
    .await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM payment")
        .fetch_one(pool)
        .await?;

    Ok(BalanceSheet {
        income: income.0,
        outstanding: outstanding.0,
        cancelled: cancelled.0,
        payment_count: count.0,
    })
}

/// Day close: cash check per payment (0/1).
pub async fn set_cash_verified_for_ids(
    pool: &SqlitePool,
    ids: &[String],
    cash_verified: i64,
) -> Result<u64, AppError> {
    ensure_payment_updated_at(pool).await?;
    let mut n = 0u64;
    let mut tx = pool.begin().await?;
    for id in ids {
        let prev: Option<String> =
            sqlx::query_scalar("SELECT CAST(updated_at AS TEXT) FROM payment WHERE id = ?1")
                .bind(id)
                .fetch_optional(&mut *tx)
                .await?;
        let stamp =
            crate::infrastructure::database::recorded_write::next_updated_at(prev.as_deref());
        let r = sqlx::query("UPDATE payment SET cash_verified = ?1, updated_at = ?2 WHERE id = ?3")
            .bind(cash_verified)
            .bind(&stamp)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        if r.rows_affected() > 0 {
            crate::infrastructure::database::recorded_write::record_in_tx(
                &mut tx, "payment", id, "UPDATE",
            )
            .await?;
            n = n.saturating_add(r.rows_affected());
        }
    }
    tx.commit().await?;
    Ok(n)
}
