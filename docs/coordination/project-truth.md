# Project truth ledger

**Last updated:** 2026-05-19  
**Scope:** Canonical statements supported by repository evidence.

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
  `FA-DOK-08` (Discharge Summary PDF), `FA-LEIST-05` (Arzt-Freigabe pro Leistung),
  `FA-PERS-07` (Permission Overrides), `FA-PERS-08` (Personal Ticket-System),
  `NFA-USE-09` (per-route Onboarding-Walkthrough), `NFA-USE-10` (Konfigurierbares Autocomplete).
- **Implementation status of new IDs:** All listed in `docs/coordination/actions.md` (A2–A10) as
  "Open" — code evidence sweep performed (`docs/coordination/validation.md` §"WAAD intake — code-evidence audit"),
  none of these IDs has runnable code yet.
- **Counts after intake:** FA = 83 (from 76), NFA = 18 (from 16) — see `02-klassifizierung.md`.

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
