//! Master/replica pairing — modular layout (R4).
//!
//! | Module | Responsibility |
//! |--------|----------------|
//! | [`types`] | DTOs + constants |
//! | [`pin`] | 4-digit OOB confirmation (HMAC, TTL, attempts) |
//! | [`policy`] | URLs, toggle, action lists |
//! | [`token`] | Activation token crypto |
//! | [`store`] | SQLite persistence (submit, decide, confirm, revoke) |
//!
//! Free functions at the crate root (`medoc_sync::pairing::*`) call [`store`].

mod pin;
mod policy;
mod store;
mod token;
mod types;

#[cfg(test)]
mod tests;

pub use pin::{
    hash_confirm_pin, normalise_pin_input, verify_confirm_pin, CONFIRM_PIN_MAX_ATTEMPTS,
    CONFIRM_PIN_TTL_SECS,
};
pub use policy::{
    admit_inbound_cluster, canonical_ip_str, canonical_peer_ip, choose_requester_ip,
    is_network_hidden, is_pairing_enabled, peer_advertised_url, peer_base_url_from_ip,
    slave_actions,
};
pub use token::{mint_activation_token, verify_activation_token};
pub use types::*;

// Callers use these names. The bodies live in `store`.

use medoc_core::error::AppError;
use sqlx::SqlitePool;

pub async fn submit_request(
    pool: &SqlitePool,
    submit: PairingRequestSubmit,
) -> Result<PairingRequest, AppError> {
    store::submit_request(pool, submit).await
}

pub async fn list_pending(pool: &SqlitePool) -> Result<Vec<PairingRequest>, AppError> {
    store::list_pending(pool).await
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<PairingRequest>, AppError> {
    store::list_all(pool).await
}

pub async fn load_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PairingRequest>, AppError> {
    store::load_by_id(pool, id).await
}

pub async fn load_by_device(
    pool: &SqlitePool,
    device_id: &str,
) -> Result<Option<PairingRequest>, AppError> {
    store::load_by_device(pool, device_id).await
}

pub async fn decide(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    decision: PairingDecision,
    replica_http_port: u16,
) -> Result<PairingDecideResult, AppError> {
    store::decide(
        pool,
        master_device_id,
        request_id,
        decision,
        replica_http_port,
    )
    .await
}

pub async fn confirm_pin(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    pin: &str,
    replica_http_port: u16,
) -> Result<PairingRequest, AppError> {
    store::confirm_pin(pool, master_device_id, request_id, pin, replica_http_port).await
}

pub async fn clear_device_activation(
    pool: &SqlitePool,
    device_or_fingerprint: &str,
) -> Result<(), AppError> {
    store::clear_device_activation(pool, device_or_fingerprint).await
}

pub async fn revoke(
    pool: &SqlitePool,
    master_device_id: &str,
    device_id: &str,
    decided_by: &str,
) -> Result<(), AppError> {
    store::revoke(pool, master_device_id, device_id, decided_by).await
}
