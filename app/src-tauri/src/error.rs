//! Application error type — single source of truth in `medoc_core::error`.
//!
//! Re-exported here so the ~200 existing `use crate::error::AppError;` (and
//! `crate::error::AppError::*`) call sites in this crate continue to compile.
//! When other server crates (LAN, Company) move to the workspace they should
//! import directly from `medoc_core::error` rather than going through this shim.

pub use medoc_core::error::AppError;
