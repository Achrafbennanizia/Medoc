//! **Legacy flat path** — canonical module: [`crate::http::sync`].
//!
//! Pre-R3 wiring (commented out — router lived in `http.rs` + this file):
//!
//! ```ignore
//! // pub async fn sync_push(...) -> Result<...> { ... }
//! // pub async fn sync_pull(...) -> Result<...> { ... }
//! // pub async fn verify_activation_for_path(...) -> Result<...> { ... }
//! ```

pub use crate::http::sync::*;
