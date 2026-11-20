# medoc-keygen (admin device only) — Safe Bridge v2

Generates owner activation material plus Bridge C recovery artifacts.

See [`docs/architecture/safe-bridge-recovery.md`](../../docs/architecture/safe-bridge-recovery.md).

## Outputs

| File | Holder | Notes |
|------|--------|-------|
| `activation.json` | Practice | Sealed device/CA/db_key + cleartext `kcv` |
| `license.code` | Public | Device fingerprint only |
| `practice-recovery.share.v2.json` | Practice | **Cleartext** random share (not passphrase-sealed) |
| `practice-recovery.sheet.txt` | Practice safe | Printable forgotten-passphrase path |
| `vendor-recovery.share.v2.json` | Vendor vault | X25519 ECDH + AEAD **with AAD** + `key_id` |
| `vendor-recovery.sk` | Vendor vault (dev) | Ephemeral X25519 sk when no pubkey supplied |

## Build / run

```bash
cmake -S . -B build && cmake --build build
./build/medoc-keygen --out activation.json --passphrase-file pw.txt
./build/medoc-keygen-verify activation.json "your passphrase"
```

Vendor pubkey: `--vendor-recovery-pubkey PATH|HEX` or `MEDOC_VENDOR_RECOVERY_PUBKEY`.

## Interop

Activation AEAD matches Rust importer (`argon2id13` MODERATE + XChaCha20-Poly1305).

Vendor share: ephemeral X25519 → HKDF-SHA256(info=`medoc-vendor-share-v2`) → XChaCha20-Poly1305 with AAD  
`medoc-vendor-share-v2 || cluster_id || fingerprint || key_id || policy`.

KCV = first 16 bytes of HKDF-SHA256(ikm=`db_key`, info=`medoc-kcv-v1`).
