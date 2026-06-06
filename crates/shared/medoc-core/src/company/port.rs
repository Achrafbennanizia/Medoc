//! **Port** (interface segregation) for vendor HTTP — enables test doubles (**Bridge** / **Strategy**).

use serde_json::Value;

use crate::error::AppError;
use crate::infrastructure::company_portal::CompanyPortalConfig;

/// Vendor portal operations (Company system boundary).
pub trait CompanyPortalPort: Send + Sync {
    fn fetch_subscription_summary<'a>(
        &'a self,
        cfg: &'a CompanyPortalConfig,
    ) -> impl std::future::Future<Output = Result<Value, AppError>> + Send + 'a;

    fn fetch_integration_statuses<'a>(
        &'a self,
        cfg: &'a CompanyPortalConfig,
    ) -> impl std::future::Future<Output = Result<Value, AppError>> + Send + 'a;

    fn fetch_feature_flags<'a>(
        &'a self,
        cfg: &'a CompanyPortalConfig,
    ) -> impl std::future::Future<Output = Result<Value, AppError>> + Send + 'a;

    fn fetch_update_manifest<'a>(
        &'a self,
        cfg: &'a CompanyPortalConfig,
        current: &'a str,
    ) -> impl std::future::Future<Output = Result<Value, AppError>> + Send + 'a;

    fn post_billing_portal_url<'a>(
        &'a self,
        cfg: &'a CompanyPortalConfig,
    ) -> impl std::future::Future<Output = Result<String, AppError>> + Send + 'a;

    fn attach_payment_method<'a>(
        &'a self,
        cfg: &'a CompanyPortalConfig,
        provider_token: &'a str,
    ) -> impl std::future::Future<Output = Result<(), AppError>> + Send + 'a;
}
