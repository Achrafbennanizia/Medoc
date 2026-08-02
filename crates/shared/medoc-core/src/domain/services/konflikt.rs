//! Termin scheduling conflicts (authoritative backend; FE `termin-availability.ts` is UI-only).
use crate::error::AppError;
use sqlx::SqlitePool;

/// Query for duplicate Arzt + date + time slot (excludes `ABGESAGT` and optional termin id).
#[derive(Debug, Clone)]
pub struct ArztSlotConflictQuery<'a> {
    pub datum: &'a str,
    pub uhrzeit: &'a str,
    pub arzt_id: &'a str,
    pub exclude_termin_id: Option<&'a str>,
}

/// Parse `HH:mm` or `HH:mm:ss` to minutes since midnight (matches FE `uhrzeitToMinutes`).
pub fn uhrzeit_to_minutes(u: &str) -> i32 {
    let s: String = u.chars().take(5).collect();
    let mut parts = s.split(':');
    let h: i32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(8);
    let m: i32 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    h * 60 + m
}

/// Returns `true` when another non-cancelled Termin occupies the same Arzt/date/time.
pub async fn has_arzt_slot_conflict(
    pool: &SqlitePool,
    q: ArztSlotConflictQuery<'_>,
) -> Result<bool, AppError> {
    let row: (i64,) = if let Some(eid) = q.exclude_termin_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM termin
             WHERE datum = ?1 AND uhrzeit = ?2 AND arzt_id = ?3 AND id != ?4
               AND status NOT IN ('ABGESAGT')",
        )
        .bind(q.datum)
        .bind(q.uhrzeit)
        .bind(q.arzt_id)
        .bind(eid)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT COUNT(*) FROM termin
             WHERE datum = ?1 AND uhrzeit = ?2 AND arzt_id = ?3
               AND status NOT IN ('ABGESAGT')",
        )
        .bind(q.datum)
        .bind(q.uhrzeit)
        .bind(q.arzt_id)
        .fetch_one(pool)
        .await?
    };
    Ok(row.0 > 0)
}

pub fn arzt_slot_conflict_message(datum: &str, uhrzeit: &str) -> String {
    format!("Physician already has an appointment on {datum} at {uhrzeit}")
}

pub fn appointment_conflict_short_message() -> &'static str {
    "Appointment conflict"
}
