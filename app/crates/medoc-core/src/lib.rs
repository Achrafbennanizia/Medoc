//! MeDoc core: domain + non-Tauri infrastructure.
//!
//! Wave B3 — placeholder crate. Real source lifts (domain, error, crypto,
//! database, logging, PDF, …) happen in Waves B5+ once the constraints
//! catalogued in `docs/coordination/wave-b-crate-mapping.md` (Tauri leakage
//! in `application/rbac.rs`, `infrastructure/database/connection.rs`,
//! crate-root macro re-homing, OUT_DIR codegen pathing) are resolved.
