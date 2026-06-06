//! Master/replica pairing — modular layout (R4).
//!
//! | Module | Responsibility |
//! |--------|----------------|
//! | [`types`] | DTOs + constants |
//! | [`policy`] | URLs, toggle, action lists |
//! | [`token`] | Activation token crypto |
//! | [`store`] | SQLite persistence |
//! | [`port`] | [`PairingPersistence`] trait + [`SqlitePairingStore`] |
//!
//! Free functions at the crate root (`medoc_sync::pairing::*`) delegate to
//! [`SqlitePairingStore`] for backward compatibility.

mod policy;
mod port;
mod store;
mod token;
mod types;

#[cfg(test)]
mod tests;

pub use policy::{is_pairing_enabled, peer_advertised_url, peer_base_url_from_ip, slave_actions};
pub use port::{PairingPersistence, SqlitePairingStore};
pub use token::{mint_activation_token, verify_activation_token};
pub use types::*;

// ---------------------------------------------------------------------------
// Legacy free-function API (delegates to the default SQLite port implementation)
// ---------------------------------------------------------------------------

use medoc_core::error::AppError;
use sqlx::SqlitePool;

pub async fn submit_request(
    pool: &SqlitePool,
    submit: PairingRequestSubmit,
) -> Result<PairingRequest, AppError> {
    SqlitePairingStore(pool).submit_request(submit).await
}

pub async fn list_pending(pool: &SqlitePool) -> Result<Vec<PairingRequest>, AppError> {
    SqlitePairingStore(pool).list_pending().await
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<PairingRequest>, AppError> {
    SqlitePairingStore(pool).list_all().await
}

pub async fn load_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PairingRequest>, AppError> {
    SqlitePairingStore(pool).load_by_id(id).await
}

pub async fn load_by_device(
    pool: &SqlitePool,
    device_id: &str,
) -> Result<Option<PairingRequest>, AppError> {
    SqlitePairingStore(pool).load_by_device(device_id).await
}

pub async fn decide(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    decision: PairingDecision,
    replica_http_port: u16,
) -> Result<PairingRequest, AppError> {
    SqlitePairingStore(pool)
        .decide(master_device_id, request_id, decision, replica_http_port)
        .await
}

pub async fn revoke(
    pool: &SqlitePool,
    master_device_id: &str,
    device_id: &str,
    decided_by: &str,
) -> Result<(), AppError> {
    SqlitePairingStore(pool)
        .revoke(master_device_id, device_id, decided_by)
        .await
}
