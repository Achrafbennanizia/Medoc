//! **Legacy flat path** — canonical: `super::repos::clinical::akte_validation`.
//!
//! Pre-R5 wiring (commented out — SQLx impl moved under `repos/`):
//!
//! ```ignore
//! // pub async fn create(pool: &SqlitePool, ...) -> Result<...> { ... }
//! ```

pub use super::repos::clinical::akte_validation::*;
