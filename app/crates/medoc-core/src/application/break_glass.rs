//! Re-export shim — the canonical `BreakGlass*` types live in
//! `medoc_core::break_glass` (top-level module). Preserved at
//! `crate::application::break_glass::*` for source compatibility with
//! existing `use crate::application::break_glass::BreakGlassState;` call
//! sites in commands/, infrastructure/, and tests.

pub use crate::break_glass::{BreakGlassGrant, BreakGlassState};
