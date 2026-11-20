use crate::domain::entities::appointment::{CreateAppointment, UpdateAppointment};
use crate::domain::entities::Appointment;
use crate::domain::services::conflict::{self, PhysicianSlotConflictQuery};
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Appointment>, AppError> {
    let rows =
        sqlx::query_as::<_, Appointment>("SELECT * FROM appointment ORDER BY date DESC, time ASC")
            .fetch_all(pool)
            .await?;
    Ok(rows)
}

pub async fn find_paginated(
    pool: &SqlitePool,
    limit: u32,
    offset: u32,
    sort_dir_sql: &'static str,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<(Vec<Appointment>, i64), AppError> {
    let mut wheres: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();
    if let Some(d) = date_from {
        wheres.push(format!("date >= ?{}", binds.len() + 1));
        binds.push(d.to_string());
    }
    if let Some(d) = date_to {
        wheres.push(format!("date <= ?{}", binds.len() + 1));
        binds.push(d.to_string());
    }
    let where_sql = if wheres.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", wheres.join(" AND "))
    };
    let count_sql = format!("SELECT COUNT(*) FROM appointment {where_sql}");
    let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
    for b in &binds {
        count_q = count_q.bind(b);
    }
    let total = count_q.fetch_one(pool).await?.0;

    let lim_i = binds.len() + 1;
    let off_i = binds.len() + 2;
    // Date primary; time secondary always ASC within a day.
    let list_sql = format!(
        "SELECT * FROM appointment {where_sql} ORDER BY date {sort_dir_sql}, time ASC LIMIT ?{lim_i} OFFSET ?{off_i}"
    );
    let mut list_q = sqlx::query_as::<_, Appointment>(&list_sql);
    for b in &binds {
        list_q = list_q.bind(b);
    }
    let rows = list_q
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(pool)
        .await?;
    Ok((rows, total))
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Appointment>, AppError> {
    let row = sqlx::query_as::<_, Appointment>("SELECT * FROM appointment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn find_by_date(pool: &SqlitePool, date: &str) -> Result<Vec<Appointment>, AppError> {
    let rows = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointment WHERE date = ?1 ORDER BY time ASC",
    )
    .bind(date)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn check_conflict(
    pool: &SqlitePool,
    date: &str,
    time: &str,
    physician_id: &str,
    exclude_id: Option<&str>,
    duration_minutes: i64,
) -> Result<bool, AppError> {
    conflict::has_physician_slot_conflict(
        pool,
        PhysicianSlotConflictQuery {
            date,
            time,
            physician_id,
            exclude_appointment_id: exclude_id,
            duration_minutes,
        },
    )
    .await
}

/// Appointments page loads the first of (today − 11 months) through the last
/// day of (today + 2 months). That span is 423–427 days; keep a little headroom.
const MAX_APPOINTMENT_RANGE_DAYS: i64 = 450;

/// F63: every appointment with `from <= date <= to` (local `yyyy-MM-dd`, as
/// stored), no page limit. Callers must stay within `MAX_APPOINTMENT_RANGE_DAYS`.
pub async fn find_in_range(
    pool: &SqlitePool,
    from: &str,
    to: &str,
) -> Result<Vec<Appointment>, AppError> {
    let parse = |d: &str| chrono::NaiveDate::parse_from_str(d.trim(), "%Y-%m-%d");
    let (Ok(f), Ok(t)) = (parse(from), parse(to)) else {
        return Err(AppError::Validation(
            "Date must be in yyyy-MM-dd format".into(),
        ));
    };
    if t < f || (t - f).num_days() > MAX_APPOINTMENT_RANGE_DAYS {
        return Err(AppError::Validation(format!(
            "Date range must be 0-{MAX_APPOINTMENT_RANGE_DAYS} days"
        )));
    }
    Ok(sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointment WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC, time ASC",
    )
    .bind(f.format("%Y-%m-%d").to_string())
    .bind(t.format("%Y-%m-%d").to_string())
    .fetch_all(pool)
    .await?)
}

/// F70: move several appointments in one transaction. Every target slot is
/// checked against the final layout (moved rows excluded from their old slot);
/// any conflict or unknown id aborts the whole move.
pub async fn move_many(
    pool: &SqlitePool,
    changes: &[crate::domain::entities::appointment::AppointmentMove],
) -> Result<Vec<Appointment>, AppError> {
    if changes.is_empty() {
        return Ok(Vec::new());
    }
    let mut tx = pool.begin().await?;
    let mut moved: Vec<(Appointment, String, String)> = Vec::new();
    for c in changes {
        let cur = sqlx::query_as::<_, Appointment>("SELECT * FROM appointment WHERE id = ?1")
            .bind(&c.id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound("Appointment".into()))?;
        chrono::NaiveDate::parse_from_str(&c.date, "%Y-%m-%d")
            .map_err(|_| AppError::Validation("Date must be in yyyy-MM-dd format".into()))?;
        moved.push((cur, c.date.clone(), c.time.clone()));
    }
    let moved_ids: Vec<&str> = moved.iter().map(|(a, _, _)| a.id.as_str()).collect();
    for (i, (a, date, time)) in moved.iter().enumerate() {
        let start = conflict::time_to_minutes(time) as i64;
        let end = start + a.duration_minutes.max(1);
        // Rows that stay where they are.
        let others: Vec<(String, String, i64)> = sqlx::query_as(
            "SELECT id, time, COALESCE(duration_minutes, 30) FROM appointment
             WHERE date = ?1 AND physician_id = ?2 AND status NOT IN ('CANCELLED','NO_SHOW')",
        )
        .bind(date)
        .bind(&a.physician_id)
        .fetch_all(&mut *tx)
        .await?;
        let clash_static = others.iter().any(|(id, t, d)| {
            if moved_ids.contains(&id.as_str()) {
                return false;
            }
            let s2 = conflict::time_to_minutes(t) as i64;
            start < s2 + d.max(&1) && s2 < end
        });
        // Rows moved in the same request.
        let clash_moved = moved.iter().enumerate().any(|(j, (b, d2, t2))| {
            if j == i || d2 != date || b.physician_id != a.physician_id {
                return false;
            }
            if b.status == "CANCELLED"
                || b.status == "NO_SHOW"
                || a.status == "CANCELLED"
                || a.status == "NO_SHOW"
            {
                return false;
            }
            let s2 = conflict::time_to_minutes(t2) as i64;
            start < s2 + b.duration_minutes.max(1) && s2 < end
        });
        let blocks = a.status != "CANCELLED" && a.status != "NO_SHOW";
        if blocks && (clash_static || clash_moved) {
            return Err(AppError::Conflict(
                conflict::physician_slot_conflict_message(date, time),
            ));
        }
    }
    for (a, date, time) in &moved {
        sqlx::query(
            "UPDATE appointment SET date = ?1, time = ?2,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?3",
        )
        .bind(date)
        .bind(time)
        .bind(&a.id)
        .execute(&mut *tx)
        .await?;
        crate::infrastructure::database::recorded_write::record_in_tx(
            &mut tx,
            "appointment",
            &a.id,
            "UPDATE",
        )
        .await?;
    }
    let mut out = Vec::with_capacity(moved.len());
    for (a, _, _) in &moved {
        out.push(
            sqlx::query_as::<_, Appointment>("SELECT * FROM appointment WHERE id = ?1")
                .bind(&a.id)
                .fetch_one(&mut *tx)
                .await?,
        );
    }
    tx.commit().await?;
    Ok(out)
}

pub async fn create(pool: &SqlitePool, data: &CreateAppointment) -> Result<Appointment, AppError> {
    let duration = crate::domain::entities::appointment::normalize_duration(data.duration_minutes)?;
    let initial_status = match data.status.as_ref() {
        None => "PLANNED".to_string(),
        Some(s) => {
            let raw = serde_json::to_string(s)
                .map_err(|e| AppError::Internal(format!("Serialize appointment status: {e}")))?
                .trim_matches('"')
                .to_uppercase();
            if raw != "PLANNED" && raw != "CONFIRMED" {
                return Err(AppError::Validation(
                    "A new appointment starts as PLANNED or CONFIRMED".into(),
                ));
            }
            raw
        }
    };
    // Check for time conflict (F65: overlapping intervals, not only equal start)
    if check_conflict(
        pool,
        &data.date,
        &data.time,
        &data.physician_id,
        None,
        duration,
    )
    .await?
    {
        return Err(AppError::Conflict(
            conflict::physician_slot_conflict_message(&data.date, &data.time),
        ));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let kind = serde_json::to_string(&data.kind)
        .map_err(|e| AppError::Internal(format!("Serialize appointment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    let patient_ok: Option<i64> = sqlx::query_scalar("SELECT 1 FROM patient WHERE id = ?1")
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
    if patient_ok.is_none() {
        return Err(AppError::Validation("Patient not found".into()));
    }
    let physician_ok: Option<i64> =
        sqlx::query_scalar("SELECT 1 FROM staff WHERE id = ?1 AND UPPER(role) = 'PHYSICIAN'")
            .bind(&data.physician_id)
            .fetch_optional(pool)
            .await?;
    if physician_ok.is_none() {
        return Err(AppError::Validation(
            "Clinician not found on this device. Sign in with a local staff account, or wait until accounts have synced from the main device.".into(),
        ));
    }

    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, patient_id, physician_id, notes, chief_complaint, duration_minutes, status, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(&data.date)
    .bind(&data.time)
    .bind(&kind)
    .bind(&data.patient_id)
    .bind(&data.physician_id)
    .bind(&data.notes)
    .bind(&data.chief_complaint)
    .bind(duration)
    .bind(&initial_status)
    .execute(pool)
    .await?;

    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "appointment",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateAppointment,
) -> Result<Appointment, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Appointment".into()))?;

    let date = data.date.as_deref().unwrap_or(&existing.date);
    let time = data.time.as_deref().unwrap_or(&existing.time);
    let physician_id = data
        .physician_id
        .as_deref()
        .unwrap_or(&existing.physician_id);

    let duration = match data.duration_minutes {
        Some(d) => crate::domain::entities::appointment::normalize_duration(Some(d))?,
        None => existing.duration_minutes.max(1),
    };
    // Check conflict if date/time/physician/duration changed
    if (date != existing.date
        || time != existing.time
        || physician_id != existing.physician_id
        || duration != existing.duration_minutes)
        && check_conflict(pool, date, time, physician_id, Some(id), duration).await?
    {
        return Err(AppError::Conflict(
            conflict::appointment_conflict_short_message().into(),
        ));
    }

    let kind = match data.kind.as_ref() {
        Some(a) => serde_json::to_string(a)
            .map_err(|e| AppError::Internal(format!("Serialize appointment type: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.kind.clone(),
    };
    let status = match data.status.as_ref() {
        Some(s) => {
            let raw = serde_json::to_string(s)
                .map_err(|e| AppError::Internal(format!("Serialize appointment status: {e}")))?
                .trim_matches('"')
                .to_uppercase();
            crate::domain::status::AppointmentStatus::require_transition(&existing.status, &raw)?;
            raw
        }
        None => existing.status.clone(),
    };

    sqlx::query(
        "UPDATE appointment SET date = ?1, time = ?2, kind = ?3, status = ?4,
         notes = ?5, chief_complaint = ?6, physician_id = ?7, duration_minutes = ?9,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?8",
    )
    .bind(date)
    .bind(time)
    .bind(&kind)
    .bind(&status)
    .bind(crate::domain::serde_util::patch_text(
        &data.notes,
        existing.notes.as_deref(),
    ))
    .bind(crate::domain::serde_util::patch_text(
        &data.chief_complaint,
        existing.chief_complaint.as_deref(),
    ))
    .bind(physician_id)
    .bind(id)
    .bind(duration)
    .execute(pool)
    .await?;

    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "appointment",
        id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM appointment WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "appointment",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

/// Next upcoming appointment for the patient (local by date/time).
/// Excludes cancelled appointments.
pub async fn find_next_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<Appointment>, AppError> {
    let row = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointment
         WHERE patient_id = ?1
           AND (status IS NULL OR TRIM(UPPER(status)) NOT IN ('CANCELLED'))
           AND (
             (date || ' ' || CASE
               WHEN trim(COALESCE(time, '')) = '' THEN '23:59'
               ELSE trim(time)
             END)
             >= strftime('%Y-%m-%d %H:%M', 'now', 'localtime')
           )
         ORDER BY date ASC, time ASC
         LIMIT 1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}
