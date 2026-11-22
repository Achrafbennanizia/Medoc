//! Roles and privileges (Settings → Team). Reading uses the synced local copy, so it also works
//! offline. Changing access is main-only: the main app does it here; elsewhere it is forwarded to
//! the main device for the signed-in person (systems::main_device).

use reqwest::Method;
use sqlx::SqlitePool;
use tauri::State;

use medoc_core::application::access_catalog::{self, AccessCatalogDto};
use medoc_core::application::access_control::{self, SetStaffAccess, StaffAccessDto};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::device::{MainOnly, Placement};

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::systems::main_device::{self, DeviceInfo};

/// Error key when this device can never run the operation (e.g. replica app, not forwardable).
const ERR_MAIN_ONLY: &str = "error.device.main_only";

#[tauri::command]
pub async fn device_info(pool: State<'_, SqlitePool>) -> Result<DeviceInfo, AppError> {
    Ok(main_device::device_info(&pool).await)
}

#[tauri::command]
pub async fn access_catalog(
    session_state: State<'_, SessionState>,
) -> Result<AccessCatalogDto, AppError> {
    rbac::require_authenticated(&session_state)?;
    Ok(access_catalog::catalog())
}

#[tauri::command]
pub async fn staff_access_get(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
) -> Result<StaffAccessDto, AppError> {
    let actor = rbac::require_authenticated(&session_state)?;
    access_control::get_staff_access(&pool, &actor, &staff_id).await
}

#[tauri::command]
pub async fn staff_access_set(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
    request: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let actor = rbac::require_authenticated(&session_state)?;
    let path = format!("/access/staff/{staff_id}");
    route(
        &pool,
        &actor,
        Method::PUT,
        &path,
        Some(request.clone()),
        |pool, actor| async move {
            let req: SetStaffAccess =
                serde_json::from_value(request).map_err(|e| AppError::Validation(e.to_string()))?;
            local::set(&pool, &actor, &staff_id, &req).await
        },
    )
    .await
}

#[tauri::command]
pub async fn staff_access_reset(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
) -> Result<serde_json::Value, AppError> {
    let actor = rbac::require_authenticated(&session_state)?;
    let path = format!("/access/staff/{staff_id}");
    route(
        &pool,
        &actor,
        Method::DELETE,
        &path,
        None,
        |pool, actor| async move { local::reset(&pool, &actor, &staff_id).await },
    )
    .await
}

/// `own_areas`: areas limited to the person's own records (today: `calendar`).
#[tauri::command]
pub async fn staff_access_set_scopes(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    staff_id: String,
    own_areas: Vec<String>,
) -> Result<serde_json::Value, AppError> {
    let actor = rbac::require_authenticated(&session_state)?;
    let path = format!("/access/staff/{staff_id}/scopes");
    let body = serde_json::json!({ "ownAreas": own_areas });
    route(
        &pool,
        &actor,
        Method::PUT,
        &path,
        Some(body),
        |pool, actor| async move { local::set_scopes(&pool, &actor, &staff_id, &own_areas).await },
    )
    .await
}

/// Runs a "manage access" operation where it belongs: here on the main device, otherwise on the
/// main device through the signed-in person's link.
async fn route<F, Fut>(
    pool: &SqlitePool,
    actor: &Session,
    method: Method,
    path: &str,
    body: Option<serde_json::Value>,
    local: F,
) -> Result<serde_json::Value, AppError>
where
    F: FnOnce(SqlitePool, Session) -> Fut,
    Fut: std::future::Future<Output = Result<StaffAccessDto, AppError>>,
{
    match main_device::placement_of(pool, MainOnly::ManageAccess).await {
        Placement::Local => to_json(local(pool.clone(), actor.clone()).await?),
        Placement::MainDevice => main_device::forward(&actor.user_id, method, path, body).await,
        Placement::Unavailable => Err(AppError::validation_code(ERR_MAIN_ONLY)),
    }
}

fn to_json(dto: StaffAccessDto) -> Result<serde_json::Value, AppError> {
    serde_json::to_value(dto).map_err(|e| AppError::Internal(e.to_string()))
}

/// The local implementation exists only in the main app. In the replica app `Placement::Local`
/// never happens (the flavor is replica), and these services are not compiled in.
#[cfg(not(feature = "replica"))]
mod local {
    use super::*;
    use medoc_core::application::access_scope;

    pub async fn set(
        pool: &SqlitePool,
        actor: &Session,
        id: &str,
        req: &SetStaffAccess,
    ) -> Result<StaffAccessDto, AppError> {
        access_control::set_staff_access(pool, actor, id, req).await
    }
    pub async fn reset(
        pool: &SqlitePool,
        actor: &Session,
        id: &str,
    ) -> Result<StaffAccessDto, AppError> {
        access_control::reset_staff_access(pool, actor, id).await
    }
    pub async fn set_scopes(
        pool: &SqlitePool,
        actor: &Session,
        id: &str,
        own: &[String],
    ) -> Result<StaffAccessDto, AppError> {
        access_scope::set_staff_scopes(pool, actor, id, &access_scope::parse_scopes(own)?).await
    }
}

#[cfg(feature = "replica")]
mod local {
    use super::*;

    fn absent() -> AppError {
        AppError::validation_code(ERR_MAIN_ONLY)
    }
    pub async fn set(
        _: &SqlitePool,
        _: &Session,
        _: &str,
        _: &SetStaffAccess,
    ) -> Result<StaffAccessDto, AppError> {
        Err(absent())
    }
    pub async fn reset(_: &SqlitePool, _: &Session, _: &str) -> Result<StaffAccessDto, AppError> {
        Err(absent())
    }
    pub async fn set_scopes(
        _: &SqlitePool,
        _: &Session,
        _: &str,
        _: &[String],
    ) -> Result<StaffAccessDto, AppError> {
        Err(absent())
    }
}
