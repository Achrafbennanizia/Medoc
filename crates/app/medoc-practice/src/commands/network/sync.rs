//! Peer replication controls (serverless mode).

use medoc_sync::deployment::SyncDeploymentConfig;
use medoc_sync::engine::{SyncEngine, SyncRunReport};
use medoc_sync::repo::SyncStatusSnapshot;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::auth_commands::SessionState;
use crate::commands::rbac_state::{require, require_authenticated};
use crate::error::AppError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSetDeploymentPayload {
    pub deployment: SyncDeploymentConfig,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_get_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<SyncStatusSnapshot, AppError> {
    require_authenticated(&session_state)?;
    SyncEngine::status(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_set_deployment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: SyncSetDeploymentPayload,
) -> Result<(), AppError> {
    require(&session_state, "ops.system")?;
    SyncEngine::set_deployment(&pool, payload.deployment).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_run_now(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<SyncRunReport, AppError> {
    require_authenticated(&session_state)?;
    let snap = SyncEngine::status(&pool).await?;
    let is_replica = snap.deployment.mode == medoc_sync::deployment::DeploymentMode::ServerlessPeer
        && snap.deployment.role == medoc_sync::deployment::DeviceRole::Replica;
    if !is_replica {
        require(&session_state, "ops.system")?;
    }
    SyncEngine::run_replica_sync(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_record_change(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    entity_table: String,
    entity_id: String,
    op: String,
    payload_json: String,
) -> Result<(), AppError> {
    require(&session_state, "ops.system")?;
    let snap = SyncEngine::status(&pool).await?;
    if snap.deployment.mode != medoc_sync::deployment::DeploymentMode::ServerlessPeer {
        return Ok(());
    }
    medoc_sync::repo::append_outbox(
        &pool,
        &snap.local_device_id,
        &entity_table,
        &entity_id,
        &op,
        &payload_json,
    )
    .await?;
    Ok(())
}
