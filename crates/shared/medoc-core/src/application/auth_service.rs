use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::personal_repo;
use crate::infrastructure::totp;
use crate::mvp_security;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub passwort: String,
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
    pub rolle: String,
    #[serde(default)]
    pub permission_overrides: Vec<PermissionOverride>,
    #[serde(default)]
    pub device_session_id: Option<String>,
}

pub async fn authenticate(pool: &SqlitePool, req: &LoginRequest) -> Result<Session, AppError> {
    let user = personal_repo::find_by_email(pool, &req.email)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let valid = crypto::verify_password(&req.passwort, &user.passwort_hash)
        .map_err(|_| AppError::Internal("Hash-Fehler".into()))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    if crypto::needs_rehash(&user.passwort_hash) {
        let new_hash =
            crypto::hash_password(&req.passwort).map_err(|e| AppError::Internal(e.to_string()))?;
        personal_repo::update_password_hash(pool, &user.id, &new_hash).await?;
    }

    // TODO(deferred-security): re-enable TOTP when `mvp_security::TOTP_2FA_ENABLED` is true.
    if !mvp_security::TOTP_2FA_ENABLED {
        return Ok(Session {
            user_id: user.id,
            name: user.name,
            email: user.email,
            rolle: user.rolle,
            permission_overrides: Vec::new(),
            device_session_id: None,
        });
    }

    let enrolled = personal_repo::is_totp_enrolled(&user);
    let mandatory = personal_repo::totp_required_for_role(&user.rolle);

    if mandatory && !enrolled {
        return Err(AppError::TotpEnrollmentRequired);
    }

    if enrolled {
        let secret = user
            .totp_secret
            .as_deref()
            .ok_or(AppError::Internal("TOTP secret missing".into()))?;
        let code = req
            .totp_code
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        match code {
            None => return Err(AppError::TotpRequired),
            Some(c) => {
                if !totp::verify_code(secret, c)? {
                    return Err(AppError::Unauthorized);
                }
            }
        }
    }

    Ok(Session {
        user_id: user.id,
        name: user.name,
        email: user.email,
        rolle: user.rolle,
        permission_overrides: Vec::new(),
        device_session_id: None,
    })
}

/// Password check without issuing a session (enrollment bootstrap).
pub async fn verify_credentials(
    pool: &SqlitePool,
    email: &str,
    passwort: &str,
) -> Result<(), AppError> {
    let user = personal_repo::find_by_email(pool, email)
        .await?
        .ok_or(AppError::Unauthorized)?;
    let valid = crypto::verify_password(passwort, &user.passwort_hash)
        .map_err(|_| AppError::Internal("Hash-Fehler".into()))?;
    if valid {
        Ok(())
    } else {
        Err(AppError::Unauthorized)
    }
}
