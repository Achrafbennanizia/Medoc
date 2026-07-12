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
        .route("/register", post(register_practice))
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

#[derive(Deserialize)]
struct RegisterPracticeBody {
    display_name: String,
    slug: String,
    admin_name: String,
    admin_email: String,
    #[serde(default)]
    street: Option<String>,
    #[serde(default)]
    postal_code: Option<String>,
    #[serde(default)]
    city: Option<String>,
    plan: String,
}

fn plan_details(plan: &str) -> (&'static str, i64, i64) {
    match plan.trim().to_uppercase().as_str() {
        "BASIC" => ("MeDoc Praxis Basis", 4900, 2),
        "ENTERPRISE" => ("MeDoc Praxis Enterprise", 17900, 99),
        _ => ("MeDoc Praxis Pro", 9900, 5),
    }
}

fn slug_valid(slug: &str) -> bool {
    let s = slug.trim();
    if s.len() < 3 || s.len() > 48 {
        return false;
    }
    s.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

async fn register_practice(
    State(state): State<CompanyHostState>,
    Json(body): Json<RegisterPracticeBody>,
) -> Result<Json<serde_json::Value>, Response> {
    let display_name = body.display_name.trim();
    let slug = body.slug.trim().to_lowercase();
    let admin_name = body.admin_name.trim();
    let admin_email = body.admin_email.trim();
    if display_name.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, "display_name too short").into_response());
    }
    if !slug_valid(&slug) {
        return Err((StatusCode::BAD_REQUEST, "invalid slug").into_response());
    }
    if admin_name.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, "admin_name too short").into_response());
    }
    if !admin_email.contains('@') || admin_email.len() < 5 {
        return Err((StatusCode::BAD_REQUEST, "invalid admin_email").into_response());
    }

    let existing: Option<(String,)> =
        sqlx::query_as("SELECT slug FROM practice WHERE slug = ?1")
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db").into_response())?;
    if existing.is_some() {
        return Err((StatusCode::CONFLICT, "slug already registered").into_response());
    }

    let (plan_name, monthly_fee_cents, max_users) = plan_details(&body.plan);
    let raw_key = format!(
        "sk_live_{}",
        base64::Engine::encode(
            &base64::engine::general_purpose::URL_SAFE_NO_PAD,
            uuid::Uuid::new_v4().as_bytes()
        )
    );
    let api_hash = api_key::hash_api_key(&raw_key)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "hash").into_response())?;

    sqlx::query(
        "INSERT INTO practice (slug, display_name, api_key_hash, plan_name, monthly_fee_cents, max_users)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&slug)
    .bind(display_name)
    .bind(&api_hash)
    .bind(plan_name)
    .bind(monthly_fee_cents)
    .bind(max_users)
    .execute(&state.pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "insert").into_response())?;

    Ok(Json(json!({
        "_demo": true,
        "practice_slug": slug,
        "display_name": display_name,
        "plan_name": plan_name,
        "plan": body.plan.trim().to_uppercase(),
        "api_key": raw_key,
        "admin_name": admin_name,
        "admin_email": admin_email,
        "street": body.street,
        "postal_code": body.postal_code,
        "city": body.city,
        "monthly_fee_cents": monthly_fee_cents,
        "max_users": max_users,
    })))
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
