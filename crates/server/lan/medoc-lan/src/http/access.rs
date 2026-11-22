//! Roles and privileges over HTTPS, so a replica app can manage access for the signed-in person
//! (docs/architecture/device-flavors-and-access.md). The main device decides: every change runs
//! through `access_control` with the caller's own session, so a replica gains no rights of its own.

use axum::extract::{Extension, Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use serde::Deserialize;
use sqlx::SqlitePool;

use medoc_core::application::access_catalog::{self, AccessCatalogDto};
use medoc_core::application::access_control::{self, SetStaffAccess, StaffAccessDto};
use medoc_core::application::access_scope;
use medoc_core::application::auth_service::Session;
use medoc_core::application::authorize;
use medoc_core::error::AppError;

use super::{ApiError, LanHttpState};
use crate::jwt;

/// Routes under the authenticated `/api/v1` router.
pub fn router() -> Router<LanHttpState> {
    Router::new()
        .route("/access/catalog", get(catalog))
        .route(
            "/access/staff/{id}",
            get(staff_get).put(staff_set).delete(staff_reset),
        )
        .route("/access/staff/{id}/scopes", put(staff_scopes))
}

/// Signed-in person as a session (live account check, current overrides).
async fn session(pool: &SqlitePool, claims: &jwt::LanClaims) -> Result<Session, AppError> {
    let caller = authorize::Caller {
        user_id: claims.sub.clone(),
        idle_for: None,
        device_session_id: None,
    };
    authorize::authorize(pool, &caller, "dashboard.read", None).await
}

async fn catalog(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<AccessCatalogDto>, ApiError> {
    session(&state.pool, &claims).await?;
    Ok(Json(access_catalog::catalog()))
}

async fn staff_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
) -> Result<Json<StaffAccessDto>, ApiError> {
    let actor = session(&state.pool, &claims).await?;
    Ok(Json(
        access_control::get_staff_access(&state.pool, &actor, &id).await?,
    ))
}

async fn staff_set(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
    Json(body): Json<SetStaffAccess>,
) -> Result<Json<StaffAccessDto>, ApiError> {
    let actor = session(&state.pool, &claims).await?;
    Ok(Json(
        access_control::set_staff_access(&state.pool, &actor, &id, &body).await?,
    ))
}

async fn staff_reset(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
) -> Result<Json<StaffAccessDto>, ApiError> {
    let actor = session(&state.pool, &claims).await?;
    Ok(Json(
        access_control::reset_staff_access(&state.pool, &actor, &id).await?,
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScopesBody {
    own_areas: Vec<String>,
}

async fn staff_scopes(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
    Json(body): Json<ScopesBody>,
) -> Result<Json<StaffAccessDto>, ApiError> {
    let actor = session(&state.pool, &claims).await?;
    let own = access_scope::parse_scopes(&body.own_areas)?;
    Ok(Json(
        access_scope::set_staff_scopes(&state.pool, &actor, &id, &own).await?,
    ))
}
