//! Practice-host build script.
//!
//! Drives RBAC codegen (consumes `config/rbac.yaml` and emits Rust into
//! `OUT_DIR/rbac_generated.rs` + TypeScript into `app/src/lib/`).
//! Domain-enum codegen + the vendor Ed25519 pubkey embedding both moved to
//! `medoc-core/build.rs` because the modules that `include!` their generated
//! files (`domain::enums`, `infrastructure::license`) now live in the
//! `medoc-core` crate, and `env!("OUT_DIR")` always resolves to the OUT_DIR
//! of the *consuming* crate's build script.
//!
//! Finally invokes `tauri_build::build()` for the Tauri runtime.

use std::path::Path;

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config_dir = manifest_dir.join("../../config");
    let ts_out_dir = manifest_dir.join("../src/lib");
    medoc_codegen::rbac::run(&config_dir.join("rbac.yaml"), &ts_out_dir);
    tauri_build::build();
}
