# Phase handoff

**Last phase label:** Workspace restructure — Wave B2.a–c (Tauri-untangle) + B4 (codegen lift)  
**Last closed:** 2026-05-25/26 — `5f09d58`; **PASS** (`cargo check/test/clippy --workspace`, 159 tests); `medoc-codegen` crate now drives RBAC + enums codegen; `domain::rbac::Role`, `commands::rbac_state::{require, …}`, `commands::db_setup_commands::init_db_from_app` introduced

### Workspace restructure (2026-05-25 / 26)

| Item | Status |
|------|--------|
| Checkpoint `33171bd` — wave-23 state committed | **PASS** (safe rollback point established) |
| Backup retention test `dbd146d` — day-of-week independent fix | **PASS** (`cargo test --test backup_tests` + full `cargo test --tests` + `clippy -D warnings`) |
| Wave A `f402f28` — drop 41 controller shims + 15 page shims; repoint imports | **PASS** (`npm run lint`, `npm test` 155/28, `npm run build`) |
| Wave B1 — per-module crate mapping document [`wave-b-crate-mapping.md`](wave-b-crate-mapping.md) | **DONE** (evidence-backed; 6 constraints catalogued) |
| Wave B3 `a1196d3` — workspace skeleton (`app/Cargo.toml` + 2 empty placeholder crates) | **PASS** (`cargo check --workspace`, `cargo test --workspace --tests`, `cargo clippy --workspace -D warnings`) |
| Wave C prep — `app/src/lib/*` category mapping [`wave-c-package-mapping.md`](wave-c-package-mapping.md) | **DONE** (97 files triaged) |
| Wave B2.a `5696bea` — move `Role` enum to `domain::rbac`; close inverted dep from `workflow_transitions` | **PASS** (`cargo check/clippy/test --workspace`, 159 tests) |
| Wave B2.b `65fbcfc` — extract `require`/`require_authenticated`/`require_one_of` into `commands::rbac_state` | **PASS** (`cargo check/clippy/test --workspace`, 159 tests) |
| Wave B2.c `04843bf` — remove Tauri dep from `infrastructure::database::connection`; add `commands::db_setup_commands::init_db_from_app` | **PASS** (`cargo check/clippy/test --workspace`, 159 tests; `connection.rs` `grep tauri` empty) |
| Wave B4 `5f09d58` — lift `build/{enums,rbac}_codegen.rs` into `medoc-codegen` lib crate; thin `build.rs` caller; latent `.gitignore` `build/` bug fixed | **PASS** (`cargo check/clippy/test --workspace`, 159 tests; generated TS / RS / SQL byte-identical) |
| Wave B5–B8 — real source lifts (core → lan → company → practice → binaries) | **NOT STARTED** |
| Wave C — npm workspace split | **NOT STARTED** — depends on B |
| Wave D — repo-root restructure (`apps/`, `crates/`, `packages/`) | **NOT STARTED** — depends on B + C |

### Validation snapshot (post Wave A, 2026-05-25)

| Command | Result |
|---------|--------|
| `cargo fmt --all -- --check` | **PASS** |
| `cargo check --all-targets` | **PASS** |
| `cargo test --tests` | **PASS** (after `dbd146d` test fix; baseline failed on Monday-run weekly-tier XOR) |
| `cargo clippy --all-targets -- -D warnings` | **PASS** |
| `npm run lint` | **PASS** |
| `npm test` | **PASS** — 155 tests / 28 files (was 154; +1 from systems-structure split) |
| `npm run build` | **PASS** — 2.35s |

### Understanding delta (Wave A)

- `app/src/controllers/*.ts` no longer exists. Every consumer now imports directly from `@/systems/{practice-host,lan,company-portal}/controllers/*`.
- 15 view-page re-export shims (`einstellungen-*-section.tsx`, `einstellungen-lan-host.tsx`, `einstellungen-company-portal-section.tsx`, `einstellungen-praxis-billing.tsx`, `patient-detail.tsx`) deleted; consumers (notably `einstellungen.tsx`, `App.tsx` lazy import, intra-system relative imports) repointed.
- `systems-structure.test.ts` now asserts the new layout instead of the legacy shims.
- `views/pages/` still contains ~53 not-yet-migrated pages (termine, dashboard, personal, verwaltung-*, etc.). These remain at their current path until a later wave decides to move them into `systems/practice-host/pages/`.

### Must happen next

1. **Wave B5 — lift `domain/` + `error.rs` into `medoc-core` crate.**

   **Evidence the lift is otherwise clean** (probed 2026-05-26):
   ```
   $ grep -E '^use crate::' app/src-tauri/src/domain -r
   domain/services/{konflikt,pricing,workflow_transitions}.rs : use crate::error::AppError;  (3 files)
   domain/entities/{patient,personal,termin,zahlung}.rs       : use crate::domain::enums::…;
   domain/services/workflow_transitions.rs                    : use crate::domain::rbac::Role;
   ```
   The **only** outward dep from `domain/` is `crate::error::AppError`. All other `use crate::*` references stay within `domain/`. `error.rs` itself depends only on external crates (`thiserror`, `serde`, `sqlx::Error`).

   **One real blocker remains — codegen `OUT_DIR` routing:**
   ```
   $ grep -n 'OUT_DIR' app/src-tauri/src/domain
   domain/enums.rs:8: include!(concat!(env!("OUT_DIR"), "/domain_enums_generated.rs"));
   ```
   `env!("OUT_DIR")` resolves at compile time to the *consuming crate's* build dir. If `domain/` moves to `medoc-core`, the file `domain_enums_generated.rs` must be produced into `medoc-core`'s `OUT_DIR`, but the codegen currently runs from `medoc`'s `build.rs`. Two clean fixes:

   - **B5.0a:** Move the enums codegen call into a new `medoc-core/build.rs` that takes `[build-dependencies] medoc-codegen = { path = ... }` and calls `medoc_codegen::enums::run(...)`. Then the `include!` resolves correctly. *Side effect:* the TS output path in `medoc_codegen::enums` is hard-coded to `manifest_dir + "../src/lib/"`. From `medoc-core` that resolves to `app/crates/src/lib/` which doesn't exist. So:
   - **B5.0b:** Extend `medoc_codegen::enums::run(manifest_dir)` to also take an explicit `ts_out_dir: &Path` parameter. `medoc-core/build.rs` passes `manifest_dir.join("../../src/lib")`; the practice-host `build.rs` would do the same once enums no longer lives there.

   Recommended sequence:
   1. **B5.0** — refactor `medoc_codegen::enums::run` signature to accept explicit `ts_out_dir`; update existing call in `app/src-tauri/build.rs` to pass `manifest_dir.join("../src/lib")` (current behaviour). Validate. (One commit.)
   2. **B5.1** — move `error.rs` into `medoc-core/src/error.rs`; add `thiserror`/`serde`/`sqlx` to `medoc-core` deps; add `medoc-core` as a normal dep of `medoc`; keep `app/src-tauri/src/error.rs` as a one-liner `pub use medoc_core::error::*;` for back-compat. Validate. (One commit.)
   3. **B5.2** — give `medoc-core` a `build.rs` that calls `medoc_codegen::enums::run(manifest_dir, manifest_dir.join("../../src/lib"))`; move `domain/` directory to `app/crates/medoc-core/src/domain/`; `medoc-core/src/lib.rs` declares `pub mod domain; pub mod error;`; `app/src-tauri/src/domain.rs` becomes `pub use medoc_core::domain::*;`. **Drop** the enums codegen call from `app/src-tauri/build.rs`. Validate. (One commit.)
   4. **B5.3** — flip `application::rbac::Role` re-export to point at `medoc_core::domain::rbac::Role`. Other consumers (`use crate::domain::*`) keep working via the re-export shim. Validate. (Same commit as B5.2 or follow-up.)

   This roadmap should be ~3 commits, each ≤ 30 minutes of focused work + 1 minute of validation.

2. **Other constraints to revisit later** (no longer Wave B5 blockers, but expected to surface during B6/B7):
   - `application/audit_chain_guard::blocks_ops()` is called from `commands::rbac_state::require` (Wave B2.b decision). If `audit_chain_guard.rs` later moves to `medoc-core`, the call stays where it is; only `commands::rbac_state` lives in `medoc-practice`. Verify before splitting `application/`.
   - `domain::repositories::*` traits — re-check signatures before lift; they should be pure trait definitions, but a quick `grep` once `medoc-core` is producing.
   - `application/akte/*` reference `commands::auth_commands::SessionState` indirectly via `rbac::require` — confirm no remaining `tauri::State` usage before lifting `application/` into `medoc-core`.
2. **Wave B6/B7 — lift `infrastructure/lan_server/` and `infrastructure/company_host/` into `medoc-lan` / `medoc-company` crates.** Both already isolated as systems; should be near-mechanical once core lands.
3. **Wave B8 — split binaries (`bin/medoc-server.rs`, `bin/medoc-company-server.rs`) into their own crates; trim `medoc` crate to Tauri-only.**
4. **Live UI smokes from earlier phases remain NOT OBSERVED.**

### Continuity tokens for the next Wave B session

- The workspace root is `app/Cargo.toml`. Always invoke cargo from there (`cd app && cargo check --workspace`).
- Required env for any `cargo {check,test,clippy}` invocation:
  - `MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`
  - `MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`
  - `MEDOC_AUDIT_KEY="k9-medoc-test-audit-key-32bytes!"`
- Latent gotcha (resolved by B4): `.gitignore:52` matches `build/` globally → any new `build/` subdir under `app/src-tauri/` will silently disappear from version control. Prefer workspace crates under `app/crates/` for build-time logic.



### Three-system wave (2026-05-22)

| Item | Status |
|------|--------|
| `application/akte/pdf_export.rs` | **PASS** — FA-AKTE-04 + FA-DOK-08; args tests in module |
| `akte_commands.rs` thin IPC | **PASS** — ~369 lines |
| `practice-host/pages/einstellungen/` | **PASS** — 12 section modules + view stubs |
| `company-portal/pages/einstellungen-company-portal-section` | **PASS** — view stub |
| LAN client `login` (Vitest + fetch mock) | **PASS** — `http-practice.adapter.test.ts` |
| `cargo fmt/clippy --all-targets/test` | **PASS** |
| `npm lint/test` (151) / `build` | **PASS** |
| Live LAN-client browser E2E | **NOT RUN** |

### Three-system wave (2026-05-21)

| Item | Status |
|------|--------|
| `app/src/systems/*` + `app/src-tauri/src/systems/*` | **PASS** — ports/adapters/facade |
| `npm lint` / `npm test` (142) / `npm run build` | **PASS** |
| `cargo fmt --check` / `cargo test --tests` | **PASS** (CI vendor pubkey) |
| `cargo clippy --all-targets -D warnings` | **PASS** | 2026-05-21 |
| LAN client UI (`einstellungen-lan-host`) | **PASS** (code) — live **NOT OBSERVED** |
| Patient-detail folder move | **PASS** — `systems/practice-host/pages/patient-detail/` |

## Verified (Phase 0 re-validation + Phase 1.1)

### Phase 0 (STABILISE) — re-checked 2026-05-19

| Task | Status | Evidence |
|------|--------|----------|
| 0.1 Remove `src/` CI refs | **PASS** | No `next-web` in `.github/workflows/ci.yml`; no `src/package.json` |
| 0.2 `MEDOC_VENDOR_PUBKEY` build | **PASS** | `build.rs`; build fails without env |
| 0.3 Update signatures | **PASS** | `update_signature_tests` 4/4 |
| 0.4 Company demo flag + UI | **PASS** | `company_host/http.rs` `_demo`; settings banner |

### Phase 1.1 — LAN TLS

- **`lan_server/tls.rs`:** self-signed `lan-tls.{crt,key}` in app data dir (Unix `0600`), SHA-256 fingerprint, `serve_tls_router` via `axum-server` + `rustls` (`aws_lc_rs` provider).
- **Embedded + headless:** `lan_commands::start_lan_embedded`, `medoc-server` binary — HTTPS only on configured port (no parallel HTTP listener).
- **Discovery beacon:** `tls: true`, `cert_sha256` on `LanBeaconPayload`.
- **UI:** `einstellungen-lan-host.tsx` shows fingerprint + `https://` URLs; `tlsCertSha256` on status DTO.
- **Test:** `tests/lan_tls_tests.rs::https_health_returns_ok` — `reqwest` + `danger_accept_invalid_certs` → `/health` 200.

### Validation commands (2026-05-19)

| Command | Result |
|---------|--------|
| `cargo fmt --check` | **PASS** (after `cargo fmt`) |
| `cargo check --all-targets` | **PASS** |
| `cargo test --tests` | **PASS** (incl. `lan_tls_tests`, `update_signature_tests`) |
| `cargo clippy --all-targets -- -D warnings` | **PASS** |
| `cargo audit` | **NOT RUN** locally (`cargo-audit` not installed); CI job still configured |
| `npm run lint` / `npm test` / `npm run build` | **PASS** (101 tests) |

## Remains unverified

- **Browser:** Demo-Modus banner, LAN TLS fingerprint in Einstellungen — **NOT OBSERVED**.
- **`curl -k https://<lan-ip>:8787/health`** on live `medoc-server` — **NOT RUN** (integration test covers equivalent).
### Phase 1.2 — OS keychain

- **`secret_store.rs`:** `keyring` service `de.medoc.app`; env overrides `MEDOC_AUDIT_KEY`, `MEDOC_LAN_JWT_SECRET`.
- **`secrets.rs`:** LAN JWT in keychain; migrates legacy `lan-jwt-secret.bin` then deletes file.
- **`audit_repo.rs`:** audit HMAC in keychain; migrates `.audit_hmac_key` / `~/medoc-data/.audit-hmac-key`.
- **Tests:** `audit_chain_tests` sets `MEDOC_AUDIT_KEY`; `cargo test --tests` **PASS**.

### Phase 1.3 — Company API key hashing

- **`company_host/api_key.rs`:** Argon2id hash + verify (reuses `crypto::hash_password`).
- **`company_host/db.rs`:** `api_key_hash` column; legacy `api_key` migrated via rename/copy; demo key still `sk_demo_company_practice_key`.
- **`company_host/http.rs`:** `BruteForceTracker` on auth middleware; `ConnectInfo` for peer IP.
- **Tests:** `company_host_auth_tests.rs` (2) **PASS**.

### Phase 1.4 — CORS allowlists

- **`infrastructure/cors_policy.rs`:** LAN allowlist (loopback, Vite/Tauri dev ports, LAN IPv4 HTTPS, discovery peers, `extra_cors_origins` in `LanServerConfigV1`); company host denies all `Origin`.
- **`lan_server/http.rs` / `company_host/http.rs`:** replaced `CorsLayer::allow_origin(Any)`; middleware returns **403** on disallowed `Origin`.
- **Tests:** `tests/cors_policy_tests.rs` (4) **PASS**.

### Phase 1.5 — SQLCipher at-rest

- **`libsqlite3-sys` `bundled-sqlcipher`** + `db_key.rs` / `sqlcipher.rs`; `PRAGMA key` via sqlx; legacy plaintext `medoc.db` migrated after first open.
- **Key storage:** OS keychain (`sqlcipher-key`), `MEDOC_DB_KEY` for tests/CI, `db-key.wrap` + `db-key.salt` fallback when keyring unavailable.
- **UI:** `DbSetupGate` + `db_setup_commands` (provision / unlock).
- **Tests:** `tests/sqlcipher_tests.rs` (3) **PASS**; CI sets `MEDOC_DB_KEY`.

## Remains unverified

- **Browser:** DB setup gate, LAN/CORS settings — **NOT OBSERVED**.
- **Phase 3.3+** — invoke registration, RBAC codegen, enum codegen — **NOT STARTED**.

### Phase 1.6 — Audit chain transactional insert

- **`audit_repo::create`:** `pool.begin_with("BEGIN IMMEDIATE")` wraps prev-HMAC read + insert.
- **Ordering:** chain tip / verify use `rowid` (not `created_at`) so same-second concurrent rows stay consistent.
- **Tests:** `audit_chain_concurrent_inserts_remain_valid` (50 tasks) **PASS**; CI `MEDOC_AUDIT_KEY` added.

### Phase 2.1 — Password policy

- **`crypto::evaluate_password_policy` / `validate_password_policy`:** ≥12 chars, upper, lower, digit.
- **Enforced:** `create_personal`, `change_password`, `set_personal_password_by_admin`.
- **UI:** `PasswordPolicyHints` on Personal + Einstellungen password flows; `password-policy.test.ts`.

### Phase 2.3 — TOTP 2FA

- **`totp-rs` v5** + `infrastructure/totp.rs`; columns `personal.totp_secret`, `totp_enrolled_at`.
- **ARZT:** login blocked until enrolled; optional `totp_code` on login / LAN API.
- **Commands:** `start/confirm_totp_enrollment`, `start/confirm_totp_enrollment_login`, `get_totp_status`.
- **UI:** login multi-step (enroll / verify); tests `totp_tests.rs` (5).

### Phase 2.2 — Re-hash on login

- **`auth_service::authenticate`:** upgrades legacy bcrypt to Argon2id after successful verify.
- **Test:** `crypto_tests::login_rehashes_legacy_bcrypt_to_argon2`.

### Phase 1.7 — Brute-force hardening

- **`BruteKey`:** `hashed_subject` via `audit_repo::subject_hmac` + `peer_ip` (`DESKTOP_PEER_IP` for Tauri login).
- **`brute_force_repo`:** table `brute_force_lockout`; hydrate on DB ready / LAN / company / headless server start.
- **Commands:** `admin_unlock_brute_force` (`personal.write`) clears all peer IPs for a subject.
- **Tests:** `tests/brute_force_tests.rs` (6) — IP/subject isolation, restart hydrate, admin clear.

### Document Phases A–E (GOZ invoice, AMVV rezept/attest, praxis guards) — 2026-05-19

| Phase | Status | Evidence |
|-------|--------|----------|
| A Praxis model & settings | **Committed** `944fcd4` | `invoice-leistung.ts`, `einstellungen-praxis-billing.tsx` |
| B DB & DTOs | **Done (uncommitted)** | `connection.rs` ALTERs; `rezept`/`attest` entities + repos; FE schemas |
| C PDF / print | **Done (uncommitted)** | `pdf.rs` GOZ layout; `akte_commands.rs`; `document-print-html.ts` |
| D Completeness | **Done (uncommitted)** | `praxis-completeness.ts`, guards in export pickers + finanz-werkzeuge + patient-detail + wizard in `app-layout.tsx` |
| E Tests | **Done (uncommitted)** | `pdf_document_tests.rs`, `db_migrations_tests` round-trips, `praxis-completeness.test.ts` |

**Validation (2026-05-19):** `cargo check`, `cargo test --tests`, `cargo clippy -D warnings`, `npm run lint`, `npm test` (105), `npm run build` — **PASS** (`docs/coordination/validation.md`).

### Phase 2.4 — Break-glass audit flags

- **Schema:** `audit_log.under_break_glass`, `break_glass_reason` (ALTER in `connection.rs`).
- **Runtime:** `audit_break_glass.rs` links active grants to `audit_repo::create`.
- **UI:** Audit page filter + column; CSV export columns.
- **Test:** `tests/audit_break_glass_tests.rs`.

### Phase 2.5 — Audit chain startup gate

- **`audit_chain_guard.rs`:** shared state; `lib.rs` spawns `verify_chain` after `DB_READY`.
- **RBAC:** `ops.*` blocked when chain broken until `acknowledge_audit_chain_break` (`ops.audit_chain_ack`).
- **UI:** `audit-chain-banner.tsx` in `app-layout`; ops page disables actions when blocked.

**Validation (2026-05-19, post 2.4–2.5):** full `cargo test --tests`, `clippy -D warnings`, `npm lint/test/build` (107 vitest) — **PASS**.

### Phase 2.6 — Backup retention + signing

- **`backup.rs`:** GFS retention (daily 30d, weekly 12w, monthly 12m); `enforce_retention` after each backup.
- **HMAC:** `crypto::audit_hmac_file` + `audit_repo::hmac_file`; sidecar `*.db.sig`.
- **`list_backups`:** `signature_ok` per entry; Ops UI shows status.
- **Tests:** `tests/backup_tests.rs` (2).

**Validation (2026-05-19, post 2.6):** full `cargo test --tests`, `clippy -D warnings`, `npm lint/test/build` (107 vitest) — **PASS**.

### Phase 2.7 — DSGVO erasure: backups + logs

- **`erase_patient_records`:** shared DB erasure for live + backup SQLCipher files.
- **Backups:** `redact_patient_from_all_backups` in `dsgvo.rs`; re-signs `.db` sidecars.
- **Logs:** `sanitizer::redact_patient_id_in_logs` (`MEDOC_LOG_DIR` for tests).
- **`ErasureReport`:** `backups_redacted`, `log_files_redacted`.
- **Tests:** `dsgvo_erasure_tests` (2).

**Phase 2 complete (2026-05-19):** all 2.1–2.7 tasks validated — `cargo test --tests`, `clippy -D warnings`, `npm lint/test/build` (107).

### Document PDF — professional layout (2026-05-19)

- **`clinical_pdf_layout.rs`:** per-kind renderers (attest / rezept / quittung), DIN letterhead, gray table bands, patient panel, TK-style quittung summary + `Tag|Position|Kurzbeschreibung` columns.
- **`pdf.rs`:** shared `pdf_fill_rect`, `pdf_table_header_band`; invoice + Akte section styling.
- **Frontend:** `clinical-pdf-layout.ts` → `columnLayout`, `headerRightLines`, `footerMetaLines`; export picker passes `layoutJson`.
- **Tests:** `pdf_document_tests` 5/5 (invoice, akte, attest, quittung markers); `clinical_layout_renders_pdf_bytes` unit test.

| Command | Result |
|---------|--------|
| `cargo check` | **PASS** |
| `cargo test --tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm run lint` / `npm test` / `npm run build` | **PASS** (107 tests) |

**NOT OBSERVED:** live PDF preview in Tauri UI (browser export dialog).

**Fix (2026-05-19):** `sqlcipher_tests::encrypted_file_db_requires_correct_key` no longer depends on `MEDOC_DB_KEY` surviving parallel tests — uses `hex_key_bytes()` constant for reopen assertion.

### Phase 3.1 — sqlx file migrations (2026-05-19)

- **`sqlx` feature `migrate`**; `app/src-tauri/migrations/0001_initial_schema.sql` (~470 lines, full baseline DDL).
- **`run_migrations`:** fresh DB (no `patient` table) → `sqlx::migrate!` + `run_rust_only_migrations` + gated `seed_demo_data`; existing DB → `run_legacy_embedded_migrations` (unchanged upgrade path).
- **Demo seed:** `cfg!(test)`, `MEDOC_DEV_SEED=1`, or `--dev-seed` via `should_run_demo_seed()`.
- **Deferred:** separate `0002_seed_dev.sql`; CI schema-drift job.

| Command | Result |
|---------|--------|
| `cargo test --tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (107 vitest) |

### Phase 3.2 — domain services (2026-05-19)

- **`domain/services/konflikt.rs`:** Arzt slot conflict SQL + `uhrzeit_to_minutes`; `termin_repo` delegates here.
- **`domain/services/pricing.rs`:** FA-LEIST-05 release check, invoice cents, Rechnungsnummer; `zahlung_repo` uses `require_released_for_billing`.
- **`domain/services/workflow_transitions.rs`:** Termin, Patientenakte, Praxis-Ticket, Bestellung status rules; commands/repos wired.
- **Tests:** `tests/domain_services_tests.rs` (7).

| Command | Result |
|---------|--------|
| `cargo test --tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (107 vitest) |

### Phase 3.3 — centralised IPC registration (2026-05-20)

- **`commands/register.rs`:** `medoc_invoke_handler!()` flat list (224 commands); `register_invoke_handler` on `Builder<tauri::Wry>`.
- **Each `*_commands.rs`:** `register_*!()` macro fragment (max 21 commands/module; all ≤30).
- **`lib.rs`:** ~250-line `generate_handler!` block removed.

| Command | Result |
|---------|--------|
| `cargo test --tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (107 vitest) |

### Phase 3.4 — RBAC YAML codegen (2026-05-20)

- **`config/rbac.yaml`** — permissions + role_sets (37 actions).
- **`build/rbac_codegen.rs`** — generates `OUT_DIR/rbac_generated.rs` + `app/src/lib/rbac.generated.ts` on `cargo build`.
- **`rbac.rs` / `rbac.ts`** — delegate to generated matrix; route/nav config stays hand-written.

| Command | Result |
|---------|--------|
| `cargo test --test rbac_tests --test rbac_codegen_tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test` | **PASS** (107 vitest) |

### Phase 3.5 — enum YAML codegen (2026-05-20)

- **`config/enums.yaml`** — wire values for Rolle, Geschlecht, Termin*, Patient/Akten/Zahlung*, Bestell/Feedback (TS-only where noted).
- **`build/enums_codegen.rs`** — `OUT_DIR/domain_enums_generated.rs`, `enums.generated.ts`, `schemas.enums.generated.ts`, `migrations/generated/enum_check_fragments.sql`.
- **`domain/enums.rs`** — `include!` generated Rust + `NICHT_ERSCHIENEN` serde test retained.

| Command | Result |
|---------|--------|
| `cargo test --tests` + `enums_codegen_tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (107 vitest) |

**Fix:** PDF integration tests no longer assert raw-byte `BSNR` (middle dot forces UTF-16 hex operand).

### Phase 3.6 — patient-scoped localStorage → SQLite (2026-05-20)

- **Already on SQLite:** `akte_validation`, `akte_next_termin_hint`, `rechnung_document` (+ one-shot LS migration helpers).
- **New:** Termin create drafts → `app_kv` key `termin.draft.v1.{draftId}` (`termin-draft.controller.ts`, `app_kv_policy` prefix whitelist).
- **Tests:** `termin-draft.controller.test.ts` (3); `app_kv_policy` unit tests in Rust.

| Command | Result |
|---------|--------|
| `cargo test --tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (110 vitest) |

### Phase 3.7 — page decomposition (partial, 2026-05-20)

- **`lib/patient-detail-utils.ts`** — tab hash, validation helpers, behandlung/rezept utils (~120 lines out of page).
- **`lib/termin-calendar-ui.ts`** — labels, status pills, drag-pack logic, calendar constants (~200 lines out of `termine.tsx`).
- **`lib/settings-format.ts`** — EUR/date/portal pill helpers from `einstellungen.tsx`.
- **Line counts:** `patient-detail` 5091, `termine` 2338, `einstellungen` 2873 (was ~10.6k combined).

| Command | Result |
|---------|--------|
| `cargo test --tests` + clippy | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

### Phase 3.7b — termin components (partial, 2026-05-20)

- **`termin-detail-drawer.tsx`**, **`termin-context-menu.tsx`**, **`termin-month-calendar.tsx`**, **`termin-doctor-legend.tsx`** — extracted and wired from `termine.tsx`.
- **`termine.tsx`:** ~1295 lines (was ~2338); month/week/day views in dedicated components.
- **`termin-week-day-grid.tsx`:** week grid, day split, appt blocks, timeline hooks (~748 lines).

| Command | Result |
|---------|--------|
| `cargo test --tests` + `clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

**Phase 3.7b patient-detail:** **Done** — shell `patient-detail.tsx` ~2126 lines (was ~5091); tabs in `patient-detail-{stamm,anam,anlage,behand,unter,zahl}-tab.tsx`; rezept/attest via `patient-detail-rezept-tab.tsx` + `use-patient-detail-rezept-tab.ts` + `patient-detail-rezept-tab-panel.tsx` + `lib/patient-detail-rezept-actions.ts`.

**Calendar UI (2026-05-20):** Pause / Notfall toolbar + confirm dialogs **disabled** in `termine.tsx` (commented; filter „Notfall (Priorität)“ unchanged).

**Einstellungen:** **Done** — 13 section modules + shell `einstellungen.tsx` ~470 lines (was 2874, −84%).

| Command | Result |
|---------|--------|
| `cargo test --tests` (MEDOC_* env) | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

## Gap remediation wave 2 (2026-05-21)

### Verified

| Item | Evidence |
|------|----------|
| G8 Krankheitsbild panel + CSV | `statistik_commands.rs` `krankheitsbilder_*`; `statistik.tsx` `sec-krankheitsbilder` |
| G9 Dashboard 24h reminders | `list_upcoming_appointments` + `dashboard.tsx` panel |
| G10 Integration stubs honesty | `integration-capabilities.ts` + integrationen section |
| G7 Autocomplete | Pre-existing toggle; confirmed in Arbeitsabläufe |
| CAL2 Emergency toolbar | `calendarEmergencyToolbarEnabled` + termine banner + settings checkbox |
| G6 Onboarding (partial) | `OnboardingCoachmark` in `app-layout` |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

### Remains unverified

- Live UI: validation nav badges, backup restore, dashboard upcoming list, statistik Krankheitsbild panel, onboarding coachmark dismiss — **NOT OBSERVED**.

### Understanding delta

- CAL2 resolved as **formal feature flag** (default off) rather than re-enabling commented toolbar code.
- G8 uses **Behandlungsaggregaten as proxy** until structured ICD diagnosis data exists.

## Gap remediation wave 3 (2026-05-21)

### Verified

| Item | Evidence |
|------|----------|
| G0 doc sync | `project-truth.md`, `06-validierung.md` §6.3a WAAD matrix updated |
| G3 error surfacing (more) | `app-layout` break-glass, `termine` plan load, `onboarding-coachmark` KV |
| N3 FA-LEIST-05 tests | `domain_services_tests::pricing_require_release_*`; `billing-release.test.ts` |
| G6 onboarding tests | `onboarding.test.ts` (route paths + coverage ratio) |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (120 vitest) |

## Gap remediation wave 4 (2026-05-21)

| Item | Evidence |
|------|----------|
| G11 stress | `tests/stress_tests.rs` — 5 clients × 20 audit ops |
| G3 | dashboard plan-next, patient katalog, session-gate, system settings toasts |
| G6 | ARZT routes + atteste/audit; settings progress % + reset |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `stress_tests` | **PASS** |
| `npm lint/test/build` | **PASS** (120 vitest) |

## Gap remediation wave 7 (2026-05-21)

| Item | Evidence |
|------|----------|
| G5 patient-detail shell | `patient-detail.tsx` **1028** lines (was ~2128); hooks: `use-patient-detail-{clinical-actions,validation,zahl-actions,akte-save}.ts`; UI: `patient-detail-shell-header.tsx`, `patient-detail-akte-subnav.tsx`, `patient-detail-overlays.tsx` |

| Command | Result |
|---------|--------|
| `cargo test --tests` | **PASS** |
| `npm run lint` / `npm test` / `npm run build` | **PASS** (120 vitest) |

## Gap remediation wave 8 (2026-05-21)

| Item | Evidence |
|------|----------|
| G6 onboarding | `ONBOARDING_MIN_COVERAGE_RATIO`, nested `stepForRoute`, coachmark persist errors |
| G13 FA-LEIST-05 | Pflichtenheft + traceability: Freigabe on B/U, not Katalog-`leistung` |
| N3 billing | `billing-release-flow.test.ts` + `zahlung_repo_tests` |
| G3 praxis sync | Toasts on `syncInvoicePraxisToAppKv` failure |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `npm lint/test/build` | **PASS** (124 vitest) |

## Gap remediation wave 9 (2026-05-21)

| Item | Evidence |
|------|----------|
| N1 | `README.md` — desktop `app/` only, no phantom `src/` release |
| N4 | `suggestAlternativeTerminSlots` in `termin-availability.ts`; conflict toast in `termin-create.tsx` |
| N5 | `migrateInvoicePraxisLocalStorageToAppKv` + login hydrate in `app-layout.tsx` |

| Command | Result |
|---------|--------|
| `npm lint/test/build` + `cargo test --tests` | **PASS** (127 vitest) |

## Gap remediation wave 11 (2026-05-21)

| Item | Evidence |
|------|----------|
| G14 FA-LEIST-06 | `zahlung_repo::ensure_open_booking_for_billable_behandlung`; FE `billing-open-booking.ts`; ARZT → Tab `zahl` |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `npm lint/test/build` | **PASS** (129 vitest, 4× `zahlung_repo_tests`) |

## Gap remediation wave 10 (2026-05-21)

| Item | Evidence |
|------|----------|
| N6 | `verwaltung.team.read`, `verwaltung.praxisplanung.read/write` in `config/rbac.yaml`; routes + `praxis_commands` |
| N2 | CI job `tauri-smoke` (`--debug --no-bundle`) |
| G3 | Portal fetch `null` documented in `einstellungen.tsx` |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `npm lint/test/build` | **PASS** (128 vitest) |

## Must happen next

1. **G12** per-patient RBAC — deferred (product).
2. **G21b** manual Tauri checklist — [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md) (**NOT OBSERVED**).
4. **P0 GAP-01/02** — code + unit tests; formal UI audit still pending.

## Wave 18 delta (2026-05-21)

- **Revalidation:** `cargo fmt --check`, `cargo test --tests`, `backup_tests` 4/4, `npm lint/test/build` (139), `tauri build --debug --no-bundle`.
- **G2b:** `vacuum_backup_from_encrypted_db_opens_with_sqlcipher_key`; restore test holds `BACKUP_TEST_LOCK` for full run.

## Wave 17 delta (2026-05-21)

- **G2b regression:** `restore_from_backup` no longer runs plaintext migration on already-encrypted `VACUUM INTO` snapshots (`opens_with_sqlcipher_key`).
- **Validation:** `backup_tests` 3/3; `cargo test --tests` **PASS**.

## Wave 16 delta (2026-05-21)

- **G21a:** `collaboration-g21.test.ts`, `posteingang.smoke.test.tsx`, `patientDetailTabBlocked`, `POSTEINGANG_POLL_MS`.
- **Validation:** 139 vitest; full stack **PASS**.

## Wave 15 delta (2026-05-21)

- **G17-fix:** `posteingang` in `ROUTE_VISIBILITY` + `NAV_SECTIONS` (route was denied; nav item never shown).
- **G20:** Tickets page banner → Posteingang; nav/native-go-menu ordering.
- **Validation:** 132 vitest; `backup_tests` 3/3; `cargo test --tests` **PASS**.

## Wave 14 delta (2026-05-21)

- **G2b:** `restore_from_backup` re-encrypts plaintext `VACUUM INTO` snapshots via `sqlcipher::migrate_plaintext_to_sqlcipher` (`backup.rs`).
- **G19:** ARZT „Aufgabe an Rezeption“ in `patient-akte-workflow-dialogs.tsx` + shell header.
- **Validation:** `backup_tests` 3/3; `cargo test --tests` **PASS**; `npm lint/test/build` **PASS** (130 vitest).

## Wave 12 delta (2026-05-21)

- **G15 FA-LEIST-07:** `untersuchung` billing columns; `ensure_open_booking_for_billable_untersuchung`; FE `UntersuchungBillingFields` + `zahlung-buchung` Soll for U-lines.
- **Validation:** `cargo test --tests` **PASS**; `npm lint/test` **PASS** (130 vitest).

## Continuity tokens

- **Local Rust builds:** `export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`
- **LAN TLS files:** `{app_data_dir}/lan-tls.crt`, `lan-tls.key`
