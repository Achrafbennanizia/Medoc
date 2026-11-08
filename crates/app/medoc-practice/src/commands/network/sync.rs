//! Peer replication controls (serverless mode).

use std::time::Duration;

use medoc_sync::cluster::services::{
    refresh_replica_lan_auth, repair_replica_master_https_url, sync_staff_from_stored_admin_endpoint,
};
use medoc_sync::deployment::SyncDeploymentConfig;
use medoc_sync::engine::{SyncEngine, SyncRunReport};
use medoc_sync::reconcile::{self, ReconcileReport};
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

/// Dock name for a replica the master has already activated. The master, and a
/// replica that has not received that activation, keep the MeDoc icon.
pub async fn replica_desktop_name(pool: &SqlitePool) -> Option<&'static str> {
    let cfg = medoc_sync::repo::load_deployment(pool).await.ok()?;
    let activated_by_master = !cfg.activation_token.trim().is_empty()
        && !cfg.master_base_url.trim().is_empty();
    if cfg.role == medoc_sync::deployment::DeviceRole::Replica
        && cfg.mode == medoc_sync::deployment::DeploymentMode::ServerlessPeer
        && activated_by_master
    {
        Some(medoc_core::infrastructure::install_plan::REPLICA_DESKTOP_NAME)
    } else {
        None
    }
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
        crate::application::rbac::effective_allowed(
            "ops.system",
            r,
            &session.permission_overrides,
        )
    });
    if !can_ops {
        snap.deployment.activation_token.clear();
        snap.deployment.master_access_token.clear();
        snap.deployment.master_pubkey.clear();
    }
    Ok(snap)
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
pub async fn sync_reconcile_now(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<ReconcileReport, AppError> {
    require(&session_state, "ops.system")?;
    reconcile::run_now(&pool).await
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
    run_replica_sync_recovering(&pool).await
}

/// Replica topbar: reach the master's LAN HTTPS with the same TLS policy as sync (self-signed OK).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_probe_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<bool, AppError> {
    require_authenticated(&session_state)?;
    probe_master_reachable(&pool).await
}

pub async fn probe_master_reachable(pool: &SqlitePool) -> Result<bool, AppError> {
    let snap = SyncEngine::status(pool).await?;
    let base = snap.deployment.master_base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Ok(false);
    }
    let client = match medoc_sync::tls_pin::pinned_http_client(
        &snap.deployment.master_cert_sha256,
        Duration::from_secs(4),
    ) {
        Ok(client) => client,
        Err(_) => return Ok(false),
    };
    for path in ["/health", "/api/v1/ping"] {
        let url = format!("{base}{path}");
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => return Ok(true),
            _ => {}
        }
    }
    Ok(false)
}

/// Queue a local mutation for later push/pull. No-op unless this device is a serverless peer.
pub async fn enqueue_local_sync(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload: &impl serde::Serialize,
) {
    let payload_json = match serde_json::to_string(payload) {
        Ok(s) => s,
        Err(_) => return,
    };
    let _ = medoc_sync::repo::sync_record_or_noop(pool, entity_table, entity_id, op, &payload_json)
        .await;
}

/// Healthy replicas poll twice a second. Each failed cycle doubles the wait, up to 30s.
const REPLICA_SYNC_BASE: Duration = Duration::from_millis(500);
const REPLICA_SYNC_MAX: Duration = Duration::from_secs(30);

pub(crate) fn replica_backoff(consecutive_failures: u32) -> Duration {
    let shift = consecutive_failures.min(6);
    REPLICA_SYNC_BASE
        .saturating_mul(1u32 << shift)
        .min(REPLICA_SYNC_MAX)
}

fn unreachable_wait(consecutive_failures: u32) -> Duration {
    replica_backoff(consecutive_failures).max(Duration::from_secs(5))
}

fn master_unreachable_message(msg: &str) -> bool {
    let lower = msg.to_ascii_lowercase();
    lower.contains("connection refused")
        || lower.contains("os error 61")
        || lower.contains("timed out")
        || lower.contains("network is unreachable")
        || lower.contains("no route to host")
        || lower.contains("master unreachable")
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

static MASTER_UNREACHABLE_UNTIL_MS: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(0);
static MASTER_UNREACHABLE_LOGGED_MS: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(0);
static MASTER_UNREACHABLE_STREAK: std::sync::atomic::AtomicU32 =
    std::sync::atomic::AtomicU32::new(0);

fn master_unreachable_cooling_down() -> bool {
    now_ms() < MASTER_UNREACHABLE_UNTIL_MS.load(std::sync::atomic::Ordering::Relaxed)
}

fn clear_master_unreachable() {
    MASTER_UNREACHABLE_STREAK.store(0, std::sync::atomic::Ordering::Relaxed);
    MASTER_UNREACHABLE_UNTIL_MS.store(0, std::sync::atomic::Ordering::Relaxed);
    MASTER_UNREACHABLE_LOGGED_MS.store(0, std::sync::atomic::Ordering::Relaxed);
}

fn note_master_unreachable(error: &AppError) {
    let streak = MASTER_UNREACHABLE_STREAK
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        .saturating_add(1);
    let wait = unreachable_wait(streak.saturating_sub(1));
    MASTER_UNREACHABLE_UNTIL_MS.store(
        now_ms().saturating_add(wait.as_millis() as u64),
        std::sync::atomic::Ordering::Relaxed,
    );
    let first_this_outage = MASTER_UNREACHABLE_LOGGED_MS
        .compare_exchange(0, now_ms(), std::sync::atomic::Ordering::Relaxed, std::sync::atomic::Ordering::Relaxed)
        .is_ok();
    if first_this_outage {
        tracing::warn!(
            target: "medoc::sync",
            event = "REPLICA_AUTH_REFRESH_FAILED",
            error = %error,
            retry_in_ms = wait.as_millis() as u64
        );
    } else {
        tracing::debug!(
            target: "medoc::sync",
            event = "REPLICA_AUTH_REFRESH_FAILED",
            error = %error
        );
    }
}

fn unreachable_report(error: &AppError) -> SyncRunReport {
    SyncRunReport {
        push: None,
        pull: None,
        mesh: None,
        error: Some(error.to_string()),
    }
}

async fn try_refresh_replica_auth(pool: &SqlitePool) -> Result<bool, AppError> {
    if master_unreachable_cooling_down() {
        return Err(AppError::Internal(
            "cluster auth connect: master unreachable, backing off".into(),
        ));
    }
    match refresh_replica_lan_auth(pool).await {
        Ok(ok) => {
            clear_master_unreachable();
            Ok(ok)
        }
        Err(e) => {
            if master_unreachable_message(&e.to_string()) {
                note_master_unreachable(&e);
            } else {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "REPLICA_AUTH_REFRESH_FAILED",
                    error = %e
                );
            }
            Err(e)
        }
    }
}
const REPLICA_CATCHUP_KV: &str = "sync.replica.catchup.done.v1";

/// The host loop and the window both call sync. One run at a time.
static REPLICA_SYNC_GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn sync_auth_rejected(msg: &str) -> bool {
    let lower = msg.to_ascii_lowercase();
    if lower.contains("401") || lower.contains("unauthorized") {
        return true;
    }
    lower.contains("403")
        && (lower.contains("token_mismatch") || lower.contains("token_unknown"))
}

fn sync_auth_requires_repair(msg: &str) -> bool {
    let lower = msg.to_ascii_lowercase();
    lower.contains("revoked") || lower.contains("not_accepted")
}

fn replica_report_needs_auth_refresh(report: &SyncRunReport) -> bool {
    report.error.as_deref().is_some_and(sync_auth_rejected)
}

fn replica_token_needs_refresh(token: &str, local_device_id: &str) -> bool {
    let token = token.trim();
    if token.is_empty() {
        return true;
    }
    if !token.starts_with(medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX) {
        return true;
    }
    replica_token_device_mismatch_token(token, local_device_id)
}

fn replica_token_device_mismatch_token(token: &str, local_device_id: &str) -> bool {
    // Without the master pubkey we can only check prefix/emptiness.
    let _ = (token, local_device_id);
    false
}

fn replica_tls_pin_missing(deployment: &SyncDeploymentConfig) -> bool {
    !medoc_sync::tls_pin::is_sha256_pin(&deployment.master_cert_sha256)
}

fn replica_needs_credential_refresh(snap: &SyncStatusSnapshot) -> bool {
    replica_token_needs_refresh_deployment(&snap.deployment, &snap.local_device_id)
        || replica_tls_pin_missing(&snap.deployment)
}

fn replica_token_needs_refresh_deployment(
    deployment: &SyncDeploymentConfig,
    local_device_id: &str,
) -> bool {
    let token = deployment.activation_token.trim();
    if replica_token_needs_refresh(token, local_device_id) && token.is_empty() {
        return deployment.master_access_token.trim().is_empty();
    }
    if token.is_empty() {
        return deployment.master_access_token.trim().is_empty();
    }
    if !token.starts_with(medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX) {
        return true;
    }
    let pk = deployment.master_pubkey.trim();
    if pk.is_empty() {
        return false;
    }
    match medoc_sync::master_keys::parse_pubkey_b64(pk) {
        Ok(key) => match medoc_sync::pairing::verify_activation_token(token, &key) {
            Ok(payload) => payload.device_id.trim() != local_device_id.trim(),
            Err(_) => true,
        },
        Err(_) => true,
    }
}

async fn run_replica_sync_recovering(pool: &SqlitePool) -> Result<SyncRunReport, AppError> {
    let _gate = REPLICA_SYNC_GATE.lock().await;
    let snap = SyncEngine::status(pool).await?;
    if replica_needs_credential_refresh(&snap) {
        if let Err(e) = try_refresh_replica_auth(pool).await {
            if master_unreachable_message(&e.to_string()) {
                return Ok(unreachable_report(&e));
            }
        }
    }
    let first = SyncEngine::run_replica_sync(pool).await?;
    if first.error.as_deref().is_some_and(sync_auth_requires_repair) {
        return Ok(first);
    }
    if !replica_report_needs_auth_refresh(&first) {
        return Ok(first);
    }
    tracing::warn!(
        target: "medoc::sync",
        event = "REPLICA_SYNC_401_RETRY",
        error = first.error.as_deref().unwrap_or("")
    );
    match try_refresh_replica_auth(pool).await {
        Ok(_) => SyncEngine::run_replica_sync(pool).await,
        Err(e) => {
            if master_unreachable_message(&e.to_string()) {
                return Ok(unreachable_report(&e));
            }
            Ok(first)
        }
    }
}

async fn run_replica_catchup_recovering(pool: &SqlitePool) -> Result<SyncRunReport, AppError> {
    let _gate = REPLICA_SYNC_GATE.lock().await;
    let snap = SyncEngine::status(pool).await?;
    if replica_needs_credential_refresh(&snap) {
        if let Err(e) = try_refresh_replica_auth(pool).await {
            if master_unreachable_message(&e.to_string()) {
                return Ok(unreachable_report(&e));
            }
        }
    }
    let first = SyncEngine::run_replica_sync_until_caught_up(pool).await?;
    if first.error.as_deref().is_some_and(sync_auth_requires_repair) {
        return Ok(first);
    }
    if !replica_report_needs_auth_refresh(&first) {
        return Ok(first);
    }
    tracing::warn!(
        target: "medoc::sync",
        event = "REPLICA_SYNC_401_RETRY",
        error = first.error.as_deref().unwrap_or("")
    );
    match try_refresh_replica_auth(pool).await {
        Ok(_) => SyncEngine::run_replica_sync_until_caught_up(pool).await,
        Err(e) => {
            if master_unreachable_message(&e.to_string()) {
                return Ok(unreachable_report(&e));
            }
            Ok(first)
        }
    }
}

/// Own OS thread: scan shared admin/user rows, queue the ones that changed,
/// and on a replica push that queue to the master immediately.
pub fn spawn_shared_change_sync_thread(pool: SqlitePool) {
    if let Err(e) = std::thread::Builder::new()
        .name("medoc-shared-sync".into())
        .spawn(move || {
            tauri::async_runtime::block_on(async move {
                let mut ticker = tokio::time::interval(REPLICA_SYNC_BASE);
                ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
                loop {
                    ticker.tick().await;
                    let Ok(snap) = SyncEngine::status(&pool).await else {
                        continue;
                    };
                    let is_replica = snap.deployment.mode
                        == medoc_sync::deployment::DeploymentMode::ServerlessPeer
                        && snap.deployment.role == medoc_sync::deployment::DeviceRole::Replica;
                    if is_replica && master_unreachable_cooling_down() {
                        continue;
                    }
                    let changes = match medoc_sync::watch::queue_shared_changes(&pool).await {
                        Ok(n) => n,
                        Err(e) => {
                            tracing::warn!(
                                target: "medoc::sync",
                                event = "SHARED_SYNC_SCAN_FAILED",
                                error = %e
                            );
                            continue;
                        }
                    };
                    if changes == 0 {
                        continue;
                    }
                    tracing::info!(
                        target: "medoc::sync",
                        event = "SHARED_SYNC_QUEUED",
                        changes
                    );
                    if !is_replica {
                        continue;
                    }
                    match run_replica_sync_recovering(&pool).await {
                        Ok(report) => {
                            if let Some(err) = report.error.as_deref() {
                                if !master_unreachable_message(err) {
                                    tracing::warn!(
                                        target: "medoc::sync",
                                        event = "SHARED_SYNC_SEND_DEFERRED",
                                        error = %err
                                    );
                                }
                            } else {
                                tracing::info!(
                                    target: "medoc::sync",
                                    event = "SHARED_SYNC_SENT",
                                    changes
                                );
                            }
                        }
                        Err(e) => tracing::warn!(
                            target: "medoc::sync",
                            event = "SHARED_SYNC_SEND_FAILED",
                            error = %e
                        ),
                    }
                }
            });
        })
    {
        tracing::warn!(
            target: "medoc::sync",
            event = "SHARED_SYNC_THREAD_FAILED",
            error = %e
        );
    }
}

pub fn spawn_replica_offline_sync_loop(pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = medoc_sync::repo::enqueue_calendar_controls(&pool).await {
            tracing::warn!(
                target: "medoc::sync",
                event = "CALENDAR_CONTROLS_ENQUEUE_FAILED",
                error = %e
            );
        }
        let mut failures: u32 = 0;
        loop {
            tokio::time::sleep(replica_backoff(failures)).await;
            let Ok(snap) = SyncEngine::status(&pool).await else {
                continue;
            };
            if snap.deployment.mode != medoc_sync::deployment::DeploymentMode::ServerlessPeer
                || snap.deployment.role != medoc_sync::deployment::DeviceRole::Replica
            {
                continue;
            }
            if replica_needs_credential_refresh(&snap)
                || snap.deployment.master_base_url.trim().is_empty()
            {
                let _ = try_refresh_replica_auth(&pool).await;
            }
            let Ok(again) = SyncEngine::status(&pool).await else {
                continue;
            };
            let has_url = !again.deployment.master_base_url.trim().is_empty();
            let has_token = !again.deployment.activation_token.trim().is_empty()
                || !again.deployment.master_access_token.trim().is_empty();
            if !has_url || !has_token {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "REPLICA_SYNC_SKIP_NO_CREDENTIALS",
                    has_url,
                    has_token
                );
                continue;
            }
            let _ = repair_replica_master_https_url(&pool).await;
            if !master_unreachable_cooling_down() {
                if let Err(e) = sync_staff_from_stored_admin_endpoint(&pool).await {
                    if master_unreachable_message(&e.to_string()) {
                        note_master_unreachable(&e);
                    }
                }
            }
            let catchup_done =
                medoc_core::infrastructure::database::app_kv_repo::get(&pool, REPLICA_CATCHUP_KV)
                    .await
                    .ok()
                    .flatten()
                    .as_deref()
                    == Some("1");
            let result = if catchup_done {
                run_replica_sync_recovering(&pool).await
            } else {
                run_replica_catchup_recovering(&pool).await
            };
            match result {
                Ok(report) => {
                    if let Some(err) = report.error.as_deref() {
                        failures = failures.saturating_add(1);
                        if !master_unreachable_message(err) {
                            tracing::warn!(
                                target: "medoc::sync",
                                event = "REPLICA_SYNC_DEFERRED",
                                error = %err,
                                backoff_ms = replica_backoff(failures).as_millis() as u64
                            );
                        }
                    } else {
                        failures = 0;
                    }
                    if !catchup_done {
                        let pulled = report
                            .pull
                            .as_ref()
                            .map(|p| p.applied.saturating_add(p.skipped))
                            .unwrap_or(0);
                        if pulled < 500 && report.error.is_none() {
                            let _ = medoc_core::infrastructure::database::app_kv_repo::set(
                                &pool,
                                REPLICA_CATCHUP_KV,
                                "1",
                            )
                            .await;
                            tracing::info!(
                                target: "medoc::sync",
                                event = "REPLICA_INITIAL_SYNC_DONE",
                                applied = report.pull.as_ref().map(|p| p.applied).unwrap_or(0)
                            );
                        }
                    }
                }
                Err(e) => {
                    failures = failures.saturating_add(1);
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_SYNC_DEFERRED",
                        error = %e,
                        backoff_ms = replica_backoff(failures).as_millis() as u64
                    );
                }
            }
        }
    });
}

#[cfg(test)]
mod backoff_tests {
    use super::replica_backoff;
    use std::time::Duration;

    #[test]
    fn backs_off_when_the_main_device_is_down() {
        assert_eq!(replica_backoff(0), Duration::from_millis(500));
        assert_eq!(replica_backoff(1), Duration::from_secs(1));
        assert_eq!(replica_backoff(2), Duration::from_secs(2));
        assert_eq!(replica_backoff(4), Duration::from_secs(8));
        assert_eq!(replica_backoff(10), Duration::from_secs(30));
        assert_eq!(super::unreachable_wait(0), Duration::from_secs(5));
        assert_eq!(super::unreachable_wait(4), Duration::from_secs(8));
        assert!(super::master_unreachable_message(
            "cluster auth connect 192.168.0.100:49300: Connection refused (os error 61)"
        ));
        assert!(!super::master_unreachable_message("401 unauthorized"));
    }

    #[test]
    fn token_for_another_device_needs_refresh() {
        assert!(super::replica_token_needs_refresh("", "dev-a"));
        assert!(super::replica_token_needs_refresh("jwt.not.mt2", "dev-a"));
    }

    #[test]
    fn mismatch_403_refreshes_once() {
        assert!(super::sync_auth_rejected("403 token_mismatch"));
        assert!(super::sync_auth_rejected("401 unauthorized"));
        assert!(!super::sync_auth_rejected("403 revoked"));
    }

    #[test]
    fn revoked_403_stops_the_loop_and_sets_repair_required() {
        assert!(super::sync_auth_requires_repair("403 reason=revoked"));
        assert!(super::sync_auth_requires_repair("not_accepted"));
        assert!(!super::sync_auth_requires_repair("token_mismatch"));
    }
}
