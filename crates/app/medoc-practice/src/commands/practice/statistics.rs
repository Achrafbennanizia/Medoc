use crate::application::rbac::{self, Role};
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

mod doctor;
mod doctor_series;
mod filters;
use doctor::{doctor_scope, scoped, scoped_payment, scoped_treatment};
use doctor_series::per_doctor_series;
pub use doctor::DoctorFigures;
pub use doctor_series::DoctorMonthSeries;
pub use filters::StatsFilters;

type PracticeTz = medoc_core::domain::practice_time::Tz;

/// UTC timestamp (SQLite text form) at which local day `d` starts.
fn local_day_start_sql(d: chrono::NaiveDate, tz: PracticeTz) -> String {
    medoc_core::domain::practice_time::local_day_bounds_utc(d, tz)
        .0
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

fn local_today(tz: PracticeTz) -> chrono::NaiveDate {
    chrono::Utc::now().with_timezone(&tz).date_naive()
}

fn local_month_start(tz: PracticeTz) -> chrono::NaiveDate {
    use chrono::Datelike;
    let t = local_today(tz);
    chrono::NaiveDate::from_ymd_opt(t.year(), t.month(), 1).unwrap_or(t)
}

/// F105: group `(created_at UTC, value)` rows by practice-local `YYYY-MM`.
fn bucket_local_months(rows: Vec<(String, f64)>, tz: PracticeTz) -> Vec<(String, f64)> {
    let mut map: std::collections::BTreeMap<String, f64> = Default::default();
    for (created, v) in rows {
        if let Some(utc) =
            medoc_core::infrastructure::database::repos::billing::payment::parse_db_utc(&created)
        {
            *map.entry(utc.with_timezone(&tz).format("%Y-%m").to_string())
                .or_insert(0.0) += v;
        }
    }
    map.into_iter().collect()
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub patients_total: Option<i64>,
    pub appointments_today: Option<i64>,
    pub revenue_today: Option<f64>,
    pub revenue_month: Option<f64>,
    pub products_low: Option<i64>,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_dashboard_stats(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<DashboardStats, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    dashboard_stats(pool.inner(), &session).await
}

/// Dashboard KPI tiles; doctor-scoped rows honour `ShareArea::Statistics` (Cabinet+).
pub async fn dashboard_stats(
    pool: &SqlitePool,
    session: &medoc_core::application::auth_service::Session,
) -> Result<DashboardStats, AppError> {
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    let ov = &session.permission_overrides;
    let allowed = |action: &str| rbac::effective_allowed(action, role, ov);
    let scope = doctor_scope(pool, session, None).await?;

    let patients_total = if allowed("patient.read") {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
            .fetch_one(pool)
            .await?;
        Some(row.0)
    } else {
        None
    };

    let tz = medoc_core::domain::practice_time::practice_tz(pool).await;
    let appointments_today = if allowed("appointment.read") {
        // F105: local day; cancelled and no-show do not count as today's work.
        let today = local_today(tz).format("%Y-%m-%d").to_string();
        let row: (i64,) = scoped(
            sqlx::query_as(&format!(
                "SELECT COUNT(*) FROM appointment WHERE date = ?1 AND status NOT IN ('CANCELLED','NO_SHOW'){}",
                scope.clause("physician_id", 2)
            ))
            .bind(&today),
            &scope,
        )
        .fetch_one(pool)
        .await?;
        Some(row.0)
    } else {
        None
    };

    let (revenue_today, revenue_month) = if allowed("finance.read") {
        // F105: income = paid and partially paid, in the practice time zone.
        let income_since = format!(
            "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
             WHERE status IN ('PAID','PARTIALLY_PAID') AND julianday(created_at) >= julianday(?1){}",
            scope.clause("for_staff_id", 2)
        );
        let today: (f64,) = scoped(
            sqlx::query_as(&income_since).bind(local_day_start_sql(local_today(tz), tz)),
            &scope,
        )
        .fetch_one(pool)
        .await?;
        let month: (f64,) = scoped(
            sqlx::query_as(&income_since).bind(local_day_start_sql(local_month_start(tz), tz)),
            &scope,
        )
        .fetch_one(pool)
        .await?;
        (Some(today.0), Some(month.0))
    } else {
        (None, None)
    };

    let products_low = if allowed("product.read") {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM product WHERE active = 1 AND min_stock IS NOT NULL AND min_stock > 0 AND stock <= min_stock")
                .fetch_one(pool)
                .await?;
        Some(row.0)
    } else {
        None
    };

    Ok(DashboardStats {
        patients_total,
        appointments_today,
        revenue_today,
        revenue_month,
        products_low,
    })
}

// ---------------------------------------------------------------------------
// Statistics overview — populates the rich statistics page with charts.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct MonthBucket {
    /// `YYYY-MM` (e.g. `"2026-04"`)
    pub month: String,
    pub value: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct LabelValue {
    pub label: String,
    pub value: f64,
}

#[derive(Debug, Serialize, Default)]
pub struct StatisticsOverview {
    // Patients
    /// F106: `None` when the caller may not read this section (card hidden).
    pub patients_total: Option<i64>,
    pub new_patients_per_month: Vec<MonthBucket>,
    pub patients_cumulative_per_month: Vec<MonthBucket>,
    pub age_groups: Vec<LabelValue>,
    pub sexes: Vec<LabelValue>,
    pub patient_status: Vec<LabelValue>,
    // Treatments
    pub treatments_by_category: Vec<LabelValue>,
    pub treatments_per_month: Vec<MonthBucket>,
    /// WAAD 9.5 / G8 — top clinical diagnoses (examination + dental finding).
    pub disease_patterns_top: Vec<LabelValue>,
    /// WAAD 9.5 / G8 — diagnosed clinical cases per month.
    pub disease_patterns_monthly: Vec<MonthBucket>,
    pub medications_top: Vec<LabelValue>,
    // Appointments & organisation
    pub appointments_per_month: Vec<MonthBucket>,
    pub appointment_status: Vec<LabelValue>,
    pub appointment_kind: Vec<LabelValue>,
    // Finance
    pub income_per_month: Vec<MonthBucket>,
    pub revenue_by_payment_method: Vec<LabelValue>,
    pub income_current_month: Option<f64>,
    // Orders / stock
    pub orders_by_status: Vec<LabelValue>,
    pub orders_per_month: Vec<MonthBucket>,
    pub products_low: Option<i64>,
    /// Group: doctors whose figures are left out because they do not share them with you.
    pub hidden_doctors: Vec<String>,
    /// Group: last 12 months per doctor you may see (empty with one doctor or a doctor filter).
    pub per_doctor: Vec<DoctorFigures>,
    /// Group: monthly breakdown per doctor for overlay charts (no single-doctor filter).
    pub per_doctor_series: Vec<DoctorMonthSeries>,
}

/// Build a list of the last `n` months in `YYYY-MM` form, oldest first.
fn last_n_months(n: usize, tz: PracticeTz) -> Vec<String> {
    use chrono::Datelike;
    let today = local_today(tz);
    let mut year = today.year();
    let mut month = today.month() as i32;
    let mut out: Vec<String> = Vec::with_capacity(n);
    for _ in 0..n {
        out.push(format!("{:04}-{:02}", year, month));
        month -= 1;
        if month == 0 {
            month = 12;
            year -= 1;
        }
    }
    out.reverse();
    out
}

/// Pad / order results so every month appears.
fn align_months(rows: Vec<(String, f64)>, months: &[String]) -> Vec<MonthBucket> {
    let map: std::collections::HashMap<String, f64> = rows.into_iter().collect();
    months
        .iter()
        .map(|m| MonthBucket {
            month: m.clone(),
            value: *map.get(m).unwrap_or(&0.0),
        })
        .collect()
}

fn altersgruppe(date_of_birth: &str) -> &'static str {
    use chrono::{Datelike, Local, NaiveDate};
    let today = Local::now().date_naive();
    let Ok(geb) = NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d") else {
        return "unknown";
    };
    let mut years = today.year() - geb.year();
    if (today.month(), today.day()) < (geb.month(), geb.day()) {
        years -= 1;
    }
    match years {
        i32::MIN..=17 => "<18",
        18..=29 => "18–29",
        30..=44 => "30–44",
        45..=59 => "45–59",
        60..=74 => "60–74",
        _ => "75+",
    }
}

fn group_label_value(rows: Vec<(String, i64)>) -> Vec<LabelValue> {
    rows.into_iter()
        .map(|(label, value)| LabelValue {
            label,
            value: value as f64,
        })
        .collect()
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_statistics_overview(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    doctor_id: Option<String>,
    treatment_kind: Option<String>,
    payment_method: Option<String>,
) -> Result<StatisticsOverview, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    statistics_overview(
        pool.inner(),
        &session,
        doctor_id,
        StatsFilters::from_opts(treatment_kind, payment_method),
    )
    .await
}

/// The statistics page's figures; `doctor_id` narrows them to one doctor (Group, T5.6).
pub async fn statistics_overview(
    pool: &SqlitePool,
    session: &medoc_core::application::auth_service::Session,
    doctor_id: Option<String>,
    filters: StatsFilters,
) -> Result<StatisticsOverview, AppError> {
    let scope = doctor_scope(pool, session, doctor_id).await?;
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    let ov = &session.permission_overrides;
    let allowed = |action: &str| rbac::effective_allowed(action, role, ov);

    let tz = medoc_core::domain::practice_time::practice_tz(pool).await;
    let months_12 = last_n_months(12, tz);
    let earliest = months_12.first().cloned().unwrap_or_default();
    let earliest_start = format!("{}-01", earliest);
    // UTC instant of the local start of the earliest month, for created_at filters.
    let earliest_utc = chrono::NaiveDate::parse_from_str(&earliest_start, "%Y-%m-%d")
        .map(|d| local_day_start_sql(d, tz))
        .unwrap_or_else(|_| earliest_start.clone());
    let mut out = StatisticsOverview::default();

    // -------- Patients --------
    if allowed("patient.read") {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
            .fetch_one(pool)
            .await?;
        out.patients_total = Some(row.0);

        // New patients per local month (last 12 months)
        let new: Vec<(String, f64)> = sqlx::query_as(
            "SELECT CAST(created_at AS TEXT), 1.0 FROM patient WHERE julianday(created_at) >= julianday(?1)",
        )
        .bind(&earliest_utc)
        .fetch_all(pool)
        .await?;
        out.new_patients_per_month = align_months(bucket_local_months(new, tz), &months_12);

        // Cumulative patients per month: count of patients with created_at <= end of month
        let cumulative: Vec<MonthBucket> = {
            let mut buckets = Vec::with_capacity(months_12.len());
            for m in &months_12 {
                // Local end of month m = local start of the next month.
                let first = chrono::NaiveDate::parse_from_str(&format!("{m}-01"), "%Y-%m-%d")
                    .unwrap_or_else(|_| local_today(tz));
                let next = first
                    .checked_add_months(chrono::Months::new(1))
                    .unwrap_or(first);
                let end = local_day_start_sql(next, tz);
                let row: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM patient WHERE julianday(created_at) < julianday(?1)",
                )
                .bind(&end)
                .fetch_one(pool)
                .await?;
                buckets.push(MonthBucket {
                    month: m.clone(),
                    value: row.0 as f64,
                });
            }
            buckets
        };
        out.patients_cumulative_per_month = cumulative;

        // Age groups
        let births: Vec<(String,)> = sqlx::query_as("SELECT date_of_birth FROM patient")
            .fetch_all(pool)
            .await?;
        let mut age_counts: std::collections::BTreeMap<&'static str, i64> =
            std::collections::BTreeMap::new();
        for (g,) in births {
            *age_counts.entry(altersgruppe(&g)).or_insert(0) += 1;
        }
        // Stable order: <18, 18–29, 30–44, 45–59, 60–74, 75+
        let order = ["<18", "18–29", "30–44", "45–59", "60–74", "75+"];
        out.age_groups = order
            .iter()
            .map(|k| LabelValue {
                label: (*k).to_string(),
                value: *age_counts.get(*k).unwrap_or(&0) as f64,
            })
            .filter(|lv| lv.value > 0.0)
            .collect();

        // Genders
        let gender: Vec<(String, i64)> =
            sqlx::query_as("SELECT sex, COUNT(*) FROM patient GROUP BY sex ORDER BY sex")
                .fetch_all(pool)
                .await?;
        out.sexes = group_label_value(gender);

        // Patient status (NEW / ACTIVE / VALIDATED / READONLY)
        let pstatus: Vec<(String, i64)> =
            sqlx::query_as("SELECT status, COUNT(*) FROM patient GROUP BY status ORDER BY status")
                .fetch_all(pool)
                .await?;
        out.patient_status = group_label_value(pstatus);
    }

    // -------- Treatments --------
    if allowed("patient.read_medical") {
        let treat_cat_extra = 1 + scope.bind_count();
        // by category (fallback type when category missing)
        let beh_kat: Vec<(String, i64)> = scoped_treatment(
            sqlx::query_as(&format!(
                "SELECT COALESCE(NULLIF(category,''), kind) AS k, COUNT(*) AS c
                 FROM treatment
                 WHERE 1 = 1{}{}
                 GROUP BY k
                 ORDER BY c DESC
                 LIMIT 12",
                scope.clause("responsible_staff_id", 1),
                filters.treatment_clause(treat_cat_extra)
            )),
            &scope,
            &filters,
        )
        .fetch_all(pool)
        .await?;
        out.treatments_by_category = group_label_value(beh_kat);

        let treat_mon_extra = 2 + scope.bind_count();
        // per month — prefer treatment_date, fallback created_at
        let beh_mon: Vec<(String, i64)> = scoped_treatment(
            sqlx::query_as(&format!(
                "SELECT strftime('%Y-%m', COALESCE(treatment_date, created_at)) AS m, COUNT(*) AS c
                 FROM treatment
                 WHERE COALESCE(treatment_date, created_at) >= ?1{}{}
                 GROUP BY m
                 ORDER BY m",
                scope.clause("responsible_staff_id", 2),
                filters.treatment_clause(treat_mon_extra)
            ))
            .bind(&earliest_start),
            &scope,
            &filters,
        )
        .fetch_all(pool)
        .await?;
        let beh_mon_f: Vec<(String, f64)> = beh_mon
            .iter()
            .map(|(m, c)| (m.clone(), *c as f64))
            .collect();
        out.treatments_per_month = align_months(beh_mon_f, &months_12);

        // Disease patterns — real diagnoses from examinations + dental findings (not treatment proxy).
        let disease_top: Vec<(String, i64)> = sqlx::query_as(
            "SELECT d AS label, COUNT(*) AS c FROM (
                 SELECT TRIM(COALESCE(
                     CASE WHEN json_valid(results)
                          THEN NULLIF(TRIM(json_extract(results, '$.diagnosis')), '')
                          ELSE NULL END,
                     NULLIF(TRIM(diagnosis), '')
                 )) AS d
                 FROM examination
                 UNION ALL
                 SELECT TRIM(diagnosis) AS d
                 FROM dental_finding
                 WHERE diagnosis IS NOT NULL AND TRIM(diagnosis) != ''
             )
             WHERE d IS NOT NULL AND TRIM(d) != ''
             GROUP BY d
             ORDER BY c DESC
             LIMIT 12",
        )
        .fetch_all(pool)
        .await?;
        out.disease_patterns_top = group_label_value(disease_top);

        let disease_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT m, COUNT(*) AS c FROM (
                 SELECT strftime('%Y-%m', created_at) AS m
                 FROM examination
                 WHERE created_at >= ?1
                   AND TRIM(COALESCE(
                       CASE WHEN json_valid(results)
                            THEN NULLIF(TRIM(json_extract(results, '$.diagnosis')), '')
                            ELSE NULL END,
                       NULLIF(TRIM(diagnosis), '')
                   )) != ''
                 UNION ALL
                 SELECT strftime('%Y-%m', created_at) AS m
                 FROM dental_finding
                 WHERE created_at >= ?1
                   AND diagnosis IS NOT NULL AND TRIM(diagnosis) != ''
             )
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool)
        .await?;
        let disease_mon_f: Vec<(String, f64)> = disease_mon
            .iter()
            .map(|(m, c)| (m.clone(), *c as f64))
            .collect();
        out.disease_patterns_monthly = align_months(disease_mon_f, &months_12);

        // top medications by active ingredient
        let med: Vec<(String, i64)> = scoped(sqlx::query_as(&format!(
            "SELECT COALESCE(NULLIF(active_ingredient,''), medication) AS w, COUNT(*) AS c
             FROM prescription
             WHERE 1 = 1{}
             GROUP BY w
             ORDER BY c DESC
             LIMIT 8",
            scope.clause("COALESCE(signed_by_staff_id, physician_id)", 1)
        )), &scope)
        .fetch_all(pool)
        .await?;
        out.medications_top = group_label_value(med);
    }

    // -------- Appointments & organisation --------
    if allowed("appointment.read") {
        let appt_mon: Vec<(String, i64)> = scoped(sqlx::query_as(&format!(
            "SELECT strftime('%Y-%m', date) AS m, COUNT(*) AS c
             FROM appointment
             WHERE date >= ?1{}
             GROUP BY m
             ORDER BY m",
            scope.clause("physician_id", 2)
        ))
        .bind(&earliest_start), &scope)
        .fetch_all(pool)
        .await?;
        let appt_mon_f: Vec<(String, f64)> = appt_mon
            .iter()
            .map(|(m, c)| (m.clone(), *c as f64))
            .collect();
        out.appointments_per_month = align_months(appt_mon_f, &months_12);

        let appt_st: Vec<(String, i64)> = scoped(sqlx::query_as(&format!(
            "SELECT status, COUNT(*) FROM appointment WHERE 1 = 1{} GROUP BY status ORDER BY status",
            scope.clause("physician_id", 1)
        )), &scope)
        .fetch_all(pool)
        .await?;
        out.appointment_status = group_label_value(appt_st);

        let appt_kind: Vec<(String, i64)> = scoped(
            sqlx::query_as(&format!(
                "SELECT kind, COUNT(*) FROM appointment WHERE 1 = 1{} GROUP BY kind ORDER BY kind",
                scope.clause("physician_id", 1)
            )),
            &scope,
        )
                .fetch_all(pool)
                .await?;
        out.appointment_kind = group_label_value(appt_kind);
    }

    // -------- Finance --------
    if allowed("finance.read") {
        let pay_income_extra = 2 + scope.bind_count();
        // F105: paid + partially paid, bucketed by local month.
        let income_rows: Vec<(String, f64)> = scoped_payment(
            sqlx::query_as(&format!(
                "SELECT CAST(created_at AS TEXT), CAST(amount AS REAL) FROM payment
             WHERE status IN ('PAID','PARTIALLY_PAID') AND julianday(created_at) >= julianday(?1){}{}",
                scope.clause("for_staff_id", 2),
                filters.payment_clause(pay_income_extra)
            ))
            .bind(&earliest_utc),
            &scope,
            &filters,
        )
        .fetch_all(pool)
        .await?;
        out.income_per_month = align_months(bucket_local_months(income_rows, tz), &months_12);

        let pay_kind_extra = 1 + scope.bind_count();
        let payment_kind: Vec<(String, f64)> = scoped_payment(
            sqlx::query_as(&format!(
                "SELECT payment_method, CAST(COALESCE(SUM(amount), 0) AS REAL)
             FROM payment
             WHERE status = 'PAID'{}{}
             GROUP BY payment_method
             ORDER BY payment_method",
                scope.clause("for_staff_id", 1),
                filters.payment_clause(pay_kind_extra)
            )),
            &scope,
            &filters,
        )
        .fetch_all(pool)
        .await?;
        out.revenue_by_payment_method = payment_kind
            .into_iter()
            .map(|(label, value)| LabelValue { label, value })
            .collect();

        let pay_month_extra = 2 + scope.bind_count();
        let row: (f64,) = scoped_payment(
            sqlx::query_as(&format!(
                "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
             WHERE status IN ('PAID','PARTIALLY_PAID') AND julianday(created_at) >= julianday(?1){}{}",
                scope.clause("for_staff_id", 2),
                filters.payment_clause(pay_month_extra)
            ))
            .bind(local_day_start_sql(local_month_start(tz), tz)),
            &scope,
            &filters,
        )
        .fetch_one(pool)
        .await?;
        out.income_current_month = Some(row.0);
    }

    // -------- Orders --------
    if allowed("purchase_order.read") {
        let order_st: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) FROM purchase_order GROUP BY status ORDER BY status",
        )
        .fetch_all(pool)
        .await?;
        out.orders_by_status = group_label_value(order_st);

        let order_rows: Vec<(String, f64)> = sqlx::query_as(
            "SELECT CAST(created_at AS TEXT), 1.0 FROM purchase_order WHERE julianday(created_at) >= julianday(?1)",
        )
        .bind(&earliest_utc)
        .fetch_all(pool)
        .await?;
        out.orders_per_month = align_months(bucket_local_months(order_rows, tz), &months_12);
    }

    if allowed("product.read") {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM product WHERE active = 1 AND min_stock IS NOT NULL AND min_stock > 0 AND stock <= min_stock")
                .fetch_one(pool)
                .await?;
        out.products_low = Some(row.0);
    }

    // -------- Per doctor (Group) --------
    out.hidden_doctors = scope.hidden.clone();
    if medoc_core::edition::CORE_CAPS.multi_doctor && scope.only.is_none() {
        out.per_doctor = doctor::per_doctor(pool, &scope, &filters, &allowed, &earliest_start, &earliest_utc).await?;
        out.per_doctor_series =
            per_doctor_series(pool, &scope, &filters, &allowed, &months_12, &earliest_start, &earliest_utc).await?;
    }

    Ok(out)
}
