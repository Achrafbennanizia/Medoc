//! Three-system boundaries (practice / LAN / company).

pub mod company;
#[cfg(feature = "cap-net")]
pub mod lan;
pub mod main_device;
pub mod practice;
pub mod usb_install_startup;
