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

use axum::body::Bytes;
use axum::extract::{ConnectInfo, Extension, Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_sync::deployment::APP_KV_DEVICE_ID_KEY;
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::pairing::{self, ActivationTokenPayload};
use medoc_sync::repo;
use serde::Deserialize;
use serde_json::json;

use super::{ApiError, LanHttpState};
use crate::master_license;

use super::sync_bodies::{sync_error, verify_signed};
pub use super::sync_bodies::{SyncExchangeBody, SyncPullBody, SyncPushBody};

fn forbidden(reason: &'static str) -> Response {
    sync_error(StatusCode::FORBIDDEN, "forbidden", reason)
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
    // The middleware only lets activation tokens through on /sync/*; a push
    // without one would skip the device binding below, so refuse it.
    let Some(token_check) = req.extensions().get::<ActivationTokenPayload>().cloned() else {
        return Err(forbidden("activation_token_required"));
    };
    let body_bytes =
        match axum::body::to_bytes(std::mem::take(req.body_mut()), 16 * 1024 * 1024).await {
            Ok(b) => b,
            Err(_) => {
                return Err(sync_error(
                    StatusCode::BAD_REQUEST,
                    "sync_push_failed",
                    "body",
                ))
            }
        };
    let body: SyncPushBody = match serde_json::from_slice(&body_bytes) {
        Ok(b) => b,
        Err(error) => {
            return Err(sync_error(
                StatusCode::BAD_REQUEST,
                "sync_push_failed",
                error.to_string(),
            ))
        }
    };
    if token_check.device_id != body.from_device_id {
        return Err(forbidden("from_device_mismatch"));
    }
    verify_signed(
        &state.pool,
        &body.from_device_id,
        &body.entries,
        &body.batch,
    )
    .await?;
    let result = SyncEngine::ingest_push(&state.pool, &body.from_device_id, &body.entries)
        .await
        .map_err(|e| {
            tracing::warn!(target: "medoc::lan", event = "LAN_SYNC_PUSH_FAILED", error = %e);
            sync_error(StatusCode::BAD_REQUEST, "sync_push_failed", e.to_string())
        })?;
    if let Err(error) = repo::touch_replica_seen(
        &state.pool,
        &body.from_device_id,
        &addr.ip().to_string(),
        state.http_port,
    )
    .await
    {
        tracing::warn!(
            target: "medoc::lan",
            event = "REPLICA_SEEN_FAILED",
            device_id = %body.from_device_id,
            error = %error
        );
    }
    Ok(Json(result))
}

pub async fn sync_exchange(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut req: axum::extract::Request,
) -> Result<Json<medoc_sync::engine::SyncExchangePage>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let Some(token_check) = req.extensions().get::<ActivationTokenPayload>().cloned() else {
        return Err(forbidden("activation_token_required"));
    };
    let body_bytes =
        match axum::body::to_bytes(std::mem::take(req.body_mut()), 16 * 1024 * 1024).await {
            Ok(b) => b,
            Err(_) => {
                return Err(sync_error(
                    StatusCode::BAD_REQUEST,
                    "sync_exchange_failed",
                    "body",
                ))
            }
        };
    let body: SyncExchangeBody = match serde_json::from_slice(&body_bytes) {
        Ok(b) => b,
        Err(error) => {
            return Err(sync_error(
                StatusCode::BAD_REQUEST,
                "sync_exchange_failed",
                error.to_string(),
            ))
        }
    };
    if token_check.device_id != body.from_device_id {
        return Err(forbidden("from_device_mismatch"));
    }
    verify_signed(
        &state.pool,
        &body.from_device_id,
        &body.packets,
        &body.batch,
    )
    .await?;
    let result = SyncEngine::serve_exchange(
        &state.pool,
        &body.from_device_id,
        &body.packets,
        body.ack_through_seq,
        &body.queues,
    )
    .await
    .map_err(|e| {
        tracing::warn!(target: "medoc::lan", event = "LAN_SYNC_EXCHANGE_FAILED", error = %e);
        sync_error(
            StatusCode::BAD_REQUEST,
            "sync_exchange_failed",
            e.to_string(),
        )
    })?;
    let deployment = medoc_sync::repo::load_deployment(&state.pool)
        .await
        .unwrap_or_default();
    if deployment.role == medoc_sync::deployment::DeviceRole::Master {
        if let Err(error) = repo::touch_replica_seen(
            &state.pool,
            &body.from_device_id,
            &addr.ip().to_string(),
            state.http_port,
        )
        .await
        {
            tracing::warn!(
                target: "medoc::lan",
                event = "REPLICA_SEEN_FAILED",
                device_id = %body.from_device_id,
                error = %error
            );
        }
    }
    Ok(Json(result))
}

pub async fn sync_pull(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Extension(token): Extension<ActivationTokenPayload>,
    Json(body): Json<SyncPullBody>,
) -> Result<Json<medoc_sync::engine::ReplicaPullPage>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    if body.requester_id.as_deref() != Some(token.device_id.as_str()) {
        return Err(forbidden("requester_mismatch"));
    }
    // The requester id is used to throttle full-snapshot requests per device.
    let page = SyncEngine::collect_pull_for_replica(
        &state.pool,
        &token.device_id,
        body.since_seq,
        body.live_since_seq,
    )
    .await
    .map_err(|_| StatusCode::BAD_REQUEST.into_response())?;
    if let Some(ref requester_id) = body.requester_id {
        if let Err(error) = repo::touch_replica_seen(
            &state.pool,
            requester_id,
            &addr.ip().to_string(),
            state.http_port,
        )
        .await
        {
            tracing::warn!(
                target: "medoc::lan",
                event = "REPLICA_SEEN_FAILED",
                device_id = %requester_id,
                error = %error
            );
        }
    }
    Ok(Json(page))
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
    let sk = master_keys::align_to_license(&state.pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "master key").into_response())?;
    let payload = match pairing::verify_activation_token(token, &sk.verifying_key()) {
        Ok(payload) => payload,
        // The main device dials this replica with a token it signed itself:
        // for the exchange, and to fetch attachment bytes the exchange named.
        Err(error)
            if path.ends_with(medoc_sync::paths::SYNC_EXCHANGE)
                || (path.contains(medoc_sync::paths::SYNC_BLOB_PREFIX)
                    && method.eq_ignore_ascii_case("GET")) =>
        {
            match verify_exchange_from_main(state, token).await {
                Ok(payload) => payload,
                Err(response) => {
                    tracing::warn!(
                        target: "medoc::lan",
                        event = "LAN_MT2_REJECTED",
                        path = %path,
                        error = %error
                    );
                    return Err(response);
                }
            }
        }
        Err(error) => {
            tracing::warn!(
                target: "medoc::lan",
                event = "LAN_MT2_REJECTED",
                path = %path,
                error = %error
            );
            return Err((StatusCode::UNAUTHORIZED, "activation token").into_response());
        }
    };
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
    let row = pairing::load_by_device(&state.pool, &payload.device_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "pairing lookup").into_response())?;
    if row.is_none() {
        // Case 3 only applies to tokens another master issued. If this node
        // issued the token (its device id is the token's master), a missing
        // row means the pairing was removed (reset, re-pair): treat as
        // revoked. Without this, a revoked device whose row was deleted kept
        // full sync access forever (tokens carry no expiry).
        let local_id = app_kv_repo::get(&state.pool, APP_KV_DEVICE_ID_KEY)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();
        if !local_id.trim().is_empty() && payload.master_device_id == local_id.trim() {
            return Err(forbidden("pairing_unknown"));
        }
    }
    if let Some(req) = row {
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
    sync_error(
        StatusCode::TOO_MANY_REQUESTS,
        "reconcile already in progress",
        "",
    )
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
    .map_err(|e| sync_error(StatusCode::BAD_REQUEST, e.to_string(), ""))?;
    let number = medoc_core::infrastructure::database::number_sequence::allocate_styled(
        &state.pool,
        &body.prefix,
        &body.date,
        style,
    )
    .await
    .map_err(|e| sync_error(StatusCode::BAD_REQUEST, e.to_string(), ""))?;
    Ok(Json(json!({ "number": number })))
}

/// Tokens minted before `sync.number` existed only list `sync.push`; a device
/// allowed to push writes may also allocate document numbers.
fn action_granted(allowed: &[String], action: &str) -> bool {
    allowed.iter().any(|a| a == action)
        || (action == "sync.number" && allowed.iter().any(|a| a == "sync.push"))
}

/// The main device dials a replica with a token it just signed. The replica
/// does not have the main device's private key, so the local license check
/// fails. Accept the token when it verifies with the paired main public key
/// and names that main device.
async fn verify_exchange_from_main(
    state: &LanHttpState,
    token: &str,
) -> Result<ActivationTokenPayload, Response> {
    let deployment = medoc_sync::repo::load_deployment(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())?;
    if deployment.role != medoc_sync::deployment::DeviceRole::Replica {
        return Err((StatusCode::UNAUTHORIZED, "activation token").into_response());
    }
    let pubkey = deployment.master_pubkey.trim();
    let main_id = deployment.master_device_id.trim();
    if pubkey.is_empty() || main_id.is_empty() {
        return Err((StatusCode::UNAUTHORIZED, "activation token").into_response());
    }
    let key = master_keys::parse_pubkey_b64(pubkey)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "activation token").into_response())?;
    let payload = pairing::verify_activation_token(token, &key)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "activation token").into_response())?;
    if payload.device_id.trim() != main_id || payload.master_device_id.trim() != main_id {
        return Err(forbidden("from_device_mismatch"));
    }
    Ok(payload)
}

fn action_for_path(path: &str, method: &str) -> &'static str {
    use medoc_sync::paths::{
        SYNC_BLOB_PREFIX, SYNC_DIGEST, SYNC_EXCHANGE, SYNC_NUMBER, SYNC_PULL, SYNC_PUSH, SYNC_ROWS,
        SYNC_ROW_HASHES, SYNC_STATUS,
    };
    if path.ends_with(SYNC_EXCHANGE) {
        // Same grant as a push: a paired device may hand its queue over and
        // take the other device's queue back.
        "sync.push"
    } else if path.contains(SYNC_BLOB_PREFIX) {
        if method.eq_ignore_ascii_case("PUT") {
            "sync.blob.put"
        } else {
            "sync.blob.get"
        }
    } else if path.ends_with(SYNC_PUSH) {
        "sync.push"
    } else if path.ends_with(SYNC_PULL) {
        "sync.pull"
    } else if path.ends_with(SYNC_STATUS) {
        "sync.status"
    } else if path.ends_with(SYNC_DIGEST)
        || path.ends_with(SYNC_ROW_HASHES)
        || path.ends_with(SYNC_ROWS)
    {
        "sync.reconcile"
    } else if path.ends_with(SYNC_NUMBER) {
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
        assert_eq!(
            action_for_path("/api/v1/sync/exchange", "POST"),
            "sync.push"
        );
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
        assert_eq!(
            action_for_path("/api/v1/pairing/peers", "GET"),
            "pairing.peers"
        );
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
