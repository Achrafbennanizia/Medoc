use crate::application::own_profile::{self, OwnProfileDto};
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::personal::{CreatePersonal, UpdateOwnProfile, UpdatePersonal};
use crate::application::auth_service::PermissionOverride;
use crate::domain::entities::{AerztSummary, Personal};
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::{audit_repo, personal_permission_repo, personal_repo};
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
    if new_password.chars().count() < 8 {
        return Err(AppError::Validation(
            "Passwort muss mindestens 8 Zeichen lang sein".into(),
        ));
    }
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
    if new_password.chars().count() < 8 {
        return Err(AppError::Validation(
            "Passwort muss mindestens 8 Zeichen lang sein".into(),
        ));
    }
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
