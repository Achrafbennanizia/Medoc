//! Embeds the vendor Ed25519 public key at compile time (`OUT_DIR/pubkey.rs`).
//!
//! Set `MEDOC_VENDOR_PUBKEY` to 64 hex characters (32 raw bytes) before building.
//! RBAC matrix: `config/rbac.yaml` → `OUT_DIR/rbac_generated.rs` + `app/src/lib/rbac.generated.ts`.
//! Domain enums: `config/enums.yaml` → `OUT_DIR/domain_enums_generated.rs` + `app/src/lib/enums.generated.ts`.

#[path = "build/enums_codegen.rs"]
mod enums_codegen;

#[path = "build/rbac_codegen.rs"]
mod rbac_codegen;

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    enums_codegen::run(manifest_dir);
    rbac_codegen::run(manifest_dir);
    let hex = env::var("MEDOC_VENDOR_PUBKEY").unwrap_or_else(|_| {
        panic!(
            "MEDOC_VENDOR_PUBKEY must be set to 64 hex chars (32-byte Ed25519 public key) before building medoc"
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
    let body = format!("pub const VENDOR_PUBKEY: [u8; 32] = {:?};\n", bytes);
    fs::write(&dest, body).expect("write OUT_DIR/pubkey.rs");

    println!("cargo:rerun-if-env-changed=MEDOC_VENDOR_PUBKEY");
    tauri_build::build();
}
