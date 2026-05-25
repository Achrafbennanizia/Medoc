//! LAN system **Facade** + **Factory** — single entry to build the HTTPS API.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

use crate::infrastructure::lan_server::discovery::LanBeaconPayload;
use crate::infrastructure::lan_server::http::{self, LanHttpState};
use crate::infrastructure::logging::brute_force::BruteForceTracker;

/// **Factory Method** — constructs LAN HTTP state and Axum router from practice DB pool.
pub struct LanSystemFactory;

impl LanSystemFactory {
    pub fn build_state(
        pool: SqlitePool,
        jwt_secret: Arc<[u8; 32]>,
        brute: Arc<BruteForceTracker>,
        http_port: u16,
        extra_cors_origins: Vec<String>,
        discovery_peers: Vec<(SocketAddr, LanBeaconPayload)>,
    ) -> LanHttpState {
        LanHttpState {
            pool,
            jwt_secret,
            brute,
            http_port,
            extra_cors_origins: Arc::new(extra_cors_origins),
            discovery_peers: Arc::new(discovery_peers),
        }
    }

    pub fn build_router(state: LanHttpState) -> Router {
        http::build_router(state)
    }
}
