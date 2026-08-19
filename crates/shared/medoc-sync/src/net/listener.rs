//! L4 TCP receive port with private-address bind guard.
//!
//! When DATA_* protocol handlers are added to the accept loop, each owner-side
//! connection must call `require_owner_admin` and `verify_peer_connection` before
//! serving cluster data (single chokepoint for license + peer authz).

use std::net::{IpAddr, SocketAddr};

use medoc_core::error::AppError;
use tokio::net::TcpListener;

use super::bind_guard::assert_private_bind;

pub const DEFAULT_CLUSTER_PORT: u16 = 49300;

pub async fn bind_cluster_listener(addr: IpAddr, port: u16) -> Result<TcpListener, AppError> {
    assert_private_bind(addr)?;
    let sock = SocketAddr::new(addr, port);
    TcpListener::bind(sock)
        .await
        .map_err(|e| AppError::Internal(format!("cluster bind {sock}: {e}")))
}
