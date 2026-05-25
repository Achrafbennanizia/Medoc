//! # Practice Host System
//!
//! Authoritative clinical and praxis runtime: Tauri desktop + SQLCipher `medoc.db`.
//!
//! - **Presentation:** React UI via Tauri IPC (`crate::commands::*`).
//! - **Domain:** `crate::domain` entities and services (pricing, workflow, …).
//! - **Application:** `crate::application` use cases (auth, RBAC, audit guard, …).
//! - **Infrastructure:** `crate::infrastructure` except LAN/company HTTP servers.
//!
//! Design patterns: **Facade** (`commands::register`), **Repository** (`infrastructure::database::*_repo`),
//! **Strategy** (RBAC permission checks), **Observer** (audit chain guard).

pub use crate::application;
pub use crate::domain;
pub use crate::error;

/// IPC command surface for the practice host (single registration point).
pub mod ipc {
    pub use crate::commands;
}
