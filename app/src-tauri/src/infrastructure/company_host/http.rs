//! HTTP-API des **MeDoc Company Servers** (`medoc-company-server` Binary).

use axum::extract::{Extension, Query, State};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct CompanyHostState {
    pub pool: SqlitePool,
}

async fn require_practice_auth(
    State(state): State<CompanyHostState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, Response> {
    let auth = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Authorization required").into_response())?;
    let raw = auth.strip_prefix("Bearer ").ok_or_else(|| {
        (StatusCode::UNAUTHORIZED, "Bearer token required").into_response()
    })?;
    let slug = req
        .headers()
        .get("X-Practice-Slug")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "X-Practice-Slug required").into_response())?;
    let key: Option<(String,)> = sqlx::query_as("SELECT api_key FROM practice WHERE slug = ?1")
        .bind(slug)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db").into_response())?;
    let Some((db_key,)) = key else {
        return Err((StatusCode::FORBIDDEN, "unknown practice").into_response());
    };
    if db_key != raw {
        return Err((StatusCode::FORBIDDEN, "invalid api key").into_response());
    }
    let slug_owned = slug.to_string();
    req.extensions_mut().insert(slug_owned);
    Ok(next.run(req).await)
}

pub fn build_company_router(pool: SqlitePool) -> Router {
    let state = CompanyHostState { pool };
    let protected = Router::new()
        .route("/health", get(health))
        .route("/summary", get(summary))
        .route("/integrations/status", get(integrations_status))
        .route("/feature-flags", get(feature_flags))
        .route("/updates/manifest", get(updates_manifest))
        .route("/billing/portal-session", post(billing_portal))
        .route("/billing/payment-methods", post(billing_attach))
        .layer(middleware::from_fn_with_state(state.clone(), require_practice_auth));

    Router::new()
        .route("/health", get(public_health))
        .nest("/v1", protected)
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::OPTIONS])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    axum::http::HeaderName::from_static("x-practice-slug"),
                ]),
        )
}

async fn public_health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "service": "medoc-company-server" }))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "authenticated": true }))
}

async fn summary(
    State(state): State<CompanyHostState>,
    Extension(slug): Extension<String>,
) -> Result<Json<serde_json::Value>, Response> {
    let row: Option<(String, String, i64, String, i64, i64, i64, f64, i64, i64)> = sqlx::query_as(
        "SELECT slug, display_name, monthly_fee_cents, next_billing_iso, max_users, active_users, storage_gb, storage_used_gb, erezept_month_used, erezept_month_quota FROM practice WHERE slug = ?1",
    )
    .bind(&slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db").into_response())?;
    let Some((slug, display_name, monthly_fee_cents, next_billing_iso, max_users, active_users, storage_gb, storage_used_gb, erezept_month_used, erezept_month_quota)) = row else {
        return Err((StatusCode::NOT_FOUND, "practice").into_response());
    };
    Ok(Json(json!({
        "practice_slug": slug,
        "display_name": display_name,
        "plan_name": "MeDoc Praxis Pro",
        "monthly_fee_cents": monthly_fee_cents,
        "next_billing_iso": next_billing_iso,
        "max_users": max_users,
        "active_users": active_users,
        "storage_gb": storage_gb,
        "storage_used_gb": storage_used_gb,
        "erezept_month_used": erezept_month_used,
        "erezept_month_quota": erezept_month_quota,
    })))
}

async fn integrations_status() -> Json<serde_json::Value> {
    Json(json!({
        "eprescription": { "status": "disconnected", "detail": "Gematik-Anbindung — Konfiguration ausstehend" },
        "datev": { "status": "beta", "detail": "DATEV-Export vorbereitet" },
        "doccheck_sso": { "status": "disconnected", "detail": "Nicht verbunden" },
        "kim_tk": { "status": "disconnected", "detail": "KIM — nicht angebunden" },
        "labor_dental_union": { "status": "beta", "detail": "Beta" },
        "card_reader": { "status": "disconnected", "detail": "Kein Kartenleser erkannt" },
    }))
}

async fn feature_flags() -> Json<serde_json::Value> {
    Json(json!({
        "notifications_push_delivery": false,
        "notifications_email_digest_delivery": false,
        "notifications_patient_sms_delivery": false,
        "two_factor_auth_enforced": false,
    }))
}

#[derive(Deserialize)]
struct ManifestQuery {
    current: Option<String>,
}

async fn updates_manifest(Query(q): Query<ManifestQuery>) -> Json<serde_json::Value> {
    let current = q.current.unwrap_or_else(|| "0.0.0".into());
    Json(json!({
        "current_version": current,
        "latest_version": current.clone(),
        "update_available": false,
        "channel": "stable",
    }))
}

async fn billing_portal() -> Json<serde_json::Value> {
    Json(json!({
        "url": "https://billing.stripe.com/demo-portal-session",
        "provider": "stripe-demo",
    }))
}

#[derive(Deserialize)]
struct AttachBody {
    provider_token: String,
}

async fn billing_attach(Json(body): Json<AttachBody>) -> Result<StatusCode, Response> {
    if body.provider_token.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "invalid token").into_response());
    }
    Ok(StatusCode::NO_CONTENT)
}
