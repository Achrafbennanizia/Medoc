// Subscription / billing portal commands (FA-PAY-01..06).
//
// MeDoc never stores PAN/IBAN/CVV locally (PCI-DSS). The actual checkout is
// hosted by the payment provider (Stripe/Mollie); we only:
//
// 1. Generate the customer-portal URL the user should open in the browser.
// 2. Surface the local billing tier so the UI can gate features.
//
// Both steps are stubs today — they'll be wired to the vendor backend when
// the SaaS layer ships. The contract surface and audit logging are in place
// so the frontend can integrate without further changes.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
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
    Ok(SubscriptionPortal {
        url: "https://portal.medoc.local/billing".to_string(),
        provider: "Stripe".to_string(),
        note: "Konto-Verwaltung erfolgt im Hersteller-Portal. \
               Keine Kartendaten werden lokal gespeichert (PCI-DSS)."
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
pub async fn attach_payment_method(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    request: PaymentMethodRequest,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "ops.system")?;
    if !is_valid_provider_token(&request.provider_token) {
        return Err(AppError::Validation(
            "Ungültiges Provider-Token (erwartet pm_ oder tok_-Präfix)".into(),
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
    // Real implementation: POST to vendor backend with bearer token.
    Ok(())
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
