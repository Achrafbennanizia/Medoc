//! MeDoc is split into **three deployable systems** with explicit boundaries (SOLID).
//!
//! | System | Crate module | Binary | Database |
//! |--------|--------------|--------|----------|
//! | **Practice Host** | [`practice`] | `medoc` (Tauri) | `medoc.db` |
//! | **LAN** | [`lan`] | `medoc-server` (embedded in Tauri) | same `medoc.db` |
//! | **Company** | [`company`] | `medoc-company-server` | `company.db` |
//!
//! Cross-system calls use adapters only (e.g. LAN → Company via [`company::CompanyPortalHttpAdapter`]).
//! Practice commands remain under `crate::commands` (IPC surface of the host).

pub mod company;
pub mod lan;
pub mod practice;
