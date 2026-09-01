//! LAN HTTP endpoints for practice license status / activate / clear
//! (mirrors Tauri `current_license_status`, `activate_license`, `clear_license`).
//!
//! - `GET    /api/v1/license` — JWT — current status
//! - `POST   /api/v1/license/activate` — JWT — verify + persist v1/v2 token
//! - `DELETE /api/v1/license` — JWT — clear installed license

use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::Json;
use medoc_core::application::rbac::Role;
use medoc_core::error::AppError;
use medoc_core::infrastructure::license::{self, LicenseStatus};
use medoc_core::infrastructure::license_repo;
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::info;

use super::{ApiError, LanHttpState};
use crate::jwt;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateBody {
    /// Vendor license token (v1 `<json>.<sig>` or v2 envelope).
    #[serde(alias = "licenseKey", alias = "license_key")]
    pub token: String,
}

fn require_authenticated(claims: &jwt::LanClaims) -> Result<(), AppError> {
    Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    Ok(())
}

/// Map core `LicenseStatus` into the Swing / LAN client envelope used by Settings.
fn to_client_status(status: &LicenseStatus) -> Value {
    let active = status.valid;
    let hint = status
        .license_v2
        .as_ref()
        .map(|l| format!("{}…", &l.customer_id.chars().take(4).collect::<String>()))
        .or_else(|| {
            status
                .license
                .as_ref()
                .map(|l| format!("{}…", &l.customer_id.chars().take(4).collect::<String>()))
        })
        .unwrap_or_default();
    let activated = status
        .license_v2
        .as_ref()
        .map(|l| l.activated_at.to_rfc3339())
        .or_else(|| {
            status
                .license
                .as_ref()
                .map(|l| l.issued_at.to_rfc3339())
        })
        .unwrap_or_default();
    json!({
        "status": if active { "ACTIVE" } else { "INACTIVE" },
        "tokenHint": hint,
        "activatedAt": activated,
        "message": status.reason.clone().unwrap_or_else(|| {
            if active {
                "License active".into()
            } else {
                "No license activated".into()
            }
        }),
        "valid": status.valid,
        "format": status.format,
        "daysUntilExpiry": status.days_until_expiry,
    })
}

pub async fn status(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_authenticated(&claims)?;
    let status = license_repo::current_status(&state.pool).await?;
    Ok(Json(to_client_status(&status)))
}

pub async fn activate(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<ActivateBody>,
) -> Result<Json<Value>, ApiError> {
    require_authenticated(&claims)?;
    let device_id = license_repo::ensure_device_id(&state.pool).await?;
    let status = license::verify(body.token.trim(), &device_id);
    if !status.valid {
        info!(
            event = "LICENSE_ACTIVATE_REJECTED",
            reason = status.reason.as_deref().unwrap_or(""),
        );
        return Ok(Json(to_client_status(&status)));
    }
    match status.format.as_deref() {
        Some("v2") => license_repo::store_v2(&state.pool, body.token.trim()).await?,
        Some("v1") => license_repo::store_v1(&state.pool, body.token.trim()).await?,
        _ => {}
    }
    info!(
        event = "LICENSE_ACTIVATED",
        format = status.format.as_deref().unwrap_or(""),
    );
    let stored = license_repo::current_status(&state.pool).await?;
    Ok(Json(to_client_status(&stored)))
}

pub async fn clear(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<StatusCode, ApiError> {
    require_authenticated(&claims)?;
    license_repo::clear(&state.pool).await?;
    Ok(StatusCode::NO_CONTENT)
}
