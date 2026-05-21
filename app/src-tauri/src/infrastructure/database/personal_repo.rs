use crate::domain::entities::personal::{CreatePersonal, UpdatePersonal};
use crate::domain::entities::{AerztSummary, Personal};
use crate::error::AppError;
use sqlx::SqlitePool;

/// All users with role ARZT (for appointment “Behandler” selection).
pub async fn find_arzt_summaries(pool: &SqlitePool) -> Result<Vec<AerztSummary>, AppError> {
    let rows = sqlx::query_as::<_, AerztSummary>(
        "SELECT id, name FROM personal WHERE UPPER(rolle) = 'ARZT' ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Personal>, AppError> {
    let rows = sqlx::query_as::<_, Personal>("SELECT * FROM personal ORDER BY name")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Personal>, AppError> {
    let row = sqlx::query_as::<_, Personal>("SELECT * FROM personal WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn find_by_email(pool: &SqlitePool, email: &str) -> Result<Option<Personal>, AppError> {
    let row = sqlx::query_as::<_, Personal>("SELECT * FROM personal WHERE email = ?1")
        .bind(email)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreatePersonal,
    hash: &str,
) -> Result<Personal, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let rolle = serde_json::to_string(&data.rolle)
        .map_err(|e| AppError::Internal(format!("Rolle serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle, taetigkeitsbereich, fachrichtung, telefon)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.email)
    .bind(hash)
    .bind(&rolle)
    .bind(&data.taetigkeitsbereich)
    .bind(&data.fachrichtung)
    .bind(&data.telefon)
    .execute(pool)
    .await?;

    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdatePersonal,
) -> Result<Personal, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;

    let name = data.name.as_deref().unwrap_or(&existing.name);
    let email = data.email.as_deref().unwrap_or(&existing.email);
    let rolle = match data.rolle.as_ref() {
        Some(r) => serde_json::to_string(r)
            .map_err(|e| AppError::Internal(format!("Rolle serialisieren: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.rolle.clone(),
    };
    let verfuegbar = data.verfuegbar.unwrap_or(existing.verfuegbar);

    let taetigkeitsbereich = match data.taetigkeitsbereich.as_deref() {
        None => existing.taetigkeitsbereich.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };
    let fachrichtung = match data.fachrichtung.as_deref() {
        None => existing.fachrichtung.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };
    let telefon = match data.telefon.as_deref() {
        None => existing.telefon.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };

    sqlx::query(
        "UPDATE personal SET name = ?1, email = ?2, rolle = ?3, taetigkeitsbereich = ?4,
         fachrichtung = ?5, telefon = ?6, verfuegbar = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
    )
    .bind(name)
    .bind(email)
    .bind(&rolle)
    .bind(taetigkeitsbereich)
    .bind(fachrichtung)
    .bind(telefon)
    .bind(verfuegbar)
    .bind(id)
    .execute(pool)
    .await?;

    find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM personal WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_password_hash(pool: &SqlitePool, id: &str, hash: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE personal SET passwort_hash = ?1 WHERE id = ?2")
        .bind(hash)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_totp_pending_secret(
    pool: &SqlitePool,
    id: &str,
    secret_base32: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE personal SET totp_secret = ?1, totp_enrolled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
    )
    .bind(secret_base32)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn confirm_totp_enrollment(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE personal SET totp_enrolled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_totp(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE personal SET totp_secret = NULL, totp_enrolled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub fn is_totp_enrolled(user: &Personal) -> bool {
    user.totp_enrolled_at.is_some() && user.totp_secret.as_ref().is_some_and(|s| !s.is_empty())
}

pub fn totp_required_for_role(rolle: &str) -> bool {
    rolle.eq_ignore_ascii_case("ARZT")
}
