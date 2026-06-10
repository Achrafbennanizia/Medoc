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

use std::net::SocketAddr;

use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::pairing::{self, ActivationTokenPayload};
use medoc_sync::repo::{self, OutboxEntry};
use serde::Deserialize;

use super::LanHttpState;
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
    #[allow(dead_code)]
    pub requester_id: Option<String>,
}

pub async fn sync_push(
    State(state): State<LanHttpState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    mut req: axum::extract::Request,
) -> Result<Json<medoc_sync::engine::SyncPushResult>, StatusCode> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let token_check = req.extensions().get::<ActivationTokenPayload>().cloned();
    let body_bytes =
        match axum::body::to_bytes(std::mem::take(req.body_mut()), 16 * 1024 * 1024).await {
            Ok(b) => b,
            Err(_) => return Err(StatusCode::BAD_REQUEST),
        };
    let body: SyncPushBody = match serde_json::from_slice(&body_bytes) {
        Ok(b) => b,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };
    if let Some(payload) = token_check {
        if payload.device_id != body.from_device_id {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    let result = SyncEngine::ingest_push(&state.pool, &body.from_device_id, &body.entries)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
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
    Json(body): Json<SyncPullBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let entries = SyncEngine::collect_pull(&state.pool, &body.device_id, body.since_seq)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(Json(serde_json::json!({ "entries": entries })))
}

pub async fn sync_status(
    State(state): State<LanHttpState>,
) -> Result<Json<medoc_sync::repo::SyncStatusSnapshot>, StatusCode> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(StatusCode::FORBIDDEN);
    }
    SyncEngine::status(&state.pool)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

/// Verify an activation token and the requested action against the
/// per-slave allow-list. Used by the LAN JWT middleware to bypass the
/// JWT path when the bearer is `mt2.<…>` (Slice 4).
///
/// BEST-EFFORT scope (Slice "best_effort_rbac"): activation tokens are
/// **only** accepted on the small list of sync-related routes returned by
/// [`action_for_path`]. Any other protected route requires a legacy JWT;
/// replicas presenting an mt2 token to `/patienten`, `/me`, etc. get a 403.
pub async fn verify_activation_for_path(
    state: &LanHttpState,
    token: &str,
    path: &str,
) -> Result<ActivationTokenPayload, Response> {
    let sk = master_keys::load_or_create()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "master key").into_response())?;
    let payload = pairing::verify_activation_token(token, &sk.verifying_key())
        .map_err(|_| (StatusCode::UNAUTHORIZED, "activation token").into_response())?;
    let action = action_for_path(path);
    if action.is_empty() {
        return Err((
            StatusCode::FORBIDDEN,
            "activation token not accepted on this route",
        )
            .into_response());
    }
    if !payload.allowed_actions.iter().any(|a| a == action) {
        return Err((StatusCode::FORBIDDEN, "action not allowed").into_response());
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
        if req.status == "REVOKED" {
            return Err((StatusCode::FORBIDDEN, "slave revoked").into_response());
        }
        let actions = pairing::slave_actions(&state.pool, &payload.device_id)
            .await
            .unwrap_or_default();
        if !actions.is_empty() && !actions.iter().any(|a| a == action) {
            return Err((StatusCode::FORBIDDEN, "action revoked").into_response());
        }
    }
    Ok(payload)
}

/// Maps a request path to its activation-token action name. Returning
/// `""` means: activation tokens are **not accepted** on this route.
fn action_for_path(path: &str) -> &'static str {
    if path.ends_with("/sync/push") {
        "sync.push"
    } else if path.ends_with("/sync/pull") {
        "sync.pull"
    } else if path.ends_with("/sync/status") {
        "sync.status"
    } else if path.ends_with("/pairing/peers") {
        "pairing.peers"
    } else if path.ends_with("/patienten") {
        "patient.read"
    } else if path.ends_with("/termine") {
        "termin.read"
    } else {
        ""
    }
}

#[cfg(test)]
mod sync_route_tests {
    use super::action_for_path;

    #[test]
    fn action_for_path_maps_sync_and_pairing_routes() {
        assert_eq!(action_for_path("/api/v1/sync/push"), "sync.push");
        assert_eq!(action_for_path("/api/v1/sync/pull"), "sync.pull");
        assert_eq!(action_for_path("/api/v1/sync/status"), "sync.status");
        assert_eq!(action_for_path("/api/v1/pairing/peers"), "pairing.peers");
        assert_eq!(action_for_path("/api/v1/patienten"), "patient.read");
        assert_eq!(action_for_path("/api/v1/termine"), "termin.read");
        assert_eq!(action_for_path("/api/v1/me"), "");
    }
}
