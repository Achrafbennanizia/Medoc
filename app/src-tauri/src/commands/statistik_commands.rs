use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub patienten_gesamt: Option<i64>,
    pub termine_heute: Option<i64>,
    pub einnahmen_monat: Option<f64>,
    pub produkte_niedrig: Option<i64>,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_dashboard_stats(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<DashboardStats, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;

    let patienten_gesamt = if rbac::allowed("patient.read", role) {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
            .fetch_one(pool.inner())
            .await?;
        Some(row.0)
    } else {
        None
    };

    let termine_heute = if rbac::allowed("termin.read", role) {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM termin WHERE datum = ?1")
            .bind(&today)
            .fetch_one(pool.inner())
            .await?;
        Some(row.0)
    } else {
        None
    };

    let einnahmen_monat = if rbac::allowed("finanzen.read", role) {
        let month_start = chrono::Local::now().format("%Y-%m-01").to_string();
        let row: (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status = 'BEZAHLT' AND created_at >= ?1",
        )
        .bind(&month_start)
        .fetch_one(pool.inner())
        .await?;
        Some(row.0)
    } else {
        None
    };

    let produkte_niedrig = if rbac::allowed("produkt.read", role) {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM produkt WHERE aktiv = 1 AND bestand <= mindestbestand",
        )
        .fetch_one(pool.inner())
        .await?;
        Some(row.0)
    } else {
        None
    };

    Ok(DashboardStats {
        patienten_gesamt,
        termine_heute,
        einnahmen_monat,
        produkte_niedrig,
    })
}

// ---------------------------------------------------------------------------
// Statistik overview — populates the rich Statistik page with charts.
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
pub struct StatistikOverview {
    // Patienten
    pub patienten_gesamt: i64,
    pub patienten_neu_pro_monat: Vec<MonthBucket>,
    pub patienten_kumuliert_pro_monat: Vec<MonthBucket>,
    pub altersgruppen: Vec<LabelValue>,
    pub geschlechter: Vec<LabelValue>,
    pub patient_status: Vec<LabelValue>,
    // Behandlungen
    pub behandlungen_nach_kategorie: Vec<LabelValue>,
    pub behandlungen_pro_monat: Vec<MonthBucket>,
    pub medikamente_top: Vec<LabelValue>,
    // Termine & Organisation
    pub termine_pro_monat: Vec<MonthBucket>,
    pub termin_status: Vec<LabelValue>,
    pub termin_art: Vec<LabelValue>,
    // Finanzen
    pub einnahmen_pro_monat: Vec<MonthBucket>,
    pub umsatz_nach_zahlungsart: Vec<LabelValue>,
    pub einnahmen_aktueller_monat: f64,
    // Bestellungen / Lager
    pub bestellungen_nach_status: Vec<LabelValue>,
    pub bestellungen_pro_monat: Vec<MonthBucket>,
    pub produkte_niedrig: i64,
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

fn altersgruppe(geburtsdatum: &str) -> &'static str {
    use chrono::{Datelike, Local, NaiveDate};
    let today = Local::now().date_naive();
    let Ok(geb) = NaiveDate::parse_from_str(geburtsdatum, "%Y-%m-%d") else {
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
pub async fn get_statistik_overview(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<StatistikOverview, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;

    let months_12 = last_n_months(12);
    let earliest = months_12.first().cloned().unwrap_or_default();
    let earliest_start = format!("{}-01", earliest);
    let mut out = StatistikOverview::default();

    // -------- Patienten --------
    if rbac::allowed("patient.read", role) {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
            .fetch_one(pool.inner())
            .await?;
        out.patienten_gesamt = row.0;

        // New patients per month (last 12 months)
        let neu: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS c
             FROM patient
             WHERE created_at >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let neu_f: Vec<(String, f64)> = neu.iter().map(|(m, c)| (m.clone(), *c as f64)).collect();
        out.patienten_neu_pro_monat = align_months(neu_f, &months_12);

        // Cumulative patients per month: count of patients with created_at <= end of month
        let cumulative: Vec<MonthBucket> = {
            let mut buckets = Vec::with_capacity(months_12.len());
            for m in &months_12 {
                let end = format!("{}-31 23:59:59", m);
                let row: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM patient WHERE created_at <= ?1",
                )
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
        out.patienten_kumuliert_pro_monat = cumulative;

        // Altersgruppen
        let births: Vec<(String,)> = sqlx::query_as("SELECT geburtsdatum FROM patient")
            .fetch_all(pool.inner())
            .await?;
        let mut age_counts: std::collections::BTreeMap<&'static str, i64> =
            std::collections::BTreeMap::new();
        for (g,) in births {
            *age_counts.entry(altersgruppe(&g)).or_insert(0) += 1;
        }
        // Stable order: <18, 18–29, 30–44, 45–59, 60–74, 75+
        let order = ["<18", "18–29", "30–44", "45–59", "60–74", "75+"];
        out.altersgruppen = order
            .iter()
            .map(|k| LabelValue {
                label: (*k).to_string(),
                value: *age_counts.get(*k).unwrap_or(&0) as f64,
            })
            .filter(|lv| lv.value > 0.0)
            .collect();

        // Geschlechter
        let gender: Vec<(String, i64)> = sqlx::query_as(
            "SELECT geschlecht, COUNT(*) FROM patient GROUP BY geschlecht ORDER BY geschlecht",
        )
        .fetch_all(pool.inner())
        .await?;
        out.geschlechter = group_label_value(gender)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "WEIBLICH" => "Weiblich".to_string(),
                    "MAENNLICH" => "Männlich".to_string(),
                    "DIVERS" => "Divers".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();

        // Patient-Status (NEU / AKTIV / VALIDIERT / READONLY)
        let pstatus: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) FROM patient GROUP BY status ORDER BY status",
        )
        .fetch_all(pool.inner())
        .await?;
        out.patient_status = group_label_value(pstatus);
    }

    // -------- Behandlungen --------
    if rbac::allowed("patient.read_medical", role) {
        // by kategorie (fallback art when kategorie missing)
        let beh_kat: Vec<(String, i64)> = sqlx::query_as(
            "SELECT COALESCE(NULLIF(kategorie,''), art) AS k, COUNT(*) AS c
             FROM behandlung
             GROUP BY k
             ORDER BY c DESC
             LIMIT 12",
        )
        .fetch_all(pool.inner())
        .await?;
        out.behandlungen_nach_kategorie = group_label_value(beh_kat);

        // per month — prefer behandlung_datum, fallback created_at
        let beh_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', COALESCE(behandlung_datum, created_at)) AS m, COUNT(*) AS c
             FROM behandlung
             WHERE COALESCE(behandlung_datum, created_at) >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let beh_mon_f: Vec<(String, f64)> =
            beh_mon.iter().map(|(m, c)| (m.clone(), *c as f64)).collect();
        out.behandlungen_pro_monat = align_months(beh_mon_f, &months_12);

        // top medikamente by wirkstoff
        let med: Vec<(String, i64)> = sqlx::query_as(
            "SELECT COALESCE(NULLIF(wirkstoff,''), medikament) AS w, COUNT(*) AS c
             FROM rezept
             GROUP BY w
             ORDER BY c DESC
             LIMIT 8",
        )
        .fetch_all(pool.inner())
        .await?;
        out.medikamente_top = group_label_value(med);
    }

    // -------- Termine & Organisation --------
    if rbac::allowed("termin.read", role) {
        let ter_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', datum) AS m, COUNT(*) AS c
             FROM termin
             WHERE datum >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let ter_mon_f: Vec<(String, f64)> =
            ter_mon.iter().map(|(m, c)| (m.clone(), *c as f64)).collect();
        out.termine_pro_monat = align_months(ter_mon_f, &months_12);

        let ter_st: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) FROM termin GROUP BY status ORDER BY status",
        )
        .fetch_all(pool.inner())
        .await?;
        out.termin_status = group_label_value(ter_st)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "GEPLANT" => "Geplant".to_string(),
                    "BESTAETIGT" => "Bestätigt".to_string(),
                    "DURCHGEFUEHRT" => "Durchgeführt".to_string(),
                    "NICHT_ERSCHIENEN" => "Nicht erschienen".to_string(),
                    "ABGESAGT" => "Abgesagt".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();

        let ter_art: Vec<(String, i64)> = sqlx::query_as(
            "SELECT art, COUNT(*) FROM termin GROUP BY art ORDER BY art",
        )
        .fetch_all(pool.inner())
        .await?;
        out.termin_art = group_label_value(ter_art)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "ERSTBESUCH" => "Erstbesuch".to_string(),
                    "UNTERSUCHUNG" => "Untersuchung".to_string(),
                    "BEHANDLUNG" => "Behandlung".to_string(),
                    "KONTROLLE" => "Kontrolle".to_string(),
                    "BERATUNG" => "Beratung".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();
    }

    // -------- Finanzen --------
    if rbac::allowed("finanzen.read", role) {
        let einn_mon: Vec<(String, f64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', created_at) AS m, COALESCE(SUM(betrag),0.0) AS s
             FROM zahlung
             WHERE status = 'BEZAHLT' AND created_at >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        out.einnahmen_pro_monat = align_months(einn_mon, &months_12);

        let zahl_art: Vec<(String, f64)> = sqlx::query_as(
            "SELECT zahlungsart, COALESCE(SUM(betrag),0.0)
             FROM zahlung
             WHERE status = 'BEZAHLT'
             GROUP BY zahlungsart
             ORDER BY zahlungsart",
        )
        .fetch_all(pool.inner())
        .await?;
        out.umsatz_nach_zahlungsart = zahl_art
            .into_iter()
            .map(|(label, value)| LabelValue {
                label: match label.as_str() {
                    "BAR" => "Bar".to_string(),
                    "KARTE" => "Karte".to_string(),
                    "UEBERWEISUNG" => "Überweisung".to_string(),
                    "RECHNUNG" => "Rechnung".to_string(),
                    other => other.to_string(),
                },
                value,
            })
            .collect();

        let month_start = chrono::Local::now().format("%Y-%m-01").to_string();
        let row: (f64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(betrag),0.0) FROM zahlung WHERE status='BEZAHLT' AND created_at >= ?1",
        )
        .bind(&month_start)
        .fetch_one(pool.inner())
        .await?;
        out.einnahmen_aktueller_monat = row.0;
    }

    // -------- Bestellungen --------
    if rbac::allowed("bestellung.read", role) {
        let best_st: Vec<(String, i64)> = sqlx::query_as(
            "SELECT status, COUNT(*) FROM bestellung GROUP BY status ORDER BY status",
        )
        .fetch_all(pool.inner())
        .await?;
        out.bestellungen_nach_status = group_label_value(best_st)
            .into_iter()
            .map(|lv| LabelValue {
                label: match lv.label.as_str() {
                    "OFFEN" => "Offen".to_string(),
                    "UNTERWEGS" => "Unterwegs".to_string(),
                    "GELIEFERT" => "Geliefert".to_string(),
                    "STORNIERT" => "Storniert".to_string(),
                    other => other.to_string(),
                },
                value: lv.value,
            })
            .collect();

        let best_mon: Vec<(String, i64)> = sqlx::query_as(
            "SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS c
             FROM bestellung
             WHERE created_at >= ?1
             GROUP BY m
             ORDER BY m",
        )
        .bind(&earliest_start)
        .fetch_all(pool.inner())
        .await?;
        let best_mon_f: Vec<(String, f64)> =
            best_mon.iter().map(|(m, c)| (m.clone(), *c as f64)).collect();
        out.bestellungen_pro_monat = align_months(best_mon_f, &months_12);
    }

    if rbac::allowed("produkt.read", role) {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM produkt WHERE aktiv=1 AND bestand <= mindestbestand",
        )
        .fetch_one(pool.inner())
        .await?;
        out.produkte_niedrig = row.0;
    }

    Ok(out)
}
