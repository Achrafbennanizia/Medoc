//! LAN HTTP endpoints for peer replication (`/api/v1/sync/*`).
//!
//! Authentication:
//!
//! - Legacy JWT path is still wired by `http::build_router` (replicas paired
//!   before Slice 4 keep working unchanged).
//! - The new activation-token middleware ([`require_activation_token`])
//!   recognises `Authorization: Bearer mt2.<body>.<sig>` tokens, verifies
//!   the signature against the master's Ed25519 public key, and rejects
//!   pushes whose `from_device_id` does not match the token's `device_id`.

#![allow(clippy::result_large_err)] // axum handlers return `Response` as Err

use std::net::SocketAddr;

use axum::extract::{ConnectInfo, Extension, Path, State};
use axum::body::Bytes;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::pairing::{self, ActivationTokenPayload};
use medoc_sync::repo::{self, OutboxEntry};
use serde::Deserialize;
use serde_json::json;

use super::{ApiError, LanHttpState};
use crate::master_license;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushBody {
    pub from_device_id: String,
    pub entries: Vec<OutboxEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullBody {
    pub device_id: String,
    pub since_seq: i64,
    pub requester_id: Option<String>,
}

fn forbidden(reason: &'static str) -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({
            "error": "forbidden",
            "reason": reason
        })),
    )
        .into_response()
}

pub async fn sync_push(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut req: axum::extract::Request,
) -> Result<Json<medoc_sync::engine::SyncPushResult>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let token_check = req.extensions().get::<ActivationTokenPayload>().cloned();
    let body_bytes =
        match axum::body::to_bytes(std::mem::take(req.body_mut()), 16 * 1024 * 1024).await {
            Ok(b) => b,
            Err(_) => return Err(StatusCode::BAD_REQUEST.into_response()),
        };
    let body: SyncPushBody = match serde_json::from_slice(&body_bytes) {
        Ok(b) => b,
        Err(_) => return Err(StatusCode::BAD_REQUEST.into_response()),
    };
    if let Some(payload) = token_check {
        if payload.device_id != body.from_device_id {
            return Err(forbidden("from_device_mismatch"));
        }
    }
    let result = SyncEngine::ingest_push(&state.pool, &body.from_device_id, &body.entries)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST.into_response())?;
    let _ = repo::touch_replica_seen(
        &state.pool,
        &body.from_device_id,
        &addr.ip().to_string(),
        state.http_port,
    )
    .await;
    Ok(Json(result))
}

pub async fn sync_pull(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Extension(token): Extension<ActivationTokenPayload>,
    Json(body): Json<SyncPullBody>,
) -> Result<Json<serde_json::Value>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    if body.requester_id.as_deref() != Some(token.device_id.as_str()) {
        return Err(forbidden("requester_mismatch"));
    }
    let entries = SyncEngine::collect_pull_for_replica(&state.pool, "", body.since_seq)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST.into_response())?;
    if let Some(ref requester_id) = body.requester_id {
        let _ = repo::touch_replica_seen(
            &state.pool,
            requester_id,
            &addr.ip().to_string(),
            state.http_port,
        )
        .await;
    }
    Ok(Json(serde_json::json!({ "entries": entries })))
}

pub async fn sync_status(
    State(state): State<LanHttpState>,
) -> Result<Json<medoc_sync::repo::SyncStatusSnapshot>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    SyncEngine::status(&state.pool)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Verify an activation token and the requested action against the
/// per-slave allow-list. Used by the LAN JWT middleware to bypass the
/// JWT path when the bearer is `mt2.<…>` (Slice 4).
///
/// BEST-EFFORT scope (Slice "best_effort_rbac"): activation tokens are
/// **only** accepted on the small list of sync-related routes returned by
/// [`action_for_path`]. Any other protected route requires a legacy JWT;
/// replicas presenting an mt2 token to `/patients`, `/me`, etc. get a 403.
pub async fn verify_activation_for_path(
    state: &LanHttpState,
    token: &str,
    path: &str,
    method: &str,
) -> Result<ActivationTokenPayload, Response> {
    let sk = master_keys::load_or_create()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "master key").into_response())?;
    let payload = pairing::verify_activation_token(token, &sk.verifying_key()).map_err(|e| {
        tracing::warn!(
            target: "medoc::lan",
            event = "LAN_MT2_REJECTED",
            path = %path,
            error = %e
        );
        (StatusCode::UNAUTHORIZED, "activation token").into_response()
    })?;
    let action = action_for_path(path, method);
    if action.is_empty() {
        return Err(forbidden("activation_token_route"));
    }
    if !action_granted(&payload.allowed_actions, action) {
        return Err(forbidden("action_not_allowed"));
    }
    // Revocation gate. Three cases must be distinguished:
    //   1. This node is the master of `device_id` and the request is REVOKED → 403.
    //   2. This node is the master of `device_id`, the request is ACCEPTED,
    //      but the action was revoked individually → 403.
    //   3. This node has no `pairing_request` row for `device_id` at all,
    //      which means we are a sibling replica receiving a mesh peer push.
    //      We cannot consult our own `slave_permission` table — we rely
    //      on the master signature already verified above and the
    //      token's baked-in `allowed_actions`. This is the documented
    //      mesh contract (see `medoc-sync::engine::run_mesh_sync`).
    if let Some(req) = pairing::load_by_device(&state.pool, &payload.device_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "pairing lookup").into_response())?
    {
        if req.status != "ACCEPTED" {
            return Err(forbidden("pairing_not_accepted"));
        }
        if req.activation_token.as_deref() != Some(token) {
            return Err(forbidden("activation_token_mismatch"));
        }
        let actions = pairing::slave_actions(&state.pool, &payload.device_id)
            .await
            .unwrap_or_default();
        if !actions.is_empty() && !action_granted(&actions, action) {
            return Err(forbidden("action_revoked"));
        }
    }
    Ok(payload)
}

fn too_many_requests() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(json!({ "error": "reconcile already in progress" })),
    )
        .into_response()
}

pub async fn sync_digest(
    State(state): State<LanHttpState>,
    Extension(token): Extension<ActivationTokenPayload>,
) -> Result<Json<medoc_sync::reconcile::DigestResponse>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let Some(_guard) = medoc_sync::reconcile::ReconcileGuard::acquire(&token.device_id) else {
        return Err(too_many_requests());
    };
    medoc_sync::reconcile::compute_digest(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError(e).into_response())
}

pub async fn sync_row_hashes(
    State(state): State<LanHttpState>,
    Extension(token): Extension<ActivationTokenPayload>,
    Json(body): Json<medoc_sync::reconcile::RowHashesRequest>,
) -> Result<Json<medoc_sync::reconcile::RowHashesBody>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let Some(_guard) = medoc_sync::reconcile::ReconcileGuard::acquire(&token.device_id) else {
        return Err(too_many_requests());
    };
    let rows = medoc_sync::reconcile::compute_row_hashes(&state.pool, &body.buckets)
        .await
        .map_err(|e| ApiError(e).into_response())?;
    Ok(Json(medoc_sync::reconcile::RowHashesBody { rows }))
}

pub async fn sync_rows(
    State(state): State<LanHttpState>,
    Extension(token): Extension<ActivationTokenPayload>,
    Json(body): Json<medoc_sync::reconcile::RowsRequest>,
) -> Result<Json<medoc_sync::reconcile::RowsBody>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let Some(_guard) = medoc_sync::reconcile::ReconcileGuard::acquire(&token.device_id) else {
        return Err(too_many_requests());
    };
    let rows = medoc_sync::reconcile::fetch_rows(&state.pool, &body.ids)
        .await
        .map_err(|e| ApiError(e).into_response())?;
    Ok(Json(medoc_sync::reconcile::RowsBody { rows }))
}

/// Maps a request path to its activation-token action name. Returning
/// `""` means: activation tokens are **not accepted** on this route.
#[derive(Debug, Deserialize)]
pub struct NumberAllocBody {
    prefix: String,
    #[serde(alias = "ymd")]
    date: String,
    #[serde(default)]
    style: Option<String>,
}

pub async fn sync_number(
    State(state): State<LanHttpState>,
    Json(body): Json<NumberAllocBody>,
) -> Result<Json<serde_json::Value>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let style = medoc_core::infrastructure::database::number_sequence::NumberStyle::parse(
        body.style.as_deref(),
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))).into_response())?;
    let number = medoc_core::infrastructure::database::number_sequence::allocate_styled(
        &state.pool,
        &body.prefix,
        &body.date,
        style,
    )
    .await
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response()
    })?;
    Ok(Json(json!({ "number": number })))
}

/// Tokens minted before `sync.number` existed only list `sync.push`; a device
/// allowed to push writes may also allocate document numbers.
fn action_granted(allowed: &[String], action: &str) -> bool {
    allowed.iter().any(|a| a == action)
        || (action == "sync.number" && allowed.iter().any(|a| a == "sync.push"))
}

fn action_for_path(path: &str, method: &str) -> &'static str {
    if path.contains("/sync/blob/") {
        if method.eq_ignore_ascii_case("PUT") {
            "sync.blob.put"
        } else {
            "sync.blob.get"
        }
    } else if path.ends_with("/sync/push") {
        "sync.push"
    } else if path.ends_with("/sync/pull") {
        "sync.pull"
    } else if path.ends_with("/sync/status") {
        "sync.status"
    } else if path.ends_with("/sync/digest")
        || path.ends_with("/sync/row-hashes")
        || path.ends_with("/sync/rows")
    {
        "sync.reconcile"
    } else if path.ends_with("/sync/number") {
        "sync.number"
    } else if path.ends_with("/pairing/peers") {
        "pairing.peers"
    } else {
        ""
    }
}

pub async fn sync_blob_get(
    State(state): State<LanHttpState>,
    Path(sha256): Path<String>,
) -> Result<Vec<u8>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    medoc_core::infrastructure::database::sync_blob::get_bytes(&state.pool, &sha256)
        .await
        .map_err(|e| ApiError(e).into_response())
}

pub async fn sync_blob_put(
    State(state): State<LanHttpState>,
    Path(sha256): Path<String>,
    body: Bytes,
) -> Result<StatusCode, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    if body.len() > 200 * 1024 * 1024 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE.into_response());
    }
    medoc_core::infrastructure::database::sync_blob::put_verified(&state.pool, &sha256, &body)
        .await
        .map_err(|e| ApiError(e).into_response())?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod sync_route_tests {
    use super::action_for_path;

    #[test]
    fn action_for_path_maps_sync_and_pairing_routes() {
        assert_eq!(action_for_path("/api/v1/sync/push", "POST"), "sync.push");
        assert_eq!(action_for_path("/api/v1/sync/pull", "POST"), "sync.pull");
        assert_eq!(action_for_path("/api/v1/sync/status", "GET"), "sync.status");
        assert_eq!(
            action_for_path("/api/v1/sync/digest", "POST"),
            "sync.reconcile"
        );
        assert_eq!(
            action_for_path("/api/v1/sync/row-hashes", "POST"),
            "sync.reconcile"
        );
        assert_eq!(
            action_for_path("/api/v1/sync/rows", "POST"),
            "sync.reconcile"
        );
        assert_eq!(action_for_path("/api/v1/pairing/peers", "GET"), "pairing.peers");
        assert_eq!(
            action_for_path("/api/v1/sync/blob/ab", "PUT"),
            "sync.blob.put"
        );
        assert_eq!(
            action_for_path("/api/v1/sync/blob/ab", "GET"),
            "sync.blob.get"
        );
        assert_eq!(action_for_path("/api/v1/patients", "GET"), "");
        assert_eq!(action_for_path("/api/v1/appointments", "GET"), "");
        assert_eq!(action_for_path("/api/v1/me", "GET"), "");
    }
}
