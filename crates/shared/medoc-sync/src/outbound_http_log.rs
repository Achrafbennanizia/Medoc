//! Failed outgoing API calls are logged by the shared helper (`medoc_core::infrastructure::logging::outbound_http`).
pub use medoc_core::infrastructure::logging::outbound_http::{send_failed, status_failed};
