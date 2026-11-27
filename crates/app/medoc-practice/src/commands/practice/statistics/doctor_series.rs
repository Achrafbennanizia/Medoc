//! Per-doctor monthly series for multi-line charts (Cabinet+ T5.6).

use serde::Serialize;
use sqlx::SqlitePool;

use super::filters::StatsFilters;
use super::{align_months, MonthBucket};
use crate::error::AppError;

use super::doctor::DoctorScope;

#[derive(Debug, Serialize, Clone)]
pub struct DoctorMonthSeries {
    pub staff_id: String,
    pub name: String,
    pub appointments_per_month: Vec<MonthBucket>,
    pub treatments_per_month: Vec<MonthBucket>,
    pub income_per_month: Option<Vec<MonthBucket>>,
}

pub(super) async fn per_doctor_series(
    pool: &SqlitePool,
    scope: &DoctorScope,
    filters: &StatsFilters,
    allowed: &(dyn Fn(&str) -> bool + Sync),
    months_12: &[String],
    earliest_start: &str,
    earliest_utc: &str,
) -> Result<Vec<DoctorMonthSeries>, AppError> {
    let doctors: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, name FROM staff WHERE UPPER(role) = 'PHYSICIAN' ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    let visible: Vec<(String, String)> = doctors
        .into_iter()
        .filter(|(id, _)| !scope.hidden.contains(id))
        .collect();
    if visible.len() < 2 {
        return Ok(vec![]);
    }

    let mut out = Vec::with_capacity(visible.len());
    for (id, name) in visible {
        let appointments_per_month = if allowed("appointment.read") {
            let rows: Vec<(String, i64)> = sqlx::query_as(
                "SELECT strftime('%Y-%m', date) AS m, COUNT(*) AS c
                 FROM appointment
                 WHERE date >= ?1 AND physician_id = ?2
                   AND status NOT IN ('CANCELLED','NO_SHOW')
                 GROUP BY m ORDER BY m",
            )
            .bind(earliest_start)
            .bind(&id)
            .fetch_all(pool)
            .await?;
            let f: Vec<(String, f64)> = rows.into_iter().map(|(m, c)| (m, c as f64)).collect();
            align_months(f, months_12)
        } else {
            vec![]
        };

        let treatments_per_month = if allowed("patient.read_medical") {
            let sql = format!(
                "SELECT strftime('%Y-%m', COALESCE(treatment_date, created_at)) AS m, COUNT(*) AS c
                 FROM treatment
                 WHERE COALESCE(treatment_date, created_at) >= ?1 AND responsible_staff_id = ?2{}
                 GROUP BY m ORDER BY m",
                filters.treatment_clause(3)
            );
            let mut q = sqlx::query_as::<_, (String, i64)>(&sql)
                .bind(earliest_start)
                .bind(&id);
            if let Some(k) = &filters.treatment_kind {
                q = q.bind(k);
            }
            let rows = q.fetch_all(pool).await?;
            let f: Vec<(String, f64)> = rows.into_iter().map(|(m, c)| (m, c as f64)).collect();
            align_months(f, months_12)
        } else {
            vec![]
        };

        let income_per_month = if allowed("finance.read") {
            let sql = format!(
                "SELECT strftime('%Y-%m', created_at) AS m, CAST(COALESCE(SUM(amount), 0) AS REAL)
                 FROM payment
                 WHERE status IN ('PAID','PARTIALLY_PAID') AND julianday(created_at) >= julianday(?1)
                   AND for_staff_id = ?2{}
                 GROUP BY m ORDER BY m",
                filters.payment_clause(3)
            );
            let mut q = sqlx::query_as::<_, (String, f64)>(&sql)
                .bind(earliest_utc)
                .bind(&id);
            if let Some(p) = &filters.payment_method {
                q = q.bind(p);
            }
            let rows = q.fetch_all(pool).await?;
            Some(align_months(rows, months_12))
        } else {
            None
        };

        out.push(DoctorMonthSeries {
            staff_id: id,
            name,
            appointments_per_month,
            treatments_per_month,
            income_per_month,
        });
    }
    Ok(out)
}