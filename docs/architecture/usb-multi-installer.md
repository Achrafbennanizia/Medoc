# USB multi-installer and `install_plan`

**Last updated:** 2026-09-01

Sales/ops ships a password-gated USB kit that installs precompiled MeDoc binaries, encodes setup instructions in signed activation material, logs every install on the stick, and wipes temporary files from the client PC.

## Components

| Artifact | Purpose |
|----------|---------|
| `MedocUsbSetup.exe` | Portable setup wizard (Rust) |
| `medoc-usb/vault.sealed` | Encrypted campaign + device slots |
| `medoc-usb/audit.sealed` | Encrypted append-only install log |
| `medoc-usb/payloads/` | Encrypted installer blobs |
| `install_plan` in LicenseV2 | Signed blueprint read by the app on first boot |

## Operator flow

1. Build kit on ops machine: `installer/build-usb-kit.ps1` (Windows) or `build-usb-kit.sh`.
2. Copy kit folder to USB; set password; create campaign (device count, roles, locale, discover window).
3. At practice: run `MedocUsbSetup.exe` → unlock → install next slot.
4. USB updates vault state + audit; PC temp folder wiped.
5. Installed MeDoc reads sidecar / license `install_plan` and applies deployment automatically.
6. Renewals later: manual activation in app (no USB).

## `install_plan` schema (v1)

Rust types: [`crates/shared/medoc-core/src/infrastructure/install_plan.rs`](../../crates/shared/medoc-core/src/infrastructure/install_plan.rs)

| Field | Meaning |
|-------|---------|
| `role` | `MASTER`, `REPLICA`, `SERVER_HOST`, `LAN_CLIENT` |
| `components` | `practice_app`, `lan_server`, `web_client` |
| `topology` | `colocated`, `split_host`, `serverless_peer` |
| `locale` | `en`, `de`, `fr` |
| `flags` | Bitfield (see below) |
| `discover` | `mode`, `address`, `port`, `windowMinutes` |
| `pairingCode` | PIN/code for replica pairing |
| `masterActivationRef` | Reference to master activation material |
| `activationMode` | `auto` or `manual` |
| `deviceLabel` | Human label for sync UI |
| `presetFeatures` | Feature flags to enable on first boot |

### Flag bits

| Bit | Constant | Meaning |
|-----|----------|---------|
| 0 | `FLAG_AUTO_ACTIVATE` | Activate license automatically after install |
| 1 | `FLAG_CHAIN_MEMBER` | Part of a chain campaign |
| 2 | `FLAG_OPEN_PORTS_WINDOW` | Master opens pairing/LAN window |
| 3 | `FLAG_SCAN_LAN` | Replica scans LAN for master |
| 4 | `FLAG_INSTALL_SERVER` | Install `medoc-server` binary |
| 5 | `FLAG_LAN_CLIENT_ONLY` | Thin client (`lan_client` mode) |

Structured fields (`discover.address`, `pairingCode`, etc.) remain authoritative over bits.

## Role → runtime mapping

| Role | Deployment mode | Device role |
|------|-----------------|-------------|
| Master (no server) | `practice_desktop` or `serverless_peer` | `MASTER` |
| Replica | `serverless_peer` | `REPLICA` |
| Server host | N/A (separate `medoc-server` process) | — |
| LAN client | `lan_client` | `REPLICA` |

See also [`deployment-topologies.md`](./deployment-topologies.md).

## Security

- Vendor Ed25519 **private** key never on USB.
- Vault + audit encrypted with Argon2id + XChaCha20-Poly1305 (same family as `medoc-keygen`).
- Pairing windows time-boxed (`discover.windowMinutes`).
- Manual activation path preserved for renewals.

## Build commands

```bash
# App installers (existing)
bash installer/build-app-installers.sh

# LAN server binary
cargo build -p medoc-lan-server --release

# USB setup tool
cargo build -p medoc-usb-setup --release

# Full kit (Windows)
powershell -File installer/build-usb-kit.ps1
```
