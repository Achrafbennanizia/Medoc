//! Update rollout on this computer (T7.6, docs/architecture/editions-plan.md §11.6).
//!
//! The admin installs a feature update now or schedules it after hours; a security update schedules
//! itself after hours. Either way a backup is taken right before installing. A sync round cut short
//! by the restart loses nothing: entries stay pending until confirmed and receivers drop duplicates.
//! Every step is audited and shown in Settings → About.

use medoc_core::application::update_rollout::{self as rollout, BusyWeek, Choice, Plan, Scheduled};
use medoc_core::infrastructure::{backup, update_manifest};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, State};

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::github_updates as gh;

const SCHEDULE_KV: &str = "updates.scheduled.v1";
const LAST_KV: &str = "updates.last_result.v1";

async fn busy_week(pool: &SqlitePool) -> BusyWeek {
    app_kv_repo::get(pool, "practice.work_hours.v1")
        .await
        .ok()
        .flatten()
        .map(|raw| BusyWeek::from_work_hours(&raw))
        .unwrap_or_default()
}

async fn scheduled(pool: &SqlitePool) -> Option<Scheduled> {
    app_kv_repo::get(pool, SCHEDULE_KV)
        .await
        .ok()
        .flatten()
        .and_then(|raw| serde_json::from_str(&raw).ok())
}

async fn audit(pool: &SqlitePool, by: &str, action: &str, details: serde_json::Value) {
    let _ = audit_repo::create(pool, by, action, "update", None, Some(&details.to_string())).await;
}

/// Backup, then download and install this build's signed update.
pub async fn install_now(app: &AppHandle, pool: &SqlitePool, by: &str) -> Result<(), AppError> {
    use tauri_plugin_updater::UpdaterExt;

    let token = gh::resolve_github_token(pool).await;
    let mut builder = app.updater_builder();
    // This build's own signed manifest (T7.5), not the generic endpoint in tauri.conf.json.
    if let Some(repo) = gh::configured_repo() {
        let url = gh::manifest_url(repo, gh::channel(pool).await)
            .parse()
            .map_err(|e| AppError::Internal(format!("update URL: {e}")))?;
        builder = builder
            .endpoints(vec![url])
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }
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
    // Tauri checks the package signature; the vendor signature says what the package is for.
    let block = gh::verify_manifest(&update.raw_json)?;
    if !update_manifest::installable(&block, env!("CARGO_PKG_VERSION")) {
        return Err(AppError::Validation(
            "This update cannot be installed on this version".into(),
        ));
    }
    let app_dir = crate::commands::app_data_dir(app)?;
    let backup_path = {
        let _guard = backup::begin_operation()?;
        backup::create_compressed(pool, &app_dir).await?
    };
    audit(
        pool,
        by,
        "UPDATE_INSTALL_STARTED",
        serde_json::json!({ "version": block.version, "kind": block.kind, "backup": backup_path.display().to_string() }),
    )
    .await;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let _ = app_kv_repo::delete(pool, SCHEDULE_KV).await;
    let last = serde_json::json!({ "version": block.version, "kind": block.kind, "at": chrono::Local::now().to_rfc3339() });
    let _ = app_kv_repo::set(pool, LAST_KV, &last.to_string()).await;
    audit(pool, by, "UPDATE_INSTALLED", last).await;
    tracing::info!(target: "medoc::system", event = "UPDATE_INSTALLED", version = %block.version);
    Ok(())
}

/// What Settings → About shows: the scheduled install and the last one.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RolloutState {
    pub scheduled: Option<Scheduled>,
    pub last: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn update_rollout_state(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<RolloutState, AppError> {
    require(&session_state, "ops.system")?;
    let last = app_kv_repo::get(&pool, LAST_KV)
        .await?
        .and_then(|raw| serde_json::from_str(&raw).ok());
    Ok(RolloutState {
        scheduled: scheduled(&pool).await,
        last,
    })
}

/// The admin's choice for the available update: `now` installs, `after_hours` schedules.
#[tauri::command]
pub async fn update_schedule(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    choice: Choice,
) -> Result<Option<Scheduled>, AppError> {
    let session = require(&session_state, "ops.system")?;
    let Some(check) = gh::check_github_updates(&pool).await? else {
        return Err(AppError::Validation("No update available".into()));
    };
    let Some(block) = check.block.filter(|_| check.update_available) else {
        return Err(AppError::Validation("No update available".into()));
    };
    match rollout::plan(
        block.kind,
        Some(choice),
        &busy_week(&pool).await,
        chrono::Local::now(),
    ) {
        Plan::InstallNow => {
            install_now(&app, &pool, &session.user_id).await?;
            Ok(None)
        }
        Plan::InstallAt(at) => {
            let s = Scheduled {
                version: block.version,
                kind: block.kind,
                at,
            };
            let raw = serde_json::to_string(&s).map_err(|e| AppError::Internal(e.to_string()))?;
            app_kv_repo::set(&pool, SCHEDULE_KV, &raw).await?;
            audit(
                &pool,
                &session.user_id,
                "UPDATE_SCHEDULED",
                serde_json::json!(s),
            )
            .await;
            Ok(Some(s))
        }
        Plan::WaitForAdmin => Ok(None),
    }
}

#[tauri::command]
pub async fn update_schedule_cancel(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    let session = require(&session_state, "ops.system")?;
    app_kv_repo::delete(&pool, SCHEDULE_KV).await?;
    audit(
        &pool,
        &session.user_id,
        "UPDATE_SCHEDULE_CANCELLED",
        serde_json::json!({}),
    )
    .await;
    Ok(())
}

/// Background check (every 30 minutes): schedules a security update after hours, and installs a
/// scheduled update once it is due. Only on the main computer of the practice (replicas follow the
/// main one, T7.7).
pub async fn tick(app: &AppHandle) {
    if medoc_core::domain::device::FLAVOR.wire() != "main" {
        return;
    }
    let Some(pool) = app.try_state::<SqlitePool>().map(|p| p.inner().clone()) else {
        return;
    };
    let week = busy_week(&pool).await;
    let now = chrono::Local::now();
    if scheduled(&pool).await.is_none() {
        let Ok(Some(check)) = gh::check_github_updates(&pool).await else {
            return;
        };
        let Some(block) = check.block.filter(|_| check.update_available) else {
            return;
        };
        if let Plan::InstallAt(at) = rollout::plan(block.kind, None, &week, now) {
            let s = Scheduled {
                version: block.version,
                kind: block.kind,
                at,
            };
            if let Ok(raw) = serde_json::to_string(&s) {
                let _ = app_kv_repo::set(&pool, SCHEDULE_KV, &raw).await;
                audit(&pool, "system", "UPDATE_SCHEDULED", serde_json::json!(s)).await;
            }
        }
        return;
    }
    let Some(s) = scheduled(&pool).await else {
        return;
    };
    if !rollout::due(&s, &week, now) {
        return;
    }
    if let Err(e) = install_now(app, &pool, "system").await {
        tracing::warn!(target: "medoc::system", event = "UPDATE_INSTALL_DEFERRED", version = %s.version, error = %e);
        audit(
            &pool,
            "system",
            "UPDATE_INSTALL_DEFERRED",
            serde_json::json!({ "version": s.version, "error": e.wire_code() }),
        )
        .await;
    }
}
