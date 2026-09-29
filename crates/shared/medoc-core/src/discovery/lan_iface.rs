//! Choose a reachable IPv4 on a switched LAN (typical home/practice Wi-Fi AP).
//!
//! Skips loopback, VPNs, and container/hypervisor NICs so cluster TCP and
//! beacons advertise the same subnet other devices actually use.

use std::net::Ipv4Addr;

use if_addrs::IfAddr;

/// Interface names that are not the practice Wi-Fi/Ethernet LAN.
pub fn is_ignored_lan_iface(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n == "lo"
        || (n.starts_with("lo") && n.as_bytes().get(2).is_some_and(|b| b.is_ascii_digit()))
        || n.contains("loopback")
        || n.starts_with("docker")
        || n.starts_with("br-")
        || n.starts_with("veth")
        || n.starts_with("cni")
        || n.starts_with("flannel")
        || n.starts_with("cali")
        || n.contains("vmnet")
        || n.starts_with("vbox")
        || n.contains("virtualbox")
        || n.contains("hyper-v")
        || n.contains("vethernet")
        || n.contains("wsl")
        || n.starts_with("tun")
        || n.starts_with("tap")
        || n.starts_with("utun")
        || n.starts_with("wg")
        || n.starts_with("zt")
        || n == "awdl0"
        || n.starts_with("llw")
        || n.starts_with("ap") && n.chars().nth(2).is_some_and(|c| c.is_ascii_digit())
}

fn looks_like_wifi(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n.contains("wi-fi")
        || n.contains("wifi")
        || n.contains("wlan")
        || n.starts_with("wl")
        || n == "en0"
}

fn looks_like_ethernet(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n.contains("ethernet") || n.starts_with("eth") || n.starts_with("en") && !looks_like_wifi(name)
}

/// Higher is better. Negative = unusable for cluster/beacon.
pub fn lan_ipv4_addr_score(ip: Ipv4Addr) -> i32 {
    let o = ip.octets();
    if ip.is_loopback() {
        return -1;
    }
    if o[0] == 192 && o[1] == 168 {
        return 100;
    }
    if o[0] == 10 {
        return 80;
    }
    if o[0] == 172 && (16..=31).contains(&o[1]) {
        // Docker / Hyper-V default NAT is often 172.17–172.29.
        if o[1] == 17 {
            return 8;
        }
        return 45;
    }
    if o[0] == 169 && o[1] == 254 {
        return 5;
    }
    -1
}

#[derive(Debug, Clone)]
pub struct LanIpv4Bind {
    pub iface_name: String,
    pub ip: Ipv4Addr,
}

fn candidate_score(name: &str, ip: Ipv4Addr) -> i32 {
    if is_ignored_lan_iface(name) {
        return -1;
    }
    let mut s = lan_ipv4_addr_score(ip);
    if s < 0 {
        return -1;
    }
    if looks_like_wifi(name) {
        s += 30;
    } else if looks_like_ethernet(name) {
        s += 15;
    }
    s
}

/// Best RFC1918 (or link-local) IPv4 on a physical-ish NIC, preferring Wi-Fi.
pub fn pick_private_lan_ipv4_bind() -> Option<LanIpv4Bind> {
    let mut best: Option<(i32, LanIpv4Bind)> = None;
    for iface in if_addrs::get_if_addrs().unwrap_or_default() {
        let IfAddr::V4(v4) = iface.addr else {
            continue;
        };
        let score = candidate_score(&iface.name, v4.ip);
        if score < 0 {
            continue;
        }
        let cand = LanIpv4Bind {
            iface_name: iface.name.clone(),
            ip: v4.ip,
        };
        match &best {
            None => best = Some((score, cand)),
            Some((s, _)) if score > *s => best = Some((score, cand)),
            Some((s, prev)) if score == *s && v4.ip.octets() < prev.ip.octets() => {
                best = Some((score, cand));
            }
            _ => {}
        }
    }
    best.map(|(_, b)| b)
}

pub fn pick_private_lan_ipv4() -> Option<Ipv4Addr> {
    pick_private_lan_ipv4_bind().map(|b| b.ip)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_container_and_vpn_nics() {
        assert!(is_ignored_lan_iface("docker0"));
        assert!(is_ignored_lan_iface("vethabc123"));
        assert!(is_ignored_lan_iface("vEthernet (WSL)"));
        assert!(is_ignored_lan_iface("utun4"));
        assert!(is_ignored_lan_iface("awdl0"));
        assert!(!is_ignored_lan_iface("en0"));
        assert!(!is_ignored_lan_iface("Wi-Fi"));
        assert!(!is_ignored_lan_iface("Local Area Connection"));
        assert!(!is_ignored_lan_iface("wlan0"));
    }

    #[test]
    fn home_wifi_subnet_scores_highest() {
        assert!(
            lan_ipv4_addr_score("192.168.1.20".parse().unwrap())
                > lan_ipv4_addr_score("10.0.0.5".parse().unwrap())
        );
        assert!(
            lan_ipv4_addr_score("192.168.1.20".parse().unwrap())
                > lan_ipv4_addr_score("172.17.0.1".parse().unwrap())
        );
        assert_eq!(lan_ipv4_addr_score("8.8.8.8".parse().unwrap()), -1);
    }

    #[test]
    fn wifi_name_outranks_same_class_ethernet() {
        let wifi = candidate_score("Wi-Fi", "192.168.1.10".parse().unwrap());
        let eth = candidate_score("Ethernet", "192.168.1.11".parse().unwrap());
        assert!(wifi > eth);
    }
}
