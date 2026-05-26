//! Drives:
//! 1. **Domain enums codegen** — produces `OUT_DIR/domain_enums_generated.rs`,
//!    `app/src/lib/enums.generated.ts`, and `migrations/generated/enum_check_fragments.sql`.
//!    `domain::enums` `include!`s the generated `.rs` file via `env!("OUT_DIR")`,
//!    which expands to the *consuming crate's* build dir at compile time, so
//!    the file must be produced by THIS crate's `build.rs`, not the practice crate's.
//! 2. **Vendor Ed25519 pubkey embedding** — same `OUT_DIR` constraint:
//!    `infrastructure::license::VENDOR_PUBKEY` `include!`s `OUT_DIR/pubkey.rs`.
//!
//! The RBAC codegen stays in the practice crate's `build.rs` because
//! `application::rbac` (which `include!`s `rbac_generated.rs`) still lives
//! there.

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    // workspace layout: app/crates/medoc-core/ → repo-root ../../..
    let repo_root = manifest_dir.join("../../..");
    let config_yaml = repo_root.join("config/enums.yaml");
    let ts_out_dir = repo_root.join("app/src/lib");
    let sql_fragments = manifest_dir.join("migrations/generated/enum_check_fragments.sql");
    medoc_codegen::enums::run(&config_yaml, &ts_out_dir, &sql_fragments);

    let hex = env::var("MEDOC_VENDOR_PUBKEY").unwrap_or_else(|_| {
        panic!(
            "MEDOC_VENDOR_PUBKEY must be set to 64 hex chars (32-byte Ed25519 public key) before building medoc-core"
        );
    });
    let hex = hex.trim();
    if hex.len() != 64 {
        panic!(
            "MEDOC_VENDOR_PUBKEY must be exactly 64 hex characters (got {} chars)",
            hex.len()
        );
    }
    let mut bytes = [0u8; 32];
    for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).expect("MEDOC_VENDOR_PUBKEY must be ASCII hex");
        bytes[i] = u8::from_str_radix(pair, 16)
            .unwrap_or_else(|_| panic!("MEDOC_VENDOR_PUBKEY contains invalid hex at byte {i}"));
    }

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR");
    let dest = Path::new(&out_dir).join("pubkey.rs");
    let body = format!("pub const VENDOR_PUBKEY: [u8; 32] = {bytes:?};\n");
    fs::write(&dest, body).expect("write OUT_DIR/pubkey.rs");

    println!("cargo:rerun-if-env-changed=MEDOC_VENDOR_PUBKEY");
}
