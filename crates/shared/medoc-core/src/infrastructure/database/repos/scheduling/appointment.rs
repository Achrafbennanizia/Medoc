use crate::domain::entities::appointment::{CreateAppointment, UpdateAppointment};
use crate::domain::entities::Appointment;
use crate::domain::services::conflict::{self, PhysicianSlotConflictQuery};
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Appointment>, AppError> {
    let rows = sqlx::query_as::<_, Appointment>("SELECT * FROM appointment ORDER BY date DESC, time ASC")
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
    let rows =
        sqlx::query_as::<_, Appointment>("SELECT * FROM appointment WHERE date = ?1 ORDER BY time ASC")
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
) -> Result<bool, AppError> {
    conflict::has_physician_slot_conflict(
        pool,
        PhysicianSlotConflictQuery {
            date,
            time,
            physician_id,
            exclude_appointment_id: exclude_id,
        },
    )
    .await
}

pub async fn create(pool: &SqlitePool, data: &CreateAppointment) -> Result<Appointment, AppError> {
    // Check for time conflict
    if check_conflict(pool, &data.date, &data.time, &data.physician_id, None).await? {
        return Err(AppError::Conflict(conflict::physician_slot_conflict_message(
            &data.date,
            &data.time,
        )));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let kind = serde_json::to_string(&data.kind)
        .map_err(|e| AppError::Internal(format!("Serialize appointment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, patient_id, physician_id, notes, chief_complaint)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&data.date)
    .bind(&data.time)
    .bind(&kind)
    .bind(&data.patient_id)
    .bind(&data.physician_id)
    .bind(&data.notes)
    .bind(&data.chief_complaint)
    .execute(pool)
    .await?;

    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "appointment", &id, "INSERT", &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateAppointment) -> Result<Appointment, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Appointment".into()))?;

    let date = data.date.as_deref().unwrap_or(&existing.date);
    let time = data.time.as_deref().unwrap_or(&existing.time);
    let physician_id = data.physician_id.as_deref().unwrap_or(&existing.physician_id);

    // Check conflict if date/time/physician changed
    if (date != existing.date || time != existing.time || physician_id != existing.physician_id)
        && check_conflict(pool, date, time, physician_id, Some(id)).await?
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
        Some(s) => serde_json::to_string(s)
            .map_err(|e| AppError::Internal(format!("Serialize appointment status: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.status.clone(),
    };

    sqlx::query(
        "UPDATE appointment SET date = ?1, time = ?2, kind = ?3, status = ?4,
         notes = ?5, chief_complaint = ?6, physician_id = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
    )
    .bind(date)
    .bind(time)
    .bind(&kind)
    .bind(&status)
    .bind(data.notes.as_deref().or(existing.notes.as_deref()))
    .bind(
        data.chief_complaint
            .as_deref()
            .or(existing.chief_complaint.as_deref()),
    )
    .bind(physician_id)
    .bind(id)
    .execute(pool)
    .await?;

    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "appointment", id, "UPDATE", &body,
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
