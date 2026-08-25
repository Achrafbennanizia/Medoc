# Project truth ledger

**Last updated:** 2026-06-06  
**Scope:** Canonical statements supported by repository evidence.

## Pro→main merge (2026-05-31 — 2026-06-01) — stable truth

- **Status:** Application-code port from `/Users/achraf/pro/Medoc` is **complete** for this tree. Main is **ahead** on PDF export stack, licensing UI/V2 bootstrap, GAP-01/02 tests, break-glass, dev license helper, Docker monolith paths.
- **G21 Posteingang:** Route `/posteingang`, RBAC, sidebar (`lib/nav-sections.ts`), badge polling, native Go menu — **verified in code**; live Tauri walkthrough **NOT OBSERVED** (`docs/coordination/g21-live-smoke-checklist.md`). Automated gate: `bash tools/g21-verify-automated.sh`.
- **Gap register (2026-06-02):** GAP-01–07, 10–11 **closed (code + automated proxy)**; GAP-08/09/12 **skipped v0.1**; GAP-13–15 **deferred** — [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md).
- **Geplant / future development (2026-06-10):** Deferred and planned features tracked in [`geplant.md`](geplant.md) only — **not** as in-app „Geplant“ UI in Einstellungen.
- **G21 automated proxies:** 181 vitest + Rust `praxis_aufgabe_tests` (incl. `g21_arzt_to_rez_flow_*`); checklist rows 1–8 covered at FE/IPC level.
- **Validation (2026-06-01):** `npm test` **181 PASS**; `cargo test --tests` **PASS**; `bash scripts/validate-docker.sh` **PASS** (~6.4 min).
- **Validation (2026-06-06 post R9/R10):** `npm test` **232 PASS**; repo-root `apps/`, `crates/`, `packages/`; `medoc-rust-wave-v1:latest` container **PASS** (fmt, clippy, tests, in-process e2e, proptests) — [`validation.md`](validation.md); full `validate-docker.sh` + multi-device **17/17** (prior run).
- **Dev launch:** `bash tools/dev-tauri.sh` or `bash tools/g21-dev-smoke.sh` (prints credentials + optional `MEDOC_PRINT_LICENSE=1`).

## Stable truth (high confidence)

- **Desktop product identity:** Tauri app **MeDoc**, identifier `de.medoc.app`, version `0.1.0` (`apps/practice-host/tauri.conf.json`).
- **Desktop stack:** React 19 + Vite 6 + TypeScript in `apps/practice-host-ui/`; Rust **edition 2021** Tauri binary `medoc` in `apps/practice-host/` with `sqlx` + SQLite via `crates/shared/medoc-core/` (`package.json`, `apps/practice-host/Cargo.toml`).
- **Database (runtime):** SQLite file `medoc.db` via SQLCipher (`libsqlite3-sys` `bundled-sqlcipher`); `PRAGMA key` from keychain / `MEDOC_DB_KEY` / `db-key.wrap`; legacy plaintext DB migrated on first open (`crates/shared/medoc-core/src/infrastructure/database/connection.rs`, `sqlcipher.rs`, `db_key.rs`).
- **CI/CD scope (2026-08-25):** `.github/workflows/ci.yml` is a push/PR wrapper that calls reusable `.github/workflows/verify.yml` (Rust fmt/clippy/test/audit + web lint/typecheck/test/build + axe-core critical gate). `.github/workflows/autofix.yml` is PR-only deterministic formatting/linting. `.github/workflows/fix-proposal.yml` opens draft PR proposals for non-deterministic fixes. `.github/workflows/release.yml` is verify-gated and builds signed artifacts in protected `release` environment.
- **Vendor Ed25519 pubkey:** Compile-time via `apps/practice-host/build.rs` → `OUT_DIR/pubkey.rs`; used by `license.rs` and `update.rs` (`apps/practice-host/src/infrastructure/crypto/sig.rs`).
- **Update signatures:** `update::evaluate` rejects unsigned/tampered manifests with `UpdateStatus::Error { message: "Signatur ungültig" }`.
- **Company server demo:** Stub routes in `company_host/http.rs` return `"_demo": true`; UI banner in `einstellungen-company-portal-section.tsx`.
- **LAN API transport:** HTTPS only via self-signed `lan-tls.{crt,key}` under app data dir; SHA-256 fingerprint exposed in status + UDP beacon (`apps/practice-host/src/infrastructure/lan_server/tls.rs`, `lan_commands.rs`; HTTP stack in `crates/server/lan/medoc-lan/`).
- **HTTP CORS:** LAN server uses explicit origin allowlist + 403 gate (`infrastructure/cors_policy.rs`); company server denies all browser `Origin` headers (`company_host/http.rs`).
- **VVT export (runtime text):** Generated VVT lists SQLite WAL and SQLCipher usage (`apps/practice-host/src/infrastructure/vvt.rs`).
- **Tauri security:** Content Security Policy set with separate **`devCsp`** for Vite (`localhost` / `127.0.0.1:1420` + websocket) and production **`csp`** without invalid `localhost:*` wildcards (`apps/practice-host/tauri.conf.json`).
- **GOZ invoice PDF (Rust):** Multipage layout in `crates/shared/medoc-core/src/infrastructure/pdf.rs`; optional praxis fields on `Invoice`; integration tests in `crates/shared/medoc-core/tests/pdf_document_tests.rs`.
- **Praxis document readiness (FE):** `packages/shared/src/lib/praxis-completeness.ts` gates PDF export per `DocumentKind`; `PraxisSetupWizard` on first incomplete billing data.
- **AMVV rezept/attest:** Extended columns via migrations in `connection.rs`; round-trip tests in `db_migrations_tests.rs`; edit UI in `rezept-edit.tsx`.
- **Validation (2026-06-10 refactor):** `cargo fmt --check`, `cargo clippy --workspace -D warnings`, `cargo test --workspace --tests`, `npm test` **240 PASS**, `npm run build` **PASS** — [`validation.md`](validation.md).
- **Refactor artifacts:** [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md), [`refactor-register.md`](refactor-register.md), [`retired-paths.md`](retired-paths.md), [`workflow-map.md`](workflow-map.md).
- **Three-system layout (2026-06-06):** Repo root: `apps/{practice-host,practice-host-ui,lan-web-client}`, `crates/{app,server,shared,test}/`, `packages/{shared,ui,app,server}/`. Rust workspace: root `Cargo.toml`. npm workspace: root `package.json`. Legacy `app/` is a README pointer only. Isolation: `./scripts/validate-three-systems.sh`, `./scripts/validate-fe-three-systems.sh`, `./scripts/validate-lan-web-client.sh`.
- **LAN web client (2026-06-06):** Browser-only `apps/lan-web-client` on port **1421**; Vite aliases replace Tauri adapters with `HttpPracticeAdapter` shim (`src/practice-http-shim.ts`); no `@tauri-apps` dependency.
- **Deployment modes (2026-05-26):** `practice_desktop` (local Tauri DB), `lan_client` (HTTPS to remote LAN server), `serverless_peer` (local DB + master/replica outbox sync). Config: `app_kv` `sync.deployment.v1`; engine: `crates/shared/medoc-sync/`; docs: `docs/architecture/deployment-topologies.md`, `serverless-sync.md`.
- **Independent binaries (Wave B8):** `cargo build -p medoc-lan-server` / `medoc-company-server` / `medoc` — no Tauri in headless servers (`docs/coordination/phase-handoff.md`).
- **License v2 (Wave V1):** Perpetual device-bound license encrypted with AES-GCM-256 (HKDF from `MEDOC_VENDOR_SEED` salted by `device_id`) and signed by `MEDOC_VENDOR_PUBKEY`. Persisted in `app_kv` under `license.v2`; runtime status via `current_license_status` Tauri IPC. Round-trip + rejection tests in `crates/shared/medoc-core/tests/license_v2_tests.rs`.
- **Pairing handshake (Wave V1):** Replicas POST `/api/v1/pairing/request` → master decides via `/decide/{id}` → master mints an Ed25519-signed activation token (`mt2.<payload>.<sig>`) stored in `pairing_request.activation_token` and pushes per-slave `slave_permission` rows. The master signing keypair lives in the OS keychain (`medoc-sync::master_keys`).
- **Activation-token auth scope (Wave V1):** `jwt_auth_middleware` accepts `mt2.*` bearers only on `/api/v1/sync/{push,pull,status}` and `/api/v1/pairing/peers`; other protected routes reject with 403 (`crates/server/lan/medoc-lan/src/sync_http.rs::verify_activation_for_path`).
- **Outbox hooks (Wave V1):** Repo write paths in `medoc-core::infrastructure::database::{patient,akte,termin,zahlung,praxis_aufgabe,app_kv}_repo` call `sync_outbox::record_or_noop` which appends one row to `sync_outbox` when `mode = serverless_peer` and the table is in `SYNCED_TABLES`. Internal `sync.*`, `license.*`, `pairing.*` `app_kv` keys are excluded. 7 integration tests + 3 unit tests cover this path.
- **Conflict resolution (Wave V1):** `ConflictPolicy::LastWriteWins` uses `updated_at`; ties break by lexicographic `device_id`. Tested in `medoc_sync::engine::tests` and `merge_apply_tests.rs`.
- **Removed:** Root `src/` Next.js reference app and CI job `next-web` (audit remediation TASK 0.1, 2026-05-19). V-Model docs mark historical Next prototype as archive only.

## Working model (needs confirmation)
- **SQLCipher linkage:** sqlx may still open a transient plaintext file before post-migration re-encrypt; accept criteria met via `migrate_plaintext_to_sqlcipher` after migrations (`connection.rs::open_pool_with_migrations`).

## WAAD requirements intake (2026-04-25)

- **Source artifact:** `docs/requirements-engineering/source/anforderungen-ableitung-waad.pdf`
  („Anforderungen – Ableitung der Anforderungen"), copied verbatim into the repo.
- **Verbatim transcript:** `docs/requirements-engineering/01a-waad-anforderungen.md` (39 IDs across
  9 categories, each with classification MUST / SHOULD / NICE TO HAVE).
- **Traceability matrix:** `docs/requirements-engineering/01b-traceability-waad.md` maps every
  WAAD-ID onto one or more `FA-*` / `NFA-*` IDs in `docs/v-model/01-anforderungen/pflichtenheft.md`,
  with status (COVERED / PARTIAL / NEW-PH / ORG) and code evidence (file + line / `rg` query).
- **New Pflichtenheft IDs derived from WAAD:** `FA-AKTE-14` (Akte-an-Arzt-Weiterleitung),
  `FA-AKTE-15` (Validierungs-Queue-Page), `FA-AKTE-16` (Vollständigkeits-Indikator),
  `FA-DOK-08` (Discharge Summary PDF), `FA-LEIST-05` (Arzt-Freigabe pro Leistung), `FA-LEIST-06` (Auto-offene Buchung nach Leistung B/U),
  `FA-PERS-07` (Permission Overrides), `FA-PERS-08` (Personal Ticket-System),
  `NFA-USE-09` (per-route Onboarding-Walkthrough), `NFA-USE-10` (Konfigurierbares Autocomplete).
- **Implementation status of new IDs (2026-05-21 gap remediation):** See `docs/coordination/actions.md`.
  **Done in code:** `FA-AKTE-14/15/16`, `FA-DOK-08`, `FA-PERS-07/08`, `NFA-SEC-08` (SQLCipher), `NFA-USE-10`,
  restore backup (WAAD 9.1), Krankheitsbild statistik proxy (WAAD 9.5 / A10).
  **Done:** `FA-LEIST-05` (B/U `freigegeben_*` + `pricing::require_released_for_billing`; FE `billing-release.ts`; docs rescoped G13).
  **Done:** `FA-LEIST-06` (Behandlung), `FA-LEIST-07` (Untersuchung: `kategorie`/`leistungsname`/`gesamtkosten`, `ensure_open_booking_for_billable_untersuchung`, `UntersuchungBillingFields`, `zahlung-buchung` Soll).
  **Done:** `FA-AUFG-01..06` (`praxis_aufgabe`, `/posteingang`, Statusmaschine, `PRAXIS_AUFGABE_ERLEDIGT`, auto `ABRECHNUNG`, manueller Dialog „Aufgabe an Rezeption“ in Patientenakte). Legacy `/tickets` + `praxis_ticket` IPC bleiben parallel.
  **Partial:** `NFA-USE-09` (`onboarding.ts`, `OnboardingCoachmark`, per-route ≥80 % target; field tooltips TBD).
  **Open:** A9 stress test → G11; per-patient RBAC → G12 deferred.
- **Counts after intake:** FA = 91 (from 76; +LEIST-06/07, +AUFG-01..06 2026-05-21), NFA = 18 (from 16) — see `02-klassifizierung.md`.

## Evidence index

| Claim | Evidence | Date |
| ----- | -------- | ---- |
| Tauri + versions | `package.json`, `apps/practice-host/Cargo.toml`, `apps/practice-host/tauri.conf.json` | 2026-06-06 |
| SQLite SQLCipher connector | `crates/shared/medoc-core/src/infrastructure/database/connection.rs` | 2026-06-06 |
| Frontend routes | `apps/practice-host-ui/src/App.tsx` | 2026-06-06 |
| CI/CD workflows | `.github/workflows/{ci,verify,autofix,fix-proposal,release}.yml` | 2026-08-25 |
| Build + tests pass | Terminal: `npm run build`, `cargo test --workspace --tests` | 2026-06-06 |
| Vendor pubkey build | `apps/practice-host/build.rs`, `docs/operations/vendor-key-rotation.md` | 2026-06-06 |
| Update signature tests | `apps/practice-host/tests/update_signature_tests.rs` | 2026-06-06 |
| LAN web client | `apps/lan-web-client/`, `./scripts/validate-lan-web-client.sh` | 2026-06-06 |
| CI without next-web | `.github/workflows/ci.yml` | 2026-05-19 |
| WAAD intake | `docs/requirements-engineering/01a-waad-anforderungen.md`, `01b-traceability-waad.md`, `source/anforderungen-ableitung-waad.pdf` | 2026-04-25 |
| WAAD-Pflichtenheft delta | `docs/v-model/01-anforderungen/pflichtenheft.md` (FA-AKTE-14..16, FA-DOK-08, FA-LEIST-05, FA-PERS-07/08, NFA-USE-09/10) | 2026-04-25 |
