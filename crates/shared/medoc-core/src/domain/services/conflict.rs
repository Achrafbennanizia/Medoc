//! Appointment scheduling conflicts (authoritative backend; FE `appointment-availability.ts` is UI-only).
use crate::error::AppError;
use sqlx::SqlitePool;

/// Query for duplicate Physician + date + time slot (excludes `CANCELLED` and optional appointment id).
#[derive(Debug, Clone)]
pub struct PhysicianSlotConflictQuery<'a> {
    pub date: &'a str,
    pub time: &'a str,
    pub physician_id: &'a str,
    pub exclude_appointment_id: Option<&'a str>,
    /// Length of the new or moved appointment in minutes.
    pub duration_minutes: i64,
}

/// Parse `HH:mm` or `HH:mm:ss` to minutes since midnight (matches FE `timeToMinutes`).
pub fn time_to_minutes(u: &str) -> i32 {
    let s: String = u.chars().take(5).collect();
    let mut parts = s.split(':');
    let h: i32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(8);
    let m: i32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    h * 60 + m
}

/// F65: `true` when another appointment of the same physician on that date
/// overlaps `[time, time + duration)`. CANCELLED and NO_SHOW do not block.
pub async fn has_physician_slot_conflict(
    pool: &SqlitePool,
    q: PhysicianSlotConflictQuery<'_>,
) -> Result<bool, AppError> {
    let rows: Vec<(String, String, i64)> = sqlx::query_as(
        "SELECT id, time, COALESCE(duration_minutes, 30) FROM appointment
         WHERE date = ?1 AND physician_id = ?2
           AND status NOT IN ('CANCELLED', 'NO_SHOW')",
    )
    .bind(q.date)
    .bind(q.physician_id)
    .fetch_all(pool)
    .await?;
    let start = time_to_minutes(q.time) as i64;
    let end = start + q.duration_minutes.max(1);
    Ok(rows.iter().any(|(id, t, d)| {
        if Some(id.as_str()) == q.exclude_appointment_id {
            return false;
        }
        let s2 = time_to_minutes(t) as i64;
        let e2 = s2 + (*d).max(1);
        start < e2 && s2 < end
    }))
}

pub fn physician_slot_conflict_message(date: &str, time: &str) -> String {
    format!("Physician already has an appointment on {date} at {time}")
}

pub fn appointment_conflict_short_message() -> &'static str {
    "Appointment conflict"
}
