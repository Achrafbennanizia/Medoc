//! Device cluster — cluster licensing, seat registry, pairing sessions.
//!
//! Evolves the existing master/replica pairing model with seat roles (ADMIN/MEMBER),
//! atomic 3/7/10 caps, seat certificates, and provisioning guards.

pub mod activation;
pub mod crypto;
mod entities;
mod enums;
mod identity;
mod ports;
mod repo;
pub mod seat_budget;
pub mod services;

#[cfg(test)]
mod tests;

pub use entities::*;
pub use enums::{DeviceStatus, PairingStatus, SeatRole};
pub use identity::is_identity_complete;
pub use ports::{
    is_provisioned, load_cluster, mark_provisioned, provisioning_counter, reserve_seat_atomic,
    DeviceRepo, LicenseRepo, PairingRepo, SqliteClusterRepos,
};
pub use seat_budget::{seat_budget_from_edition, SeatBudget};
