use crate::domain::entities::staff::{CreateStaff, UpdateStaff};
use crate::domain::entities::{PhysicianSummary, Staff, TaskTeamMember};
use crate::error::AppError;
use sqlx::SqlitePool;

/// All users with role PHYSICIAN (for appointment “Clinician” selection).
pub async fn find_physician_summaries(
    pool: &SqlitePool,
) -> Result<Vec<PhysicianSummary>, AppError> {
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

pub async fn find_task_team_summaries(pool: &SqlitePool) -> Result<Vec<TaskTeamMember>, AppError> {
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
    let row =
        sqlx::query_as::<_, Staff>("SELECT * FROM staff WHERE LOWER(email) = LOWER(?1) LIMIT 1")
            .bind(email.trim())
            .fetch_optional(pool)
            .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, data: &CreateStaff, hash: &str) -> Result<Staff, AppError> {
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

pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateStaff) -> Result<Staff, AppError> {
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
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_BEGIN",
        staff_id = %id
    );
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Staff".into()))?;
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_TARGET",
        staff_id = %id,
        role = %existing.role,
        email = %existing.email
    );

    let refs = staff_delete_ref_counts(pool, id).await?;
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_FK_COUNTS",
        staff_id = %id,
        appointments = refs.appointments,
        prescriptions = refs.prescriptions,
        certificates = refs.certificates,
        work_time_sessions = refs.work_time_sessions,
        sick_leave = refs.sick_leave,
        work_plan = refs.work_plan,
        practice_tickets = refs.practice_tickets,
        practice_tasks = refs.practice_tasks,
        notifications = refs.notifications
    );

    let clinical = refs.appointments + refs.prescriptions + refs.certificates;
    if clinical > 0 {
        let other = replacement_physician_id(pool, id).await?;
        if other.is_none() {
            tracing::warn!(
                target: "medoc::staff",
                event = "STAFF_DELETE_BLOCKED_LAST_PHYSICIAN",
                staff_id = %id,
                appointments = refs.appointments,
                prescriptions = refs.prescriptions,
                certificates = refs.certificates
            );
            return Err(AppError::Validation(
                "This account still owns appointments or clinical documents. Assign another clinician first, then remove the account.".into(),
            ));
        }
    }

    detach_staff_operational_rows(pool, id).await?;
    reassign_or_reject_clinical_ownership(pool, id, &refs).await?;
    nullify_optional_staff_fks(pool, id).await?;

    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_EXECUTE",
        staff_id = %id
    );
    sqlx::query("DELETE FROM staff WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_OK",
        staff_id = %id
    );
    Ok(())
}

struct StaffDeleteRefs {
    appointments: i64,
    prescriptions: i64,
    certificates: i64,
    work_time_sessions: i64,
    sick_leave: i64,
    work_plan: i64,
    practice_tickets: i64,
    practice_tasks: i64,
    notifications: i64,
}

async fn count_sql(pool: &SqlitePool, sql: &str, id: &str) -> Result<i64, AppError> {
    sqlx::query_scalar(sql)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)
}

async fn staff_delete_ref_counts(pool: &SqlitePool, id: &str) -> Result<StaffDeleteRefs, AppError> {
    Ok(StaffDeleteRefs {
        appointments: count_sql(pool, "SELECT COUNT(*) FROM appointment WHERE physician_id = ?1", id).await?,
        prescriptions: count_sql(
            pool,
            "SELECT COUNT(*) FROM prescription WHERE physician_id = ?1 OR prescribing_physician_id = ?1",
            id,
        )
        .await?,
        certificates: count_sql(
            pool,
            "SELECT COUNT(*) FROM certificate WHERE physician_id = ?1 OR issuing_physician_id = ?1",
            id,
        )
        .await?,
        work_time_sessions: count_sql(
            pool,
            "SELECT COUNT(*) FROM work_time_session WHERE staff_id = ?1",
            id,
        )
        .await?,
        sick_leave: count_sql(
            pool,
            "SELECT COUNT(*) FROM sick_leave_certificate WHERE staff_id = ?1 OR created_by = ?1 OR ended_by = ?1",
            id,
        )
        .await?,
        work_plan: count_sql(
            pool,
            "SELECT COUNT(*) FROM work_plan_adjustment WHERE staff_id = ?1",
            id,
        )
        .await?,
        practice_tickets: count_sql(
            pool,
            "SELECT COUNT(*) FROM practice_ticket WHERE from_user_id = ?1 OR to_physician_id = ?1",
            id,
        )
        .await?,
        practice_tasks: count_sql(
            pool,
            "SELECT COUNT(*) FROM practice_task WHERE created_by = ?1 OR assignee_user_id = ?1",
            id,
        )
        .await?,
        notifications: count_sql(
            pool,
            "SELECT COUNT(*) FROM in_app_notification WHERE user_id = ?1",
            id,
        )
        .await?,
    })
}

async fn detach_staff_operational_rows(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // sync: recorded by caller delete_staff
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_DETACH_OPERATIONAL",
        staff_id = %id
    );
    sqlx::query(
        "DELETE FROM work_time_pause_segment WHERE session_id IN
         (SELECT id FROM work_time_session WHERE staff_id = ?1)",
    )
    .bind(id)
    .execute(pool)
    .await?;
    sqlx::query("DELETE FROM work_time_preference WHERE staff_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM work_time_session WHERE staff_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM work_plan_adjustment WHERE staff_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM sick_leave_certificate WHERE staff_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    // A note written for someone else stays. Point the author columns at
    // another account so this delete does not fail the foreign key.
    let other: Option<String> =
        sqlx::query_scalar("SELECT id FROM staff WHERE id != ?1 ORDER BY id LIMIT 1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    if let Some(other) = other {
        sqlx::query(
            "UPDATE sick_leave_certificate SET created_by = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE created_by = ?2 AND staff_id != ?2",
        )
        .bind(&other)
        .bind(id)
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "UPDATE sick_leave_certificate SET ended_by = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE ended_by = ?1 AND staff_id != ?1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    sqlx::query("DELETE FROM device_session WHERE user_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

async fn replacement_physician_id(
    pool: &SqlitePool,
    except_id: &str,
) -> Result<Option<String>, AppError> {
    sqlx::query_scalar(
        "SELECT id FROM staff WHERE UPPER(role) = 'PHYSICIAN' AND id != ?1 ORDER BY id LIMIT 1",
    )
    .bind(except_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)
}

async fn reassign_or_reject_clinical_ownership(
    pool: &SqlitePool,
    id: &str,
    refs: &StaffDeleteRefs,
) -> Result<(), AppError> {
    // sync: recorded by caller delete_staff
    let clinical = refs.appointments + refs.prescriptions + refs.certificates;
    if clinical == 0 {
        return Ok(());
    }
    let Some(other) = replacement_physician_id(pool, id).await? else {
        tracing::warn!(
            target: "medoc::staff",
            event = "STAFF_DELETE_BLOCKED_LAST_PHYSICIAN",
            staff_id = %id,
            appointments = refs.appointments,
            prescriptions = refs.prescriptions,
            certificates = refs.certificates
        );
        return Err(AppError::Validation(
            "This account still owns appointments or clinical documents. Assign another clinician first, then remove the account.".into(),
        ));
    };
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_REASSIGN_CLINICAL",
        staff_id = %id,
        replacement_physician_id = %other,
        appointments = refs.appointments,
        prescriptions = refs.prescriptions,
        certificates = refs.certificates
    );
    let mut tx = pool.begin().await?;
    record_reassigned(
        &mut tx,
        "appointment",
        "UPDATE appointment SET physician_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE physician_id = ?2 RETURNING id",
        &other,
        id,
    )
    .await?;
    record_reassigned(
        &mut tx,
        "prescription",
        "UPDATE prescription SET physician_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE physician_id = ?2 RETURNING id",
        &other,
        id,
    )
    .await?;
    record_reassigned(
        &mut tx,
        "certificate",
        "UPDATE certificate SET physician_id = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE physician_id = ?2 RETURNING id",
        &other,
        id,
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn record_reassigned(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    table: &str,
    sql: &str,
    other: &str,
    old_id: &str,
) -> Result<(), AppError> {
    let ids: Vec<String> = sqlx::query_scalar(sql)
        .bind(other)
        .bind(old_id)
        .fetch_all(&mut **tx)
        .await?;
    for row_id in ids {
        crate::infrastructure::database::recorded_write::record_in_tx(tx, table, &row_id, "UPDATE")
            .await?;
    }
    Ok(())
}

async fn nullify_optional_staff_fks(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // sync: recorded by caller delete_staff
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_NULLIFY_OPTIONAL",
        staff_id = %id
    );
    let mut tx = pool.begin().await?;
    record_returning(
        &mut tx,
        "prescription",
        "UPDATE prescription SET prescribing_physician_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE prescribing_physician_id = ?1 RETURNING id",
        id,
    )
    .await?;
    record_returning(
        &mut tx,
        "certificate",
        "UPDATE certificate SET issuing_physician_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE issuing_physician_id = ?1 RETURNING id",
        id,
    )
    .await?;
    record_returning(
        &mut tx,
        "examination",
        "UPDATE examination SET released_by_physician_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE released_by_physician_id = ?1 RETURNING id",
        id,
    )
    .await?;
    record_returning(
        &mut tx,
        "treatment",
        "UPDATE treatment SET released_by_physician_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE released_by_physician_id = ?1 RETURNING id",
        id,
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn record_returning(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    table: &str,
    sql: &str,
    staff_id: &str,
) -> Result<(), AppError> {
    let ids: Vec<String> = sqlx::query_scalar(sql)
        .bind(staff_id)
        .fetch_all(&mut **tx)
        .await?;
    for row_id in ids {
        crate::infrastructure::database::recorded_write::record_in_tx(tx, table, &row_id, "UPDATE")
            .await?;
    }
    Ok(())
}

pub async fn update_password_hash(pool: &SqlitePool, id: &str, hash: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE staff SET password_hash = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2")
        .bind(hash)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Stores a new password and invalidates LAN tokens issued before the change.
pub async fn replace_password(pool: &SqlitePool, id: &str, hash: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE staff SET password_hash = ?1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
    )
    .bind(hash)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn token_version(pool: &SqlitePool, id: &str) -> Result<i64, AppError> {
    let version: Option<i64> =
        sqlx::query_scalar("SELECT token_version FROM staff WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    version.ok_or(AppError::Unauthorized)
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
    role.eq_ignore_ascii_case("PHYSICIAN") || role.eq_ignore_ascii_case("ADMIN")
}
