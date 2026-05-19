use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::personal_repo;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub passwort: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionOverride {
    pub action: String,
    pub effect: String,
}

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

    Ok(Session {
        user_id: user.id,
        name: user.name,
        email: user.email,
        rolle: user.rolle,
        permission_overrides: Vec::new(),
        device_session_id: None,
    })
}
