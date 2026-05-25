//! Re-export shim — the canonical domain types live in `medoc_core::domain`.
//!
//! Wave B5.2 moved the entire `domain/` tree to the `medoc-core` workspace
//! crate. This file preserves the existing `crate::domain::*` paths used
//! throughout the practice-host crate (commands, application, infrastructure,
//! tests) so we don't have to repoint every consumer in one giant diff.
//!
//! New code in this crate should import directly from `medoc_core::domain`.

pub use medoc_core::domain::*;
