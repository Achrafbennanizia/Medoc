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
