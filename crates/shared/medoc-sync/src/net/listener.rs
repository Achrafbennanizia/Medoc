//! L4 TCP receive port with private-address bind guard.

use std::net::{IpAddr, SocketAddr};

use medoc_core::error::AppError;
use tokio::net::TcpListener;

use super::bind_guard::assert_private_bind;

pub const DEFAULT_VERBUND_PORT: u16 = 49300;

pub async fn bind_verbund_listener(addr: IpAddr, port: u16) -> Result<TcpListener, AppError> {
    assert_private_bind(addr)?;
    let sock = SocketAddr::new(addr, port);
    TcpListener::bind(sock)
        .await
        .map_err(|e| AppError::Internal(format!("verbund bind {sock}: {e}")))
}
