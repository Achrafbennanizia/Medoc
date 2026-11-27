//! IPC commands — network domain.
//!
//! Everything except the vendor portal and this device's own licence and status (`local`) talks
//! to other devices: only editions with `cap-net` (docs/architecture/editions-plan.md §4.2).

#[cfg(feature = "cap-net")]
pub mod cluster;
pub mod company_portal;
#[cfg(feature = "cap-net")]
pub mod lan;
pub mod local;
#[cfg(feature = "cap-net")]
pub mod pairing;
#[cfg(feature = "cap-net")]
pub mod reconnect_update_check;
#[cfg(feature = "cap-net")]
pub mod sync;
#[cfg(feature = "cap-net")]
pub mod sync_problems;
