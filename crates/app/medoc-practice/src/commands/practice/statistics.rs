use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub patients_total: Option<i64>,
    pub appointments_today: Option<i64>,
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
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;

    let patients_total = if rbac::allowed("patient.read", role) {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
            .fetch_one(pool.inner())
            .await?;
        Some(row.0)
    } else {
        None
    };

    let appointments_today = if rbac::allowed("appointment.read", role) {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM appointment WHERE date = ?1")
            .bind(&today)
            .fetch_one(pool.inner())
            .await?;
        Some(row.0)
    } else {
        None
    };

    let revenue_month = if rbac::allowed("finance.read", role) {
        let month_start = chrono::Local::now().format("%Y-%m-01").to_string();
        let row: (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount), 0.0) FROM payment WHERE status = 'PAID' AND created_at >= ?1",
        )
        .bind(&month_start)
        .fetch_one(pool.inner())
        .await?;
        Some(row.0)
    } else {
        None
    };

    let products_low = if rbac::allowed("product.read", role) {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM product WHERE active = 1 AND stock <= min_stock",
        )
        .fetch_one(pool.inner())
        .await?;
        Some(row.0)
    } else {
        None
    };

    Ok(DashboardStats {
        patients_total,
        appointments_today,
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
    pub patients_total: i64,
    pub new_patients_per_month: Vec<MonthBucket>,
    pub patients_cumulative_per_month: Vec<MonthBucket>,
    pub age_groups: Vec<LabelValue>,
    pub sexes: Vec<LabelValue>,
    pub patient_status: Vec<LabelValue>,
    // Treatments
    pub treatments_by_category: Vec<LabelValue>,
    pub treatments_per_month: Vec<MonthBucket>,
    /// WAAD 9.5 / G8 — top categories as disease-proxy (treatment category/type).
    pub disease_patterns_top: Vec<LabelValue>,
    /// WAAD 9.5 / G8 — treatment-case trend per month.
    pub disease_patterns_monthly: Vec<MonthBucket>,
    pub medications_top: Vec<LabelValue>,
    // Appointments & organisation
    pub appointments_per_month: Vec<MonthBucket>,
    pub appointment_status: Vec<LabelValue>,
    pub appointment_kind: Vec<LabelValue>,
    // Finance
    pub income_per_month: Vec<MonthBucket>,
    pub revenue_by_payment_method: Vec<LabelValue>,
    pub income_current_month: f64,
    // Orders / stock
    pub orders_by_status: Vec<LabelValue>,
    pub orders_per_month: Vec<MonthBucket>,
    pub products_low: i64,
}

/// Build a list of the last `n` months in `YYYY-MM` form, oldest first.
fn last_n_months(n: usize) -> Vec<String> {
    use chrono::{Datelike, Local};
    let today = Local::now().date_naive();
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
        return "Unbekannt";
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
) -> Result<StatisticsOverview, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;

    let months_12 = last_n_months(12);
    let earliest = months_12.first().cloned().unwrap_or_default();
    let earliest_start = format!("{}-01", earliest);
    let mut out = StatisticsOverview::default();

    // -------- Patients --------
    if rbac::allowed("patient.read", role) {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
            .fetch_one(pool.inner())
            .await?;
        out.patients_total = row.0;

        // New patients per month (last 12 months)
        let new: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS c
             FROM patient
             WHERE created_at >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let new_f: Vec<(String, f64)> = new.iter().map(|(m, c)| (m.clone(), *c as f64)).collect();
        out.new_patients_per_month = align_months(new_f, &months_12);

        // Cumulative patients per month: count of patients with created_at <= end of month
        let cumulative: Vec<MonthBucket> = {
            let mut buckets = Vec::with_capacity(months_12.len());
            for m in &months_12 {
                let end = format!("{}-31 23:59:59", m);
                let row: (i64,) =
                    sqlx::query_as("SELECT COUNT(*) FROM patient WHERE created_at <= ?1")
                        .bind(&end)
                        .fetch_one(pool.inner())
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
            .fetch_all(pool.inner())
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
        let gender: Vec<(String, i64)> = sqlx::query_as(
            "SELECT sex, COUNT(*) FROM patient GROUP BY sex ORDER BY sex",
        )
        .fetch_all(pool.inner())
        .await?;
        out.sexes = group_label_value(gender)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "FEMALE" => "Female".to_string(),
                    "MALE" => "Männlich".to_string(),
                    "DIVERSE" => "Divers".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();

        // Patient status (NEW / ACTIVE / VALIDATED / READONLY)
        let pstatus: Vec<(String, i64)> =
            sqlx::query_as("SELECT status, COUNT(*) FROM patient GROUP BY status ORDER BY status")
                .fetch_all(pool.inner())
                .await?;
        out.patient_status = group_label_value(pstatus);
    }

    // -------- Treatments --------
    if rbac::allowed("patient.read_medical", role) {
        // by category (fallback type when category missing)
        let beh_kat: Vec<(String, i64)> = sqlx::query_as(
            "SELECT COALESCE(NULLIF(category,''), kind) AS k, COUNT(*) AS c
             FROM treatment
             GROUP BY k
             ORDER BY c DESC
             LIMIT 12",
        )
        .fetch_all(pool.inner())
        .await?;
        out.treatments_by_category = group_label_value(beh_kat);

        // per month — prefer treatment_date, fallback created_at
        let beh_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', COALESCE(treatment_date, created_at)) AS m, COUNT(*) AS c
             FROM treatment
             WHERE COALESCE(treatment_date, created_at) >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let beh_mon_f: Vec<(String, f64)> = beh_mon
            .iter()
            .map(|(m, c)| (m.clone(), *c as f64))
            .collect();
        out.treatments_per_month = align_months(beh_mon_f, &months_12);
        out.disease_patterns_top = out.treatments_by_category.clone();
        out.disease_patterns_monthly = out.treatments_per_month.clone();

        // top medications by active ingredient
        let med: Vec<(String, i64)> = sqlx::query_as(
            "SELECT COALESCE(NULLIF(active_ingredient,''), medication) AS w, COUNT(*) AS c
             FROM prescription
             GROUP BY w
             ORDER BY c DESC
             LIMIT 8",
        )
        .fetch_all(pool.inner())
        .await?;
        out.medications_top = group_label_value(med);
    }

    // -------- Appointments & organisation --------
    if rbac::allowed("appointment.read", role) {
        let appt_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', date) AS m, COUNT(*) AS c
             FROM appointment
             WHERE date >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let appt_mon_f: Vec<(String, f64)> = appt_mon
            .iter()
            .map(|(m, c)| (m.clone(), *c as f64))
            .collect();
        out.appointments_per_month = align_months(appt_mon_f, &months_12);

        let appt_st: Vec<(String, i64)> =
            sqlx::query_as("SELECT status, COUNT(*) FROM appointment GROUP BY status ORDER BY status")
                .fetch_all(pool.inner())
                .await?;
        out.appointment_status = group_label_value(appt_st)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "PLANNED" => "Planned".to_string(),
                    "CONFIRMED" => "Confirmed".to_string(),
                    "COMPLETED" => "Completed".to_string(),
                    "NO_SHOW" => "No-show".to_string(),
                    "CANCELLED" => "Cancelled".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();

        let appt_kind: Vec<(String, i64)> =
            sqlx::query_as("SELECT kind, COUNT(*) FROM appointment GROUP BY kind ORDER BY kind")
                .fetch_all(pool.inner())
                .await?;
        out.appointment_kind = group_label_value(appt_kind)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "FIRST_VISIT" => "FirstVisit".to_string(),
                    "EXAMINATION" => "Examination".to_string(),
                    "TREATMENT" => "Treatment".to_string(),
                    "CHECKUP" => "Checkup".to_string(),
                    "CONSULTATION" => "Consultation".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();
    }

    // -------- Finance --------
    if rbac::allowed("finance.read", role) {
        let income_mon: Vec<(String, f64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', created_at) AS m, COALESCE(SUM(amount),0.0) AS s
             FROM payment
             WHERE status = 'PAID' AND created_at >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        out.income_per_month = align_months(income_mon, &months_12);

        let payment_kind: Vec<(String, f64)> = sqlx::query_as(
            "SELECT payment_method, COALESCE(SUM(amount),0.0)
             FROM payment
             WHERE status = 'PAID'
             GROUP BY payment_method
             ORDER BY payment_method",
        )
        .fetch_all(pool.inner())
        .await?;
        out.revenue_by_payment_method = payment_kind
            .into_iter()
            .map(|(label, value)| LabelValue {
                label: match label.as_str() {
                    "CASH" => "Cash".to_string(),
                    "CARD" => "Card".to_string(),
                    "BANK_TRANSFER" => "Bank transfer".to_string(),
                    "INVOICE" => "Invoice".to_string(),
                    other => other.to_string(),
                },
                value,
            })
            .collect();

        let month_start = chrono::Local::now().format("%Y-%m-01").to_string();
        let row: (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(amount),0.0) FROM payment WHERE status='PAID' AND created_at >= ?1",
        )
        .bind(&month_start)
        .fetch_one(pool.inner())
        .await?;
        out.income_current_month = row.0;
    }

    // -------- Orders --------
    if rbac::allowed("purchase_order.read", role) {
        let order_st: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) FROM purchase_order GROUP BY status ORDER BY status",
        )
        .fetch_all(pool.inner())
        .await?;
        out.orders_by_status = group_label_value(order_st)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "OPEN" => "Open".to_string(),
                    "IN_TRANSIT" => "InTransit".to_string(),
                    "DELIVERED" => "Delivered".to_string(),
                    "CANCELLED" => "Cancelled".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();

        let order_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS c
             FROM purchase_order
             WHERE created_at >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let order_mon_f: Vec<(String, f64)> = order_mon
            .iter()
            .map(|(m, c)| (m.clone(), *c as f64))
            .collect();
        out.orders_per_month = align_months(order_mon_f, &months_12);
    }

    if rbac::allowed("product.read", role) {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM product WHERE active=1 AND stock <= min_stock",
        )
        .fetch_one(pool.inner())
        .await?;
        out.products_low = row.0;
    }

    Ok(out)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! regisappt_statistics_commands {
    () => {
        $crate::commands::statistics_commands::get_dashboard_stats,
        $crate::commands::statistics_commands::get_statistics_overview,
    };
}
