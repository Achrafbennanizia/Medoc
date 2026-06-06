//! **Legacy flat path** — canonical: `super::repos::billing::bilanz_snapshot`.
//!
//! Pre-R5 wiring (commented out — SQLx impl moved under `repos/`):
//!
//! ```ignore
//! // pub async fn create(pool: &SqlitePool, ...) -> Result<...> { ... }
//! ```

pub use super::repos::billing::bilanz_snapshot::*;
