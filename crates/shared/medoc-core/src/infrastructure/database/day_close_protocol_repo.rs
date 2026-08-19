//! **Legacy flat path** — canonical: `super::repos::billing::day_close_protocol`.
//!
//! Pre-R5 wiring (commented out — SQLx impl moved under `repos/`):
//!
//! ```ignore
//! // pub async fn create(pool: &SqlitePool, ...) -> Result<...> { ... }
//! ```

pub use super::repos::billing::day_close_protocol::*;
