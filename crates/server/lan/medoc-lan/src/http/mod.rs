//! Axum HTTPS API — authenticated LAN access (JWT HS256, TLS via `lan_server::tls`).
//!
//! **Background / Betrieb:** Der eingebettete Host läuft in eigenen Tokio-Tasks (`lan_commands`), blockiert die
//! Tauri-UI nicht. Headless: Binary `medoc-server`. **Timeouts** verhindern hängende LAN-Anfragen.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{ConnectInfo, Extension, Query, State};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;

use medoc_core::application::app_kv_policy;
use medoc_core::application::auth_service::{self, LoginRequest};
use medoc_core::application::own_profile::{self, OwnProfileDto};
use medoc_core::application::rbac::{self, Role};
use medoc_core::company::{CompanyPortalPort, COMPANY_PORTAL};
use medoc_core::domain::entities::personal::UpdateOwnProfile;
use medoc_core::domain::entities::{Patient, Termin};
use medoc_core::error::AppError;
use medoc_core::infrastructure::company_portal::load_company_portal_config;
use medoc_core::infrastructure::cors_policy::{self, CorsGate};
use medoc_core::infrastructure::database::{app_kv_repo, patient_repo, termin_repo};
use medoc_core::infrastructure::logging::brute_force::{BruteForceTracker, BruteKey, CheckResult};
use medoc_sync::pairing::ActivationTokenPayload;

use crate::discovery::LanBeaconPayload;
use crate::jwt;

pub mod pairing;
pub mod sync;

#[derive(Clone)]
pub struct LanHttpState {
    pub pool: SqlitePool,
    pub jwt_secret: Arc<[u8; 32]>,
    pub brute: Arc<BruteForceTracker>,
    pub http_port: u16,
    pub extra_cors_origins: Arc<Vec<String>>,
    pub discovery_peers: Arc<Vec<(SocketAddr, LanBeaconPayload)>>,
}

struct ApiError(AppError);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match &self.0 {
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::RateLimited(_) => StatusCode::TOO_MANY_REQUESTS,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::TotpRequired | AppError::TotpEnrollmentRequired => StatusCode::UNAUTHORIZED,
            AppError::Database(_) | AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let msg = self.0.to_string();
        let body = Json(json!({ "error": msg }));
        (status, body).into_response()
    }
}

impl From<AppError> for ApiError {
    fn from(value: AppError) -> Self {
        ApiError(value)
    }
}

#[derive(Deserialize)]
pub struct LoginBody {
    pub email: String,
    #[serde(alias = "password")]
    pub passwort: String,
    #[serde(default)]
    pub totp_code: Option<String>,
}

#[derive(Deserialize)]
pub struct TermineQuery {
    pub datum: Option<String>,
}

#[derive(Deserialize)]
pub struct AppKvKeyQuery {
    pub key: String,
}

#[derive(Deserialize)]
pub struct AppKvPutBody {
    pub key: String,
    pub value: String,
}

fn require_app_kv_write(claims: &jwt::LanClaims, key: &str) -> Result<(), AppError> {
    let perm = app_kv_policy::permission_for_app_kv_key(key)
        .ok_or_else(|| AppError::Validation(format!("Unbekannter KV-Key: {key}")))?;
    let role = Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    if !rbac::allowed(perm, role) {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub expires_in: i64,
    pub user: LoginUserDto,
}

#[derive(Serialize)]
pub struct LoginUserDto {
    pub user_id: String,
    pub email: String,
    pub name: String,
    pub rolle: String,
}

fn unauthorized(msg: &'static str) -> Response {
    (StatusCode::UNAUTHORIZED, Json(json!({ "error": msg }))).into_response()
}

async fn jwt_auth_middleware(
    State(state): State<LanHttpState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, Response> {
    let auth = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| unauthorized("Authorization header required"))?;
    let raw = auth
        .strip_prefix("Bearer ")
        .ok_or_else(|| unauthorized("Bearer token required"))?
        .trim();
    if raw.starts_with(medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX) {
        // Activation-token path (Slice 4): replicas authenticate sync calls
        // with the Ed25519-signed token instead of the legacy JWT.
        let path = req.uri().path().to_string();
        let payload = self::sync::verify_activation_for_path(&state, raw, &path).await?;
        req.extensions_mut().insert(payload);
        return Ok(next.run(req).await);
    }
    let claims = jwt::verify_token(state.jwt_secret.as_ref(), raw)
        .map_err(|_| unauthorized("Invalid token"))?;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

fn require_ops_system_claims(claims: &jwt::LanClaims) -> Result<(), AppError> {
    let role = Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    if !rbac::allowed("ops.system", role) {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub fn build_router(state: LanHttpState) -> Router {
    let allowed = cors_policy::lan_allowed_origin_strings(
        state.http_port,
        &state.extra_cors_origins,
        &state.discovery_peers,
    );
    let cors_gate = CorsGate::lan(
        state.http_port,
        &state.extra_cors_origins,
        &state.discovery_peers,
    );

    let public = Router::new()
        .route("/ping", get(ping))
        .route("/auth/login", post(login))
        .route("/pairing/request", post(self::pairing::submit))
        .route("/pairing/status/{id}", get(self::pairing::status))
        .route("/pairing/confirm/{id}", post(self::pairing::confirm))
        .route("/pairing/master-info", get(self::pairing::master_info))
        .route("/pairing/peers", get(self::pairing::peers))
        .with_state(state.clone());

    let protected = Router::new()
        .route("/patienten", get(list_patienten))
        .route("/termine", get(list_termine))
        .route("/me", get(me_get).patch(me_patch))
        .route(
            "/app-kv",
            get(app_kv_get).put(app_kv_put).delete(app_kv_delete),
        )
        .route("/company/summary", get(company_summary_get))
        .route(
            "/company/integrations/status",
            get(company_integrations_get),
        )
        .route("/company/feature-flags", get(company_feature_flags_get))
        .route(
            "/company/billing/portal-session",
            post(company_billing_portal_post),
        )
        .route("/sync/push", post(self::sync::sync_push))
        .route("/sync/pull", post(self::sync::sync_pull))
        .route("/sync/status", get(self::sync::sync_status))
        .route("/pairing/pending", get(self::pairing::pending))
        .route("/pairing/all", get(self::pairing::list_all))
        .route("/pairing/decide/{id}", post(self::pairing::decide))
        .route("/pairing/revoke/{device_id}", post(self::pairing::revoke))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            jwt_auth_middleware,
        ))
        .with_state(state.clone());

    Router::new()
        .route("/health", get(health))
        .nest("/api/v1", public.merge(protected))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(120),
        ))
        .layer(RequestBodyLimitLayer::new(16 * 1024))
        .layer(cors_policy::lan_cors_layer(&allowed))
        .layer(middleware::from_fn_with_state(
            cors_gate,
            cors_policy::cors_origin_gate_middleware,
        ))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "medoc-lan",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn ping() -> Json<serde_json::Value> {
    Json(json!({ "ok": true }))
}

async fn login(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(body): Json<LoginBody>,
) -> Result<Json<LoginResponse>, Response> {
    let peer_ip = addr.ip().to_string();
    let brute_key =
        BruteKey::from_subject(&body.email, &peer_ip).map_err(|e| ApiError(e).into_response())?;
    match state.brute.check(Some(&state.pool), &brute_key).await {
        CheckResult::Locked { remaining_secs } => {
            return Err((
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({ "error": format!("Zu viele Fehlversuche — {remaining_secs}s") })),
            )
                .into_response());
        }
        CheckResult::Allowed => {}
    }

    let req = LoginRequest {
        email: body.email.clone(),
        passwort: body.passwort,
        totp_code: body.totp_code.clone(),
    };

    let session = match auth_service::authenticate(&state.pool, &req).await {
        Ok(s) => s,
        Err(e) => {
            let locked = state
                .brute
                .record_failure(Some(&state.pool), &brute_key)
                .await;
            if locked {
                tracing::warn!(target: "medoc::lan", event = "LAN_LOGIN_LOCKOUT", ip = %peer_ip);
            }
            return Err(ApiError(e).into_response());
        }
    };

    state
        .brute
        .record_success(Some(&state.pool), &brute_key)
        .await;

    let token = jwt::issue_token(
        state.jwt_secret.as_ref(),
        &session.user_id,
        &session.email,
        &session.rolle,
    )
    .map_err(|e| ApiError(e).into_response())?;

    Ok(Json(LoginResponse {
        access_token: token,
        token_type: "Bearer",
        expires_in: 8 * 3600,
        user: LoginUserDto {
            user_id: session.user_id,
            email: session.email.clone(),
            name: session.name,
            rolle: session.rolle.clone(),
        },
    }))
}

/// Eigenes Profil — spiegelt Tauri `get_own_profile` (jede gültige JWT-Sitzung).
async fn me_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<OwnProfileDto>, ApiError> {
    let dto = own_profile::get_own_profile(&state.pool, &claims.sub).await?;
    Ok(Json(dto))
}

/// Eigenes Profil aktualisieren — spiegelt Tauri `update_own_profile`.
async fn me_patch(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<UpdateOwnProfile>,
) -> Result<Json<OwnProfileDto>, ApiError> {
    let updated = own_profile::apply_own_profile_update(&state.pool, &claims.sub, &body).await?;
    Ok(Json(OwnProfileDto::from(&updated)))
}

async fn list_patienten(
    State(state): State<LanHttpState>,
    req: axum::extract::Request,
) -> Result<Json<Vec<Patient>>, ApiError> {
    if req.extensions().get::<ActivationTokenPayload>().is_some() {
        let rows = patient_repo::find_all(&state.pool).await?;
        return Ok(Json(rows));
    }
    let claims = req
        .extensions()
        .get::<jwt::LanClaims>()
        .cloned()
        .ok_or(AppError::Unauthorized)?;
    let role = Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    if !rbac::allowed("patient.read", role) {
        return Err(AppError::Forbidden.into());
    }
    let rows = patient_repo::find_all(&state.pool).await?;
    Ok(Json(rows))
}

async fn list_termine(
    State(state): State<LanHttpState>,
    Query(q): Query<TermineQuery>,
    req: axum::extract::Request,
) -> Result<Json<Vec<Termin>>, ApiError> {
    let datum = q
        .datum
        .unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());
    if req.extensions().get::<ActivationTokenPayload>().is_some() {
        let rows = termin_repo::find_by_date(&state.pool, &datum).await?;
        return Ok(Json(rows));
    }
    let claims = req
        .extensions()
        .get::<jwt::LanClaims>()
        .cloned()
        .ok_or(AppError::Unauthorized)?;
    let role = Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    if !rbac::allowed("termin.read", role) {
        return Err(AppError::Forbidden.into());
    }
    let rows = termin_repo::find_by_date(&state.pool, &datum).await?;
    Ok(Json(rows))
}

/// Mirrors Tauri `get_app_kv` — any authenticated JWT may read whitelisted keys.
async fn app_kv_get(
    State(state): State<LanHttpState>,
    Extension(_claims): Extension<jwt::LanClaims>,
    Query(q): Query<AppKvKeyQuery>,
) -> Result<Json<Option<String>>, ApiError> {
    app_kv_policy::permission_for_app_kv_key(&q.key)
        .ok_or_else(|| AppError::Validation(format!("Unbekannter KV-Key: {}", q.key)))?;
    let row = app_kv_repo::get(&state.pool, &q.key).await?;
    Ok(Json(row))
}

/// Mirrors Tauri `set_app_kv`.
async fn app_kv_put(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<AppKvPutBody>,
) -> Result<StatusCode, ApiError> {
    require_app_kv_write(&claims, &body.key)?;
    app_kv_repo::set(&state.pool, &body.key, &body.value).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Mirrors Tauri `delete_app_kv`.
async fn app_kv_delete(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Query(q): Query<AppKvKeyQuery>,
) -> Result<StatusCode, ApiError> {
    require_app_kv_write(&claims, &q.key)?;
    app_kv_repo::delete(&state.pool, &q.key).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Hersteller-Portal — Abo-Zusammenfassung (nur `ops.system`, nutzt Praxis-KV + ggf. Env).
async fn company_summary_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&claims)?;
    let cfg = load_company_portal_config(&state.pool).await;
    let v = COMPANY_PORTAL.fetch_subscription_summary(&cfg).await?;
    Ok(Json(v))
}

async fn company_integrations_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&claims)?;
    let cfg = load_company_portal_config(&state.pool).await;
    let v = COMPANY_PORTAL.fetch_integration_statuses(&cfg).await?;
    Ok(Json(v))
}

async fn company_feature_flags_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&claims)?;
    let cfg = load_company_portal_config(&state.pool).await;
    let v = COMPANY_PORTAL.fetch_feature_flags(&cfg).await?;
    Ok(Json(v))
}

async fn company_billing_portal_post(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&claims)?;
    let cfg = load_company_portal_config(&state.pool).await;
    let url = COMPANY_PORTAL.post_billing_portal_url(&cfg).await?;
    Ok(Json(json!({ "url": url, "provider": "Hersteller-Portal" })))
}
