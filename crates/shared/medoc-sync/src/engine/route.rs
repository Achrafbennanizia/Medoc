//! Group routing (T4.1, docs/architecture/editions-plan.md §4.4.1).
//!
//! * **Star (mode S)**: the primary hub is reachable. Every device pushes to the primary and
//!   pulls from it; the primary re-emits what it applied, so one push per change reaches
//!   everybody.
//! * **Origin-sends (mode O)**: the primary missed [`FAILS_TO_ORIGIN_SENDS`] sync rounds in a
//!   row. The device that made a change also pushes it to every peer it can reach (mesh push,
//!   tracked per target in `sync_peer_vector`); nobody re-sends someone else's change. The
//!   peer list comes from the last list the primary signed, re-verified with its pinned key.
//!
//! Switching never loses or duplicates a change: each device keeps its own entries pending for
//! the primary until the primary confirms them (`delivered_at`), whatever the mode, and every
//! receiver drops an entry it already applied (`sync_applied`). So when the primary answers
//! again the device goes back to star at once: its next push hands the primary everything it
//! missed, and the primary re-emits it to the others.
//!
//! Only Group builds route this way (`multi_admin`); Duo stays star-only and queues locally.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use sqlx::SqlitePool;

/// Missed rounds before a device starts sending its own changes to its peers.
pub const FAILS_TO_ORIGIN_SENDS: u32 = 3;

const FAILS_KV: &str = "sync.route.master_failures.v1";
const PEERS_KV: &str = "sync.route.peer_list.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RouteMode {
    Star,
    OriginSends,
}

/// This build routes around a missing primary (Group).
pub fn routing_enabled() -> bool {
    medoc_core::edition::CORE_CAPS.multi_admin
}

async fn failures(pool: &SqlitePool) -> u32 {
    app_kv_repo::get(pool, FAILS_KV)
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0)
}

fn mode_for(failures: u32) -> RouteMode {
    if routing_enabled() && failures >= FAILS_TO_ORIGIN_SENDS {
        RouteMode::OriginSends
    } else {
        RouteMode::Star
    }
}

/// Current mode of this device.
pub async fn mode(pool: &SqlitePool) -> RouteMode {
    mode_for(failures(pool).await)
}

/// Record whether this round reached the primary; returns the mode for the rest of the round.
pub async fn record_master_contact(
    pool: &SqlitePool,
    reached: bool,
) -> Result<RouteMode, AppError> {
    let before = failures(pool).await;
    let after = if reached { 0 } else { before.saturating_add(1) };
    if after != before {
        app_kv_repo::set(pool, FAILS_KV, &after.to_string()).await?;
    }
    let (was, now) = (mode_for(before), mode_for(after));
    if was != now {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_ROUTE_MODE",
            mode = ?now,
            missed_rounds = after,
        );
    }
    Ok(now)
}

/// True when `err` says the other device could not be reached at all (no answer), as opposed
/// to an answer with an error status. `outbound_http::send_failed` words it "<kind> http: …".
pub fn is_unreachable(err: &AppError) -> bool {
    matches!(err, AppError::Internal(msg) if msg.contains(" http: "))
}

/// Keep the primary's last signed peer list (raw body) for mode O.
pub(crate) async fn save_peer_list(pool: &SqlitePool, raw: &str) -> Result<(), AppError> {
    app_kv_repo::set(pool, PEERS_KV, raw).await
}

pub(crate) async fn cached_peer_list(pool: &SqlitePool) -> Option<String> {
    app_kv_repo::get(pool, PEERS_KV).await.ok().flatten()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn three_missed_rounds_switch_group_builds_to_origin_sends() {
        assert_eq!(mode_for(0), RouteMode::Star);
        assert_eq!(mode_for(FAILS_TO_ORIGIN_SENDS - 1), RouteMode::Star);
        let expected = if routing_enabled() {
            RouteMode::OriginSends
        } else {
            RouteMode::Star
        };
        assert_eq!(mode_for(FAILS_TO_ORIGIN_SENDS), expected);
    }

    #[test]
    fn only_a_missing_answer_counts_as_unreachable() {
        assert!(is_unreachable(&AppError::Internal(
            "sync pull http: error sending request".into()
        )));
        assert!(!is_unreachable(&AppError::Validation("503".into())));
    }
}
