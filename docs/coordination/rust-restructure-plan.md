# Rust crate restructure plan (SOLID / KISS / YAGNI / DRY)

**Opened:** 2026-06-06  
**Scope:** `app/crates/*` + practice `src-tauri` (Tauri IPC only)  
**Related:** [`restructure-plan.md`](restructure-plan.md) (Wave B–D repo layout)

---

## Principles applied

| Principle | Rust application in MeDoc |
|-----------|---------------------------|
| **S** — Single responsibility | One module per concern: pool lifecycle ≠ migrations ≠ demo seed ≠ PDF primitives |
| **O** — Open/closed | Domain services + repo traits stable; SQL implementations extend without changing commands |
| **L** — Liskov | Repository implementations honor domain contracts (e.g. `personal_repo` trait) |
| **I** — Interface segregation | Small HTTP surfaces per route module (`sync_http`, `pairing_http`) vs one god-router |
| **D** — Dependency inversion | `medoc-lan` / `medoc-sync` depend on `medoc-core`, never on Tauri |
| **KISS** | Mechanical file splits first; no new abstractions until pain is proven |
| **YAGNI** | No repository subfolders by domain until count/complexity forces it |
| **DRY** | Shared PDF core + letterhead; codegen in `medoc-codegen`; one `connection` entry for DB |

---

## Current workspace (verified 2026-06-06)

```
app/crates/
├── medoc-codegen/     build-time RBAC + enums
├── medoc-core/        domain + application + infrastructure (largest)
├── medoc-lan/         LAN HTTPS + discovery + sync/pairing HTTP
├── medoc-lan-server/  headless binary
├── medoc-company/     company portal HTTP
├── medoc-company-server/
├── medoc-sync/        outbox, merge, pairing crypto, engine
└── medoc-e2e/         HTTP integration harness
app/src-tauri/         Tauri IPC commands only (Wave B target state)
```

---

## Phase R1 — medoc-core database layer ✅ (2026-06-06)

**Problem:** `connection.rs` was **2062 lines** — pool init, legacy ALTER chain, sync DDL, and demo seed in one file (SRP violation).

**Change:**

```
infrastructure/database/
├── connection.rs          (~100 lines — pool + run_migrations orchestration)
├── migrations/
│   ├── mod.rs
│   ├── rust_only.rs       conditional rebuilds + data backfills
│   ├── sync_tables.rs     sync_device / outbox / pairing DDL
│   ├── legacy_embedded.rs incremental upgrades for pre-sqlx DBs
│   └── seed.rs            MEDOC_DEV_SEED / test demo data
└── license_repo.rs        moved from infrastructure root (repo with peers)
```

**Public API unchanged:** `connection::{init_db_headless, test_memory_pool, run_migrations}`.

**Validation:** `cargo check --workspace` PASS; `cargo test -p medoc-core --tests` PASS; `db_migrations_tests` + `pdf_document_tests` PASS; `cargo clippy -p medoc-core -D warnings` PASS.

---

## Phase R2 — medoc-core PDF layer ✅ (2026-06-06)

**Problem:** Five flat PDF files at `infrastructure/` root (3500+ lines combined), cross-importing via `super::pdf_*`.

**Change:**

```
infrastructure/pdf/
├── mod.rs
├── core.rs           (was pdf_core.rs)
├── letterhead.rs
├── clinical_layout.rs
├── render.rs         (was pdf.rs — invoice + akte)
└── export.rs         (facade for commands / application)
```

**Backward compatibility:** `infrastructure/mod.rs` re-exports `pdf_core`, `clinical_pdf_layout`, `pdf_export`, `pdf_letterhead` as aliases.

---

## Phase R3 — medoc-lan HTTP grouping ✅ (2026-06-06)

**Change:**

```
medoc-lan/src/http/
├── mod.rs      router + LanHttpState + JWT middleware
├── sync.rs     (was sync_http.rs)
└── pairing.rs  (was pairing_http.rs)
```

**Backward compatibility:** `medoc_lan::sync_http` and `medoc_lan::pairing_http` re-exported from `lib.rs`.

---

## Phase R4 — medoc-sync pairing + ports ✅ (2026-06-06)

**Change:**

```
medoc-sync/src/
├── pairing.rs              facade + legacy free-function API
├── pairing/
│   ├── types.rs            DTOs + constants
│   ├── policy.rs           URLs, toggle, slave actions
│   ├── token.rs            Ed25519 activation tokens
│   ├── store.rs            SQLite persistence
│   ├── port.rs             PairingPersistence trait
│   ├── tests.rs
│   └── archive_monolith.rs full pre-split file (#[cfg(any())] — not compiled)
└── ports/
    ├── mod.rs
    ├── pairing.rs          re-export PairingPersistence
    └── sync.rs             SyncReplicationStore trait + SqliteSyncStore
```

**Abstractions:** [`PairingPersistence`] and [`SyncReplicationStore`] enable swapping SQLite for mocks in tests or alternate backends.

**Legacy paths preserved:** shim files with commented old wiring at `infrastructure/{pdf_core,pdf_export,...}.rs`, `medoc-lan/{sync_http,pairing_http}.rs`.

---

## Phase R5 — medoc-core database repos ✅ (2026-06-06)

**Change:**

```
database/
├── ports/           DatabasePool trait
├── repos/
│   ├── clinical/    patient, akte*, rezept, attest
│   ├── scheduling/  termin, praxis_aufgabe, praxis_ticket
│   ├── billing/     zahlung, leistung, rechnung_document, …
│   ├── admin/       personal, audit, app_kv, license, …
│   └── praxis/      praxis, bestellung, produkt, …
└── *_repo.rs        29 legacy shims (re-export from repos/)
```

**Domain port:** `domain::repositories::PersonalRepository` + `SqlitePersonalRepository`.

---

## Phase R5b — medoc-sync repo + engine ✅ (2026-06-06)

```
medoc-sync/src/
├── repo/
│   ├── types.rs     OutboxEntry, SyncPeer, SYNCED_TABLES
│   ├── store.rs     SQLite persistence
│   └── archive_monolith.rs
├── repo.rs          facade
├── engine/
│   ├── types.rs     SyncPushResult, SyncRunReport, …
│   ├── run.rs       SyncEngine impl
│   └── archive_monolith.rs
└── engine.rs        facade
```

---

## Phase R6 — medoc-practice crate ✅ (2026-06-06)

**New workspace member:** `crates/medoc-practice` — Tauri IPC + host wiring.

```
medoc-practice/src/
├── commands/
│   ├── clinical/      patient, akte*, rezept, attest
│   ├── scheduling/    termin, praxis_aufgabe
│   ├── billing/       zahlung, invoice, vertrag, …
│   ├── admin/         auth, personal, audit, db_setup, …
│   ├── praxis/        praxis settings, produkt, statistik, …
│   ├── network/       lan, pairing, sync, company_portal
│   ├── system/        ops, export, pdf, devices, menu, …
│   ├── register.rs
│   └── {name}_commands.rs  legacy re-export shims per module
├── infrastructure/    medoc-core re-exports + app_menu + LAN/company
├── systems/           lan / company / practice facades
└── application.rs     medoc-core + rbac guards

src-tauri/             thin Tauri shell — re-exports medoc_practice
```

**Dependency graph:** `medoc` (Tauri) → `medoc-practice` → `{medoc-core, medoc-lan, medoc-company, medoc-sync}`

---

## Phase R7 — Tier separation (app / server / shared) ✅ (2026-06-06)

Crates grouped under `app/crates/` by deployable system:

```
crates/
├── app/medoc-practice          Practice desktop IPC (Tauri)
├── server/
│   ├── lan/{medoc-lan, medoc-lan-server}
│   └── company/{medoc-company, medoc-company-server}
├── shared/{medoc-core, medoc-sync, medoc-codegen}
└── test/medoc-e2e
```

**Isolation:**

| System | Binary | Depends on |
|--------|--------|------------|
| Practice | `medoc` (`src-tauri`) | `medoc-practice` only (transitive core/lan/company/sync) |
| LAN server | `medoc-lan-server` | `medoc-lan` → core + sync (no Tauri, no practice) |
| Company server | `medoc-company-server` | `medoc-company` → core only |

**Script:** `app/scripts/validate-three-systems.sh` — builds all three binaries independently.

**`src-tauri/Cargo.toml`:** direct deps trimmed to `medoc-practice` + Tauri/runtime only.

---

## Phase R8 — npm workspace tiers (app / server / shared) ✅ (2026-06-06)

TypeScript packages under `app/packages/` mirror Rust crate tiers:

```
packages/
├── shared/              @medoc/shared — lib, models
├── ui/                  @medoc/ui — design-system components
├── app/practice-host/   @medoc/system-practice
└── server/
    ├── lan/             @medoc/system-lan (no Tauri)
    └── company/         @medoc/system-company (no Tauri)
```

**App shell (`src/`):** routing, pages, Tauri adapters, `platform/` utilities.

**Path aliases:** `@/lib/*`, `@/systems/*` resolve into packages; legacy imports preserved.

**Scripts:** `validate-fe-three-systems.sh`, `validate-three-systems.sh`

---

## Phase R9 — repo-root promotion ✅ (2026-06-06)

Promoted tiered layout to repository root:

```
Medoc/
├── apps/practice-host/          Tauri binary (was app/src-tauri)
├── apps/practice-host-ui/       React shell (was app/src + configs)
├── crates/{app,server,shared,test}/
├── packages/{shared,ui,app,server}/
├── Cargo.toml                   workspace root
└── package.json                 npm workspace root
```

Legacy `app/` retained as README pointer only.

---

## Phase R10 — lan-web-client ✅ (2026-06-06)

Browser-only **`apps/lan-web-client`** (port 1421):

- Vite aliases replace Tauri adapters with `src/practice-http-shim.ts` → `HttpPracticeAdapter`.
- `HttpPracticeAdapter` accepts `allowMissingToken` for pre-login flows.
- Validate: `./scripts/validate-lan-web-client.sh`

---

## Validation matrix (run after each phase)

```bash
# from repository root
export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32
export MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export MEDOC_AUDIT_KEY="k9-medoc-test-audit-key-32bytes!"

cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --tests
cargo build -p medoc-lan-server -p medoc-company-server -p medoc
./scripts/validate-three-systems.sh
./scripts/validate-fe-three-systems.sh
./scripts/validate-lan-web-client.sh
npm test && npm run build

# Docker Wave V1 scoped (Linux; verified 2026-06-06)
docker build -f docker/ci/Dockerfile.rust-wave-v1 -t medoc-rust-wave-v1:latest .
docker run --rm --shm-size=4g -e CARGO_BUILD_JOBS=1 \
  -v "$PWD:/work" -v medoc-cargo-registry:/usr/local/cargo/registry \
  -v medoc-cargo-git:/usr/local/cargo/git -v medoc-target-linux-e2e:/work/target \
  medoc-rust-wave-v1:latest

# Full Docker pipeline (+ optional VALIDATE_DOCKER_FULL=1 for Tauri)
bash scripts/validate-docker.sh
```

---

## Remaining risks

- **medoc-e2e port tests** require a live HTTPS listener on `:8787` — failures with `Connection refused` are environmental, not structural regressions. In-process Wave V1 Docker excludes `multi_device_port_http`; use `validate-docker-multi-device.sh` for live port coverage.
- **Legacy embedded migrations** remain large (~1100 lines) — further split by schema version is possible but low ROI until sqlx migration path dominates new installs.
- **`VALIDATE_DOCKER_FULL=1`** (Tauri link in Linux container) — not re-run after dev-deps fix; optional gate separate from Wave V1 scoped image.
