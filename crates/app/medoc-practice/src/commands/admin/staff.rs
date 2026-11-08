use crate::application::auth_service::PermissionOverride;
use crate::application::mvp_security::{self, StaffQuota};
use crate::application::own_profile::{self, OwnProfileDto};
use crate::application::rbac;
use crate::commands::auth_commands::{BruteForceState, SessionState};
use crate::domain::entities::staff::{CreateStaff, UpdateOwnProfile, UpdateStaff};
use crate::domain::entities::{PhysicianSummary, Staff, TaskTeamMember};
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::{audit_repo, device_session_repo, staff_permission_repo, staff_repo};
use crate::infrastructure::logging::brute_force;
// TODO(deferred-security): 2FA unwired — see todos-deferred-security-features.md
// use crate::infrastructure::totp::{self, TotpEnrollmentDto};
use medoc_sync::deployment::DeviceRole;
use medoc_sync::engine::SyncEngine;
use sqlx::SqlitePool;
use tauri::State;

const STAFF_MANAGED_ON_MAIN: &str = "Staff accounts are managed on the main device.";

pub async fn reject_staff_writes_on_replica(pool: &SqlitePool) -> Result<(), AppError> {
    match SyncEngine::status(pool).await {
        Ok(snap) if snap.deployment.role == DeviceRole::Replica => {
            Err(AppError::Validation(STAFF_MANAGED_ON_MAIN.into()))
        }
        _ => Ok(()),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_staff(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Staff>, AppError> {
    rbac::require(&session_state, "staff.read")?;
    staff_repo::find_all(&pool).await
}

/// Doctors only — for appointment treating clinician (FA-TERM-14); allowed for Physician + Reception.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_physicians(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PhysicianSummary>, AppError> {
    rbac::require(&session_state, "appointment.list_physicians")?;
    staff_repo::find_physician_summaries(&pool).await
}

/// Doctor/reception directory for practice-task labels — `task.status.fulfill` (no HR read).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_task_team_directory(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<TaskTeamMember>, AppError> {
    rbac::require(&session_state, "task.status.fulfill")?;
    staff_repo::find_task_team_summaries(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state, id))]
pub async fn get_staff(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Staff, AppError> {
    rbac::require(&session_state, "staff.read")?;
    staff_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("error.entity.staff".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_staff(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateStaff,
) -> Result<Staff, AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    if staff_repo::find_by_email(&pool, &data.email)
        .await?
        .is_some()
    {
        return Err(AppError::validation_code("error.staff.email_taken"));
    }
    crypto::validate_password_policy(&data.password)?;
    let hash =
        crypto::hash_password(&data.password).map_err(|e| AppError::Internal(e.to_string()))?;
    let p = staff_repo::create_with_quota(&pool, &data, &hash).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Staff",
        Some(&p.id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

/// Read own profile (no `staff.read` required — any authenticated session).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_own_profile(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<OwnProfileDto, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    own_profile::get_own_profile(&pool, &session.user_id).await
}

/// Update own profile (name, email, contact — no role changes).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_own_profile(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateOwnProfile,
) -> Result<OwnProfileDto, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let updated = own_profile::apply_own_profile_update(&pool, &session.user_id, &data).await?;
    {
        let mut guard = session_state.lock_session();
        if let Some((sess, _)) = guard.as_mut() {
            sess.name.clone_from(&updated.name);
            sess.email.clone_from(&updated.email);
        }
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE_OWN_PROFILE",
        "Staff",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();
    Ok(OwnProfileDto::from(&updated))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_staff(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateStaff,
) -> Result<Staff, AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    let existing = staff_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("error.entity.staff".into()))?;
    let p = if let Some(ref new_role) = data.role {
        let role_str = serde_json::to_string(new_role)
            .map_err(|e| AppError::Internal(format!("Serialize role: {e}")))?
            .trim_matches('"')
            .to_string();
        if !role_str.eq_ignore_ascii_case(&existing.role) {
            staff_repo::update_with_quota(&pool, &id, &data, &role_str).await?
        } else {
            staff_repo::update(&pool, &id, &data).await?
        }
    } else {
        staff_repo::update(&pool, &id, &data).await?
    };
    if data.available == Some(false) {
        staff_repo::replace_password(&pool, &id, &existing.password_hash).await.ok();
        let _ = crate::infrastructure::database::device_session_repo::end_all_for_user(&pool, &id)
            .await;
    }
    audit_repo::create(&pool, &session.user_id, "UPDATE", "Staff", Some(&id), None)
        .await
        .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_staff(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    tracing::info!(
        target: "medoc::staff",
        event = "STAFF_DELETE_IPC",
        actor_id = %session.user_id,
        staff_id = %id
    );
    if session.user_id == id {
        return Err(AppError::Validation(
            "You cannot remove the account you are signed in with.".into(),
        ));
    }
    staff_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Staff", Some(&id), None)
        .await
        .ok();
    Ok(())
}

/// Self-service password change. The caller authenticates with their old
/// password and supplies a new one (>= 8 chars). FA-EINST-02 / ISO 27001.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, old_password, new_password))]
pub async fn change_password(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    old_password: String,
    new_password: String,
) -> Result<(), AppError> {
    let session = {
        let guard = session_state.lock_session();
        let (s, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
        s.clone()
    };
    reject_staff_writes_on_replica(&pool).await?;
    crypto::validate_password_policy(&new_password)?;
    let me = staff_repo::find_by_id(&pool, &session.user_id)
        .await?
        .ok_or(AppError::NotFound("error.entity.staff".into()))?;
    let ok = crypto::verify_password(&old_password, &me.password_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !ok {
        return Err(AppError::Unauthorized);
    }
    let hash =
        crypto::hash_password(&new_password).map_err(|e| AppError::Internal(e.to_string()))?;
    staff_repo::replace_password(&pool, &session.user_id, &hash).await?;
    if let Some(keep) = session
        .device_session_id
        .as_deref()
        .filter(|id| !id.is_empty())
    {
        device_session_repo::end_other_than(&pool, &session.user_id, keep).await?;
    } else {
        device_session_repo::end_all_for_user(&pool, &session.user_id).await?;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "CHANGE_PASSWORD",
        "Staff",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// Set password for any team member (without old password) — e.g. staff admin.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, new_password))]
pub async fn set_staff_password_by_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    new_password: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    crypto::validate_password_policy(&new_password)?;
    if staff_repo::find_by_id(&pool, &id).await?.is_none() {
        return Err(AppError::NotFound("error.entity.staff".into()));
    }
    let hash =
        crypto::hash_password(&new_password).map_err(|e| AppError::Internal(e.to_string()))?;
    staff_repo::replace_password(&pool, &id, &hash).await?;
    if session.user_id == id {
        if let Some(keep) = session
            .device_session_id
            .as_deref()
            .filter(|keep_id| !keep_id.is_empty())
        {
            device_session_repo::end_other_than(&pool, &id, keep).await?;
        } else {
            device_session_repo::end_all_for_user(&pool, &id).await?;
        }
    } else {
        device_session_repo::end_all_for_user(&pool, &id).await?;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "SET_PASSWORD",
        "Staff",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// FA-PERS-07: Permission overrides for a team member (read — same policy as staff master data).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn list_staff_permission_overrides(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
) -> Result<Vec<PermissionOverride>, AppError> {
    rbac::require(&session_state, "staff.read")?;
    staff_permission_repo::list_for_staff(&pool, &staff_id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_staff_permission_override(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
    action: String,
    effect: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    if !rbac::is_known_action(action.trim()) {
        return Err(AppError::Validation(
            "Unknown permission action.".into(),
        ));
    }
    staff_permission_repo::upsert(&pool, &staff_id, &action, &effect).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_SET",
        "Staff",
        Some(&staff_id),
        Some(&format!("{}={}", action.trim(), effect.trim())),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_staff_permission_override(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
    action: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    staff_permission_repo::delete_override(&pool, &staff_id, &action).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_DELETE",
        "Staff",
        Some(&staff_id),
        Some(action.trim()),
    )
    .await
    .ok();
    Ok(())
}

/// Remove all permission overrides — role defaults apply again.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn reset_staff_permission_overrides(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    let n = staff_permission_repo::delete_all_for_staff(&pool, &staff_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_RESET",
        "Staff",
        Some(&staff_id),
        Some(&format!("deleted={n}")),
    )
    .await
    .ok();
    Ok(n)
}

/// FA-PERS-07 preset: full patient chart in read-only mode (ALLOW read_medical, DENY write_medical).
/// When `enabled` is false, removes only those two overrides so the role matrix applies again.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_staff_full_chart_readonly(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
    enabled: bool,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    staff_repo::find_by_id(&pool, &staff_id)
        .await?
        .ok_or(AppError::NotFound("error.entity.staff".into()))?;
    if enabled {
        staff_permission_repo::upsert(&pool, &staff_id, rbac::PATIENT_READ_MEDICAL, "ALLOW")
            .await?;
        staff_permission_repo::upsert(&pool, &staff_id, rbac::PATIENT_WRITE_MEDICAL, "DENY")
            .await?;
    } else {
        staff_permission_repo::delete_override(&pool, &staff_id, rbac::PATIENT_READ_MEDICAL)
            .await?;
        staff_permission_repo::delete_override(&pool, &staff_id, rbac::PATIENT_WRITE_MEDICAL)
            .await?;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        if enabled {
            "PERMISSION_FULL_CHART_READONLY_ON"
        } else {
            "PERMISSION_FULL_CHART_READONLY_OFF"
        },
        "Staff",
        Some(&staff_id),
        Some(if enabled { "enabled=1" } else { "enabled=0" }),
    )
    .await
    .ok();
    Ok(())
}

/// Set ALLOW for every action declared in `config/rbac.yaml` (full access via overrides).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn grant_staff_all_permissions(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    reject_staff_writes_on_replica(&pool).await?;
    staff_repo::find_by_id(&pool, &staff_id)
        .await?
        .ok_or(AppError::NotFound("error.entity.staff".into()))?;
    let mut n = 0u64;
    for action in rbac::all_rbac_actions() {
        staff_permission_repo::upsert(&pool, &staff_id, action, "ALLOW").await?;
        n += 1;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_GRANT_ALL",
        "Staff",
        Some(&staff_id),
        Some(&format!("actions={n}")),
    )
    .await
    .ok();
    Ok(n)
}

/// Live password-policy evaluation for UI hints (no persistence).
#[tauri::command]
pub fn evaluate_password_policy(password: String) -> crypto::PasswordPolicyStatus {
    crypto::evaluate_password_policy(&password)
}
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_staff_quota(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<StaffQuota, AppError> {
    rbac::require(&session_state, "staff.read")?;
    mvp_security::staff_quota(&pool).await
}

/*
// TODO(deferred-security): 2FA settings IPC — re-enable with TOTP_2FA_ENABLED.

#[derive(Debug, serde::Serialize)]
pub struct TotpStatusDto {
    pub required: bool,
    pub enrolled: bool,
    pub pending: bool,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_totp_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<TotpStatusDto, AppError> {
    ...
}

... start_totp_enrollment, confirm_totp_enrollment, deactivate_totp ...
*/

/// Clears brute-force lockouts for `target_email` (all peer IPs). Requires `staff.write`.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, brute_force), fields(target = %target_email))]
pub async fn admin_unlock_brute_force(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    brute_force: State<'_, BruteForceState>,
    target_email: String,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "staff.write")?;
    let hashed = brute_force::hash_subject(target_email.trim())?;
    let removed = brute_force.0.admin_clear_subject(&pool, &hashed).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "BRUTE_FORCE_ADMIN_UNLOCK",
        "Staff",
        None,
        Some("subject_hmac_cleared"),
    )
    .await
    .ok();
    Ok(removed)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_staff_commands {
    () => {
        $crate::commands::staff_commands::list_staff,
        $crate::commands::staff_commands::list_physicians,
        $crate::commands::staff_commands::list_task_team_directory,
        $crate::commands::staff_commands::get_staff,
        $crate::commands::staff_commands::get_own_profile,
        $crate::commands::staff_commands::update_own_profile,
        $crate::commands::staff_commands::create_staff,
        $crate::commands::staff_commands::update_staff,
        $crate::commands::staff_commands::delete_staff,
        $crate::commands::staff_commands::change_password,
        $crate::commands::staff_commands::set_staff_password_by_admin,
        $crate::commands::staff_commands::list_staff_permission_overrides,
        $crate::commands::staff_commands::set_staff_permission_override,
        $crate::commands::staff_commands::delete_staff_permission_override,
        $crate::commands::staff_commands::reset_staff_permission_overrides,
        $crate::commands::staff_commands::set_staff_full_chart_readonly,
        $crate::commands::staff_commands::grant_staff_all_permissions,
        $crate::commands::staff_commands::admin_unlock_brute_force,
        $crate::commands::staff_commands::evaluate_password_policy,
        $crate::commands::staff_commands::get_staff_quota,
        // TODO(deferred-security): 2FA IPC unwired
        // $crate::commands::staff_commands::get_totp_status,
        // $crate::commands::staff_commands::start_totp_enrollment,
        // $crate::commands::staff_commands::confirm_totp_enrollment,
        // $crate::commands::staff_commands::deactivate_totp,
    };
}
