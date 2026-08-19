//! Domain-grouped SQLite repositories (R5).
//!
//! Legacy flat paths (`database::patient_repo`, …) remain as shim modules in
//! the parent `database/` directory — they re-export from here.

pub mod admin;
pub mod billing;
pub mod clinical;
pub mod practice;
pub mod scheduling;
