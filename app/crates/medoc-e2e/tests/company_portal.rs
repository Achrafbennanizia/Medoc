//! Company portal server end-to-end: public health + practice API key auth.

use axum::http::StatusCode;
use medoc_e2e::harness::CompanyHarness;

const DEMO_SLUG: &str = "demo-praxis";
const DEMO_API_KEY: &str = "sk_demo_company_practice_key";

#[tokio::test]
async fn company_public_health() {
    let mut company = CompanyHarness::new().await;
    let (status, body) = company.json("GET", "/health", None, None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["service"], "medoc-company-server");
}

#[tokio::test]
async fn company_authenticated_summary() {
    let mut company = CompanyHarness::new().await;

    let (status, body) = company
        .json(
            "GET",
            "/v1/summary",
            None,
            Some(DEMO_SLUG),
            Some(DEMO_API_KEY),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "summary failed: {body:?}");
    assert_eq!(body["practice_slug"], DEMO_SLUG);
    assert_eq!(body["display_name"], "Demo Praxis GmbH");
    assert!(body["monthly_fee_cents"].is_number());
}

#[tokio::test]
async fn company_rejects_invalid_api_key() {
    let mut company = CompanyHarness::new().await;

    let (status, _body) = company
        .json(
            "GET",
            "/v1/summary",
            None,
            Some(DEMO_SLUG),
            Some("sk_wrong_key"),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn company_rejects_missing_slug_header() {
    let mut company = CompanyHarness::new().await;

    let (status, _body) = company
        .json("GET", "/v1/summary", None, None, Some(DEMO_API_KEY))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn company_feature_flags_and_integrations() {
    let mut company = CompanyHarness::new().await;

    let (status, flags) = company
        .json(
            "GET",
            "/v1/feature-flags",
            None,
            Some(DEMO_SLUG),
            Some(DEMO_API_KEY),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(flags["_demo"], true);

    let (status, integrations) = company
        .json(
            "GET",
            "/v1/integrations/status",
            None,
            Some(DEMO_SLUG),
            Some(DEMO_API_KEY),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert!(integrations["eprescription"].is_object());
}

#[tokio::test]
async fn company_billing_attach_validates_token_length() {
    let mut company = CompanyHarness::new().await;

    let (status, _body) = company
        .json(
            "POST",
            "/v1/billing/payment-methods",
            Some(&serde_json::json!({ "provider_token": "short" })),
            Some(DEMO_SLUG),
            Some(DEMO_API_KEY),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, body) = company
        .json(
            "POST",
            "/v1/billing/payment-methods",
            Some(&serde_json::json!({ "provider_token": "tok_valid_demo" })),
            Some(DEMO_SLUG),
            Some(DEMO_API_KEY),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["attached"], true);
}
