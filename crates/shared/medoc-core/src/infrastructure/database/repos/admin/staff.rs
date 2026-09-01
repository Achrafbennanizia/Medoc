use crate::domain::entities::staff::{CreateStaff, UpdateStaff};
use crate::domain::entities::{PhysicianSummary, TaskTeamMember, Staff};
use crate::error::AppError;
use sqlx::SqlitePool;

/// All users with role PHYSICIAN (for appointment “Clinician” selection).
pub async fn find_physician_summaries(pool: &SqlitePool) -> Result<Vec<PhysicianSummary>, AppError> {
    let rows = sqlx::query_as::<_, PhysicianSummary>(
        "SELECT id, name FROM staff WHERE UPPER(role) = 'PHYSICIAN' ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Physician + Reception names for practice tasks UI (no `staff.read` required).
pub async fn find_user_ids_by_role(pool: &SqlitePool, role: &str) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT id FROM staff WHERE UPPER(role) = UPPER(?1) ORDER BY name")
            .bind(role)
            .fetch_all(pool)
            .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn find_task_team_summaries(
    pool: &SqlitePool,
) -> Result<Vec<TaskTeamMember>, AppError> {
    let rows = sqlx::query_as::<_, TaskTeamMember>(
        "SELECT id, name, role FROM staff
         WHERE UPPER(role) IN ('PHYSICIAN', 'RECEPTION')
         ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Staff>, AppError> {
    let rows = sqlx::query_as::<_, Staff>("SELECT * FROM staff ORDER BY name")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Staff>, AppError> {
    let row = sqlx::query_as::<_, Staff>("SELECT * FROM staff WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn find_by_email(pool: &SqlitePool, email: &str) -> Result<Option<Staff>, AppError> {
    let row = sqlx::query_as::<_, Staff>(
        "SELECT * FROM staff WHERE LOWER(email) = LOWER(?1) LIMIT 1",
    )
    .bind(email.trim())
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreateStaff,
    hash: &str,
) -> Result<Staff, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let role = serde_json::to_string(&data.role)
        .map_err(|e| AppError::Internal(format!("Role serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, activity_area, specialty, phone)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.email)
    .bind(hash)
    .bind(&role)
    .bind(&data.activity_area)
    .bind(&data.specialty)
    .bind(&data.phone)
    .execute(pool)
    .await?;

    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))
}

/// Insert staff row inside an open `BEGIN IMMEDIATE` transaction (quota enforced by caller).
pub async fn create_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    data: &CreateStaff,
    hash: &str,
) -> Result<Staff, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let role = serde_json::to_string(&data.role)
        .map_err(|e| AppError::Internal(format!("Role serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, activity_area, specialty, phone)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.email)
    .bind(hash)
    .bind(&role)
    .bind(&data.activity_area)
    .bind(&data.specialty)
    .bind(&data.phone)
    .execute(&mut **tx)
    .await?;

    find_by_id_in_tx(tx, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))
}

/// Atomic create with staff-quota enforcement (`BEGIN IMMEDIATE`).
pub async fn create_with_quota(
    pool: &SqlitePool,
    data: &CreateStaff,
    hash: &str,
) -> Result<Staff, AppError> {
    let role = serde_json::to_string(&data.role)
        .map_err(|e| AppError::Internal(format!("Role serialisieren: {e}")))?
        .trim_matches('"')
        .to_string();
    let mut tx = crate::mvp_security::begin_immediate_quota_tx(pool).await?;
    crate::mvp_security::enforce_staff_quota_on_conn(&mut tx, &role, None).await?;
    let p = create_in_tx(&mut tx, data, hash).await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(p)
}

async fn find_by_id_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: &str,
) -> Result<Option<Staff>, AppError> {
    let row = sqlx::query_as::<_, Staff>("SELECT * FROM staff WHERE id = ?1")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(row)
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateStaff,
) -> Result<Staff, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Staff".into()))?;

    let name = data.name.as_deref().unwrap_or(&existing.name);
    let email = data.email.as_deref().unwrap_or(&existing.email);
    let role = match data.role.as_ref() {
        Some(r) => serde_json::to_string(r)
            .map_err(|e| AppError::Internal(format!("Role serialisieren: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.role.clone(),
    };
    let available = data.available.unwrap_or(existing.available);

    let activity_area = match data.activity_area.as_deref() {
        None => existing.activity_area.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };
    let specialty = match data.specialty.as_deref() {
        None => existing.specialty.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };
    let phone = match data.phone.as_deref() {
        None => existing.phone.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };

    sqlx::query(
        "UPDATE staff SET name = ?1, email = ?2, role = ?3, activity_area = ?4,
         specialty = ?5, phone = ?6, available = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
    )
    .bind(name)
    .bind(email)
    .bind(&role)
    .bind(activity_area)
    .bind(specialty)
    .bind(phone)
    .bind(available)
    .bind(id)
    .execute(pool)
    .await?;

    find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))
}

/// Update staff row inside an open transaction.
pub async fn update_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: &str,
    data: &UpdateStaff,
) -> Result<Staff, AppError> {
    let existing = find_by_id_in_tx(tx, id)
        .await?
        .ok_or(AppError::NotFound("Staff".into()))?;

    let name = data.name.as_deref().unwrap_or(&existing.name);
    let email = data.email.as_deref().unwrap_or(&existing.email);
    let role = match data.role.as_ref() {
        Some(r) => serde_json::to_string(r)
            .map_err(|e| AppError::Internal(format!("Role serialisieren: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.role.clone(),
    };
    let available = data.available.unwrap_or(existing.available);

    let activity_area = match data.activity_area.as_deref() {
        None => existing.activity_area.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };
    let specialty = match data.specialty.as_deref() {
        None => existing.specialty.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };
    let phone = match data.phone.as_deref() {
        None => existing.phone.clone(),
        Some(t) if t.trim().is_empty() => None,
        Some(t) => Some(t.trim().to_string()),
    };

    sqlx::query(
        "UPDATE staff SET name = ?1, email = ?2, role = ?3, activity_area = ?4,
         specialty = ?5, phone = ?6, available = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
    )
    .bind(name)
    .bind(email)
    .bind(&role)
    .bind(activity_area)
    .bind(specialty)
    .bind(phone)
    .bind(available)
    .bind(id)
    .execute(&mut **tx)
    .await?;

    find_by_id_in_tx(tx, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))
}

/// Atomic role-change update with staff-quota enforcement (`BEGIN IMMEDIATE`).
pub async fn update_with_quota(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateStaff,
    target_role: &str,
) -> Result<Staff, AppError> {
    let mut tx = crate::mvp_security::begin_immediate_quota_tx(pool).await?;
    crate::mvp_security::enforce_staff_quota_on_conn(&mut tx, target_role, Some(id)).await?;
    let p = update_in_tx(&mut tx, id, data).await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(p)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM staff WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_password_hash(pool: &SqlitePool, id: &str, hash: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE staff SET password_hash = ?1 WHERE id = ?2")
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
        "UPDATE staff SET totp_secret = ?1, totp_enrolled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
    )
    .bind(secret_base32)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn confirm_totp_enrollment(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE staff SET totp_enrolled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_totp(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE staff SET totp_secret = NULL, totp_enrolled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub fn is_totp_enrolled(user: &Staff) -> bool {
    user.totp_enrolled_at.is_some() && user.totp_secret.as_ref().is_some_and(|s| !s.is_empty())
}

pub fn totp_required_for_role(role: &str) -> bool {
    // When TOTP_2FA_ENABLED is false, all callers see optional 2FA (no inverted branches needed).
    if !crate::mvp_security::TOTP_2FA_ENABLED {
        return false;
    }
    role.eq_ignore_ascii_case("PHYSICIAN")
}
