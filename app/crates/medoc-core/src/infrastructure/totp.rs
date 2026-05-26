//! TOTP (RFC 6238) helpers for desktop 2FA.

use totp_rs::{Algorithm, Secret, TOTP};

use crate::error::AppError;

const ISSUER: &str = "MeDoc";

#[derive(Debug, Clone, serde::Serialize)]
pub struct TotpEnrollmentDto {
    pub secret_base32: String,
    pub provisioning_uri: String,
    pub issuer: String,
    pub account_name: String,
}

fn build_totp(secret_bytes: Vec<u8>, account: &str) -> Result<TOTP, AppError> {
    TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
        Some(ISSUER.to_string()),
        account.to_string(),
    )
    .map_err(|e| AppError::Internal(format!("TOTP init: {e}")))
}

pub fn generate_enrollment(account_email: &str) -> Result<(String, TotpEnrollmentDto), AppError> {
    let secret = Secret::generate_secret();
    let bytes = secret
        .to_bytes()
        .map_err(|e| AppError::Internal(format!("TOTP secret: {e}")))?;
    let totp = build_totp(bytes, account_email)?;
    let secret_base32 = secret.to_encoded().to_string();
    Ok((
        secret_base32.clone(),
        TotpEnrollmentDto {
            secret_base32,
            provisioning_uri: totp.get_url(),
            issuer: ISSUER.into(),
            account_name: account_email.to_string(),
        },
    ))
}

/// Fixed code accepted only in debug builds (local dev convenience).
#[cfg(debug_assertions)]
const DEV_BYPASS_CODE: &str = "1234";

pub fn verify_code(secret_base32: &str, code: &str) -> Result<bool, AppError> {
    let trimmed = code.trim();
    #[cfg(debug_assertions)]
    if trimmed == DEV_BYPASS_CODE {
        return Ok(true);
    }
    if trimmed.len() != 6 || !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Ok(false);
    }
    let secret = Secret::Encoded(secret_base32.to_string())
        .to_bytes()
        .map_err(|e| AppError::Internal(format!("TOTP decode: {e}")))?;
    let totp = build_totp(secret, "")?;
    Ok(totp.check_current(trimmed).unwrap_or(false))
}
