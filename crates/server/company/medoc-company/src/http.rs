//! HTTP-API des **MeDoc Company Servers** (`medoc-company-server` Binary).

use std::net::SocketAddr;
use std::sync::Arc;

use medoc_core::infrastructure::cors_policy::{self, CorsGate};
use medoc_core::infrastructure::logging::brute_force::{BruteForceTracker, BruteKey, CheckResult};

use crate::api_key;
use axum::extract::{ConnectInfo, Extension, Query, State};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct CompanyHostState {
    pub pool: SqlitePool,
    pub brute: Arc<BruteForceTracker>,
}

type PracticeSummaryRow = (String, String, i64, String, i64, i64, i64, f64, i64, i64);

async fn require_practice_auth(
    State(state): State<CompanyHostState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, Response> {
    let peer_ip = addr.ip().to_string();
    let slug = req
        .headers()
        .get("X-Practice-Slug")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "X-Practice-Slug required").into_response())?;
    let brute_key = match BruteKey::from_subject(slug, &peer_ip) {
        Ok(k) => k,
        Err(_) => {
            return Err((StatusCode::INTERNAL_SERVER_ERROR, "brute key").into_response());
        }
    };
    if let CheckResult::Locked { remaining_secs } =
        state.brute.check(Some(&state.pool), &brute_key).await
    {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({ "error": format!("Zu viele Fehlversuche — {remaining_secs}s") })),
        )
            .into_response());
    }

    let auth = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Authorization required").into_response())?;
    let raw = auth
        .strip_prefix("Bearer ")
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Bearer token required").into_response())?;
    let row: Option<(String,)> =
        sqlx::query_as("SELECT api_key_hash FROM practice WHERE slug = ?1")
            .bind(slug)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db").into_response())?;
    let Some((hash,)) = row else {
        state
            .brute
            .record_failure(Some(&state.pool), &brute_key)
            .await;
        return Err((StatusCode::FORBIDDEN, "unknown practice").into_response());
    };
    if !api_key::verify_api_key(raw, &hash) {
        state
            .brute
            .record_failure(Some(&state.pool), &brute_key)
            .await;
        return Err((StatusCode::FORBIDDEN, "invalid api key").into_response());
    }
    state
        .brute
        .record_success(Some(&state.pool), &brute_key)
        .await;
    let slug_owned = slug.to_string();
    req.extensions_mut().insert(slug_owned);
    Ok(next.run(req).await)
}

pub async fn build_company_router(pool: SqlitePool) -> Router {
    let brute = Arc::new(BruteForceTracker::new());
    if let Err(e) = brute.hydrate_from_db(&pool).await {
        tracing::warn!(target: "medoc::company", event = "BRUTE_FORCE_HYDRATE_FAILED", error = %e);
    }
    let state = CompanyHostState { pool, brute };
    let protected = Router::new()
        .route("/health", get(health))
        .route("/summary", get(summary))
        .route("/integrations/status", get(integrations_status))
        .route("/feature-flags", get(feature_flags))
        .route("/updates/manifest", get(updates_manifest))
        .route("/billing/portal-session", post(billing_portal))
        .route("/billing/payment-methods", post(billing_attach))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            require_practice_auth,
        ));

    Router::new()
        .route("/health", get(public_health))
        .nest("/v1", protected)
        .with_state(state)
        .layer(cors_policy::company_cors_layer())
        .layer(middleware::from_fn_with_state(
            CorsGate::company(),
            cors_policy::cors_origin_gate_middleware,
        ))
}

async fn public_health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "medoc-company-server",
        "_demo": true,
        "banner": "Demo-only billing stub — not for production (GAP-15 deferred)."
    }))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "authenticated": true, "_demo": true }))
}

async fn summary(
    State(state): State<CompanyHostState>,
    Extension(slug): Extension<String>,
) -> Result<Json<serde_json::Value>, Response> {
    let row: Option<PracticeSummaryRow> = sqlx::query_as(
        "SELECT slug, display_name, monthly_fee_cents, next_billing_iso, max_users, active_users, storage_gb, storage_used_gb, erezept_month_used, erezept_month_quota FROM practice WHERE slug = ?1",
    )
    .bind(&slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db").into_response())?;
    let Some((
        slug,
        display_name,
        monthly_fee_cents,
        next_billing_iso,
        max_users,
        active_users,
        storage_gb,
        storage_used_gb,
        erezept_month_used,
        erezept_month_quota,
    )) = row
    else {
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
        "_demo": true,
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
        "_demo": true,
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
        "_demo": true,
        "current_version": current,
        "latest_version": current.clone(),
        "update_available": false,
        "channel": "stable",
    }))
}

async fn billing_portal() -> Json<serde_json::Value> {
    Json(json!({
        "_demo": true,
        "url": "https://billing.stripe.com/demo-portal-session",
        "provider": "stripe-demo",
    }))
}

#[derive(Deserialize)]
struct AttachBody {
    provider_token: String,
}

async fn billing_attach(Json(body): Json<AttachBody>) -> Result<Json<serde_json::Value>, Response> {
    if body.provider_token.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "invalid token").into_response());
    }
    Ok(Json(json!({ "_demo": true, "attached": true })))
}
