use crate::domain::entities::termin::{CreateTermin, UpdateTermin};
use crate::domain::entities::Termin;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Termin>, AppError> {
    let rows = sqlx::query_as::<_, Termin>("SELECT * FROM termin ORDER BY datum DESC, uhrzeit ASC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Termin>, AppError> {
    let row = sqlx::query_as::<_, Termin>("SELECT * FROM termin WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn find_by_date(pool: &SqlitePool, datum: &str) -> Result<Vec<Termin>, AppError> {
    let rows =
        sqlx::query_as::<_, Termin>("SELECT * FROM termin WHERE datum = ?1 ORDER BY uhrzeit ASC")
            .bind(datum)
            .fetch_all(pool)
            .await?;
    Ok(rows)
}

pub async fn check_conflict(
    pool: &SqlitePool,
    datum: &str,
    uhrzeit: &str,
    arzt_id: &str,
    exclude_id: Option<&str>,
) -> Result<bool, AppError> {
    let row: (i64,) = if let Some(eid) = exclude_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM termin WHERE datum = ?1 AND uhrzeit = ?2 AND arzt_id = ?3 AND id != ?4 AND status NOT IN ('ABGESAGT')"
        )
        .bind(datum).bind(uhrzeit).bind(arzt_id).bind(eid)
        .fetch_one(pool).await?
    } else {
        sqlx::query_as(
            "SELECT COUNT(*) FROM termin WHERE datum = ?1 AND uhrzeit = ?2 AND arzt_id = ?3 AND status NOT IN ('ABGESAGT')"
        )
        .bind(datum).bind(uhrzeit).bind(arzt_id)
        .fetch_one(pool).await?
    };
    Ok(row.0 > 0)
}

pub async fn create(pool: &SqlitePool, data: &CreateTermin) -> Result<Termin, AppError> {
    // Check for time conflict
    if check_conflict(pool, &data.datum, &data.uhrzeit, &data.arzt_id, None).await? {
        return Err(AppError::Conflict(format!(
            "Arzt hat bereits einen Termin am {} um {}",
            data.datum, data.uhrzeit
        )));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let art = serde_json::to_string(&data.art)
        .unwrap()
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO termin (id, datum, uhrzeit, art, patient_id, arzt_id, notizen, beschwerden)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&data.datum)
    .bind(&data.uhrzeit)
    .bind(&art)
    .bind(&data.patient_id)
    .bind(&data.arzt_id)
    .bind(&data.notizen)
    .bind(&data.beschwerden)
    .execute(pool)
    .await?;

    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))
}

pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateTermin) -> Result<Termin, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Termin".into()))?;

    let datum = data.datum.as_deref().unwrap_or(&existing.datum);
    let uhrzeit = data.uhrzeit.as_deref().unwrap_or(&existing.uhrzeit);
    let arzt_id = data.arzt_id.as_deref().unwrap_or(&existing.arzt_id);

    // Check conflict if date/time/arzt changed
    if (datum != existing.datum || uhrzeit != existing.uhrzeit || arzt_id != existing.arzt_id)
        && check_conflict(pool, datum, uhrzeit, arzt_id, Some(id)).await?
    {
        return Err(AppError::Conflict("Terminkonflikt".into()));
    }

    let art = data
        .art
        .as_ref()
        .map(|a| {
            serde_json::to_string(a)
                .unwrap()
                .trim_matches('"')
                .to_uppercase()
        })
        .unwrap_or(existing.art.clone());
    let status = data
        .status
        .as_ref()
        .map(|s| {
            serde_json::to_string(s)
                .unwrap()
                .trim_matches('"')
                .to_uppercase()
        })
        .unwrap_or(existing.status.clone());

    sqlx::query(
        "UPDATE termin SET datum = ?1, uhrzeit = ?2, art = ?3, status = ?4,
         notizen = ?5, beschwerden = ?6, arzt_id = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
    )
    .bind(datum)
    .bind(uhrzeit)
    .bind(&art)
    .bind(&status)
    .bind(data.notizen.as_deref().or(existing.notizen.as_deref()))
    .bind(
        data.beschwerden
            .as_deref()
            .or(existing.beschwerden.as_deref()),
    )
    .bind(arzt_id)
    .bind(id)
    .execute(pool)
    .await?;

    find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM termin WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
