// License & update commands.

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::license::{self, LicenseStatus};
use crate::infrastructure::license_repo;
use crate::infrastructure::perf;
use crate::log_system;
use medoc_sync::cluster::services::ClusterResetMode;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, token))]
pub async fn verify_license(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    token: String,
) -> Result<LicenseStatus, AppError> {
    rbac::require_authenticated(&session_state)?;
    let device_id = license_repo::ensure_device_id(&pool).await?;
    let status = license::verify(&token, &device_id);
    log_system!(
        info,
        event = "LICENSE_CHECK",
        valid = status.valid,
        reason = status.reason.as_deref().unwrap_or(""),
        format = status.format.as_deref().unwrap_or("none"),
    );
    Ok(status)
}

/// Verify the supplied token against the local device id; on success
/// persist it to `app_kv` (`license.v2` or `license.v1` depending on
/// format). Used by the master license-activate view.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, token))]
pub async fn activate_license(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    token: String,
) -> Result<LicenseStatus, AppError> {
    // Bootstrap gate: user is already authenticated; token is vendor-signed + device-bound.
    // Do not require `ops.system` — a broken audit chain would block first-time activation.
    rbac::require_authenticated(&session_state)?;
    let device_id = license_repo::ensure_device_id(&pool).await?;
    let status = license::verify(&token, &device_id);
    if !status.valid {
        log_system!(
            warn,
            event = "LICENSE_ACTIVATE_REJECTED",
            reason = status.reason.as_deref().unwrap_or(""),
        );
        return Ok(status);
    }
    match status.format.as_deref() {
        Some("v2") => license_repo::store_v2(&pool, token.trim()).await?,
        Some("v1") => license_repo::store_v1(&pool, token.trim()).await?,
        _ => {}
    }
    log_system!(
        info,
        event = "LICENSE_ACTIVATED",
        format = status.format.as_deref().unwrap_or(""),
    );
    Ok(status)
}

/// Read the currently-installed license (prefers v2). Returns
/// `valid=false` with a “no license activated” reason when none exists.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn current_license_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<LicenseStatus, AppError> {
    rbac::require_authenticated(&session_state)?;
    license_repo::current_status(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state))]
pub async fn clear_license(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;

    crate::commands::app_lifecycle::stop_network_services(&app).await;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App data directory: {e}")))?;

    medoc_sync::cluster::services::wipe_desktop_network_state(
        &pool,
        &app_data_dir,
        ClusterResetMode::NetworkOnly,
    )
    .await?;

    {
        let mut guard = session_state.lock_session();
        *guard = None;
    }

    log_system!(info, event = "LICENSE_CLEARED");
    crate::commands::app_lifecycle::schedule_app_restart(app);
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn get_perf_threshold_ms(session_state: State<'_, SessionState>) -> Result<u64, AppError> {
    rbac::require(&session_state, "ops.system")?;
    Ok(perf::threshold_ms())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn set_perf_threshold_ms(
    session_state: State<'_, SessionState>,
    ms: u64,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    let ms = ms.max(1);
    perf::set_threshold_ms(ms);
    log_system!(info, event = "PERF_THRESHOLD_CHANGED", ms);
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub channel: String,
    #[serde(default)]
    pub release_notes: String,
    /// `github_releases` | `company_portal` | `none`
    #[serde(default)]
    pub source: String,
}

/// Optionally queries the **vendor portal** or **GitHub Releases** (CI).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn check_for_updates(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<UpdateInfo, AppError> {
    rbac::require_authenticated(&session_state)?;
    let current = env!("CARGO_PKG_VERSION").to_string();
    log_system!(info, event = "UPDATE_CHECK", current_version = %current);

    let cfg =
        crate::infrastructure::company_portal::config::load_company_portal_config(&pool).await;
    if let (Some(_base), true) = (
        crate::infrastructure::company_portal::config::effective_base_url(&cfg),
        !crate::infrastructure::company_portal::config::effective_api_key(&cfg).is_empty()
            && !cfg.practice_slug.trim().is_empty(),
    ) {
        if let Ok(m) =
            crate::infrastructure::company_portal::fetch_update_manifest(&cfg, &current).await
        {
            let latest = m
                .get("latest_version")
                .and_then(|version| version.as_str())
                .unwrap_or(&current)
                .to_string();
            let update_available = m
                .get("update_available")
                .and_then(|version| version.as_bool())
                .unwrap_or(false);
            let channel = m
                .get("channel")
                .and_then(|version| version.as_str())
                .unwrap_or("stable")
                .to_string();
            let release_notes = m
                .get("release_notes")
                .or_else(|| m.get("notes"))
                .and_then(|version| version.as_str())
                .unwrap_or("")
                .to_string();
            return Ok(UpdateInfo {
                current_version: current.clone(),
                latest_version: latest,
                update_available,
                channel,
                release_notes,
                source: "company_portal".into(),
            });
        }
    }

    if let Some(gh) = crate::infrastructure::github_updates::check_github_updates(&pool).await? {
        return Ok(UpdateInfo {
            current_version: gh.current_version,
            latest_version: gh.latest_version,
            update_available: gh.update_available,
            channel: "stable".into(),
            release_notes: gh.release_notes,
            source: "github_releases".into(),
        });
    }

    Ok(UpdateInfo {
        current_version: current.clone(),
        latest_version: current,
        update_available: false,
        channel: "stable".to_string(),
        release_notes: String::new(),
        source: "none".into(),
    })
}

/// Download and install the update published by CI (GitHub Releases + Tauri signer).
#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state))]
pub async fn install_available_update(
    app: tauri::AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    use tauri_plugin_updater::UpdaterExt;

    rbac::require(&session_state, "ops.system")?;
    let token = crate::infrastructure::github_updates::resolve_github_token(&pool).await;
    let mut builder = app.updater_builder();
    if let Some(t) = token {
        builder = builder
            .header("Authorization", format!("Bearer {t}"))
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }
    let checked = builder
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .check()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let Some(update) = checked else {
        return Err(AppError::Validation("No update available".into()));
    };
    update
        .download_and_install(
            |_, _| {},
            || {},
        )
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    log_system!(info, event = "UPDATE_INSTALLED", version = %update.version);
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct HealthCheck {
    pub db_ok: bool,
    pub db_latency_ms: u128,
    pub audit_chain_ok: bool,
    pub audit_broken_at: Option<String>,
    pub log_dir_writable: bool,
    pub version: String,
}

/// Run a self-test over the critical subsystems: database connectivity,
/// audit-chain integrity, log directory writability. Used by the Ops UI
/// and — per ISO 13485 §7.5.1 — service engineers.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn system_health_check(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<HealthCheck, AppError> {
    rbac::require(&session_state, "ops.system")?;

    let t0 = std::time::Instant::now();
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool.inner())
        .await
        .is_ok();
    let db_latency_ms = t0.elapsed().as_millis();

    let audit_broken_at = audit_repo::verify_chain(&pool).await.ok().flatten();
    let audit_chain_ok = audit_broken_at.is_none();

    let log_dir = dirs::home_dir()
        .map(|h| h.join("medoc-data").join("logs"))
        .unwrap_or_else(|| std::path::PathBuf::from("./logs"));
    let log_dir_writable = std::fs::create_dir_all(&log_dir)
        .and_then(|_| {
            let probe = log_dir.join(".health-probe");
            std::fs::write(&probe, b"ok")?;
            std::fs::remove_file(&probe)?;
            Ok(())
        })
        .is_ok();

    log_system!(
        info,
        event = "HEALTH_CHECK",
        db_ok,
        db_latency_ms = db_latency_ms as u64,
        audit_chain_ok,
        log_dir_writable,
    );

    Ok(HealthCheck {
        db_ok,
        db_latency_ms,
        audit_chain_ok,
        audit_broken_at,
        log_dir_writable,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn list_detected_photo_viewer_apps(
    session_state: State<'_, SessionState>,
) -> Result<Vec<crate::infrastructure::photo_viewer_scan::DetectedPhotoViewerApp>, AppError> {
    rbac::require_authenticated(&session_state)?;
    Ok(crate::infrastructure::photo_viewer_scan::detect_photo_viewer_apps())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_system_commands {
    () => {
        $crate::commands::system_commands::verify_license,
        $crate::commands::system_commands::activate_license,
        $crate::commands::system_commands::current_license_status,
        $crate::commands::system_commands::clear_license,
        $crate::commands::system_commands::check_for_updates,
        $crate::commands::system_commands::install_available_update,
        $crate::commands::system_commands::list_detected_photo_viewer_apps,
        $crate::commands::system_commands::system_health_check,
        $crate::commands::system_commands::get_perf_threshold_ms,
        $crate::commands::system_commands::set_perf_threshold_ms,
    };
}
