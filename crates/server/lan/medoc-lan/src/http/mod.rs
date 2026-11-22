//! Axum HTTPS API — authenticated LAN access (JWT HS256, TLS via `lan_server::tls`).
//!
//! **Background / ops:** The embedded host runs in its own Tokio tasks (`commands::network::lan`) and does not
//! block the Tauri UI. Headless: `medoc-server` binary. **Timeouts** prevent hung LAN requests.

#![allow(clippy::result_large_err)] // axum handlers return `Response` as Err

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::extract::{ConnectInfo, Extension, Path, Query, State};
use axum::http::{header, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;

use medoc_core::application::access_control::{self, MyAccessDto};
use medoc_core::application::app_kv_policy;
use medoc_core::application::auth_service::{self, LoginRequest};
use medoc_core::application::authorize;
use medoc_core::application::own_profile::{self, OwnProfileDto};
use medoc_core::company::{CompanyPortalPort, COMPANY_PORTAL};
use medoc_core::domain::entities::staff::UpdateOwnProfile;
use medoc_core::error::AppError;
use medoc_core::infrastructure::company_portal::load_company_portal_config;
use medoc_core::infrastructure::cors_policy::{self, CorsGate};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::database::repos::admin::staff as staff_repo;
use medoc_core::infrastructure::logging::brute_force::{BruteForceTracker, BruteKey, CheckResult};

use crate::discovery::LanBeaconPayload;
use crate::jwt;

pub mod access;
pub mod eprescription;
pub mod license;
pub mod observability;
pub mod pairing;
pub mod app_kv_lww;
pub mod sync;
pub mod sync_bodies;

#[derive(Clone)]
pub struct LanHttpState {
    pub pool: SqlitePool,
    pub jwt_secret: Arc<[u8; 32]>,
    pub brute: Arc<BruteForceTracker>,
    pub http_port: u16,
    pub extra_cors_origins: Arc<Vec<String>>,
    pub discovery_peers: Arc<Vec<(SocketAddr, LanBeaconPayload)>>,
}

pub struct ApiError(AppError);

/// Single AppError → HTTP mapping for every LAN router (status from `AppError::http_status`,
/// body `{ "error": "<wire token>" }` identical to the Tauri IPC payload, so clients share one resolver).
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.0.http_status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        // `error` is the contract (wire token, same as IPC). `status` is additive and mirrors the HTTP code
        // for clients that only see the body (e.g. queued sync problems); the request id is in the header.
        (
            status,
            Json(json!({ "error": self.0.wire_code(), "status": status.as_u16() })),
        )
            .into_response()
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
    pub password: String,
    #[serde(default)]
    pub totp_code: Option<String>,
}

#[derive(Deserialize)]
pub struct AppKvKeyQuery {
    pub key: String,
}

#[derive(Deserialize)]
pub struct AppKvPutBody {
    pub key: String,
    pub value: String,
    /// Set when a web client replays a write it queued offline (RFC 3339, time of the edit).
    #[serde(default, rename = "editedAt")]
    pub edited_at: Option<String>,
}

/// One authorization path for every JWT route: the staff row is re-read, so a
/// deactivated account, a per-person DENY or a changed access profile applies
/// at once — not only after the 8 h token expires. The role baked into the
/// token is not trusted.
async fn require_claims(
    pool: &SqlitePool,
    claims: &jwt::LanClaims,
    action: &str,
) -> Result<(), AppError> {
    let caller = authorize::Caller {
        user_id: claims.sub.clone(),
        idle_for: None,
        device_session_id: None,
    };
    authorize::authorize(pool, &caller, action, None).await?;
    Ok(())
}

async fn require_app_kv_write(
    pool: &SqlitePool,
    claims: &jwt::LanClaims,
    key: &str,
) -> Result<(), AppError> {
    let perm = app_kv_policy::permission_for_app_kv_key(key)
        .ok_or_else(|| AppError::Validation(format!("Unbekannter KV-Key: {key}")))?;
    require_claims(pool, claims, perm).await
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
    pub role: String,
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
        .and_then(|version| version.to_str().ok())
        .ok_or_else(|| unauthorized("Authorization header required"))?;
    let raw = auth
        .strip_prefix("Bearer ")
        .ok_or_else(|| unauthorized("Bearer token required"))?
        .trim();
    let path = req.uri().path().to_string();
    let sync_channel = path.contains("/sync/") || path.ends_with("/pairing/peers");
    if sync_channel && !raw.starts_with(medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX) {
        let reconcile = path.contains("/sync/digest")
            || path.contains("/sync/row-hashes")
            || path.contains("/sync/rows");
        if reconcile {
            return Err(unauthorized("staff jwt is not a device activation token"));
        }
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "sync routes accept only a paired device activation token",
                "reason": "staff_jwt_rejected"
            })),
        )
            .into_response());
    }
    if raw.starts_with(medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX) {
        // Activation-token path (Slice 4): replicas authenticate sync calls
        // with the Ed25519-signed token instead of the legacy JWT.
        let method = req.method().as_str().to_string();
        let payload = self::sync::verify_activation_for_path(&state, raw, &path, &method).await?;
        req.extensions_mut().insert(payload);
        return Ok(next.run(req).await);
    }
    let claims = jwt::verify_token(state.jwt_secret.as_ref(), raw).map_err(|_| {
        tracing::warn!(
            target: "medoc::lan",
            event = "LAN_JWT_REJECTED",
            path = %req.uri().path(),
            token_prefix = %raw.chars().take(8).collect::<String>()
        );
        unauthorized("Invalid token")
    })?;
    let current = staff_repo::token_version(&state.pool, &claims.sub)
        .await
        .map_err(|_| unauthorized("Invalid token"))?;
    if claims.token_version != current {
        return Err(unauthorized("Invalid token"));
    }
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

async fn require_ops_system_claims(
    pool: &SqlitePool,
    claims: &jwt::LanClaims,
) -> Result<(), AppError> {
    require_claims(pool, claims, "ops.system").await
}

/// Sign-in and pairing are small interactive calls; sync and blob routes keep the global 120 s.
const PUBLIC_ROUTE_TIMEOUT_SECS: u64 = 15;

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
        // Interactive, small requests: fail fast instead of holding a connection for the global 120 s.
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(PUBLIC_ROUTE_TIMEOUT_SECS),
        ))
        .with_state(state.clone());

    let protected = Router::new()
        .route("/me", get(me_get).patch(me_patch))
        .route("/me/access", get(me_access_get))
        .merge(self::access::router())
        // Staff route (not under `/sync/`, which only takes device tokens).
        .route("/sync-problems", get(sync_problems_list))
        .route("/sync-problems/{id}/retry", post(sync_problem_retry))
        .route("/sync-problems/{id}/dismiss", post(sync_problem_dismiss))
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
        .route(medoc_sync::paths::SYNC_PUSH, post(self::sync::sync_push))
        .route(medoc_sync::paths::SYNC_PULL, post(self::sync::sync_pull))
        .route(
            medoc_sync::paths::SYNC_EXCHANGE,
            post(self::sync::sync_exchange),
        )
        .route(
            medoc_sync::paths::SYNC_DIGEST,
            post(self::sync::sync_digest),
        )
        .route(
            medoc_sync::paths::SYNC_ROW_HASHES,
            post(self::sync::sync_row_hashes),
        )
        .route(medoc_sync::paths::SYNC_ROWS, post(self::sync::sync_rows))
        .route(medoc_sync::paths::SYNC_STATUS, get(self::sync::sync_status))
        .route(
            medoc_sync::paths::SYNC_NUMBER,
            post(self::sync::sync_number),
        )
        .route(
            medoc_sync::paths::SYNC_BLOB_ROUTE,
            get(self::sync::sync_blob_get).put(self::sync::sync_blob_put),
        )
        .route("/pairing/pending", get(self::pairing::pending))
        .route("/pairing/all", get(self::pairing::list_all))
        .route("/pairing/decide/{id}", post(self::pairing::decide))
        .route("/pairing/revoke/{device_id}", post(self::pairing::revoke))
        .route(
            "/eprescriptions/validate",
            post(self::eprescription::validate),
        )
        .route("/eprescriptions/submit", post(self::eprescription::submit))
        .route(
            "/license",
            get(self::license::status).delete(self::license::clear),
        )
        .route("/license/activate", post(self::license::activate))
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
        .layer(RequestBodyLimitLayer::new(16 * 1024 * 1024))
        // gzip for clients that send `Accept-Encoding: gzip` (the sync client does). Sync pull/rows pages
        // are JSON and shrink several-fold; tiny bodies and already-compressed types are skipped.
        .layer(tower_http::compression::CompressionLayer::new().gzip(true))
        // Request id, request log line (network.log) and response headers — see observability.rs.
        .layer(middleware::from_fn(self::observability::request_context))
        .layer(cors_policy::lan_cors_layer(&allowed))
        .layer(middleware::from_fn_with_state(
            cors_gate,
            cors_policy::cors_origin_gate_middleware,
        ))
}

/// Host clock snapshot. Clients use `server_time` to correct their own clock drift so every device in
/// the practice shows the same "now" (see `packages/shared/src/lib/practice-clock.ts`).
fn clock_snapshot() -> serde_json::Value {
    let now = chrono::Utc::now();
    let local = chrono::Local::now();
    json!({
        "server_time": now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        "utc_offset_minutes": local.offset().local_minus_utc() / 60,
    })
}

async fn health() -> Json<serde_json::Value> {
    let mut body = json!({
        "status": "ok",
        "service": "medoc-lan",
        "version": env!("CARGO_PKG_VERSION"),
    });
    if let (Some(dst), serde_json::Value::Object(src)) = (body.as_object_mut(), clock_snapshot()) {
        dst.extend(src);
    }
    Json(body)
}

async fn ping() -> Json<serde_json::Value> {
    let mut body = json!({ "ok": true });
    if let (Some(dst), serde_json::Value::Object(src)) = (body.as_object_mut(), clock_snapshot()) {
        dst.extend(src);
    }
    Json(body)
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
                Json(
                    json!({ "error": format!("error.app.rate_limited|seconds={remaining_secs}") }),
                ),
            )
                .into_response());
        }
        CheckResult::Allowed => {}
    }

    let req = LoginRequest {
        email: body.email.clone(),
        password: body.password,
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

    let token_version = staff_repo::token_version(&state.pool, &session.user_id)
        .await
        .map_err(|e| ApiError(e).into_response())?;
    let token = jwt::issue_token_versioned(
        state.jwt_secret.as_ref(),
        &session.user_id,
        &session.email,
        &session.role,
        token_version,
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
            role: session.role.clone(),
        },
    }))
}

/// Own profile — mirrors Tauri `get_own_profile` (any valid JWT session).
async fn me_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<OwnProfileDto>, ApiError> {
    let dto = own_profile::get_own_profile(&state.pool, &claims.sub).await?;
    Ok(Json(dto))
}

/// What the signed-in person may do: area levels and allowed actions.
/// Clients use it to hide what the server would refuse anyway.
async fn me_access_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<MyAccessDto>, ApiError> {
    require_claims(&state.pool, &claims, "dashboard.read").await?;
    let dto = access_control::my_access(&state.pool, &claims.sub).await?;
    Ok(Json(dto))
}

#[derive(Deserialize)]
pub struct SyncProblemsQuery {
    #[serde(default)]
    pub all: bool,
}

/// Changes that could not be applied or sent, for the admin to resolve.
async fn sync_problems_list(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Query(q): Query<SyncProblemsQuery>,
) -> Result<Json<Vec<medoc_sync::problems::SyncProblem>>, ApiError> {
    require_claims(&state.pool, &claims, "ops.system").await?;
    Ok(Json(medoc_sync::problems::list(&state.pool, q.all).await?))
}

async fn sync_problem_retry(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    require_claims(&state.pool, &claims, "ops.system").await?;
    medoc_sync::problems::retry(&state.pool, &id, &claims.sub).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn sync_problem_dismiss(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    require_claims(&state.pool, &claims, "ops.system").await?;
    medoc_sync::problems::dismiss(&state.pool, &id, &claims.sub).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Update own profile — mirrors Tauri `update_own_profile`.
async fn me_patch(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<UpdateOwnProfile>,
) -> Result<Json<OwnProfileDto>, ApiError> {
    let updated = own_profile::apply_own_profile_update(&state.pool, &claims.sub, &body).await?;
    Ok(Json(OwnProfileDto::from(&updated)))
}

/// Mirrors Tauri `get_app_kv` — the key's permission applies to reads as well as writes.
async fn app_kv_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Query(q): Query<AppKvKeyQuery>,
) -> Result<Json<Option<String>>, ApiError> {
    let perm = app_kv_policy::read_permission_for_app_kv_key(&q.key)
        .ok_or_else(|| AppError::Validation(format!("Unknown KV key: {}", q.key)))?;
    require_claims(&state.pool, &claims, perm).await?;
    let row = app_kv_repo::get(&state.pool, &q.key).await?;
    Ok(Json(row))
}

/// Mirrors Tauri `set_app_kv`.
async fn app_kv_put(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<AppKvPutBody>,
) -> Result<StatusCode, ApiError> {
    require_app_kv_write(&state.pool, &claims, &body.key).await?;
    app_kv_policy::validate_app_kv_value(&body.key, &body.value)?;
    if app_kv_lww::offline_write_is_stale(&state.pool, &body.key, body.edited_at.as_deref()).await {
        return Ok(StatusCode::CONFLICT);
    }
    app_kv_repo::set(&state.pool, &body.key, &body.value).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Mirrors Tauri `delete_app_kv`.
async fn app_kv_delete(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Query(q): Query<AppKvKeyQuery>,
) -> Result<StatusCode, ApiError> {
    require_app_kv_write(&state.pool, &claims, &q.key).await?;
    app_kv_repo::delete(&state.pool, &q.key).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Vendor portal — subscription summary (`ops.system` only; uses practice KV + optional env).
async fn company_summary_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&state.pool, &claims).await?;
    let cfg = load_company_portal_config(&state.pool).await;
    let version = COMPANY_PORTAL.fetch_subscription_summary(&cfg).await?;
    Ok(Json(version))
}

async fn company_integrations_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&state.pool, &claims).await?;
    let cfg = load_company_portal_config(&state.pool).await;
    let version = COMPANY_PORTAL.fetch_integration_statuses(&cfg).await?;
    Ok(Json(version))
}

async fn company_feature_flags_get(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&state.pool, &claims).await?;
    let cfg = load_company_portal_config(&state.pool).await;
    let version = COMPANY_PORTAL.fetch_feature_flags(&cfg).await?;
    Ok(Json(version))
}

async fn company_billing_portal_post(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Value>, ApiError> {
    require_ops_system_claims(&state.pool, &claims).await?;
    let cfg = load_company_portal_config(&state.pool).await;
    let url = COMPANY_PORTAL.post_billing_portal_url(&cfg).await?;
    Ok(Json(json!({ "url": url, "provider": "Vendor portal" })))
}
