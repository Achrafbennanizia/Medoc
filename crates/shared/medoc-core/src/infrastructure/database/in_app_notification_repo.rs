//! **Legacy flat path** — canonical: `super::repos::praxis::in_app_notification`.
//!
//! Pre-R5 wiring (commented out — SQLx impl moved under `repos/`):
//!
//! ```ignore
//! // pub async fn create(pool: &SqlitePool, ...) -> Result<...> { ... }
//! ```

pub use super::repos::praxis::in_app_notification::*;
