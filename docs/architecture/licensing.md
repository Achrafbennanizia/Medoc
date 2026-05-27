# Licensing (v2: perpetual, device-bound, signed + AES-GCM encrypted)

**Last updated:** 2026-05-26  
**Crate:** `app/crates/medoc-core` (`infrastructure::license`, `infrastructure::license_repo`)  
**Tests:** `app/crates/medoc-core/tests/license_v2_tests.rs`

## TL;DR

A MeDoc master device runs only when it can decrypt and signature-verify a
v2 license envelope bound to **its own** `device_id`. The license is a
**perpetual** entitlement — there is no recurring expiry — and is gated
by the boot-time `LicenseAndPairingGate` in the UI. Replicas do **not**
require a license; they authenticate through the master's signed
activation token.

## Envelope format

```
LicenseV2 (cleartext JSON, signed by vendor Ed25519)
  ├── device_id        — UUID of the bound device
  ├── activated_at     — RFC3339 timestamp
  ├── product          — "medoc-master" | "medoc-master-pro" | …
  └── (optional) note

→ AES-GCM-256 encrypted with HKDF(vendor_seed, info=device_id)
→ Base64-encoded payload distributed to the customer
```

`encrypt_v2_for_device` (vendor side) and `verify_v2_envelope` (client
side) live in `infrastructure::license`. Both bindings use the same
HKDF-derived key, so the same envelope cannot be decrypted on a different
machine — `derive_device_key(seed, device_id)` returns a different key
when `device_id` changes.

## Vendor seed + public key

Both are baked into the binary at build time by `medoc-core/build.rs`:

| Env var | Effect |
|---------|--------|
| `MEDOC_VENDOR_PUBKEY` | 64 hex chars (32-byte Ed25519 public key). **Required.** |
| `MEDOC_VENDOR_SEED`   | 64 hex chars (32-byte HKDF seed). Optional; falls back to a deterministic dev seed with a build warning. |

CI sets both via repository secrets; the dev default is **not** secure but
is reproducible so unit tests can sign/encrypt round-trip without injecting
secrets.

## Verification path (master boot)

1. `system_commands::activate_license` (Tauri IPC) accepts the
   base64-encoded envelope from the user.
2. `license_repo::ensure_device_id` reads or mints the master's
   `sync.device_id.v1` from `app_kv`.
3. `license::verify(token, local_device_id)` dispatches to
   - `verify_v2_envelope` (AES-GCM decrypt → Ed25519 verify → device
     binding check), or
   - `verify_v1` (legacy non-encrypted path, kept until all customers are
     on v2).
4. On success, the envelope is persisted in `app_kv` under `license.v2`.
5. `current_license_status` returns the resolved status to the UI on
   subsequent boots — no re-prompt unless the license is cleared.

`verify_v2_envelope` rejects:

- AES-GCM tag mismatch (tampered ciphertext).
- Ed25519 signature mismatch (wrong vendor key).
- `device_id` in the inner payload not matching `local_device_id`
  (license belongs to another machine).
- Malformed JSON / base64 padding.

## Persistence

| Key | Contents |
|-----|----------|
| `app_kv["license.v2"]` | Base64 envelope, AES-GCM ciphertext. |
| `app_kv["license.v1"]` | Legacy JSON token (still verifiable, retained for backward compat). |
| `app_kv["sync.device_id.v1"]` | Master's UUID. Used as HKDF salt and pairing identity. |

The `app_kv` outbox hook (Slice 5) **excludes** these keys from sync
replication (they would clobber per-device identity if replicated).

## Replica authentication (no license)

Replicas pair with a master and receive a `mt2.<payload>.<sig>` activation
token signed by the master's Ed25519 keypair (`medoc-sync::master_keys`).
The token contains `device_id`, `master_device_id`, `allowed_actions[]`,
`issued_at`, and `nonce`. Token verification (`pairing::verify_activation_token`)
fails if any field is altered.

The LAN router accepts mt2 tokens **only** on:
- `POST /api/v1/sync/push`
- `POST /api/v1/sync/pull`
- `GET  /api/v1/sync/status`
- `GET  /api/v1/pairing/peers`

Other protected routes reject mt2 with HTTP 403; replicas use the legacy
JWT (login flow) for general LAN access.

## Threat model & residual risks

| Threat | Mitigation | Residual |
|--------|------------|----------|
| License copied to another machine | HKDF key derives from `device_id`; envelope fails to decrypt. | Customer running same `device_id` (mirrored OS image) — out of scope. |
| Vendor key compromise | Ed25519 signature fails; client-side rejection is the only check. | Vendor key rotation requires a binary update (no in-product re-keying). |
| Envelope tampering | AES-GCM AEAD + Ed25519 signature both fail. | — |
| Time manipulation on host | License is perpetual; `activated_at` is informational only. | No support-window enforcement (deliberate). |
| Replica acting without master | Replicas have no license; activation token signature fails after revocation. | Mesh peer push not yet signed (BEST-EFFORT, see `serverless-sync.md`). |

## What was explicitly **not** built

- In-product license renewal / billing portal.
- Time-bound entitlements (`expires_at`) — the perpetual model was a
  product decision.
- Binary obfuscation / anti-tamper of compiled Rust. The plan rejected
  "encrypt every microservice" as YAGNI; TLS + SQLCipher + signed tokens
  meet the threat model.
- Customer-portal IPC for self-service activation rollback.

## Related docs

- [serverless-sync.md](./serverless-sync.md)
- [three-systems.md](./three-systems.md)
- [deployment-topologies.md](./deployment-topologies.md)
