//! **Legacy flat path** — canonical module: [`crate::infrastructure::database::license_repo`].
//!
//! Pre-R1 wiring (commented out):
//!
//! ```ignore
//! // pub const KEY_V1: &str = "license.v1";
//! // pub async fn store_v2(pool: &SqlitePool, envelope: &str) -> Result<(), AppError> { ... }
//! ```

pub use crate::infrastructure::database::license_repo::*;
