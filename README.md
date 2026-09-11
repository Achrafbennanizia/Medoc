# MeDoc

**MeDoc** is a local **dental practice management system** (Zahnarztpraxis-PVS) for patient records, appointments, clinical documentation, prescriptions/certificates, billing, staff, inventory, and compliance audit trails.

| | |
|---|---|
| **Product** | MeDoc desktop (`de.medoc.app`), version `0.1.0` |
| **Stack** | React 19 + Vite 6 + TypeScript · Rust 2021 · Tauri 2 · SQLCipher SQLite |
| **License** | Proprietary — see [`LICENSE`](LICENSE) (not open source) |
| **Intended use** | Administrative / documentation tool for licensed dental staff — **not** an MDR medical device (see [`docs/benutzerhandbuch.md`](docs/benutzerhandbuch.md)) |

This repository is a **monorepo** with three independently runnable systems, shared Rust/TS libraries, installers, and validation tooling.

---

## Table of contents

1. [What MeDoc does](#1-what-medoc-does)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Security](#4-security)
5. [Languages (i18n)](#5-languages-i18n)
6. [UI philosophy and principles](#6-ui-philosophy-and-principles)
7. [Features and navigation](#7-features-and-navigation)
8. [Installer and end-user install](#8-installer-and-end-user-install)
9. [Developer setup](#9-developer-setup)
10. [Build, compile, and run](#10-build-compile-and-run)
11. [Demo and test accounts](#11-demo-and-test-accounts)
12. [Testing and CI](#12-testing-and-ci)
13. [Configuration sources of truth](#13-configuration-sources-of-truth)
14. [Further documentation](#14-further-documentation)

---

## 1. What MeDoc does

MeDoc runs primarily **on-device**. Clinical and practice data live in an encrypted SQLite database (`medoc.db`). Optional LAN and company portal pieces support multi-device practices and vendor/admin workflows.

### Core domains (high level)

- **Patients & charts** — master data, clinical charts, validation queue, GDPR erase paths
- **Appointments** — calendar and scheduling
- **Inbox / tickets / practice tasks** — reception ↔ physician workflows
- **Prescriptions & certificates** — AMVV-oriented document flows
- **Finance** — open bookings, payments, cash desk, purchase orders, services/catalogs
- **Staff & administration** — work time, team, templates, day-close, inventory, contracts
- **Settings, audit, privacy, ops** — locale, license, backup/restore, compliance exports

### Three systems

| # | System | Role | Binary / app | Database |
|---|--------|------|--------------|----------|
| 1 | **Practice Host** | Desktop clinical UI + local DB + Tauri IPC | `medoc` (Tauri) | `medoc.db` |
| 2 | **LAN** | HTTPS API for practice LAN clients / sync | `medoc-lan-server` (also embeddable) | same `medoc.db` |
| 3 | **Company** | Vendor / company portal HTTP API | `medoc-company-server` | `company.db` |

Plus a **browser-only LAN web client** (`apps/lan-web-client`) that talks HTTPS to the LAN server — no Tauri, no local SQLite.

### Deployment modes (practice)

| Mode | Data | Typical use |
|------|------|-------------|
| `practice_desktop` | Local Tauri + SQLCipher | Single workstation |
| `lan_client` | Remote HTTPS only | Thin client against a LAN host |
| `serverless_peer` | Local DB + outbox sync (MASTER / REPLICA) | Multi-device without a dedicated always-on server role |

Details: [`docs/architecture/deployment-topologies.md`](docs/architecture/deployment-topologies.md), [`docs/architecture/serverless-sync.md`](docs/architecture/serverless-sync.md).

---

## 2. Architecture

### Layering (frontend → backend)

```
React pages / views
  → controllers (per system)
  → ports (PracticeSystemPort | LanSystemPort | CompanySystemPort)
  → adapters (Tauri IPC | HTTP)
  → Rust: Practice IPC | LAN HTTPS | Company HTTP
```

Design intent: **SOLID** boundaries and GoF patterns (Adapter, Facade, Repository, Strategy for RBAC, etc.) — mapped in [`docs/architecture/three-systems.md`](docs/architecture/three-systems.md).

### Rust crate graph (simplified)

```
medoc (apps/practice-host)          # Tauri shell
  └── medoc-practice
        ├── medoc-core              # domain, DB, PDF, GDPR, crypto helpers
        ├── medoc-lan               # LAN HTTP stack (also used embedded)
        ├── medoc-company           # company client adapter
        └── medoc-sync              # outbox / peer sync engine

medoc-lan-server     → medoc-lan → medoc-core + medoc-sync
medoc-company-server → medoc-company → medoc-core
```

Headless servers **must not** depend on Tauri. See [`crates/README.md`](crates/README.md).

### TypeScript package tiers

```
@medoc/shared            packages/shared     — models, i18n, RBAC helpers, generated enums
@medoc/ui                packages/ui         — design-system components
@medoc/system-practice   packages/app/…      — practice controllers / pages
@medoc/system-lan        packages/server/lan
@medoc/system-company    packages/server/company
```

Desktop shell (routing, layouts, Vite entry) lives in **`apps/practice-host-ui`**.  
See [`packages/README.md`](packages/README.md), [`docs/README-frontend.md`](docs/README-frontend.md).

### Network defaults (dev / docs)

| Service | Default |
|---------|---------|
| Vite practice UI | `http://localhost:1420` |
| LAN web client | `http://localhost:1421` |
| LAN HTTPS API | `https://127.0.0.1:8787` |
| Company HTTP API | port **9797** (`/v1/*`) |

LAN TLS uses **self-signed** material under the app data directory (`lan-tls.{crt,key}`); fingerprint is exposed for pinning / discovery.

### Auth / boot gates

`LicenseAndPairingGate` blocks the main app until:

- a valid **license.v2** exists for owner devices, or
- a **REPLICA** has completed **pairing** (activation token) in serverless mode.

Onboarding routes: license → subscription/account/join → `/login`.

---

## 3. Repository layout

```
Medoc/
├── apps/
│   ├── practice-host/          Tauri binary crate `medoc` (npm: medoc-tauri-host)
│   │                           tauri.conf.json, icons, Rust src, integration tests
│   ├── practice-host-ui/       React + Vite shell (npm: medoc); src-tauri → ../practice-host
│   └── lan-web-client/         Browser client → LAN HTTPS (no Tauri)
├── crates/
│   ├── app/medoc-practice/     Practice IPC / commands
│   ├── server/lan/             medoc-lan + medoc-lan-server
│   ├── server/company/         medoc-company + medoc-company-server
│   ├── shared/                 medoc-core, medoc-sync, medoc-codegen
│   └── test/medoc-e2e/         Cross-system e2e
├── packages/                   npm workspace (@medoc/*)
├── config/
│   ├── rbac.yaml               RBAC source of truth (codegen → Rust + TS)
│   └── enums.yaml              Domain enums SoT (English ids; wire values as needed)
├── installer/
│   ├── medoc-usb-setup/        USB field installer (Rust / egui)
│   ├── medoc-keygen/           Offline admin keygen (C++)
│   ├── build-usb-kit.{sh,ps1}
│   ├── build-keygen.{sh,ps1}
│   └── build-app-installers.sh
├── docker/ci/                  Linux validation images
├── tools/                      Dev helpers (dev-tauri, G21 smoke, coverage)
├── scripts/                    CI, i18n, validate-*, Windows OpenSSL unwrap
├── docs/                       Architecture, i18n, handbook, coordination ledgers
├── releases/                   Archived release / coverage artifacts
├── app/                        Retired layout — pointer only (see app/README.md)
├── Cargo.toml                  Rust workspace root
├── package.json                npm workspace root
└── AGENTS.md                   Project-wide agent / master commands
```

### Why key paths exist

| Path | Why |
|------|-----|
| `apps/practice-host` | Real Cargo workspace member + Tauri config. **Always build/run Tauri from here** (or `-w medoc-tauri-host`). |
| `apps/practice-host-ui` | Frontend only. `src-tauri` is a **symlink** to `practice-host` for local DX; on Windows CI that path breaks `cargo metadata` — do not invoke Tauri via `-w medoc`. |
| `crates/shared/medoc-core` | Shared domain, SQLCipher DB, migrations, PDF, GDPR, secrets helpers |
| `crates/shared/medoc-sync` | Peer sync outbox / merge policies |
| `packages/shared/locales` | All four UI language catalogs |
| `config/*.yaml` | Edit once; regenerate via `cargo build` |
| `installer/` | Field USB kit, keygen, OS installers |
| `docs/coordination/` | Long-run project truth, validation, actions, phase handoff |
| `tools/dev-tauri.sh` | Canonical local desktop launch (keys + seed + correct cwd) |

Legacy docs that still say `app/src-tauri` refer to the **pre-restructure** tree; live code is under `apps/` + `crates/`.

---

## 4. Security

MeDoc is designed for **local-first** clinical practice data with defense in depth.

| Concern | Approach | Where |
|---------|----------|--------|
| **DB encryption** | SQLCipher (`bundled-sqlcipher`); key from OS keychain / wrap file / `MEDOC_DB_KEY`; plaintext → cipher migrate on open | `medoc-core` `connection.rs`, `sqlcipher.rs`, `db_key.rs` |
| **Audit integrity** | HMAC key via `MEDOC_AUDIT_KEY` / secret store | `secret_store`, audit repos |
| **License v2** | Device-bound perpetual license: AES-GCM-256 + Ed25519; persist `app_kv["license.v2"]` | [`docs/architecture/licensing.md`](docs/architecture/licensing.md) |
| **Vendor pubkey** | Compile-time `MEDOC_VENDOR_PUBKEY` → generated `pubkey.rs` | `medoc-core` / practice-host build scripts |
| **Pairing** | LAN discover + PIN; master mints `mt2.` activation tokens for replicas | `medoc-practice` pairing commands, `medoc-sync` |
| **LAN transport** | HTTPS only (self-signed TLS); JWT / activation-scoped routes | `medoc-lan` TLS + sync HTTP |
| **CORS** | LAN: explicit origin allowlist; Company: browser `Origin` denied | `cors_policy.rs`, company HTTP |
| **RBAC** | Roles `PHYSICIAN`, `RECEPTION` (others deferred); permissions from YAML | `config/rbac.yaml` |
| **Tauri CSP** | Strict production CSP; separate `devCsp` for Vite | `apps/practice-host/tauri.conf.json` |
| **Updates** | Signed updater manifests (release pipeline); reject bad signatures | updater plugin + signature tests |
| **GDPR** | Patient erase paths + backup redaction helpers | `gdpr.rs`, FE privacy flows |

**Important:** CI / README hex values for `MEDOC_VENDOR_PUBKEY` and DB/audit keys are **development / CI test material**, not production vendor secrets.

Unsigned / ad-hoc macOS `.app` builds may be blocked by Gatekeeper until notarized — see install notes below.

---

## 5. Languages (i18n)

| Locale | File | Notes |
|--------|------|--------|
| **English** | `packages/shared/locales/en.json` | Default / origin catalog |
| **German** | `packages/shared/locales/de.json` | |
| **French** | `packages/shared/locales/fr.json` | |
| **Arabic** | `packages/shared/locales/ar.json` | RTL (`dir` / `lang` on `<html>`) |

- Runtime: **i18next** + Zustand locale store (`medoc-locale`) in `packages/shared/src/lib/i18n.ts`
- Switch: **Settings → Appearance**, or the **login** screen (`LocaleSwitcher`: EN · DE · FR · AR)
- Key prefixes: `nav.*`, `common.*`, `page.*`, `error.*`, `a11y.*`, `enum.*`, …
- Backend errors should return stable codes such as `error.work_time.no_open_session`; UI maps via `formatIpcError`

```bash
npm run i18n:verify   # 4-way key parity
npm run i18n:scan     # hardcoded-string scan (baseline-aware)
```

Full guide: [`docs/i18n.md`](docs/i18n.md).

---

## 6. UI philosophy and principles

There is no single marketing “brand manifesto”; product UI rules live in engineering docs:

### Layout standard ([`docs/page-layout-standard.md`](docs/page-layout-standard.md))

Canonical vertical order for list/report pages:

1. **Page header** + primary CTA (top-right in LTR)
2. **Filters / view controls** (search flexes; filters content-width)
3. **Result summary** (counts, “as of …”)
4. **Content** (table / cards / calendar)
5. **Pagination**
6. **Sticky bulk bar** only when a selection exists

Breakpoints: `--bp-sm` 640px, `--bp-md` 900px, `--bp-lg` 1200px.

### Frontend architecture principles ([`docs/README-frontend.md`](docs/README-frontend.md))

- Pages → controllers → ports → adapters (testable without Tauri)
- RBAC mirrored on FE (`rbac.ts`, `RoleRoute`) and enforced in Rust IPC
- Design-system components under shared UI packages / `views/components/ui`
- **Clinical data belongs in SQLite**, not `localStorage`
- Onboarding coachmarks / per-route guidance where implemented

### Interaction tone

- Dense, clinical **workstation** UI (min window ~1250×800 in Tauri config)
- Prefer logical CSS for RTL (`margin-inline-*`, `text-align: start`)
- Prefer i18n keys over hardcoded copy

Wireframes / route maps: [`docs/ui/`](docs/ui/).

---

## 7. Features and navigation

Sidebar sections (`packages/shared/src/lib/nav-sections.ts`):

| Section | Routes (representative) |
|---------|-------------------------|
| **Overview** | `/`, `/appointments` |
| **Clinical** | `/patients`, `/charts/to-validate`, `/tickets` (+ optional `/inbox`, `/prescriptions`), `/statistics` |
| **Practice** | `/finance`, `/finance/cash`, `/purchase-orders`, `/staff/work-time`, `/administration`, `/settings` (+ optional `/services`) |

Additional areas (routing in `apps/practice-host-ui`): onboarding, login, patient detail / prescriptions, purchase orders, balance sheet, administration (team, work days, planning, templates, catalogs, day-close, inventory, contracts), certificates, products, staff, audit, privacy, logs, ops, compliance, help, feedback, migration.

Capability flags (inbox, services menu, prescriptions menu) gate some items at build/config time.

---

## 8. Installer and end-user install

### End-user (packaged app)

Documented OS baselines ([`docs/benutzerhandbuch.md`](docs/benutzerhandbuch.md)):

| | Minimum | Recommended |
|---|---------|-------------|
| OS | Windows 10 / macOS 12 / Ubuntu 22.04 | Win 11 / macOS 14 / Ubuntu 24.04 |
| RAM | 4 GB | 8 GB |
| Display | 1366×768 | 1920×1080 |

1. Run the platform installer (`MeDoc-Setup-*.exe` / `.dmg` / `.AppImage` / `.deb` / …).
2. First launch creates app data (DB, logs, backups) under the **OS application data directory** for `de.medoc.app` (Tauri / `dirs::data_dir`). Some older handbook text mentions `~/medoc-data/` — treat that as **legacy / log fallback**, not the sole live path.
3. Complete **onboarding** (license or join network → account → login).

**macOS Gatekeeper:** ad-hoc / unsigned `.app` bundles may refuse to open from Finder until notarized. Coordination notes document using a helper such as `Open MeDoc.command` or launching the inner binary — see [`docs/coordination/phase-handoff.md`](docs/coordination/phase-handoff.md).

**Updates:** Release pipeline can publish signed Tauri updater artifacts ([`installer/README.md`](installer/README.md)). The German handbook still says “manual updates only” — treat that as a **documentation tension**; prefer installer/release docs for the updater path.

### Operator USB multi-installer

```bash
cargo build -p medoc-usb-setup --release
bash installer/build-usb-kit.sh    # Windows: .\installer\build-usb-kit.ps1
# → installer/dist/usb-kit/  (MedocUsbSetup + payloads)
cd installer/dist/usb-kit && ./MedocUsbSetup wizard
```

Roles in the field kit include MASTER / REPLICA / SERVER_HOST / LAN_CLIENT. Authenticode / notarized USB setup is **not** implemented yet — [`docs/architecture/usb-multi-installer.md`](docs/architecture/usb-multi-installer.md).

### Admin keygen (owner devices)

```bash
bash installer/build-keygen.sh     # Windows: .\installer\build-keygen.ps1
# → installer/dist/medoc-keygen-<os>-<arch>
./installer/dist/medoc-keygen-… --out activation.json
```

Member / replica devices use **in-app pairing**, not vendor license codes.

Quick start: [`installer/QUICK-START.md`](installer/QUICK-START.md).

---

## 9. Developer setup

### Prerequisites

| Tool | Notes |
|------|--------|
| **Node.js** | CI uses **Node 20** |
| **npm** | Workspaces via root `package.json` |
| **Rust stable** | + `clippy`, `rustfmt` for full checks |
| **Platform Tauri deps** | Linux: webkit2gtk 4.1, gtk3, ayatana-appindicator, librsvg, libsoup3 (see CI). Windows: OpenSSL for SQLCipher link (`scripts/ci-windows-install-openssl.ps1`). macOS: Xcode CLT |
| **Optional installer** | cmake + libsodium (keygen); vcpkg libsodium on Windows |

```bash
# Optional local Rust toolchain helper
bash scripts/bootstrap-dev-rust.sh
source scripts/rust-env.sh
```

### Required environment variables (dev / CI)

```bash
export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32
export MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export MEDOC_AUDIT_KEY="k9-medoc-test-audit-key-32bytes!"
```

Useful optional vars:

| Variable | Purpose |
|----------|---------|
| `MEDOC_DEV_SEED=1` | Seed demo practice data / passwords (`tools/dev-tauri.sh`) |
| `MEDOC_PAIRING_MASTER_SECRET` | Dev pairing secret |
| `MEDOC_VENDOR_SEED` | License crypto material (licensing docs) |
| `MEDOC_LAN_JWT_SECRET` | Override LAN JWT secret |
| `MEDOC_COMPANY_API_BASE` / `MEDOC_COMPANY_API_KEY` | Company server client config |

```bash
npm ci
```

On **Windows CI / npm workspaces**, run `scripts/ci-windows-unwrap-workspace-node-modules.ps1` if Node hits `EPERM` on workspace `node_modules` junctions.

---

## 10. Build, compile, and run

Always prefer commands from the **repository root**.

### Practice UI only (Vite)

```bash
npm run dev                 # apps/practice-host-ui → http://localhost:1420
npm run build               # production web assets → apps/practice-host-ui/dist
```

### Full desktop (Tauri) — recommended

```bash
# Sets env keys, MEDOC_DEV_SEED=1, runs from apps/practice-host (avoids symlink bug)
bash tools/dev-tauri.sh
```

Or manually:

```bash
npm run build -w medoc
npm run tauri -w medoc-tauri-host -- build --debug --no-bundle   # smoke / CI style
npm run tauri -w medoc-tauri-host -- build                       # release binary + bundles
```

Root script `npm run tauri -- …` forwards to **`medoc-tauri-host`** (`apps/practice-host`).

**Do not** rely on `npm run tauri -w medoc` (UI package): `src-tauri` → symlink breaks Cargo workspace resolution on Windows.

Release build without white window: UI must be built, and the Rust binary needs Tauri **`custom-protocol`** for packaged assets (see phase-handoff notes). Prefer `tauri build` or:

```bash
npm run build -w medoc
cargo build -p medoc --release --features custom-protocol
```

### LAN server

```bash
cargo run -p medoc-lan-server
# often with --data-dir pointing at the same app data dir as the desktop host
```

### Company server

```bash
cargo run -p medoc-company-server
```

### LAN web client

```bash
npm run dev:lan-web         # http://localhost:1421
npm run build:lan-web
```

### USB kit / keygen / OS installers

```bash
bash installer/build-keygen.sh
bash installer/build-usb-kit.sh
bash installer/build-app-installers.sh
# Installers → apps/practice-host/target/release/bundle/
```

`build-app-installers.sh` currently invokes Tauri with `-w medoc`; on Windows prefer aligning with `-w medoc-tauri-host` if you hit the symlink/`cargo metadata` error.

### Docker validation (Linux)

```bash
docker build -f docker/ci/Dockerfile.rust-wave-v1 -t medoc-rust-wave-v1:latest .
bash scripts/validate-docker.sh
```

### Per-OS quick matrix

| Goal | macOS / Linux | Windows |
|------|---------------|---------|
| Install deps | Node 20, Rust, brew cmake/libsodium (keygen) | Node 20, Rust, vcpkg OpenSSL/libsodium as needed |
| Dev desktop | `bash tools/dev-tauri.sh` | Same via Git Bash **or** set env vars + `npm run tauri -w medoc-tauri-host -- dev` from `apps/practice-host` |
| USB kit | `bash installer/build-usb-kit.sh` | `.\installer\build-usb-kit.ps1` |
| Keygen | `bash installer/build-keygen.sh` | `.\installer\build-keygen.ps1` |
| CI parity | `cargo test --workspace --tests`, `npm test`, `npm run build` | Same + OpenSSL env + unwrap script |

---

## 11. Demo and test accounts

When running with **dev seed** (`MEDOC_DEV_SEED=1`, as in `tools/dev-tauri.sh` / `tools/g21-dev-smoke.sh`):

| Email | Role | Password |
|-------|------|----------|
| `ahmed@practice.de` | Physician (`PHYSICIAN`) | `password123` |
| `aya@practice.de` | Reception (`RECEPTION`) | `password123` |

Additional reception seed users (`nora@`, `tom@`, `lina@practice.de`) may appear when the year-volume seed path runs — same password hash in seed code.

**Company portal demo** (not staff login): slug `demo-praxis`, API key `Bearer sk_demo_company_practice_key` — see [`docs/medoc-company-server.md`](docs/medoc-company-server.md).

These credentials are for **local development only**.

---

## 12. Testing and CI

```bash
# Frontend
npm test
npm run build
npm run lint

# Rust
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --tests

# Isolation / architecture gates
./scripts/validate-three-systems.sh
./scripts/validate-fe-three-systems.sh
./scripts/validate-lan-web-client.sh
```

**CI** (`.github/workflows/ci.yml`):

1. **Rust** — fmt, check, test, clippy, cargo-audit (Ubuntu + Windows)
2. **Frontend** — npm audit, lint, vitest (via `scripts/ci-frontend-test.*`), build
3. **Tauri smoke** — `npm run build -w medoc` then `tauri build --debug --no-bundle` via `medoc-tauri-host`
4. **ci-ok** gate — all required jobs green

Release / updater: `.github/workflows/release.yml`.

Validation ledger: [`docs/coordination/validation.md`](docs/coordination/validation.md).

---

## 13. Configuration sources of truth

| File | Purpose |
|------|---------|
| [`config/rbac.yaml`](config/rbac.yaml) | Permissions & roles — edit here, rebuild to regenerate Rust/TS |
| [`config/enums.yaml`](config/enums.yaml) | Domain enums SoT |
| [`apps/practice-host/tauri.conf.json`](apps/practice-host/tauri.conf.json) | Product id, window, CSP, bundles, updater stubs |
| [`docs/architecture/licensing.md`](docs/architecture/licensing.md) | License & pairing threat model |
| [`docs/coordination/project-truth.md`](docs/coordination/project-truth.md) | Canonical “what is true in this repo” ledger |

---

## 14. Further documentation

| Topic | Path |
|-------|------|
| Three systems | [`docs/architecture/three-systems.md`](docs/architecture/three-systems.md) |
| Deployment topologies | [`docs/architecture/deployment-topologies.md`](docs/architecture/deployment-topologies.md) |
| Sync | [`docs/architecture/serverless-sync.md`](docs/architecture/serverless-sync.md) |
| USB installer | [`docs/architecture/usb-multi-installer.md`](docs/architecture/usb-multi-installer.md) |
| Frontend guide | [`docs/README-frontend.md`](docs/README-frontend.md) |
| i18n | [`docs/i18n.md`](docs/i18n.md) |
| User handbook (DE) | [`docs/benutzerhandbuch.md`](docs/benutzerhandbuch.md) |
| RBAC matrix (human) | [`docs/rbac-matrix.md`](docs/rbac-matrix.md) — prefer `config/rbac.yaml` if they disagree |
| Installer | [`installer/README.md`](installer/README.md), [`installer/QUICK-START.md`](installer/QUICK-START.md) |
| Agent master commands | [`AGENTS.md`](AGENTS.md) |
| Coordination | [`docs/coordination/`](docs/coordination/) |

---

### Honest limits

- Some architecture markdown still mentions pre-move paths (`app/src-tauri`); **code paths above are authoritative**.
- Handbook vs release updater behavior may disagree — verify against `installer/README.md` and release workflow for shipping.
- Production signing, notarization, and vendor key material are **operator responsibilities**; repo defaults are for development and CI.
