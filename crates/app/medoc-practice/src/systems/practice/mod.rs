//! Practice host system — IPC + domain + application.

pub use crate::application;
pub use crate::domain;
pub use crate::error;

pub mod ipc {
    pub use crate::commands;
}
