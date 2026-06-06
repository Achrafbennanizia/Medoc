//! Domain repository contracts (ports).
//!
//! Implementations live in [`crate::infrastructure::database::repos`].
//! Legacy flat paths (`database::patient_repo`, …) remain as shims.

pub mod personal_repo;

pub use personal_repo::PersonalRepository;
