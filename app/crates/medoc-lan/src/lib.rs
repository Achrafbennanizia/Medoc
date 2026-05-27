//! # MeDoc LAN server crate
//!
//! Authenticated HTTPS API + UDP discovery beacon — runs as either:
//!
//! 1. **Embedded** inside the practice host (`medoc-server` binary spawned by
//!    `commands::lan_commands::start_lan_embedded`), or
//! 2. **Standalone** on a separate Linux/macOS host (`medoc-server` binary
//!    started from the CLI), pointing at the same SQLCipher database file.
//!
//! Requirements: NFA-NET-* (authenticated sessions over LAN).
//!
//! ### Operational notes
//!
//! - **NFA-NET-03 (Headless):** `medoc-server` + `medoc_core::infrastructure::database::connection::init_db_headless`.
//! - **Host ohne UI-Blockade:** LAN HTTP runs inside Tokio tasks.
//! - **Auto-Start with the desktop app:** `LanServerConfigV1.auto_start_with_app` triggers a spawn in `lib.rs` (~1.5 s after the DB is ready).
//! - **Geräte-Erkennung (NFA-NET-SEC-04 / NFA-NET-08):** UDP broadcast in `discovery.rs` (no mDNS).
//! - **TLS (NFA-NET-07 / NFA-SEC-09):** HTTPS via a self-signed `lan-tls.{crt,key}` plus SHA-256 fingerprint surfaced in UI / beacon.
//! - **Reconnect on loss (NFA-NET-05):** delegated to LAN clients (browsers / tablets) — not this host binary.

pub mod config;
pub mod discovery;
pub mod http;
pub mod jwt;
pub mod master_license;
pub mod pairing_http;
pub mod secrets;
pub mod sync_http;
pub mod tls;

pub use config::{LanServerConfigV1, APP_KV_KEY};
pub use discovery::{scan_lan_hosts, LanBeaconPayload, SCHEMA};
pub use secrets::{ensure_instance_id, ensure_jwt_secret_bytes};

/// LAN system **Factory** — single entry point that builds the HTTPS state +
/// Axum router for both the embedded path (Tauri practice host spawns it
/// via `commands::lan_commands`) and the standalone `medoc-server` binary.
pub struct LanSystemFactory;

impl LanSystemFactory {
    pub fn build_state(
        pool: sqlx::SqlitePool,
        jwt_secret: std::sync::Arc<[u8; 32]>,
        brute: std::sync::Arc<medoc_core::infrastructure::logging::brute_force::BruteForceTracker>,
        http_port: u16,
        extra_cors_origins: Vec<String>,
        discovery_peers: Vec<(std::net::SocketAddr, LanBeaconPayload)>,
    ) -> http::LanHttpState {
        http::LanHttpState {
            pool,
            jwt_secret,
            brute,
            http_port,
            extra_cors_origins: std::sync::Arc::new(extra_cors_origins),
            discovery_peers: std::sync::Arc::new(discovery_peers),
        }
    }

    pub fn build_router(state: http::LanHttpState) -> axum::Router {
        http::build_router(state)
    }
}
