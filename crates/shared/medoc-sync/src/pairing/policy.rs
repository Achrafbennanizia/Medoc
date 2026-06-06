//! Pairing policy helpers (URLs, feature toggle, action sanitisation).

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use super::types::{APP_KV_PAIRING_ENABLED, DEFAULT_ALLOWED_ACTIONS};

/// Build HTTPS base URL for a replica from its LAN IP (mesh + peer discovery).
pub fn peer_base_url_from_ip(ip: &str, http_port: u16) -> Option<String> {
    let ip = ip.trim();
    if ip.is_empty() {
        return None;
    }
    Some(format!("https://{ip}:{http_port}"))
}

/// Prefer `sync_device.peer_base_url` (updated on sync push); fall back to request IP.
pub async fn peer_advertised_url(
    pool: &SqlitePool,
    device_id: &str,
    requester_ip: &str,
    http_port: u16,
) -> Result<Option<String>, AppError> {
    let stored: Option<String> =
        sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
            .bind(device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
            .flatten()
            .filter(|s: &String| !s.trim().is_empty());
    Ok(stored.or_else(|| peer_base_url_from_ip(requester_ip, http_port)))
}

/// Master-side toggle — defaults to enabled when unset.
pub async fn is_pairing_enabled(pool: &SqlitePool) -> Result<bool, AppError> {
    let raw = medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_PAIRING_ENABLED)
        .await?;
    Ok(!matches!(raw.as_deref(), Some("0") | Some("false")))
}

/// Authorised actions for a slave device (master-side check).
pub async fn slave_actions(pool: &SqlitePool, device_id: &str) -> Result<Vec<String>, AppError> {
    crate::schema::ensure_sync_tables(pool).await?;
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT action FROM slave_permission WHERE device_id = ?1 ORDER BY action ASC",
    )
    .bind(device_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(|(a,)| a).collect())
}

pub(crate) fn sanitise_actions(input: &[String]) -> Vec<String> {
    if input.is_empty() {
        return DEFAULT_ALLOWED_ACTIONS
            .iter()
            .map(|s| (*s).to_string())
            .collect();
    }
    let mut out: Vec<String> = input
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    out.sort();
    out.dedup();
    out
}
