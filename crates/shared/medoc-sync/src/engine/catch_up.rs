//! Primary hub catch-up (T4.1b, docs/architecture/editions-plan.md §4.4.1 "Primary hub comes back").
//!
//! 1. **Announce.** At start a Group primary that has paired devices marks itself *catching up*.
//!    While it does, it refuses replica push / pull / exchange with 503 `primary_catching_up`, so
//!    no change is routed through a hub that is behind and devices stay in mode O (their own
//!    entries stay pending for the primary, as always).
//! 2. **Collect.** It asks every peer it can dial for other devices' signed changes after its own
//!    vector (`origin_pull`); each origin's signature is checked and the usual merge applies.
//!    True conflicts go to the conflict inbox through the normal merge.
//! 3. **Ready.** It marks itself ready. Replicas then push their own pending entries (anything the
//!    primary already has is dropped by `sync_applied`) and pull the relay log as in star mode.
//!
//! Number blocks need no extra step: `number_block` rows travel as ordinary entries during collect.
//! A peer that cannot be reached does not hold the primary: its own entries stay pending for the
//! primary and arrive when it comes back. Catch-up ends after [`MAX_DURATION`] whatever happens.

use std::time::Duration;

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use sqlx::SqlitePool;

use crate::deployment::DeviceRole;

pub const STATE_KV: &str = "sync.primary.catch_up.v1";
pub const REFUSAL_REASON: &str = "primary_catching_up";
/// Upper bound of one catch-up; after it the primary relays again.
pub const MAX_DURATION: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatchUpReport {
    pub peers_reached: u32,
    pub peers_failed: u32,
    pub applied: u32,
    pub errors: Vec<String>,
}

async fn remote_device_count(pool: &SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM sync_device WHERE is_local = 0 AND role = 'REPLICA'")
        .fetch_one(pool)
        .await
        .unwrap_or(0)
}

/// Group primary with paired devices: start catching up. Returns whether it did.
pub async fn announce(pool: &SqlitePool) -> Result<bool, AppError> {
    if !super::route::routing_enabled() {
        return Ok(false);
    }
    let deployment = crate::repo::load_deployment(pool).await?;
    if deployment.role != DeviceRole::Master || remote_device_count(pool).await == 0 {
        return Ok(false);
    }
    let until = chrono::Utc::now()
        + chrono::Duration::from_std(MAX_DURATION).unwrap_or(chrono::Duration::minutes(10));
    app_kv_repo::set(pool, STATE_KV, &format!("catching_up:{}", until.to_rfc3339())).await?;
    tracing::warn!(target: "medoc::sync", event = "SYNC_PRIMARY_CATCHING_UP");
    Ok(true)
}

/// True while the primary must not relay. Expires on its own after [`MAX_DURATION`].
pub async fn is_catching_up(pool: &SqlitePool) -> bool {
    let Ok(Some(raw)) = app_kv_repo::get(pool, STATE_KV).await else {
        return false;
    };
    let Some(until) = raw.strip_prefix("catching_up:") else {
        return false;
    };
    chrono::DateTime::parse_from_rfc3339(until)
        .map(|t| chrono::Utc::now() < t)
        .unwrap_or(false)
}

pub async fn mark_ready(pool: &SqlitePool, report: &CatchUpReport) -> Result<(), AppError> {
    app_kv_repo::set(
        pool,
        STATE_KV,
        &format!("ready:{}", chrono::Utc::now().to_rfc3339()),
    )
    .await?;
    tracing::info!(
        target: "medoc::sync",
        event = "SYNC_PRIMARY_READY",
        reached = report.peers_reached,
        failed = report.peers_failed,
        applied = report.applied
    );
    Ok(())
}

/// True when a replica's sync error says the primary is catching up (stay in mode O).
pub fn is_catching_up_error(message: &str) -> bool {
    message.contains(REFUSAL_REASON)
}
