//! This device's own licence, identity and status: the commands every edition needs, also the
//! ones without other devices (`cap-net`). Moved out of `cluster.rs` / `sync.rs`, whose
//! remaining commands talk to other devices.

use medoc_core::infrastructure::install_plan::{InstallPlan, ProvisioningWindowState};
use medoc_sync::cluster::services::{
    activate_cluster_license, apply_install_plan, cluster_status,
    consume_default_sidecar_and_apply, get_provisioning_window, import_owner_activation,
    ApplyInstallPlanResult, ClusterStatus, ImportActivationResult,
};
use medoc_sync::engine::SyncEngine;
use medoc_sync::repo::SyncStatusSnapshot;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::{require, require_authenticated};
use crate::error::AppError;

/// Pre-login onboarding commands (license, install plan) run without a staff
/// session on a fresh install. Once setup is complete they change the
/// device's role / license, so a signed-in `ops.system` user is required —
/// otherwise anyone at a logged-out practice PC could re-role the device.
async fn require_ops_after_onboarding(
    pool: &SqlitePool,
    session_state: &State<'_, SessionState>,
) -> Result<(), AppError> {
    let done = medoc_core::infrastructure::database::repos::admin::app_kv::get(
        pool,
        "onboarding.setup_complete.v1",
    )
    .await
    .ok()
    .flatten()
    .map(|v| {
        let v = v.trim().trim_matches('"');
        !v.is_empty() && v != "0" && v != "false"
    })
    .unwrap_or(false);
    if done {
        require(session_state, "ops.system")?;
    }
    Ok(())
}

pub(crate) fn user_id(session: &SessionState) -> Result<String, AppError> {
    let guard = session.lock_session();
    let (sess, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
    Ok(sess.user_id.clone())
}

#[tauri::command]
pub async fn cluster_status_cmd(pool: State<'_, SqlitePool>) -> Result<ClusterStatus, AppError> {
    cluster_status(&pool).await
}

#[tauri::command]
pub async fn license_activate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    license_key: String,
) -> Result<ClusterStatus, AppError> {
    require_ops_after_onboarding(&pool, &session_state).await?;
    // Pre-login onboarding: no session yet — use bootstrap actor id.
    let uid = user_id(&session_state).unwrap_or_else(|_| "onboarding".into());
    let resolved = crate::commands::network::company_portal::resolve_onboarding_license_key(
        &pool,
        &license_key,
    )
    .await?;
    let status = activate_cluster_license(&pool, &uid, &resolved).await?;
    if status.licensed {
        let rebound = resolved.trim() != license_key.trim();
        if let Some(code) =
            crate::commands::network::company_portal::deployment_code_for_pasted_license(
                &license_key,
                rebound,
            )
        {
            let _ =
                crate::commands::network::company_portal::apply_serverless_role_from_license_code(
                    &pool, &code,
                )
                .await;
        }
        crate::commands::network::company_portal::reset_onboarding_after_owner_license_activation(
            &pool,
        )
        .await?;
    }
    Ok(status)
}

#[tauri::command]
pub async fn import_activation_manifest(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    manifest_path: String,
    passphrase: String,
) -> Result<ImportActivationResult, AppError> {
    let app_dir = crate::commands::app_data_dir(&app)?;
    let summary = import_owner_activation(
        &pool,
        &app_dir,
        "onboarding",
        std::path::Path::new(&manifest_path),
        &passphrase,
    )
    .await?;
    let status = if summary.requires_app_reload {
        let fresh =
            medoc_core::infrastructure::database::connection::reopen_app_pool(&app_dir).await?;
        cluster_status(&fresh).await?
    } else {
        cluster_status(&pool).await?
    };
    Ok(ImportActivationResult {
        status,
        manifest_removed: summary.manifest_removed,
        cluster_id: Some(summary.cluster_id),
        device_fingerprint: Some(summary.device_fingerprint),
        requires_app_reload: summary.requires_app_reload,
        needs_bridge_b_passphrase: summary.needs_bridge_b_passphrase,
    })
}

/// Native file picker for owner activation manifest (pre-login onboarding).
#[tauri::command]
pub async fn pick_activation_manifest_file() -> Result<Option<String>, AppError> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json"])
        .set_file_name("activation.json")
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

/// Apply pending USB sidecar install plan (first boot after USB setup).
#[tauri::command]
pub async fn install_plan_consume_sidecar(
    pool: State<'_, SqlitePool>,
) -> Result<Option<ApplyInstallPlanResult>, AppError> {
    consume_default_sidecar_and_apply(&pool).await
}

/// Apply an explicit install plan (e.g. from onboarding UI).
#[tauri::command]
pub async fn install_plan_apply(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    plan: InstallPlan,
) -> Result<ApplyInstallPlanResult, AppError> {
    require_ops_after_onboarding(&pool, &session_state).await?;
    apply_install_plan(&pool, &plan).await
}

/// Active provisioning window from USB install_plan (pairing / scan / open ports).
#[tauri::command]
pub async fn install_plan_provisioning_status(
    pool: State<'_, SqlitePool>,
) -> Result<Option<ProvisioningWindowState>, AppError> {
    get_provisioning_window(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_get_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<SyncStatusSnapshot, AppError> {
    let session = require_authenticated(&session_state)?;
    let mut snap = SyncEngine::status(&pool).await?;
    let role = crate::application::rbac::Role::parse(&session.role);
    let can_ops = role.is_some_and(|r| {
        crate::application::rbac::effective_allowed("ops.system", r, &session.permission_overrides)
    });
    if !can_ops {
        snap.deployment.activation_token.clear();
        snap.deployment.master_access_token.clear();
        snap.deployment.master_pubkey.clear();
    }
    Ok(snap)
}
