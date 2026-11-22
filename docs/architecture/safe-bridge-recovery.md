# Safe Bridge Recovery (ADR) — v2

**Status:** Accepted (v2)  
**Date:** 2026-11-20  
**Supersedes:** v1 (passphrase-sealed practice share + `crypto_box_seal`)  
**Related:** [`installer/medoc-keygen`](../../installer/medoc-keygen/README.md), [`installer/medoc-recovery`](../../installer/medoc-recovery/README.md), [`db_key.rs`](../../crates/shared/medoc-core/src/infrastructure/database/db_key.rs)

## Context

Practice PHI lives in SQLCipher (`medoc.db`). The day-to-day key lives in the OS keychain. If the keychain is lost and there is no recoverable wrap, the database is permanently unreadable. We need offline recovery that is a **safe bridge** for the practice, not a vendor backdoor.

v1 sealed the practice half of Bridge C under the same passphrase as Bridges A and B. A forgotten passphrase then failed all three paths. v2 makes Bridge C the forgotten-passphrase path via a printed random share.

## Decision

Three independent bridges can reconstruct the same **per-device** 32-byte SQLCipher master key. None derive the key from the vendor license envelope alone.

| Bridge | Practice holds | Vendor holds | Alone can open DB? |
|--------|----------------|--------------|--------------------|
| A — Activation kit | `activation.json` + practice passphrase | — | Practice yes |
| B — Passphrase wrap | `db-key.wrap` + `db-key.salt` + `db-key.kcv` + practice passphrase | — | Practice yes |
| C — Split knowledge | Printed recovery sheet (random 32-byte share) | `vendor-recovery.share.v2.json` + X25519 recovery private key | **Neither** alone |

Standalone tools: **`medoc-recovery`** (Rust CLI) and **`medoc-recovery-ui`** (small egui window, same stack as USB Setup). They reconstruct the key, verify KCV, and write `db-key.wrap` for the main app. They do **not** write the OS keychain (macOS ACL issues). The Tauri app unlocks via existing `unlock_with_passphrase`. Both can create a new recovery result file as **JSON**, **XML**, or **YAML** (`medoc-recovery-result.v1`; plaintext `key_hex` is opt-in only).

The UI keeps a local store under `~/Library/Application Support/MeDocRecovery/` (`vendor/` for `vendor-recovery.sk`, `kit/` for activation/shares). It auto-scans common locations, copies matches into that store, and fills path fields. Vendors rotate keys by replacing files in `vendor/` (then Rescan).

### Per-device keys

Each install has its own SQLCipher key. Owner activation recovers the **owner** device. Replicas keep separate local keys; after new hardware they re-pair and re-sync from the master. There is no cluster-wide shared `db_key`.

### Auth ticket

`medoc-recovery-auth.v1` is a **process / audit control** only. Whoever holds the vendor recovery private key can skip it. The threat model does not count the ticket as cryptographic protection.

## Naming glossary

| Name | Meaning |
|------|---------|
| `license.code` / device fingerprint | Public `base32(sha256(device_pubkey))` — not a decrypt key |
| Vendor license `v2.*` | Entitlement envelope bound to `device_id` — not the DB key |
| Practice passphrase | Unseals Bridge A and/or Bridge B only |
| Practice recovery sheet | Random 32-byte share (BIP39 words + machine JSON) — Bridge C |
| Vendor recovery keypair | **X25519 only** (encryption). Not the license Ed25519 signing key |
| `key_id` | Identifies which vendor recovery public key sealed the share |
| `kcv` | Key-check value: first 16 bytes of `HKDF-SHA256(ikm=db_key, info="medoc-kcv-v1")` |

## Threat model

| Actor / event | Must NOT open PHI DB alone | May recover with |
|---------------|----------------------------|------------------|
| Vendor / ops | License token, vendor pubkey, vendor share alone, auth ticket | Bridge C after practice presents the printed sheet |
| Thief with disk image | `medoc.db` without key material | Offline brute-force of wrap/activation if passphrase is weak — mitigate with passphrase policy + Argon2 |
| Forgotten passphrase | Bridges A and B fail | Bridge C (sheet + vendor share) |
| New hardware | Current machine fingerprint unused | Mint-time fingerprint from share **header** |
| Lost vendor recovery key | Bridge C gone for all customers sealed to that `key_id` | Ops must backup/split the X25519 secret |

**`db-key.wrap` is key material** sitting next to `medoc.db`. Security depends on passphrase strength and Argon2 parameters.

**Backups** must include `medoc.db` **and** `db-key.wrap` + `db-key.salt` + `db-key.kcv`, or Bridge B fails after restore.

**Rekey:** if SQLCipher is rekeyed, every share and wrap become stale. Regenerating the kit must reissue the practice sheet and vendor share; stale shares fail KCV.

## Public binding (AAD)

Never sufficient alone. Vendor ciphertext AAD (v2):

```
UTF-8("medoc-vendor-share-v2") || cluster_id(16) || UTF-8(mint_fingerprint) || key_id(8) || uint32_be(policy_version)
```

Recovery reads `device_fingerprint` / `key_id` / `cluster_id` from the **share header**, never from the current machine (new-hardware case).

## Bridge A — Activation kit

Plaintext inside `activation.json` (160 bytes):

`device_sk(64) ‖ ca_sk(64) ‖ db_key(32)`

Sealed with Argon2id13 (libsodium MODERATE) → XChaCha20-Poly1305 under the practice passphrase. Cleartext field `kcv` (base64, 16 bytes).

## Bridge B — Practice wrap

- Tag `v2:` + base64(`nonce(24) ‖ XChaCha20-Poly1305(key)`)
- KEK = Argon2id(m=19456 KiB, t=2, p=1) over `salt ‖ "medoc-db-key-wrap-v2"`
- Files: `db-key.salt`, `db-key.wrap`, `db-key.kcv`
- Passphrase must satisfy the app password policy (length + character classes); offline brute-force risk remains

## Bridge C — XOR split (forgotten passphrase)

1. `practice_share = random(32)` — **not** derived from the passphrase  
2. `vendor_share = db_key XOR practice_share`  
3. Practice: printed sheet + cleartext `practice-recovery.share.v2.json` (no passphrase seal)  
4. Vendor: ephemeral X25519 ECDH with vendor recovery public key → HKDF-SHA256 → XChaCha20-Poly1305 with AAD; file `vendor-recovery.share.v2.json`

Schemas: [`docs/architecture/schemas/`](schemas/).

## Vendor share crypto (not sealed box)

`crypto_box_seal` has **no AAD**. v2 uses:

1. Ephemeral X25519 keypair  
2. Shared secret = X25519(ephemeral_sk, vendor_pk)  
3. `KEK = HKDF-SHA256(ikm=shared_secret, salt=empty, info="medoc-vendor-share-v2")` (32 bytes)  
4. Encrypt `vendor_share` with XChaCha20-Poly1305, AAD as above  
5. Store `ephemeral_pubkey`, `nonce`, `ciphertext`, header fields, `kcv`, `key_id`

## Auth ticket (process only)

Kind `medoc-recovery-auth.v1`. Signed by the vendor **license** Ed25519 key. Canonical message unchanged from v1. Does not unlock crypto.

## Non-goals / forbidden

- Deriving SQLCipher key from `v2.*` license alone  
- Deriving practice share from the practice passphrase  
- Company portal returning raw DB keys  
- Silent remote rekey from vendor API  
- Counting the auth ticket as a cryptographic gate  
- Recovery CLI writing the OS keychain

## Consequences

- Keygen emits printed sheet + cleartext practice share JSON + vendor share v2  
- Ops run Rust `medoc-recovery`; main app unlocks via wrap  
- Practices must retain Bridge A kit **or** Bridge B passphrase **or** the printed sheet for Bridge C  
- Vendor vault holds sealed vendor shares + X25519 recovery private key(s), backed up / split by `key_id`

## Success criteria

- Forgotten passphrase + printed sheet + vendor share → Bridge C recovers (KCV OK) → wrap written → app unlocks  
- Recovery works on new hardware using mint-time fingerprint from the share header  
- Wrong share → KCV failure before SQLCipher  
- Vendor share alone / license alone / auth ticket alone → cannot open DB  
- Bridges A and B still work when the passphrase is known  

## Validation (how to re-run)

Manual walkthrough and expected outputs: [`installer/medoc-recovery/README.md`](../../installer/medoc-recovery/README.md) (§ Live demo).

Automated smoke (A == C key, wrap write, Bridge B unlock, wrong-share KCV fail):

```bash
./installer/medoc-recovery/scripts/smoke-bridges-v2.sh
```

Verified locally (2026-11-20): kit under `.tmp/medoc-recovery-demo`; A/C/B same `key_hex`; wrong practice share → `KCV mismatch` before SQLCipher.
