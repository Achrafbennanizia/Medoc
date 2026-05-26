//! MeDoc shared core — domain types + non-Tauri infrastructure.
//!
//! This crate is the dependency-graph root for everything that runs
//! outside the desktop binary: it must compile without `tauri` (or any
//! other GUI runtime) so that LAN + Company server crates can depend on
//! it directly.
//!
//! The practice-host (`medoc`) crate re-exports the most-used items
//! (`medoc_core::error::AppError`, `medoc_core::domain::*`) on their
//! existing `crate::*` paths for source compatibility with the ~200
//! call sites that haven't been repointed yet.

pub mod break_glass;
pub mod discovery;
pub mod domain;
pub mod error;
