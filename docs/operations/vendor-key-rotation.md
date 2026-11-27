# Vendor Ed25519 key rotation

MeDoc embeds a single **vendor Ed25519 public key** at compile time. It verifies:

- Offline **license** tokens (`<json>.<base64-sig>`)
- **Update manifest** entries (`version|url|min_supported` signed payload)

## Build-time public key

Set before every `cargo build` / CI run:

```bash
export MEDOC_VENDOR_PUBKEY="<64 hex chars = 32 raw bytes>"
```

The build script (`app/src-tauri/build.rs`) writes `OUT_DIR/pubkey.rs`:

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

`.github/workflows/ci.yml` sets `MEDOC_VENDOR_PUBKEY` for the Rust job. Local developers must export the same variable (or your org’s production pubkey for release builds).

## Vendor support encryption key (X25519)

A second, separate key: support bundles, error reports and health reports are **sealed** to it, so only the
vendor can read them — not the mail server, the USB stick or a later company server
(`docs/architecture/editions-plan.md` §11.2, code: `medoc-core::infrastructure::support_seal`).
One key per job: the Ed25519 key above signs, this one encrypts; either can be rotated alone.

**Build input:** `MEDOC_VENDOR_SUPPORT_PUBKEY` (64 hex). Release builds take it from the GitHub repository
variable of the same name. Unset or empty: the build seals to the **published dev key** and prints a warning —
fine for development, never for a release that goes to practices.

**Create the key pair (once, on an offline machine):**

```bash
cargo run -p medoc-support-open -- keygen medoc-support-<year>.key
# prints MEDOC_VENDOR_SUPPORT_PUBKEY=<64 hex> and the key id
```

Keep `medoc-support-<year>.key` offline (it is the only way to read support files). Put the printed public
key into the repository variable `MEDOC_VENDOR_SUPPORT_PUBKEY` (Settings → Secrets and variables → Variables).

**Open a support file:**

```bash
cargo run -p medoc-support-open -- open medoc-support-….mdsb --secret medoc-support-2026.key [--secret older.key] [--dev]
```

Each file names its key id in the header; the tool picks the matching secret, so files sealed before a
rotation still open with the old secret. `--dev` opens files from development builds.

**Rotation:** create a new pair, set the new public key in the repository variable, ship a release. Keep every
old secret as long as files sealed to it may still arrive (support files are kept 30 days at most).
