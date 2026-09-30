// Notifications & appointment-reminder scheduler (FA-TER-NOTIFY).
//
// Calculates which appointments fall within a configurable lead time
// (default 24 h) and emits structured `system.log` events plus a JSON list
// the frontend can render in a notifications panel. Real OS notifications
// would require the `tauri-plugin-notification` crate — enabling it later
// only means swapping the `dispatch` body.

use chrono::{Duration, Local, NaiveDateTime};
use serde::Serialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::log_system;

fn parse_appointment_local(date: &str, time: &str) -> Option<NaiveDateTime> {
    let date = date.trim();
    let time = time.trim();
    let with_seconds = format!("{date} {time}");
    NaiveDateTime::parse_from_str(&with_seconds, "%Y-%m-%d %H:%M:%S")
        .ok()
        .or_else(|| NaiveDateTime::parse_from_str(&with_seconds, "%Y-%m-%d %H:%M").ok())
        .or_else(|| {
            let hm: String = time.chars().take(5).collect();
            NaiveDateTime::parse_from_str(&format!("{date} {hm}"), "%Y-%m-%d %H:%M").ok()
        })
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AppointmentReminder {
    pub appointment_id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub physician_id: String,
    pub date: String,
    pub time: String,
    pub kind: String,
    pub minutes_until: i64,
}

pub async fn upcoming(
    pool: &SqlitePool,
    lead_minutes: i64,
) -> Result<Vec<AppointmentReminder>, AppError> {
    // Appointment date/time are practice-local (same as calendar), not UTC.
    let now = Local::now().naive_local();
    let until = now + Duration::minutes(lead_minutes);

    let rows: Vec<(String, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT t.id, t.patient_id, p.name, t.physician_id, t.date, t.time, t.kind \
         FROM appointment t \
         JOIN patient p ON p.id = t.patient_id \
         WHERE t.status IN ('PLANNED','CONFIRMED') \
           AND t.date BETWEEN ? AND ? \
         ORDER BY t.date, t.time",
    )
    .bind(now.date().format("%Y-%m-%d").to_string())
    .bind(until.date().format("%Y-%m-%d").to_string())
    .fetch_all(pool)
    .await?;

    let mut out = Vec::new();
    for (id, pid, pname, aid, date, time, kind) in rows {
        if let Some(dt) = parse_appointment_local(&date, &time) {
            let delta = dt.signed_duration_since(now).num_minutes();
            if delta >= 0 && delta <= lead_minutes {
                out.push(AppointmentReminder {
                    appointment_id: id,
                    patient_id: pid,
                    patient_name: pname,
                    physician_id: aid,
                    date,
                    time,
                    kind,
                    minutes_until: delta,
                });
            }
        }
    }
    log_system!(
        info,
        event = "REMINDERS_SCANNED",
        count = out.len(),
        lead_minutes
    );
    Ok(out)
}
