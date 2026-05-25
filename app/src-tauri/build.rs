//! Embeds the vendor Ed25519 public key at compile time (`OUT_DIR/pubkey.rs`).
//! Delegates RBAC + domain-enum codegen to the `medoc-codegen` build-time
//! crate (consumes `config/rbac.yaml` + `config/enums.yaml` and emits Rust
//! into `OUT_DIR/`, TypeScript into `app/src/lib/`, and SQL CHECK fragments
//! into `app/src-tauri/migrations/generated/`).

use std::env;
use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config_dir = manifest_dir.join("../../config");
    let ts_out_dir = manifest_dir.join("../src/lib");
    let sql_fragments = manifest_dir.join("migrations/generated/enum_check_fragments.sql");
    medoc_codegen::enums::run(&config_dir.join("enums.yaml"), &ts_out_dir, &sql_fragments);
    medoc_codegen::rbac::run(&config_dir.join("rbac.yaml"), &ts_out_dir);
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
