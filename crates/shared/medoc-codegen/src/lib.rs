//! Build-time codegen helpers for MeDoc.
//!
//! Two YAML sources under `config/` are compiled into Rust + TypeScript +
//! SQL artifacts every build:
//!
//! - [`enums::run`] — `config/enums.yaml` →
//!   `OUT_DIR/domain_enums_generated.rs`, `app/src/lib/enums.generated.ts`,
//!   `app/src/lib/schemas.enums.generated.ts`,
//!   `migrations/generated/enum_check_fragments.sql`.
//! - [`rbac::run`]  — `config/rbac.yaml`  →
//!   `OUT_DIR/rbac_generated.rs`, `app/src/lib/rbac.generated.ts`.
//!
//! Both functions take the consuming crate's `CARGO_MANIFEST_DIR` (the
//! `app/src-tauri/` directory) and resolve YAML inputs + TS outputs
//! relative to it. They are intended to be called from a `build.rs`.

pub mod enums;
pub mod rbac;
