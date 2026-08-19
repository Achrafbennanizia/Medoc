//! Domain repository contracts (ports).
//!
//! Implementations live in [`crate::infrastructure::database::repos`].
//! Legacy flat paths (`database::patient_repo`, …) remain as shims.

pub mod staff_repo;

pub use staff_repo::StaffRepository;
