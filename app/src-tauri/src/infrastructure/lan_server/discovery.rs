//! Re-export shim — the UDP discovery beacon protocol now lives in
//! `medoc_core::discovery` so it can be shared between the practice host
//! (which scans for LAN servers) and the LAN server binary (which broadcasts
//! beacons), without forcing `medoc-core::cors_policy` to depend on the
//! LAN crate. The full `lan_server` module moves to `medoc-lan` in Wave B7.

pub use medoc_core::discovery::{
    parse_beacon_line, run_discovery_responder, scan_lan_hosts, LanBeaconPayload, DISCOVER_PROBE,
    SCHEMA,
};
