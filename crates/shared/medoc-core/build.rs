//! Drives:
//! 1. **Domain enums codegen** — produces `OUT_DIR/domain_enums_generated.rs`,
//!    `app/src/lib/enums.generated.ts`, and `migrations/generated/enum_check_fragments.sql`.
//!    `domain::enums` `include!`s the generated `.rs` file via `env!("OUT_DIR")`,
//!    which expands to the *consuming crate's* build dir at compile time, so
//!    the file must be produced by THIS crate's `build.rs`, not the practice crate's.
//! 2. **RBAC codegen** — produces `OUT_DIR/rbac_generated.rs` +
//!    `app/src/lib/rbac.generated.ts`. `application::rbac` (now in medoc-core)
//!    `include!`s the generated Rust file, so the same OUT_DIR constraint applies.
//! 3. **Vendor Ed25519 pubkey embedding** — `infrastructure::license::VENDOR_PUBKEY`
//!    `include!`s `OUT_DIR/pubkey.rs`.

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    // workspace layout: crates/shared/medoc-core/ → repo-root ../../../
    let repo_root = manifest_dir.join("../../..");
    let config_dir = repo_root.join("config");
    let ts_out_dir = repo_root.join("packages/shared/src/lib");
    let sql_fragments = manifest_dir.join("migrations/generated/enum_check_fragments.sql");
    medoc_codegen::enums::run(&config_dir.join("enums.yaml"), &ts_out_dir, &sql_fragments);
    medoc_codegen::rbac::run(&config_dir.join("rbac.yaml"), &ts_out_dir);

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

    // License v2 envelope seed (NFA-LIC-02). 32 bytes hex.
    // Optional: when unset we use a deterministic dev seed so existing CI keeps building.
    // Production builds MUST set MEDOC_VENDOR_SEED.
    const DEV_SEED_HEX: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    let seed_hex = env::var("MEDOC_VENDOR_SEED").unwrap_or_else(|_| {
        println!(
            "cargo:warning=MEDOC_VENDOR_SEED not set — using deterministic dev seed (licenses encrypted with this key are NOT secure)"
        );
        DEV_SEED_HEX.to_string()
    });
    let seed_hex = seed_hex.trim();
    if seed_hex.len() != 64 {
        panic!(
            "MEDOC_VENDOR_SEED must be exactly 64 hex characters (got {} chars)",
            seed_hex.len()
        );
    }
    let mut seed_bytes = [0u8; 32];
    for (i, chunk) in seed_hex.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).expect("MEDOC_VENDOR_SEED must be ASCII hex");
        seed_bytes[i] = u8::from_str_radix(pair, 16)
            .unwrap_or_else(|_| panic!("MEDOC_VENDOR_SEED contains invalid hex at byte {i}"));
    }
    let seed_dest = Path::new(&out_dir).join("license_seed.rs");
    let seed_body = format!("pub const VENDOR_LICENSE_SEED: [u8; 32] = {seed_bytes:?};\n");
    fs::write(&seed_dest, seed_body).expect("write OUT_DIR/license_seed.rs");
    println!("cargo:rerun-if-env-changed=MEDOC_VENDOR_SEED");
}
