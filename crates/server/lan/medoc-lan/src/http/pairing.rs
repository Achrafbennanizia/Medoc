//! LAN HTTP endpoints for the master/replica pairing handshake.
//!
//! - `POST /api/v1/pairing/request`         (unauth) — replica submits.
//! - `GET  /api/v1/pairing/status/:id`      (unauth) — replica polls.
//! - `GET  /api/v1/pairing/master-info`     (unauth) — replica learns master pubkey + label.
//! - `POST /api/v1/pairing/decide/:id`      (JWT, ops.system) — master accepts/rejects.
//! - `POST /api/v1/pairing/confirm/:id`     (unauth) — replica submits 4-digit PIN.
//! - `GET  /api/v1/pairing/pending`         (JWT, ops.system) — master inbox.
//! - `POST /api/v1/pairing/revoke/:device`  (JWT, ops.system) — master revokes.
//! - `GET  /api/v1/pairing/peers`           (activation token) — replica fetches signed peer list (mesh, BEST-EFFORT).

use std::net::SocketAddr;

use axum::extract::{ConnectInfo, Extension, Path, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use medoc_sync::deployment::APP_KV_DEVICE_ID_KEY;
use medoc_sync::master_keys;
use medoc_sync::pairing::{
    self, ActivationTokenPayload, PairingDecideResult, PairingDecision, PairingRequest,
    PairingRequestSubmit, ACTIVATION_TOKEN_PREFIX,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::LanHttpState;
use crate::jwt;
use crate::master_license;

pub struct ApiError(AppError);

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
        (status, Json(json!({ "error": msg }))).into_response()
    }
}

impl From<AppError> for ApiError {
    fn from(value: AppError) -> Self {
        ApiError(value)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequestBody {
    pub device_id: String,
    pub slave_pubkey: String,
    #[serde(default)]
    pub slave_label: String,
    #[serde(default = "default_transport")]
    pub transport: String,
}

fn default_transport() -> String {
    "lan".into()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingConfirmBody {
    pub pin: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingDecisionBody {
    pub accept: bool,
    #[serde(default)]
    pub allowed_actions: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterInfo {
    pub master_device_id: String,
    pub master_pubkey: String,
    pub master_label: String,
    pub master_version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingPeerListing {
    pub master_device_id: String,
    pub peers: Vec<PairingPeerEntry>,
    pub signature: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingPeerEntry {
    pub device_id: String,
    pub slave_label: String,
    pub slave_pubkey: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer_base_url: Option<String>,
}

pub async fn submit(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(body): Json<PairingRequestBody>,
) -> Result<Json<PairingRequest>, ApiError> {
    master_license::require_master_license(&state.pool).await?;
    let ip = addr.ip().to_string();
    let req = pairing::submit_request(
        &state.pool,
        PairingRequestSubmit {
            device_id: body.device_id,
            slave_pubkey: body.slave_pubkey,
            slave_label: body.slave_label,
            requester_ip: ip,
            transport: body.transport,
        },
    )
    .await?;
    Ok(Json(req))
}

pub async fn status(
    State(state): State<LanHttpState>,
    Path(id): Path<String>,
) -> Result<Json<PairingRequest>, ApiError> {
    let row = pairing::load_by_id(&state.pool, &id)
        .await?
        .ok_or(AppError::NotFound("pairing_request".into()))?;
    Ok(Json(row))
}

pub async fn master_info(State(state): State<LanHttpState>) -> Result<Json<MasterInfo>, ApiError> {
    let signing_key = master_keys::load_or_create()?;
    let master_device_id = app_kv_repo::get(&state.pool, APP_KV_DEVICE_ID_KEY)
        .await?
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".into());
    let master_label = app_kv_repo::get(&state.pool, "lan.host_label.v1")
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "MeDoc Master".to_string());
    Ok(Json(MasterInfo {
        master_device_id,
        master_pubkey: master_keys::pubkey_b64(&signing_key),
        master_label,
        master_version: env!("CARGO_PKG_VERSION").to_string(),
    }))
}

pub async fn pending(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Vec<PairingRequest>>, ApiError> {
    require_ops_system(&claims)?;
    let rows = pairing::list_pending(&state.pool).await?;
    Ok(Json(rows))
}

pub async fn list_all(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
) -> Result<Json<Vec<PairingRequest>>, ApiError> {
    require_ops_system(&claims)?;
    let rows = pairing::list_all(&state.pool).await?;
    Ok(Json(rows))
}

pub async fn decide(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
    Json(body): Json<PairingDecisionBody>,
) -> Result<Json<PairingDecideResult>, ApiError> {
    require_ops_system(&claims)?;
    master_license::require_master_license(&state.pool).await?;
    let master_device_id = master_local_device_id(&state).await?;
    let result = pairing::decide(
        &state.pool,
        &master_device_id,
        &id,
        PairingDecision {
            accept: body.accept,
            allowed_actions: body.allowed_actions,
            decided_by: claims.sub.clone(),
        },
        state.http_port,
    )
    .await?;
    Ok(Json(result))
}

pub async fn confirm(
    State(state): State<LanHttpState>,
    Path(id): Path<String>,
    Json(body): Json<PairingConfirmBody>,
) -> Result<Json<PairingRequest>, ApiError> {
    master_license::require_master_license(&state.pool).await?;
    let master_device_id = master_local_device_id(&state).await?;
    let row = pairing::confirm_pin(
        &state.pool,
        &master_device_id,
        &id,
        &body.pin,
        state.http_port,
    )
    .await?;
    Ok(Json(row))
}

pub async fn revoke(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(device_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    require_ops_system(&claims)?;
    master_license::require_master_license(&state.pool).await?;
    let master_device_id = master_local_device_id(&state).await?;
    pairing::revoke(&state.pool, &master_device_id, &device_id, &claims.sub).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Activation-token-authenticated peer list — replicas use this to learn
/// each other's `device_id` so they can mesh-sync directly.
pub async fn peers(
    State(state): State<LanHttpState>,
    req: axum::extract::Request,
) -> Result<Json<PairingPeerListing>, ApiError> {
    let token = extract_bearer(&req)?;
    let signing_key = master_keys::load_or_create()?;
    let payload = pairing::verify_activation_token(token, &signing_key.verifying_key())?;
    require_action(&payload, "pairing.peers")?;
    // Revocation gate: if THIS node knows `device_id` as a paired slave and
    // its status is REVOKED, reject. If no row exists at all, this is a
    // mesh-peer scenario (sibling replica fetching the peer list against
    // its own master, not us) — fall back to trusting the master signature
    // and baked-in actions. Mirrors `sync_http::verify_activation_for_path`.
    if let Some(req) = pairing::load_by_device(&state.pool, &payload.device_id).await? {
        if req.status == "REVOKED" {
            return Err(AppError::Forbidden.into());
        }
        let live_actions = pairing::slave_actions(&state.pool, &payload.device_id).await?;
        if !live_actions.is_empty() && !live_actions.iter().any(|a| a == "pairing.peers") {
            return Err(AppError::Forbidden.into());
        }
    }
    let master_device_id = master_local_device_id(&state).await?;
    let rows = pairing::list_all(&state.pool).await?;
    let mut peers_list: Vec<PairingPeerEntry> = Vec::new();
    for r in rows {
        if r.status != "ACCEPTED" || r.device_id == payload.device_id {
            continue;
        }
        let peer_base_url = pairing::peer_advertised_url(
            &state.pool,
            &r.device_id,
            &r.requester_ip,
            state.http_port,
        )
        .await?;
        peers_list.push(PairingPeerEntry {
            device_id: r.device_id,
            slave_label: r.slave_label,
            slave_pubkey: r.slave_pubkey,
            peer_base_url,
        });
    }
    let body = serde_json::to_vec(&serde_json::json!({
        "masterDeviceId": master_device_id,
        "peers": peers_list,
    }))
    .map_err(|e| AppError::Internal(format!("peers body: {e}")))?;
    let sig = master_keys::sign(&signing_key, &body);
    Ok(Json(PairingPeerListing {
        master_device_id,
        peers: peers_list,
        signature: sig,
    }))
}

async fn master_local_device_id(state: &LanHttpState) -> Result<String, AppError> {
    let id = app_kv_repo::get(&state.pool, APP_KV_DEVICE_ID_KEY)
        .await?
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "master-local".into());
    Ok(id)
}

fn require_ops_system(claims: &jwt::LanClaims) -> Result<(), AppError> {
    use medoc_core::application::rbac::{self, Role};
    let role = Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    if !rbac::allowed("ops.system", role) {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

fn require_action(payload: &ActivationTokenPayload, action: &str) -> Result<(), AppError> {
    if payload.allowed_actions.iter().any(|a| a == action) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

fn extract_bearer(req: &axum::extract::Request) -> Result<&str, AppError> {
    let raw = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;
    let token = raw
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?
        .trim();
    if !token.starts_with(ACTIVATION_TOKEN_PREFIX) {
        return Err(AppError::Unauthorized);
    }
    Ok(token)
}
