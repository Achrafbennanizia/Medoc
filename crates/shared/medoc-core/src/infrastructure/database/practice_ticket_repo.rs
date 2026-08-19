//! **Legacy flat path** — canonical: `super::repos::scheduling::practice_ticket`.
//!
//! Pre-R5 wiring (commented out — SQLx impl moved under `repos/`):
//!
//! ```ignore
//! // pub async fn create(pool: &SqlitePool, ...) -> Result<...> { ... }
//! ```

pub use super::repos::scheduling::practice_ticket::*;
