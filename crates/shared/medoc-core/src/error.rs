//! Shared application error type used across MeDoc crates.
//!
//! The practice-host (`medoc`) crate re-exports this as `crate::error::AppError`
//! for source compatibility with ~200+ call sites; LAN + Company server crates
//! will eventually use the same type directly from `medoc_core::error`.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Unauthorized")]
    Unauthorized,

    #[error("Too many failed attempts — wait {0} seconds")]
    RateLimited(u64),

    #[error("Access denied")]
    Forbidden,

    #[error("{0} not found")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation error: {0}")]
    Validation(String),

    /// Stable i18n key returned to the UI (e.g. `error.work_time.no_open_session`).
    #[error("{0}")]
    ValidationCode(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),

    /// Password OK; enrolled user must supply a 6-digit TOTP code on the next login step.
    #[error("Two-factor code required")]
    TotpRequired,

    /// Password OK; PHYSICIAN must complete TOTP enrollment before a session is issued.
    #[error("Two-factor enrollment required")]
    TotpEnrollmentRequired,
}

impl AppError {
    /// Return a validation error identified by a stable `error.*` i18n key for the UI.
    pub fn validation_code(code: impl Into<String>) -> Self {
        AppError::ValidationCode(code.into())
    }

    /// Stable i18n key with `|key=value` params (parsed by the UI `formatIpcError`).
    pub fn validation_code_params(
        code: impl Into<String>,
        params: &[(&str, impl std::fmt::Display)],
    ) -> Self {
        let mut out = code.into();
        for (k, version) in params {
            out.push('|');
            out.push_str(k);
            out.push('=');
            out.push_str(&version.to_string());
        }
        AppError::ValidationCode(out)
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let coded = match self {
            AppError::ValidationCode(code) => code.clone(),
            AppError::Unauthorized => "error.app.unauthorized".into(),
            AppError::RateLimited(secs) => format!("error.app.rate_limited|seconds={secs}"),
            AppError::Forbidden => "error.app.forbidden".into(),
            AppError::NotFound(resource) => {
                format!("error.app.not_found|resource={resource}")
            }
            AppError::Conflict(detail) => format!("error.app.conflict|detail={detail}"),
            AppError::TotpRequired => "error.app.totp_required".into(),
            AppError::TotpEnrollmentRequired => "error.app.totp_enrollment_required".into(),
            _ => return serializer.serialize_str(&self.to_string()),
        };
        serializer.serialize_str(&coded)
    }
}
