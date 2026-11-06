//! Pairing policy helpers (URLs, feature toggle, action sanitisation).

use std::net::IpAddr;

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use super::types::{APP_KV_PAIRING_ENABLED, DEFAULT_ALLOWED_ACTIONS};

/// IPv4 form of a socket address. Mapped IPv6 (`::ffff:192.168.1.5`) becomes `192.168.1.5`.
/// Unspecified addresses (`0.0.0.0`, `::`) are treated as unknown.
pub fn canonical_peer_ip(ip: IpAddr) -> String {
    let ip = match ip {
        IpAddr::V6(v6) => v6
            .to_ipv4_mapped()
            .map(IpAddr::V4)
            .unwrap_or(IpAddr::V6(v6)),
        other => other,
    };
    if ip.is_unspecified() {
        String::new()
    } else {
        ip.to_string()
    }
}

/// Normalize an IP string already stored or received from a client.
pub fn canonical_ip_str(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    match trimmed.parse::<IpAddr>() {
        Ok(ip) => canonical_peer_ip(ip),
        Err(_) => trimmed.to_string(),
    }
}

/// Addresses that are not the replica's LAN address.
fn unusable_requester_ip(ip: &str) -> bool {
    ip == "::1"
        || ip.starts_with("127.")
        || ip.starts_with("fe80:")
        || ip.starts_with("169.254.")
}

/// Prefer the address the master saw on the socket. If that is loopback or link-local,
/// use the LAN address the replica advertised in the join.
pub fn choose_requester_ip(peer: Option<&str>, advertised: &str) -> String {
    let peer = peer.map(canonical_ip_str).filter(|ip| !ip.is_empty());
    let advertised = {
        let ip = canonical_ip_str(advertised);
        if ip.is_empty() {
            None
        } else {
            Some(ip)
        }
    };
    match (peer, advertised) {
        (Some(peer), Some(advertised)) if unusable_requester_ip(&peer) => advertised,
        (Some(peer), _) => peer,
        (None, Some(advertised)) => advertised,
        (None, None) => String::new(),
    }
}

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

#[cfg(test)]
mod tests {
    use std::net::IpAddr;

    use super::{canonical_ip_str, canonical_peer_ip};

    #[test]
    fn mapped_ipv6_displays_as_ipv4() {
        let ip: IpAddr = "::ffff:192.168.1.20".parse().unwrap();
        assert_eq!(canonical_peer_ip(ip), "192.168.1.20");
        assert_eq!(canonical_ip_str("  ::ffff:10.0.0.8 "), "10.0.0.8");
        assert_eq!(canonical_ip_str("0.0.0.0"), "");
        assert_eq!(canonical_ip_str("::"), "");
        assert_eq!(canonical_ip_str("192.168.0.4"), "192.168.0.4");
    }

    #[test]
    fn requester_ip_prefers_advertised_lan_over_loopback() {
        assert_eq!(
            super::choose_requester_ip(Some("127.0.0.1"), "192.168.1.42"),
            "192.168.1.42"
        );
        assert_eq!(
            super::choose_requester_ip(Some("10.0.0.8"), "192.168.1.42"),
            "10.0.0.8"
        );
        assert_eq!(super::choose_requester_ip(None, "::ffff:10.1.1.5"), "10.1.1.5");
    }
}
