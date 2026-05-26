//! Re-export shim — `BreakGlassGrant`/`BreakGlassState` live in
//! `medoc_core::break_glass`. Preserved here so existing
//! `use crate::application::break_glass::BreakGlassState;` call sites
//! (commands, infrastructure, tests) keep compiling.

pub use medoc_core::break_glass::{BreakGlassGrant, BreakGlassState};
