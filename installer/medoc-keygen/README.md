# medoc-keygen (admin device only)

Generates the root key material for a MeDoc cluster owner device and writes a
sealed `activation.json` manifest that the app imports once on first run.

This tool runs on the **admin (cluster owner) device only**. Member devices
generate just their own device identity in-app and receive everything else
through the approved pairing (PROVISION) flow. They never run this tool.

Distributed **separately** from MeDoc app installers (ops portal / USB).

## What it generates

- `cluster_id` (16 random bytes)
- device ed25519 identity keypair
- cluster CA ed25519 keypair (signs member seat certificates)
- device fingerprint = `base32(sha256(device_pubkey))`, RFC 4648, no padding
- 32-byte database master key

The three secret keys (device secret key, CA secret key, DB master key) are
concatenated and sealed with XChaCha20-Poly1305 under a key derived from the
admin passphrase via Argon2id. Public values are written in clear so the
manifest is inspectable.

## Build

Linux / macOS:

```bash
cmake -S . -B build && cmake --build build
# or: bash ../build-keygen.sh
```

Windows (vcpkg):

```powershell
vcpkg install libsodium:x64-windows
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT\scripts\buildsystems\vcpkg.cmake"
cmake --build build --config Release
```

## Run

```bash
./build/medoc-keygen --out activation.json
```

Non-interactive (CI / automation):

```bash
./build/medoc-keygen --out activation.json --passphrase-file ./pw.txt
./build/medoc-keygen --out activation.json --passphrase-env MEDOC_KEYGEN_PASS
```

Reads the passphrase without echo (interactive), confirms it, writes
`activation.json` with owner-only permissions, and prints the device fingerprint.

The manifest is a secret. Import it once on the owner device, then delete it.

## Interop contract (must match the Rust importer exactly)

| Manifest field | libsodium value here | `argon2` crate equivalent |
|----------------|----------------------|---------------------------|
| `kdf.alg`      | `ALG_ARGON2ID13`     | `Algorithm::Argon2id`, `Version::V0x13` |
| `kdf.ops`      | `OPSLIMIT_MODERATE` = 3 | `t_cost = 3` |
| `kdf.mem`      | `MEMLIMIT_MODERATE` = 268435456 bytes | `m_cost = 262144` (KiB) |
| parallelism    | fixed at 1 by libsodium | `p_cost = 1` |
| output length  | 32                   | output length 32 |

AEAD: `XChaCha20-Poly1305-IETF`, 24-byte nonce, 16-byte tag.

Plaintext: 160 bytes = device_sk (64) || ca_sk (64) || db_key (32). On the Rust
side use the **first 32 bytes** of each libsodium secret key as the
`ed25519-dalek` seed.

## Verify

```bash
./build/medoc-keygen-verify activation.json "your passphrase"
```
