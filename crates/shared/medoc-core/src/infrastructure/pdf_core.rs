//! **Legacy flat path** — canonical module: [`crate::infrastructure::pdf::core`].
//!
//! Pre-R2 wiring (commented out — do not re-enable without removing `pdf/core.rs`):
//!
//! ```ignore
//! // pub const PAGE_WIDTH: i32 = 595;
//! // pub const PAGE_HEIGHT: i32 = 842;
//! // ... ~900 lines of shared PDF primitives lived in this file ...
//! ```

pub use crate::infrastructure::pdf::core::*;
