//! L3 private-address bind guard (RFC1918, link-local, ULA only).

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use medoc_core::error::AppError;

/// Returns true when `addr` is safe for device-cluster listener binding.
pub fn is_private_lan_address(addr: IpAddr) -> bool {
    match addr {
        IpAddr::V4(v4) => is_private_v4(v4),
        IpAddr::V6(v6) => is_private_v6(v6),
    }
}

fn is_private_v4(addr: Ipv4Addr) -> bool {
    let octets = addr.octets();
    matches!(octets[0], 10)
        || (octets[0] == 172 && (16..=31).contains(&octets[1]))
        || (octets[0] == 192 && octets[1] == 168)
        || (octets[0] == 169 && octets[1] == 254)
        || octets[0] == 127
}

fn is_private_v6(addr: Ipv6Addr) -> bool {
    let segs = addr.segments();
    // fe80::/10 link-local
    if (segs[0] & 0xffc0) == 0xfe80 {
        return true;
    }
    // fc00::/7 ULA
    if (segs[0] & 0xfe00) == 0xfc00 {
        return true;
    }
    false
}

pub fn assert_private_bind(addr: IpAddr) -> Result<(), AppError> {
    if is_private_lan_address(addr) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "Device-cluster listener may only bind private LAN addresses (rejected: {addr})"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_v4_accepted() {
        assert!(is_private_lan_address("192.168.1.1".parse().unwrap()));
        assert!(is_private_lan_address("10.0.0.1".parse().unwrap()));
    }

    #[test]
    fn public_v4_rejected() {
        assert!(!is_private_lan_address("8.8.8.8".parse().unwrap()));
    }
}
