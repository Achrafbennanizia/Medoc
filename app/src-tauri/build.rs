//! Practice-host build script.
//!
//! All shared codegen (domain enums, RBAC matrix, vendor Ed25519 pubkey)
//! moved to `medoc-core/build.rs` because the modules that `include!`
//! the generated files now live in the `medoc-core` crate, and
//! `env!("OUT_DIR")` always resolves to the OUT_DIR of the *consuming*
//! crate's build script.
//!
//! This script now only drives `tauri_build::build()` for the Tauri
//! runtime (capabilities/ACL schema, Info.plist, code signing handoff).

fn main() {
    tauri_build::build();
}
