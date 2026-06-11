use crate::application::auth_service::PermissionOverride;
use crate::application::own_profile::{self, OwnProfileDto};
use crate::application::rbac;
use crate::commands::auth_commands::{BruteForceState, SessionState};
use crate::domain::entities::personal::{CreatePersonal, UpdateOwnProfile, UpdatePersonal};
use crate::domain::entities::{AerztSummary, AufgabeTeamMember, Personal};
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::{audit_repo, personal_permission_repo, personal_repo};
use crate::infrastructure::logging::brute_force;
use crate::infrastructure::totp::{self, TotpEnrollmentDto};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_personal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Personal>, AppError> {
    rbac::require(&session_state, "personal.read")?;
    personal_repo::find_all(&pool).await
}

/// Doctors only — for Termin «Behandler» (FA-TERM-14); allowed for Arzt + Rezeption.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_aerzte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<AerztSummary>, AppError> {
    rbac::require(&session_state, "termin.list_aerzte")?;
    personal_repo::find_arzt_summaries(&pool).await
}

/// Arzt/Rezeption directory for Praxis-Aufgaben labels — `aufgabe.status.fulfill` (no HR read).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_aufgabe_team_directory(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<AufgabeTeamMember>, AppError> {
    rbac::require(&session_state, "aufgabe.status.fulfill")?;
    personal_repo::find_aufgabe_team_summaries(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state, id))]
pub async fn get_personal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Personal, AppError> {
    rbac::require(&session_state, "personal.read")?;
    personal_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_personal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePersonal,
) -> Result<Personal, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    if personal_repo::find_by_email(&pool, &data.email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict("E-Mail bereits vergeben".into()));
    }
    crypto::validate_password_policy(&data.passwort)?;
    let hash =
        crypto::hash_password(&data.passwort).map_err(|e| AppError::Internal(e.to_string()))?;
    let p = personal_repo::create(&pool, &data, &hash).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Personal",
        Some(&p.id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

/// Eigenes Profil lesen (ohne `personal.read` — jede Sitzung).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_own_profile(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<OwnProfileDto, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    own_profile::get_own_profile(&pool, &session.user_id).await
}

/// Eigenes Profil aktualisieren (Name, E-Mail, Kontakt — keine Rollenänderung).
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
        "Personal",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();
    Ok(OwnProfileDto::from(&updated))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_personal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdatePersonal,
) -> Result<Personal, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let p = personal_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Personal",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_personal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    personal_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Personal",
        Some(&id),
        None,
    )
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
    crypto::validate_password_policy(&new_password)?;
    let me = personal_repo::find_by_id(&pool, &session.user_id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;
    let ok = crypto::verify_password(&old_password, &me.passwort_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !ok {
        return Err(AppError::Unauthorized);
    }
    let hash =
        crypto::hash_password(&new_password).map_err(|e| AppError::Internal(e.to_string()))?;
    personal_repo::update_password_hash(&pool, &session.user_id, &hash).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CHANGE_PASSWORD",
        "Personal",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// Setzt das Passwort für ein beliebiges Team-Mitglied (ohne altes Passwort) — z. B. Personalverwaltung.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, new_password))]
pub async fn set_personal_password_by_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    new_password: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    crypto::validate_password_policy(&new_password)?;
    if personal_repo::find_by_id(&pool, &id).await?.is_none() {
        return Err(AppError::NotFound("Personal".into()));
    }
    let hash =
        crypto::hash_password(&new_password).map_err(|e| AppError::Internal(e.to_string()))?;
    personal_repo::update_password_hash(&pool, &id, &hash).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "SET_PASSWORD",
        "Personal",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// FA-PERS-07: Overrides für ein Team-Mitglied (Lesen — gleiche Policy wie Personal-Stamm).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn list_personal_permission_overrides(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    personal_id: String,
) -> Result<Vec<PermissionOverride>, AppError> {
    rbac::require(&session_state, "personal.read")?;
    personal_permission_repo::list_for_personal(&pool, &personal_id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_personal_permission_override(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    personal_id: String,
    action: String,
    effect: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    personal_permission_repo::upsert(&pool, &personal_id, &action, &effect).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_SET",
        "Personal",
        Some(&personal_id),
        Some(&format!("{}={}", action.trim(), effect.trim())),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_personal_permission_override(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    personal_id: String,
    action: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    personal_permission_repo::delete_override(&pool, &personal_id, &action).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_DELETE",
        "Personal",
        Some(&personal_id),
        Some(action.trim()),
    )
    .await
    .ok();
    Ok(())
}

/// Entfernt alle Berechtigungs-Overrides — Rolle gilt wieder unverändert.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn reset_personal_permission_overrides(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    personal_id: String,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let n = personal_permission_repo::delete_all_for_personal(&pool, &personal_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_RESET",
        "Personal",
        Some(&personal_id),
        Some(&format!("deleted={n}")),
    )
    .await
    .ok();
    Ok(n)
}

/// Setzt ALLOW für jede in `config/rbac.yaml` deklarierte Aktion (Vollzugriff über Overrides).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn grant_personal_all_permissions(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    personal_id: String,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    personal_repo::find_by_id(&pool, &personal_id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;
    let mut n = 0u64;
    for action in rbac::all_rbac_actions() {
        personal_permission_repo::upsert(&pool, &personal_id, action, "ALLOW").await?;
        n += 1;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "PERMISSION_OVERRIDE_GRANT_ALL",
        "Personal",
        Some(&personal_id),
        Some(&format!("actions={n}")),
    )
    .await
    .ok();
    Ok(n)
}

/// Live password-policy evaluation for UI hints (no persistence).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(password))]
pub fn evaluate_password_policy(password: String) -> crypto::PasswordPolicyStatus {
    crypto::evaluate_password_policy(&password)
}

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
    let session = rbac::require_authenticated(&session_state)?;
    let user = personal_repo::find_by_id(&pool, &session.user_id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;
    let enrolled = personal_repo::is_totp_enrolled(&user);
    let pending = user.totp_secret.is_some() && !enrolled;
    Ok(TotpStatusDto {
        required: personal_repo::totp_required_for_role(&user.rolle),
        enrolled,
        pending,
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn start_totp_enrollment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<TotpEnrollmentDto, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let user = personal_repo::find_by_id(&pool, &session.user_id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;
    if personal_repo::is_totp_enrolled(&user) {
        return Err(AppError::Conflict("Zwei-Faktor ist bereits aktiv".into()));
    }
    let (secret, dto) = totp::generate_enrollment(&user.email)?;
    personal_repo::set_totp_pending_secret(&pool, &user.id, &secret).await?;
    Ok(dto)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn confirm_totp_enrollment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    code: String,
) -> Result<(), AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let user = personal_repo::find_by_id(&pool, &session.user_id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;
    let secret = user
        .totp_secret
        .as_deref()
        .ok_or_else(|| AppError::Validation("Bitte zuerst die Einrichtung starten".into()))?;
    if !totp::verify_code(secret, &code)? {
        return Err(AppError::Validation(
            "Ungültiger Code — bitte erneut versuchen".into(),
        ));
    }
    personal_repo::confirm_totp_enrollment(&pool, &user.id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "TOTP_ENROLL",
        "Personal",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// Disables enrolled 2FA (requires TOTP code) or cancels a pending enrollment.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn deactivate_totp(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    code: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let outcome =
        crate::application::totp_service::deactivate_totp(&pool, &session.user_id, code.as_deref())
            .await?;
    let event = match outcome {
        crate::application::totp_service::TotpDeactivateResult::Deactivated => "TOTP_DEACTIVATE",
        crate::application::totp_service::TotpDeactivateResult::CancelledPending => {
            "TOTP_ENROLL_CANCEL"
        }
    };
    audit_repo::create(
        &pool,
        &session.user_id,
        event,
        "Personal",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// Clears brute-force lockouts for `target_email` (all peer IPs). Requires `personal.write`.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, brute_force), fields(target = %target_email))]
pub async fn admin_unlock_brute_force(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    brute_force: State<'_, BruteForceState>,
    target_email: String,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let hashed = brute_force::hash_subject(target_email.trim())?;
    let removed = brute_force.0.admin_clear_subject(&pool, &hashed).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "BRUTE_FORCE_ADMIN_UNLOCK",
        "Personal",
        None,
        Some("subject_hmac_cleared"),
    )
    .await
    .ok();
    Ok(removed)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_personal_commands {
    () => {
        $crate::commands::personal_commands::list_personal,
        $crate::commands::personal_commands::list_aerzte,
        $crate::commands::personal_commands::list_aufgabe_team_directory,
        $crate::commands::personal_commands::get_personal,
        $crate::commands::personal_commands::get_own_profile,
        $crate::commands::personal_commands::update_own_profile,
        $crate::commands::personal_commands::create_personal,
        $crate::commands::personal_commands::update_personal,
        $crate::commands::personal_commands::delete_personal,
        $crate::commands::personal_commands::change_password,
        $crate::commands::personal_commands::set_personal_password_by_admin,
        $crate::commands::personal_commands::list_personal_permission_overrides,
        $crate::commands::personal_commands::set_personal_permission_override,
        $crate::commands::personal_commands::delete_personal_permission_override,
        $crate::commands::personal_commands::reset_personal_permission_overrides,
        $crate::commands::personal_commands::grant_personal_all_permissions,
        $crate::commands::personal_commands::admin_unlock_brute_force,
        $crate::commands::personal_commands::evaluate_password_policy,
        $crate::commands::personal_commands::get_totp_status,
        $crate::commands::personal_commands::start_totp_enrollment,
        $crate::commands::personal_commands::confirm_totp_enrollment,
        $crate::commands::personal_commands::deactivate_totp,
    };
}
