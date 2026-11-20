use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::repos::admin::staff as staff_repo;
use crate::infrastructure::totp;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub totp_code: Option<String>,
}

// `PermissionOverride` is the domain shape for FA-PERS-07 RBAC overrides;
// canonical definition now lives in `medoc_core::domain::rbac`. Re-exported
// here so the ~30 `use crate::application::auth_service::PermissionOverride;`
// (and direct field access via `Session.permission_overrides`) sites keep
// compiling unchanged.
pub use crate::domain::rbac::PermissionOverride;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub user_id: String,
    pub name: String,
    pub email: String,
    pub role: String,
    #[serde(default)]
    pub permission_overrides: Vec<PermissionOverride>,
    #[serde(default)]
    pub device_session_id: Option<String>,
    #[serde(default)]
    pub token_version: i64,
}

pub async fn authenticate(pool: &SqlitePool, req: &LoginRequest) -> Result<Session, AppError> {
    let email = req.email.trim();
    let user = staff_repo::find_by_email(pool, email)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let valid = crypto::verify_password(&req.password, &user.password_hash)
        .map_err(|_| AppError::Internal("Hash error".into()))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }
    if !crate::domain::rbac::is_login_role_allowed(&user.role) {
        return Err(AppError::Forbidden);
    }
    if !user.available {
        return Err(AppError::Forbidden);
    }

    if crypto::needs_rehash(&user.password_hash) {
        let new_hash =
            crypto::hash_password(&req.password).map_err(|e| AppError::Internal(e.to_string()))?;
        staff_repo::update_password_hash(pool, &user.id, &new_hash).await?;
    }

    // Hand-set overrides plus the compiled access profile: every
    // `effective_allowed(…, &session.permission_overrides)` check enforces it.
    let permission_overrides =
        crate::application::access_control::session_overrides(pool, &user.id, &user.role).await?;
    // Stored secrets stay in the database. While the flag is off they are not checked,
    // so an account enrolled under the previous build can still sign in with a password.
    if crate::mvp_security::TOTP_2FA_ENABLED
        && (staff_repo::is_totp_enrolled(&user) || staff_repo::totp_required_for_role(&user.role))
    {
        if !staff_repo::is_totp_enrolled(&user) {
            return Err(AppError::TotpEnrollmentRequired);
        }
        let secret = user.totp_secret.as_deref().unwrap_or("");
        let code = req.totp_code.as_deref().map(str::trim).unwrap_or("");
        if code.is_empty() || !totp::verify_code(secret, code)? {
            return Err(AppError::TotpRequired);
        }
    }
    Ok(Session {
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permission_overrides,
        device_session_id: None,
        token_version: user.token_version,
    })
}

/// Password check without issuing a session (enrollment bootstrap).
pub async fn verify_credentials(
    pool: &SqlitePool,
    email: &str,
    password: &str,
) -> Result<(), AppError> {
    let user = staff_repo::find_by_email(pool, email.trim())
        .await?
        .ok_or(AppError::Unauthorized)?;
    let valid = crypto::verify_password(password, &user.password_hash)
        .map_err(|_| AppError::Internal("Hash error".into()))?;
    if valid {
        Ok(())
    } else {
        Err(AppError::Unauthorized)
    }
}
