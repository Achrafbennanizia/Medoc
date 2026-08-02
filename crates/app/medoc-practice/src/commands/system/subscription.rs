// Subscription / billing — primarily **MeDoc vendor portal** (`company_portal` HTTP),
// Fallback: local stub URL / audit only when no portal configuration is available.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::company_portal::config::load_company_portal_config;
use crate::infrastructure::company_portal::{
    attach_payment_method_remote, post_billing_portal_url,
};
use crate::infrastructure::database::audit_repo;
use crate::log_system;

#[derive(Debug, Serialize)]
pub struct SubscriptionPortal {
    pub url: String,
    pub provider: String,
    pub note: String,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionStatus {
    pub edition: String,
    pub max_users: u32,
    pub renewal_url: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn open_subscription_portal(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<SubscriptionPortal, AppError> {
    let session = rbac::require(&session_state, "ops.system")?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "OPEN",
        "SubscriptionPortal",
        None,
        None,
    )
    .await
    .ok();
    log_system!(info, event = "SUBSCRIPTION_PORTAL_OPEN", user = %session.user_id);
    let cfg = load_company_portal_config(&pool).await;
    if crate::infrastructure::company_portal::config::effective_base_url(&cfg).is_some()
        && !crate::infrastructure::company_portal::config::effective_api_key(&cfg).is_empty()
        && !cfg.practice_slug.trim().is_empty()
    {
        let url = post_billing_portal_url(&cfg).await?;
        return Ok(SubscriptionPortal {
            url,
            provider: "Vendor portal".to_string(),
            note: "Billing via the MeDoc vendor backend.".to_string(),
        });
    }
    Ok(SubscriptionPortal {
        url: "https://portal.medoc.local/billing".to_string(),
        provider: "Stub".to_string(),
        note: "Vendor portal not configured — set it under Settings › System › Vendor connection."
            .to_string(),
    })
}

#[derive(Debug, Deserialize)]
pub struct PaymentMethodRequest {
    pub provider_token: String,
}

/// Pure validator for provider tokens — extracted so it can be unit-tested
/// without needing a full Tauri State / SQLite pool.
pub fn is_valid_provider_token(token: &str) -> bool {
    (token.starts_with("pm_") || token.starts_with("tok_")) && token.len() >= 8
}

/// Accepts a provider-issued opaque token (e.g. Stripe payment method id).
/// We never see the underlying card number.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, request))]
pub async fn attach_payment_method(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    request: PaymentMethodRequest,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "ops.system")?;
    if !is_valid_provider_token(&request.provider_token) {
        return Err(AppError::Validation(
            "Invalid provider token (expected pm_ or tok_ prefix)".into(),
        ));
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "ATTACH",
        "PaymentMethod",
        None,
        None,
    )
    .await
    .ok();
    log_system!(info, event = "PAYMENT_METHOD_ATTACHED", user = %session.user_id);
    let cfg = load_company_portal_config(&pool).await;
    if crate::infrastructure::company_portal::config::effective_base_url(&cfg).is_some()
        && !crate::infrastructure::company_portal::config::effective_api_key(&cfg).is_empty()
        && !cfg.practice_slug.trim().is_empty()
    {
        attach_payment_method_remote(&cfg, &request.provider_token).await?;
    }
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_subscription_commands {
    () => {
        $crate::commands::subscription_commands::open_subscription_portal,
        $crate::commands::subscription_commands::attach_payment_method,
    };
}

#[cfg(test)]
mod tests {
    use super::is_valid_provider_token;

    #[test]
    fn accepts_stripe_payment_method_token() {
        assert!(is_valid_provider_token("pm_1NxYz9AbCdEf"));
    }

    #[test]
    fn accepts_legacy_tok_token() {
        assert!(is_valid_provider_token("tok_visa12345"));
    }

    #[test]
    fn rejects_raw_pan_or_short_input() {
        assert!(!is_valid_provider_token("4111111111111111"));
        assert!(!is_valid_provider_token("pm_"));
        assert!(!is_valid_provider_token(""));
    }

    #[test]
    fn rejects_unknown_prefix() {
        assert!(!is_valid_provider_token("xyz_abcdefgh"));
    }
}
