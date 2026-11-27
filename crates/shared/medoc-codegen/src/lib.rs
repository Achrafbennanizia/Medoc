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
//! - [`editions::run`] — `config/editions.yaml` →
//!   `OUT_DIR/edition_generated.rs`, `packages/shared/src/lib/edition.generated.ts`.
//!
//! Both functions take the consuming crate's `CARGO_MANIFEST_DIR` (the
//! `app/src-tauri/` directory) and resolve YAML inputs + TS outputs
//! relative to it. They are intended to be called from a `build.rs`.

pub mod editions;
pub mod enums;
pub mod rbac;

/// Writes a generated file only when its content changed. Files in the source tree are watched
/// (Vite, `tauri dev`): rewriting them on every build restarted the dev app in a loop.
pub(crate) fn write_if_changed(path: &std::path::Path, body: &str) {
    if std::fs::read_to_string(path).ok().as_deref() != Some(body) {
        std::fs::write(path, body).unwrap_or_else(|e| panic!("write {}: {e}", path.display()));
    }
}
