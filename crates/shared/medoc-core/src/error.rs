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

impl AppError {
    /// Stable wire token sent to every client (Tauri IPC and LAN HTTP alike):
    /// `error.<domain>.<name>[|param=value…]`. The UI maps it to a support code (`MD-…`) and a localised
    /// message via `packages/shared/src/lib/errors/error-catalog.ts`.
    ///
    /// Database and internal errors never leak driver text to the UI: the detail is logged with a short
    /// correlation `ref` and only `error.app.database|ref=…` / `error.app.internal|ref=…` is returned.
    pub fn wire_code(&self) -> String {
        match self {
            AppError::ValidationCode(code) => code.clone(),
            AppError::Validation(detail) => {
                format!("error.app.validation|detail={}", sanitize_param(detail))
            }
            AppError::Unauthorized => "error.app.unauthorized".into(),
            AppError::RateLimited(secs) => format!("error.app.rate_limited|seconds={secs}"),
            AppError::Forbidden => "error.app.forbidden".into(),
            AppError::NotFound(resource) => {
                format!("error.app.not_found|resource={}", sanitize_param(resource))
            }
            AppError::Conflict(detail) => {
                format!("error.app.conflict|detail={}", sanitize_param(detail))
            }
            AppError::TotpRequired => "error.app.totp_required".into(),
            AppError::TotpEnrollmentRequired => "error.app.totp_enrollment_required".into(),
            AppError::Database(e) => {
                let r = correlation_ref();
                crate::log_system!(error, event = "DB_ERROR", error_ref = %r, detail = %e);
                format!("error.app.database|ref={r}")
            }
            AppError::Internal(detail) => {
                let r = correlation_ref();
                crate::log_system!(error, event = "INTERNAL_ERROR", error_ref = %r, detail = %detail);
                format!("error.app.internal|ref={r}")
            }
        }
    }

    /// HTTP status for REST surfaces (LAN / company servers). One mapping for every router.
    pub fn http_status(&self) -> u16 {
        match self {
            AppError::Unauthorized | AppError::TotpRequired | AppError::TotpEnrollmentRequired => 401,
            AppError::Forbidden => 403,
            AppError::NotFound(_) => 404,
            AppError::Conflict(_) => 409,
            AppError::RateLimited(_) => 429,
            AppError::Validation(_) | AppError::ValidationCode(_) => 400,
            AppError::Database(_) | AppError::Internal(_) => 500,
        }
    }
}

/// `|` and `=` delimit params on the wire; keep free text from breaking the token.
fn sanitize_param(raw: &str) -> String {
    raw.replace('|', "/").replace('=', ":").replace(['\n', '\r'], " ")
}

fn correlation_ref() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..8].to_uppercase()
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.wire_code())
    }
}

#[cfg(test)]
mod wire_tests {
    use super::AppError;

    #[test]
    fn database_errors_do_not_leak_driver_text() {
        let e = AppError::Database(sqlx::Error::RowNotFound);
        let wire = e.wire_code();
        assert!(wire.starts_with("error.app.database|ref="), "{wire}");
        assert!(!wire.to_lowercase().contains("row"), "{wire}");
    }

    #[test]
    fn free_text_params_cannot_inject_delimiters() {
        let wire = AppError::Validation("a|b=c".into()).wire_code();
        assert_eq!(wire, "error.app.validation|detail=a/b:c");
    }

    #[test]
    fn coded_errors_pass_through() {
        let wire = AppError::validation_code_params("error.payment.overpayment_treatment", &[("max", 5)]).wire_code();
        assert_eq!(wire, "error.payment.overpayment_treatment|max=5");
        assert_eq!(AppError::Forbidden.http_status(), 403);
    }
}
