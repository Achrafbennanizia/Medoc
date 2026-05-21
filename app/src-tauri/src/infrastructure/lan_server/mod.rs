//! LAN-facing HTTP API + UDP discovery (requirements NFA-NET-* — authenticated sessions over LAN).
//!
//! ### Abgleich „Hintergrund“ / Betrieb (Stand Code)
//!
//! - **NFA-NET-03 (Headless):** `medoc-server` + [`init_db_headless`](crate::infrastructure::database::connection::init_db_headless).
//! - **Host ohne UI-Blockade:** LAN-HTTP in Tokio-Tasks (`commands::lan_commands`), nicht im Hauptthread der Oberfläche.
//! - **Auto-Start mit App:** `LanServerConfigV1.auto_start_with_app` und Spawn in `lib.rs` (~1,5 s nach DB).
//! - **Geräte-Erkennung (Roh-NFA-NET-SEC-04 / NFA-NET-08 SHOULD):** UDP-Broadcast `discovery.rs` (kein mDNS).
//! - **TLS (Pflichtenheft NFA-NET-07 / NFA-SEC-09):** HTTPS via self-signed `lan-tls.{crt,key}` + SHA-256 fingerprint in UI/beacon.
//! - **Reconnect bei Verlust (NFA-NET-05):** Verantwortung eines LAN-Clients/Browsers, nicht dieses Host-Binary.

pub mod config;
pub mod discovery;
pub mod http;
pub mod jwt;
pub mod secrets;
pub mod tls;

pub use secrets::{ensure_instance_id, ensure_jwt_secret_bytes};

pub use config::{LanServerConfigV1, APP_KV_KEY};
pub use discovery::{scan_lan_hosts, LanBeaconPayload, SCHEMA};
