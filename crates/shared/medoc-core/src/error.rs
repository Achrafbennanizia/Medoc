//! Shared application error type used across MeDoc crates.
//!
//! The practice-host (`medoc`) crate re-exports this as `crate::error::AppError`
//! for source compatibility with ~200+ call sites; LAN + Company server crates
//! will eventually use the same type directly from `medoc_core::error`.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Nicht autorisiert")]
    Unauthorized,

    #[error("Zu viele Fehlversuche — bitte {0} Sekunden warten")]
    RateLimited(u64),

    #[error("Zugriff verweigert")]
    Forbidden,

    #[error("{0} nicht gefunden")]
    NotFound(String),

    #[error("Konflikt: {0}")]
    Conflict(String),

    #[error("Validierungsfehler: {0}")]
    Validation(String),

    /// Stable i18n key returned to the UI (e.g. `error.work_time.no_open_session`).
    #[error("{0}")]
    ValidationCode(String),

    #[error("Datenbankfehler: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Interner Fehler: {0}")]
    Internal(String),

    /// Password OK; enrolled user must supply a 6-digit TOTP code on the next login step.
    #[error("Zwei-Faktor-Code erforderlich")]
    TotpRequired,

    /// Password OK; ARZT must complete TOTP enrollment before a session is issued.
    #[error("Zwei-Faktor-Einrichtung erforderlich")]
    TotpEnrollmentRequired,
}

impl AppError {
    /// Return a validation error identified by a stable `error.*` i18n key for the UI.
    pub fn validation_code(code: impl Into<String>) -> Self {
        AppError::ValidationCode(code.into())
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            AppError::ValidationCode(code) => serializer.serialize_str(code),
            _ => serializer.serialize_str(&self.to_string()),
        }
    }
}
