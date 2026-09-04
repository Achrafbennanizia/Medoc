//! Identify the same physical device across reconnects using peer IP.

use std::collections::HashSet;
use std::net::IpAddr;

/// Stored / compared form of a login peer address.
pub fn normalize_peer_ip(raw: &str) -> String {
    let t = raw.trim().to_ascii_lowercase();
    if t.is_empty()
        || t == "local-desktop"
        || t == "localhost"
        || t == "127.0.0.1"
        || t == "::1"
        || t == "0.0.0.0"
        || t == "::"
        || t == "[::1]"
    {
        return "local".into();
    }
    let stripped = t.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = stripped.parse::<IpAddr>() {
        if ip.is_loopback() || ip.is_unspecified() {
            return "local".into();
        }
        return ip.to_string();
    }
    t
}

pub fn same_peer(a: &str, b: &str) -> bool {
    normalize_peer_ip(a) == normalize_peer_ip(b)
}

/// Keep one visible row per peer IP. Prefer the current session, then remaining rows in order.
pub fn collapse_by_peer_ip<T>(
    rows: Vec<T>,
    peer_of: impl Fn(&T) -> String,
    is_current: impl Fn(&T) -> bool,
) -> Vec<T> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::with_capacity(rows.len());
    let (currents, others): (Vec<T>, Vec<T>) = rows.into_iter().partition(|r| is_current(r));
    for row in currents {
        seen.insert(peer_of(&row));
        out.push(row);
    }
    for row in others {
        if !seen.insert(peer_of(&row)) {
            continue;
        }
        out.push(row);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn localhost_and_desktop_sentinel_collapse() {
        assert_eq!(normalize_peer_ip("local-desktop"), "local");
        assert_eq!(normalize_peer_ip("127.0.0.1"), "local");
        assert_eq!(normalize_peer_ip("::1"), "local");
        assert!(same_peer("127.0.0.1", "local-desktop"));
    }

    #[test]
    fn lan_ips_stay_distinct() {
        assert!(!same_peer("192.168.1.10", "192.168.1.11"));
        assert!(same_peer("192.168.1.10", "192.168.1.10"));
        assert_eq!(normalize_peer_ip("192.168.1.10"), "192.168.1.10");
    }

    #[test]
    fn collapse_hides_reconnect_same_ip() {
        struct R {
            id: &'static str,
            ip: &'static str,
            current: bool,
        }
        let rows = vec![
            R {
                id: "cur",
                ip: "127.0.0.1",
                current: true,
            },
            R {
                id: "old",
                ip: "local-desktop",
                current: false,
            },
            R {
                id: "lan",
                ip: "10.0.0.8",
                current: false,
            },
        ];
        let out = collapse_by_peer_ip(rows, |r| normalize_peer_ip(r.ip), |r| r.current);
        let ids: Vec<_> = out.iter().map(|r| r.id).collect();
        assert_eq!(ids, vec!["cur", "lan"]);
    }
}
