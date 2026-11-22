//! The main device as seen from this device: whether this device *is* the main device, the
//! signed-in person's link to it, and running main-only operations there.
//! See docs/architecture/device-flavors-and-access.md.

pub mod link;
pub mod role;

pub use link::{clear_link, establish_link, forward, link_status, LinkStatus};
pub use role::{device_info, is_main_device, placement_of, DeviceInfo};
