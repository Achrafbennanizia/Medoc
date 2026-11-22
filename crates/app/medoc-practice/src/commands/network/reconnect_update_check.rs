//! Update check when the link to the main device comes back.
//!
//! While offline every change waits in `sync_outbox`. The first successful contact after an
//! offline period (or after start) runs one full update check instead of waiting for the next
//! tick or the hourly digest:
//!
//! 1. push every queued change (signed on send, `medoc_sync::entry_signature`) and pull until
//!    nothing is left (`run_replica_sync_until_caught_up`);
//! 2. compare row digests with the main device (`reconcile::run_now`), which repairs any row
//!    that still differs, so no update stays lost after a crash or a missed hook;
//! 3. record the outcome in `sync.update_check.last.v1` (device-local, never replicated).

use std::sync::atomic::{AtomicBool, Ordering};

use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_sync::engine::SyncEngine;
use medoc_sync::reconcile;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

pub const LAST_UPDATE_CHECK_KV: &str = "sync.update_check.last.v1";

/// Starts `true`: the first contact after the app starts also runs the check.
static OFFLINE: AtomicBool = AtomicBool::new(true);
static RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckReport {
    pub at: String,
    pub pushed: u32,
    pub pulled: u32,
    pub repaired: u32,
    pub complete: bool,
    pub error: Option<String>,
}

/// Call after every sync attempt. A success that follows an offline period starts the check.
pub fn note_link(pool: &SqlitePool, connected: bool) {
    drain_spool_in_background(pool);
    if !connected {
        OFFLINE.store(true, Ordering::SeqCst);
        return;
    }
    if !OFFLINE.swap(false, Ordering::SeqCst) || RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let pool = pool.clone();
    tauri::async_runtime::spawn(async move {
        let report = run_update_check(&pool).await;
        if report.error.is_some() {
            // Not finished: try again on the next successful contact.
            OFFLINE.store(true, Ordering::SeqCst);
        }
        RUNNING.store(false, Ordering::SeqCst);
    });
}

/// At start, before the first sync: restore what a crash or power cut left in the queue files.
pub async fn recover_queues(pool: &SqlitePool) {
    if let Err(e) = medoc_sync::durable_queue::recover(pool).await {
        tracing::warn!(target: "medoc::sync", event = "SYNC_QUEUE_RECOVER_FAILED", error = %e);
    }
}

/// Changes the outbox could not take wait in the spool file; move them in on every cycle.
fn drain_spool_in_background(pool: &SqlitePool) {
    static DRAINING: AtomicBool = AtomicBool::new(false);
    if DRAINING.swap(true, Ordering::SeqCst) {
        return;
    }
    let pool = pool.clone();
    tauri::async_runtime::spawn(async move {
        let _ = medoc_sync::durable_queue::drain_spool(&pool).await;
        DRAINING.store(false, Ordering::SeqCst);
    });
}

pub async fn run_update_check(pool: &SqlitePool) -> UpdateCheckReport {
    let mut report = UpdateCheckReport {
        at: chrono::Utc::now().to_rfc3339(),
        ..Default::default()
    };
    match SyncEngine::run_replica_sync_until_caught_up(pool).await {
        Ok(run) => {
            report.pushed = run.push.as_ref().map(|p| p.accepted).unwrap_or(0);
            report.pulled = run.pull.as_ref().map(|p| p.applied).unwrap_or(0);
            report.error = run.error;
        }
        Err(e) => report.error = Some(e.to_string()),
    }
    if report.error.is_none() {
        match reconcile::run_now(pool).await {
            Ok(r) => {
                report.repaired = r.applied.saturating_add(r.queued);
                report.error = r.error;
            }
            Err(e) => report.error = Some(e.to_string()),
        }
    }
    report.complete = report.error.is_none();
    tracing::info!(
        target: "medoc::sync",
        event = "SYNC_UPDATE_CHECK",
        pushed = report.pushed,
        pulled = report.pulled,
        repaired = report.repaired,
        complete = report.complete,
        error = report.error.as_deref().unwrap_or("")
    );
    if let Ok(json) = serde_json::to_string(&report) {
        let _ = app_kv_repo::set(pool, LAST_UPDATE_CHECK_KV, &json).await;
    }
    report
}

/// Last update check of this device (`None` before the first one).
pub async fn last_update_check(pool: &SqlitePool) -> Option<UpdateCheckReport> {
    let raw = app_kv_repo::get(pool, LAST_UPDATE_CHECK_KV)
        .await
        .ok()
        .flatten()?;
    serde_json::from_str(&raw).ok()
}

/// Last update check of this device, for the sync status in Settings.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_last_update_check(
    pool: tauri::State<'_, SqlitePool>,
    session_state: tauri::State<'_, crate::commands::admin::auth::SessionState>,
) -> Result<Option<UpdateCheckReport>, crate::error::AppError> {
    crate::commands::rbac_state::require_authenticated(&session_state)?;
    Ok(last_update_check(&pool).await)
}
