//! JSON-REST zum Hersteller-Portal (`medoc-company-server` oder produktives Backend).

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde_json::{json, Value};

use crate::error::AppError;

use super::config::{effective_api_key, require_callable, CompanyPortalConfig};

fn client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP-Client: {e}")))
}

fn auth_headers(cfg: &CompanyPortalConfig) -> Result<HeaderMap, AppError> {
    let mut h = HeaderMap::new();
    let key = effective_api_key(cfg);
    let bearer = format!("Bearer {key}");
    h.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&bearer).map_err(|e| AppError::Internal(format!("Header: {e}")))?,
    );
    Ok(h)
}

async fn get_json(base: &str, path: &str, cfg: &CompanyPortalConfig) -> Result<Value, AppError> {
    let url = format!("{base}{path}");
    let c = client()?;
    let res = c
        .get(&url)
        .headers(auth_headers(cfg)?)
        .header("X-Practice-Slug", cfg.practice_slug.trim())
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Hersteller-Portal GET {path}: {e}")))?;
    let status = res.status();
    if !status.is_success() {
        let t = res.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Hersteller-Portal {}: HTTP {} — {}",
            path,
            status,
            t.chars().take(400).collect::<String>()
        )));
    }
    res.json::<Value>()
        .await
        .map_err(|e| AppError::Internal(format!("Hersteller-Portal JSON {path}: {e}")))
}

async fn post_json(
    base: &str,
    path: &str,
    cfg: &CompanyPortalConfig,
    body: Value,
) -> Result<Value, AppError> {
    let url = format!("{base}{path}");
    let c = client()?;
    let res = c
        .post(&url)
        .headers(auth_headers(cfg)?)
        .header("X-Practice-Slug", cfg.practice_slug.trim())
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Hersteller-Portal POST {path}: {e}")))?;
    let status = res.status();
    if !status.is_success() {
        let t = res.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Hersteller-Portal {}: HTTP {} — {}",
            path,
            status,
            t.chars().take(400).collect::<String>()
        )));
    }
    let txt = res.text().await.unwrap_or_default();
    if txt.trim().is_empty() {
        return Ok(json!({}));
    }
    serde_json::from_str(&txt).map_err(|e| AppError::Internal(format!("JSON: {e}")))
}

pub async fn fetch_subscription_summary(cfg: &CompanyPortalConfig) -> Result<Value, AppError> {
    let (base, c) = require_callable(cfg)?;
    get_json(&base, "/v1/summary", &c).await
}

pub async fn fetch_integration_statuses(cfg: &CompanyPortalConfig) -> Result<Value, AppError> {
    let (base, c) = require_callable(cfg)?;
    get_json(&base, "/v1/integrations/status", &c).await
}

pub async fn fetch_feature_flags(cfg: &CompanyPortalConfig) -> Result<Value, AppError> {
    let (base, c) = require_callable(cfg)?;
    get_json(&base, "/v1/feature-flags", &c).await
}

pub async fn fetch_update_manifest(
    cfg: &CompanyPortalConfig,
    current: &str,
) -> Result<Value, AppError> {
    let (base, c) = require_callable(cfg)?;
    let path = format!(
        "/v1/updates/manifest?current={}",
        urlencoding::encode(current)
    );
    get_json(&base, &path, &c).await
}

pub async fn post_billing_portal_url(cfg: &CompanyPortalConfig) -> Result<String, AppError> {
    let (base, c) = require_callable(cfg)?;
    let v = post_json(&base, "/v1/billing/portal-session", &c, json!({})).await?;
    v.get("url")
        .and_then(|x| x.as_str())
        .map(str::to_string)
        .ok_or_else(|| AppError::Internal("Hersteller-Portal: Antwort ohne url".into()))
}

pub async fn attach_payment_method_remote(
    cfg: &CompanyPortalConfig,
    provider_token: &str,
) -> Result<(), AppError> {
    let (base, c) = require_callable(cfg)?;
    let _ = post_json(
        &base,
        "/v1/billing/payment-methods",
        &c,
        json!({ "provider_token": provider_token }),
    )
    .await?;
    Ok(())
}
