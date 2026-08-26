# Vendor Ed25519 key rotation

MeDoc embeds a single **vendor Ed25519 public key** at compile time. It verifies:

- Offline **license** tokens (`<json>.<base64-sig>`)
- **Update manifest** entries (`version|url|min_supported` signed payload)

## Build-time public key

Set before every `cargo build` / CI run:

```bash
export MEDOC_VENDOR_PUBKEY="<64 hex chars = 32 raw bytes>"
```

The build script (`apps/practice-host/build.rs`) writes `OUT_DIR/pubkey.rs`:

```rust
pub const VENDOR_PUBKEY: [u8; 32] = […];
```

If `MEDOC_VENDOR_PUBKEY` is unset or not exactly 64 hex characters, **the build fails**.

## Generate a new keypair (ops)

```bash
# Example with OpenSSL 3+
openssl genpkey -algorithm ED25519 -out medoc-vendor.pem
openssl pkey -in medoc-vendor.pem -pubout -outform DER \
  | tail -c 32 | xxd -p -c 64   # → MEDOC_VENDOR_PUBKEY value
```

Store the **private** key only in your secrets manager (never in git). Use it to sign licenses and update manifests offline.

## Rotation procedure

1. Generate new keypair; record `issued_at` and key id in your change log.
2. Update CI / release pipelines with the new `MEDOC_VENDOR_PUBKEY`.
3. Ship a MeDoc release that embeds the new public key.
4. Re-sign all active licenses and publish update manifests with the new private key.
5. Keep the previous public key verifiable for one support window if you maintain dual-signed manifests during transition.

## CI

`.github/workflows/verify.yml` and `.github/workflows/release.yml` set `MEDOC_VENDOR_PUBKEY` for Rust jobs. Local developers must export the same variable (or your org’s production pubkey for release builds).
