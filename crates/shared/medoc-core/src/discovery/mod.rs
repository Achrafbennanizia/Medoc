//! Master discovery transports for serverless pairing.
//!
//! | Submodule | Responsibility |
//! |-----------|----------------|
//! | [`beacon`] | Shared JSON beacon (UDP + BLE) |
//! | [`lan_iface`] | Pick a switched-LAN IPv4 (Wi-Fi / Ethernet, skip docker/VPN) |
//! | [`lan_udp`] | UDP probe / responder |

mod beacon;
mod lan_iface;
mod lan_udp;

pub use beacon::{
    beacon_base_url, beacon_host, parse_beacon_from_ble_local_name, parse_beacon_line,
    primary_local_ipv4, LanBeaconPayload, BLE_LOCAL_NAME_PREFIX, DISCOVER_PROBE,
    MEDOC_BLE_SERVICE_UUID, SCHEMA,
};
pub use lan_iface::{
    is_ignored_lan_iface, lan_ipv4_addr_score, pick_private_lan_ipv4, pick_private_lan_ipv4_bind,
    LanIpv4Bind,
};
pub use lan_udp::{run_discovery_responder, scan_lan_hosts};
