// Notifications & appointment-reminder scheduler (FA-TER-NOTIFY).
//
// Calculates which appointments fall within a configurable lead time
// (default 24 h) and emits structured `system.log` events plus a JSON list
// the frontend can render in a notifications panel. Real OS notifications
// would require the `tauri-plugin-notification` crate — enabling it later
// only means swapping the `dispatch` body.

use chrono::{Duration, NaiveDateTime, Utc};
use serde::Serialize;
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::log_system;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AppointmentReminder {
    pub termin_id: String,
    pub patient_id: String,
    pub patient_name: String,
    pub arzt_id: String,
    pub datum: String,
    pub uhrzeit: String,
    pub art: String,
    pub minutes_until: i64,
}

pub async fn upcoming(
    pool: &SqlitePool,
    lead_minutes: i64,
) -> Result<Vec<AppointmentReminder>, AppError> {
    let now = Utc::now().naive_utc();
    let until = now + Duration::minutes(lead_minutes);

    // Filter in SQL on the date portion to keep the scan small; remaining
    // time-of-day comparison happens in Rust to handle any timezone quirks.
    let rows: Vec<(String, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT t.id, t.patient_id, p.name, t.arzt_id, t.datum, t.uhrzeit, t.art \
         FROM termin t \
         JOIN patient p ON p.id = t.patient_id \
         WHERE t.status IN ('GEPLANT','BESTAETIGT') \
           AND t.datum BETWEEN ? AND ? \
         ORDER BY t.datum, t.uhrzeit",
    )
    .bind(now.date().format("%Y-%m-%d").to_string())
    .bind(until.date().format("%Y-%m-%d").to_string())
    .fetch_all(pool)
    .await?;

    let mut out = Vec::new();
    for (id, pid, pname, aid, datum, uhrzeit, art) in rows {
        let stamp = format!("{datum} {uhrzeit}");
        if let Ok(dt) = NaiveDateTime::parse_from_str(&stamp, "%Y-%m-%d %H:%M") {
            let delta = dt.signed_duration_since(now).num_minutes();
            if delta >= 0 && delta <= lead_minutes {
                out.push(AppointmentReminder {
                    termin_id: id,
                    patient_id: pid,
                    patient_name: pname,
                    arzt_id: aid,
                    datum,
                    uhrzeit,
                    art,
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
