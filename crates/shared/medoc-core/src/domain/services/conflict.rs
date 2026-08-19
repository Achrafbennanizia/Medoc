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
}

/// Parse `HH:mm` or `HH:mm:ss` to minutes since midnight (matches FE `timeToMinutes`).
pub fn time_to_minutes(u: &str) -> i32 {
    let s: String = u.chars().take(5).collect();
    let mut parts = s.split(':');
    let h: i32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(8);
    let m: i32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    h * 60 + m
}

/// Returns `true` when another non-cancelled Appointment occupies the same Physician/date/time.
pub async fn has_physician_slot_conflict(
    pool: &SqlitePool,
    q: PhysicianSlotConflictQuery<'_>,
) -> Result<bool, AppError> {
    let row: (i64,) = if let Some(eid) = q.exclude_appointment_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM appointment
             WHERE date = ?1 AND time = ?2 AND physician_id = ?3 AND id != ?4
               AND status NOT IN ('CANCELLED')",
        )
        .bind(q.date)
        .bind(q.time)
        .bind(q.physician_id)
        .bind(eid)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT COUNT(*) FROM appointment
             WHERE date = ?1 AND time = ?2 AND physician_id = ?3
               AND status NOT IN ('CANCELLED')",
        )
        .bind(q.date)
        .bind(q.time)
        .bind(q.physician_id)
        .fetch_one(pool)
        .await?
    };
    Ok(row.0 > 0)
}

pub fn physician_slot_conflict_message(date: &str, time: &str) -> String {
    format!("Physician already has an appointment on {date} at {time}")
}

pub fn appointment_conflict_short_message() -> &'static str {
    "Appointment conflict"
}
