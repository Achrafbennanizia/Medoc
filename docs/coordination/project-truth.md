# Project truth ledger

**Last updated:** 2026-06-01  
**Scope:** Canonical statements supported by repository evidence.

## Pro→main merge (2026-05-31 — 2026-06-01) — stable truth

- **Status:** Application-code port from `/Users/achraf/pro/Medoc` is **complete** for this tree. Main is **ahead** on PDF export stack, licensing UI/V2 bootstrap, GAP-01/02 tests, break-glass, dev license helper, Docker monolith paths.
- **G21 Posteingang:** Route `/posteingang`, RBAC, sidebar (`lib/nav-sections.ts`), badge polling, native Go menu — **verified in code**; live Tauri walkthrough **NOT OBSERVED** (`docs/coordination/g21-live-smoke-checklist.md`).
- **G21 automated proxies:** 181 vitest + Rust `praxis_aufgabe_tests` (incl. `g21_arzt_to_rez_flow_*`); checklist rows 1–8 covered at FE/IPC level.
- **Validation (2026-06-01):** `npm test` **181 PASS**; `cargo test --tests` **PASS**; `bash scripts/validate-docker.sh` **PASS** (~6.4 min).
- **Dev launch:** `bash tools/dev-tauri.sh` or `bash tools/g21-dev-smoke.sh` (prints credentials + optional `MEDOC_PRINT_LICENSE=1`).

## Stable truth (high confidence)

- **Desktop product identity:** Tauri app **MeDoc**, identifier `de.medoc.app`, version `0.1.0` (`app/src-tauri/tauri.conf.json`).
- **Desktop stack:** React 19 + Vite 6 + TypeScript frontend in `app/`; Rust **edition 2021** backend crate `medoc` with `sqlx` + SQLite (`app/package.json`, `app/src-tauri/Cargo.toml`).
- **Database (runtime):** SQLite file `medoc.db` via SQLCipher (`libsqlite3-sys` `bundled-sqlcipher`); `PRAGMA key` from keychain / `MEDOC_DB_KEY` / `db-key.wrap`; legacy plaintext DB migrated on first open (`connection.rs`, `sqlcipher.rs`, `db_key.rs`).
- **CI scope:** `.github/workflows/ci.yml` — Rust (`app/src-tauri`): fmt, check, test, clippy, cargo-audit (requires `MEDOC_VENDOR_PUBKEY`); desktop frontend (`app`): npm audit, lint, vitest, build. **No** root-level `src/` Next.js tree in repo (2026-05-19).
- **Vendor Ed25519 pubkey:** Compile-time via `app/src-tauri/build.rs` → `OUT_DIR/pubkey.rs`; used by `license.rs` and `update.rs` (`app/src-tauri/src/infrastructure/crypto/sig.rs`).
- **Update signatures:** `update::evaluate` rejects unsigned/tampered manifests with `UpdateStatus::Error { message: "Signatur ungültig" }`.
- **Company server demo:** Stub routes in `company_host/http.rs` return `"_demo": true`; UI banner in `einstellungen-company-portal-section.tsx`.
- **LAN API transport:** HTTPS only via self-signed `lan-tls.{crt,key}` under app data dir; SHA-256 fingerprint exposed in status + UDP beacon (`app/src-tauri/src/infrastructure/lan_server/tls.rs`, `lan_commands.rs`).
- **HTTP CORS:** LAN server uses explicit origin allowlist + 403 gate (`infrastructure/cors_policy.rs`); company server denies all browser `Origin` headers (`company_host/http.rs`).
- **VVT export (runtime text):** Generated VVT lists SQLite WAL and **explicitly** states DB file currently without SQLCipher plus planned SQLCipher (`app/src-tauri/src/infrastructure/vvt.rs`).
- **Tauri security:** Content Security Policy set with separate **`devCsp`** for Vite (`localhost` / `127.0.0.1:1420` + websocket) and production **`csp`** without invalid `localhost:*` wildcards (`app/src-tauri/tauri.conf.json`).
- **GOZ invoice PDF (Rust):** Multipage layout in `app/src-tauri/src/infrastructure/pdf.rs`; optional praxis fields on `Invoice`; integration tests in `tests/pdf_document_tests.rs`.
- **Praxis document readiness (FE):** `app/src/lib/praxis-completeness.ts` gates PDF export per `DocumentKind`; `PraxisSetupWizard` on first incomplete billing data.
- **AMVV rezept/attest:** Extended columns via migrations in `connection.rs`; round-trip tests in `db_migrations_tests.rs`; edit UI in `rezept-edit.tsx`.
- **Validation (fix session):** `npm run lint`, `npm test`, `npm run build` (app/) **passed**; `cargo test --tests` (app/src-tauri) **passed** (`docs/coordination/validation.md`).
- **Three-system layout (2026-05-21):** FE `app/src/systems/{practice-host,lan,company-portal}/`; Rust workspace crates `medoc-core`, `medoc-lan`, `medoc-company`, binaries `medoc`, `medoc-server`, `medoc-company-server`; architecture `docs/architecture/three-systems.md`. Legacy `app/src/controllers/*.ts` removed (Wave A).
- **Deployment modes (2026-05-26):** `practice_desktop` (local Tauri DB), `lan_client` (HTTPS to remote LAN server), `serverless_peer` (local DB + master/replica outbox sync). Config: `app_kv` `sync.deployment.v1`; engine: `app/crates/medoc-sync/`; docs: `docs/architecture/deployment-topologies.md`, `serverless-sync.md`.
- **Independent binaries (Wave B8):** `cargo build -p medoc-lan-server` / `medoc-company-server` / `medoc` — no Tauri in headless servers (`docs/coordination/phase-handoff.md`).
- **License v2 (Wave V1):** Perpetual device-bound license encrypted with AES-GCM-256 (HKDF from `MEDOC_VENDOR_SEED` salted by `device_id`) and signed by `MEDOC_VENDOR_PUBKEY`. Persisted in `app_kv` under `license.v2`; runtime status via `current_license_status` Tauri IPC. Round-trip + rejection tests in `app/crates/medoc-core/tests/license_v2_tests.rs`.
- **Pairing handshake (Wave V1):** Replicas POST `/api/v1/pairing/request` → master decides via `/decide/{id}` → master mints an Ed25519-signed activation token (`mt2.<payload>.<sig>`) stored in `pairing_request.activation_token` and pushes per-slave `slave_permission` rows. The master signing keypair lives in the OS keychain (`medoc-sync::master_keys`).
- **Activation-token auth scope (Wave V1):** `jwt_auth_middleware` accepts `mt2.*` bearers only on `/api/v1/sync/{push,pull,status}` and `/api/v1/pairing/peers`; other protected routes reject with 403 (`app/crates/medoc-lan/src/sync_http.rs::verify_activation_for_path`).
- **Outbox hooks (Wave V1):** Repo write paths in `medoc-core::infrastructure::database::{patient,akte,termin,zahlung,praxis_aufgabe,app_kv}_repo` call `sync_outbox::record_or_noop` which appends one row to `sync_outbox` when `mode = serverless_peer` and the table is in `SYNCED_TABLES`. Internal `sync.*`, `license.*`, `pairing.*` `app_kv` keys are excluded. 7 integration tests + 3 unit tests cover this path.
- **Conflict resolution (Wave V1):** `ConflictPolicy::MasterWinsWithFreshness` uses `updated_at`. Tested by `master_does_not_overwrite_newer_replica_row` and `newer_master_push_overwrites_older_replica_row` in `medoc_sync::engine::tests`.
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
| Tauri + versions | `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| SQLite not SQLCipher in connector | `app/src-tauri/src/infrastructure/database/connection.rs` | 2026-04-19 |
| Frontend routes | `app/src/App.tsx` | 2026-04-19 |
| CI commands | `.github/workflows/ci.yml` | 2026-04-19 |
| Build + tests pass | Terminal: `npm run build`, `cargo test --tests` | 2026-04-19 |
| Vendor pubkey build | `app/src-tauri/build.rs`, `docs/operations/vendor-key-rotation.md` | 2026-05-19 |
| Update signature tests | `app/src-tauri/tests/update_signature_tests.rs` | 2026-05-19 |
| CI without next-web | `.github/workflows/ci.yml` | 2026-05-19 |
| WAAD intake | `docs/requirements-engineering/01a-waad-anforderungen.md`, `01b-traceability-waad.md`, `source/anforderungen-ableitung-waad.pdf` | 2026-04-25 |
| WAAD-Pflichtenheft delta | `docs/v-model/01-anforderungen/pflichtenheft.md` (FA-AKTE-14..16, FA-DOK-08, FA-LEIST-05, FA-PERS-07/08, NFA-USE-09/10) | 2026-04-25 |
