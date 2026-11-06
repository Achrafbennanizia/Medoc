//! Master-side pairing IPC (inbox, decide, revoke).

use medoc_sync::cluster::services::{accept_join_request, list_pending_requests};
use medoc_sync::master_keys;
use medoc_sync::pairing::{self as pairing, PairingDecideResult, PairingDecision, PairingRequest};
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::auth_commands::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError as TauriAppError;

use super::support::{into_tauri, master_local_device_id, require_master_license_cmd};
use super::types::{PairingDecidePayload, PairingMasterInfo};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_list_pending(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PairingRequest>, TauriAppError> {
    require(&session_state, "ops.system")?;
    let mut pending = pairing::list_pending(&pool).await.map_err(into_tauri)?;
    if let Ok(cluster) = list_pending_requests(&pool).await {
        for version in cluster {
            if pending.iter().any(|row| row.id == version.id) {
                continue;
            }
            pending.push(PairingRequest {
                id: version.id,
                device_id: version.fingerprint.clone(),
                slave_pubkey: String::new(),
                slave_label: version
                    .hostname
                    .filter(|h| !h.is_empty())
                    .unwrap_or(version.fingerprint),
                requester_ip: version.ip.unwrap_or_default(),
                status: "PENDING".into(),
                allowed_actions: vec![],
                activation_token: None,
                requested_at: version.created_at,
                decided_at: None,
                decided_by: None,
                awaiting_pin: false,
                transport: "cluster".into(),
                cluster_sas: true,
                coupling_code: None,
            });
        }
    }
    Ok(pending)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_list_all(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PairingRequest>, TauriAppError> {
    require(&session_state, "ops.system")?;
    pairing::list_all(&pool).await.map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_decide(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: PairingDecidePayload,
) -> Result<PairingDecideResult, TauriAppError> {
    let session = require(&session_state, "ops.system")?;
    require_master_license_cmd(&pool)
        .await
        .map_err(into_tauri)?;
    let master_device_id = master_local_device_id(&pool).await.map_err(into_tauri)?;
    if payload.accept {
        let pairing_state: Option<String> = sqlx::query_scalar(
            "SELECT pairing_state FROM pairing_request WHERE id = ?1",
        )
        .bind(&payload.request_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(medoc_core::error::AppError::Database)
        .map_err(into_tauri)?
        .flatten();
        if matches!(
            pairing_state.as_deref(),
            Some("JOIN_REQUESTED" | "AWAITING_SAS" | "SAS_CONFIRMED" | "PROVISIONED" | "ABORTED")
        ) {
            let sas = accept_join_request(
                pool.inner(),
                &session.user_id,
                &payload.request_id,
                &[],
                None,
            )
            .await
            .map_err(into_tauri)?;
            let request = pairing::list_all(pool.inner())
                .await
                .map_err(into_tauri)?
                .into_iter()
                .find(|row| row.id == payload.request_id)
                .ok_or_else(|| {
                    TauriAppError::Internal("pairing request missing after cluster accept".into())
                })?;
            return Ok(PairingDecideResult {
                request,
                confirm_pin: Some(sas.digits),
            });
        }
    }
    pairing::decide(
        &pool,
        &master_device_id,
        &payload.request_id,
        PairingDecision {
            accept: payload.accept,
            allowed_actions: payload.allowed_actions,
            decided_by: session.user_id.clone(),
        },
        pairing::DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_revoke(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    device_id: String,
) -> Result<(), TauriAppError> {
    let session = require(&session_state, "ops.system")?;
    require_master_license_cmd(&pool)
        .await
        .map_err(into_tauri)?;
    let master_device_id = master_local_device_id(&pool).await.map_err(into_tauri)?;
    pairing::revoke(&pool, &master_device_id, &device_id, &session.user_id)
        .await
        .map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_master_info(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<PairingMasterInfo, TauriAppError> {
    require(&session_state, "ops.system")?;
    let sk = master_keys::load_or_create().map_err(into_tauri)?;
    let master_device_id = master_local_device_id(&pool).await.map_err(into_tauri)?;
    Ok(PairingMasterInfo {
        master_device_id,
        master_pubkey: master_keys::pubkey_b64(&sk),
    })
}
