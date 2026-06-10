//! TOTP lifecycle (enrollment teardown) — shared by desktop IPC and future HTTP surfaces.

use crate::error::AppError;
use crate::infrastructure::database::personal_repo;
use crate::infrastructure::totp;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TotpDeactivateResult {
    /// Cleared enrolled 2FA after successful code verification.
    Deactivated,
    /// Cleared in-progress enrollment (session-authenticated; no code yet).
    CancelledPending,
}

/// Disables 2FA for the signed-in user.
///
/// - **Enrolled:** `code` must be a valid current TOTP (6 digits).
/// - **Pending enrollment:** `code` is ignored; clears the pending secret.
pub async fn deactivate_totp(
    pool: &SqlitePool,
    user_id: &str,
    code: Option<&str>,
) -> Result<TotpDeactivateResult, AppError> {
    let user = personal_repo::find_by_id(pool, user_id)
        .await?
        .ok_or(AppError::NotFound("Personal".into()))?;

    let enrolled = personal_repo::is_totp_enrolled(&user);
    let pending = user.totp_secret.as_ref().is_some_and(|s| !s.is_empty()) && !enrolled;

    if enrolled {
        let c = code
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::Validation("Authenticator-Code erforderlich".into()))?;
        let secret = user
            .totp_secret
            .as_deref()
            .ok_or_else(|| AppError::Internal("TOTP secret missing".into()))?;
        if !totp::verify_code(secret, c)? {
            return Err(AppError::Validation(
                "Ungültiger Code — bitte erneut versuchen".into(),
            ));
        }
        personal_repo::clear_totp(pool, user_id).await?;
        return Ok(TotpDeactivateResult::Deactivated);
    }

    if pending {
        personal_repo::clear_totp(pool, user_id).await?;
        return Ok(TotpDeactivateResult::CancelledPending);
    }

    Err(AppError::Conflict("Zwei-Faktor ist nicht aktiv".into()))
}
