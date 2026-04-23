use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::personal::{CreatePersonal, UpdatePersonal};
use crate::domain::entities::{AerztSummary, Personal};
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::{audit_repo, personal_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_personal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Personal>, AppError> {
    rbac::require(&session_state, "personal.read")?;
    personal_repo::find_all(&pool).await
}

/// Doctors only — for Termin «Behandler» (FA-TERM-14); allowed for Arzt + Rezeption.
#[tauri::command]
pub async fn list_aerzte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<AerztSummary>, AppError> {
    rbac::require(&session_state, "termin.list_aerzte")?;
    personal_repo::find_arzt_summaries(&pool).await
}

#[tauri::command]
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

#[tauri::command]
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
