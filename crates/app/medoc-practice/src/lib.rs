//! MeDoc practice host library — Tauri IPC surface + host-only modules.
//!
//! The desktop binary (`medoc` / `src-tauri`) depends on this crate and
//! re-exports its modules on `crate::*` paths for backward compatibility.

pub mod application;
pub mod commands;
pub mod domain;
pub mod error;
pub mod infrastructure;
pub mod systems;

pub use medoc_core::{log_device, log_migration, log_perf, log_security, log_system, log_workflow};
