//! **Legacy flat path** — canonical: `super::repos::practice::purchase_order`.
//!
//! Pre-R5 wiring (commented out — SQLx impl moved under `repos/`):
//!
//! ```ignore
//! // pub async fn create(pool: &SqlitePool, ...) -> Result<...> { ... }
//! ```

pub use super::repos::practice::purchase_order::*;
