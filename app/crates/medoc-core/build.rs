//! Drives the enums codegen for the domain layer.
//!
//! `domain::enums` lives in this crate and `include!`s
//! `concat!(env!("OUT_DIR"), "/domain_enums_generated.rs")`. Because
//! `env!("OUT_DIR")` expands to the *consuming crate's* build dir at compile
//! time, the file must be produced from THIS crate's `build.rs` — not from
//! the practice-host crate's build.rs.
//!
//! The RBAC codegen stays in the practice crate's `build.rs` because
//! `application::rbac` (which `include!`s `rbac_generated.rs`) still lives
//! in the practice crate.

use std::path::Path;

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    // workspace layout: app/crates/medoc-core/ → repo-root ../../..
    let repo_root = manifest_dir.join("../../..");
    let config_yaml = repo_root.join("config/enums.yaml");
    let ts_out_dir = repo_root.join("app/src/lib");
    let sql_fragments =
        repo_root.join("app/src-tauri/migrations/generated/enum_check_fragments.sql");
    medoc_codegen::enums::run(&config_yaml, &ts_out_dir, &sql_fragments);
}
