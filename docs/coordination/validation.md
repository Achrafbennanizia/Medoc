# Validation ledger

**Last updated:** 2026-05-19 (Phase 3.7b — patient-detail rezept logic extraction validated)

## Verified (commands run, outcomes recorded)

| Check | Command | Result | Date | Notes |
| ----- | ------- | ------ | ---- | ----- |
| Phase 3.7b — patient-detail rezept hook + panel | `npm run lint && npm test && npm run build` + `cargo test --tests` | **PASS** | 2026-05-19 | Shell `patient-detail.tsx` ~2126 lines; `use-patient-detail-rezept-tab.ts` (~638); `patient-detail-rezept-tab-panel.tsx` (~1116); `patient-detail-rezept-tab.tsx` (22); `patient-detail-rezept-actions.ts` (196); restored `handlePrintQuittung*` in shell; fixed `updateRezept` import |
| Phase 3.7b — patient-detail all tabs | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-19 | 7 tab modules + rezept hook/panel; shell was ~2815 before rezept logic move |
| Phase 3.7b — patient-detail rezept tab | npm lint/test/build | **PASS** | 2026-05-19 | JSX panel extracted; logic in hook (supersedes monolithic tab file) |
| Phase 3.7b — patient-detail zahl tab | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-19 | `patient-detail-zahl-tab.tsx` (~938 lines) |
| Phase 3.7b — patient-detail unter tab | npm lint/test/build | **PASS** | 2026-05-19 | `patient-detail-unter-tab.tsx` (~359 lines) |
| Phase 3.7b — patient-detail behand tab | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-19 | `patient-detail-behand-tab.tsx` (~207 lines); recreated after missing file broke build |
| Phase 3.7b — patient-detail anam + anlage tabs | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `patient-detail-anam-tab.tsx`, `patient-detail-anlage-tab.tsx` |
| Phase 3.7b — patient-detail stamm tab | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `patient-detail-stamm-tab.tsx`; `patient-detail.tsx` reduced |
| Phase 3.7b — einstellungen praxis + shell rebuild | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-praxis-section.tsx`; shell `einstellungen.tsx` ~500 lines (all 13 sections wired) |
| Phase 3.7b — einstellungen lizenz + integrationen | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-lizenz-section.tsx`, `einstellungen-integrationen-section.tsx`; shell `einstellungen.tsx` ~1218 lines (−58% vs 2874) |
| Phase 3.7b — einstellungen migration + ueber | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-migration-section.tsx`, `einstellungen-ueber-section.tsx`; shell `einstellungen.tsx` ~1465 lines (−44% vs 2874) |
| Phase 3.7b — einstellungen system section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-system-section.tsx`; health/perf/backup/ops embed; `einstellungen.tsx` ~1601 lines |
| Phase 3.7b — einstellungen sicherheit section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-sicherheit-section.tsx`; device sessions + portal flags internal |
| Phase 3.7b — einstellungen konto section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-konto-section.tsx`; profile load/save self-contained |
| Phase 3.7b — einstellungen arbeitsablaeufe section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-arbeitsablaeufe-section.tsx`; confirmation prefs colocated |
| Phase 3.7b — einstellungen darstellung section | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-darstellung-section.tsx`; `einstellungen.tsx` ~2589 lines |
| Phase 3.7b — einstellungen benachrichtigungen section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-benachrichtigungen-section.tsx`, shared `settings-switch.tsx` |
| Phase 3.7b — termin week/day grid extracted | npm lint/test/build + clippy | **PASS** | 2026-05-20 | `termin-week-day-grid.tsx` (~748 lines); `termine.tsx` ~1295 lines |
| Phase 3.7b — termin month cal + legend wired | `cargo test --tests` + clippy + npm lint/test/build | **PASS** | 2026-05-20 | `termin-month-calendar.tsx`, `termin-doctor-legend.tsx`; no duplicate `MonthCalendar`/`DoctorLegend` |
| Phase 3.7b — termin drawer/context | npm lint/test/build | **PASS** | 2026-05-20 | `termin-detail-drawer.tsx`, `termin-context-menu.tsx` |
| Phase 3.7 — page utils split | `cargo clippy` + npm lint/test (114 vitest) | **PASS** | 2026-05-20 | `patient-detail-utils.ts`, `termin-calendar-ui.ts`, `settings-format.ts` |
| Phase 3.6 — patient localStorage → DB | `cargo test --tests` + clippy + npm lint/test (110 vitest) | **PASS** | 2026-05-20 | Termin drafts → `app_kv` `termin.draft.v1.{uuid}`; validation/plan/invoice already on SQLite |
| Phase 3.5 — enum codegen | `cargo test --tests` + `enums_codegen_tests` + clippy + npm lint/test/build | **PASS** | 2026-05-20 | `config/enums.yaml`; `enums.generated.ts`; `schemas.enums.generated.ts`; PDF tests adjusted (BSNR line UTF-16) |
| Phase 3.4 — RBAC codegen | `cargo build` + `rbac_tests` + `rbac_codegen_tests` + npm test | **PASS** | 2026-05-20 | `config/rbac.yaml`; `build/rbac_codegen.rs`; `rbac.generated.ts` |
| Phase 3.3 — IPC registration | `cargo test --test invoke_registration_tests` + full suite + clippy | **PASS** | 2026-05-20 | `commands/register.rs` + 42× `register_*!()` macros; `lib.rs` uses `register_invoke_handler` |
| Phase 3.2 — domain services | `cargo test --test domain_services_tests` + full `cargo test --tests` | **PASS** | 2026-05-19 | `domain/services/{konflikt,pricing,workflow_transitions}.rs`; wired termin/zahlung/akte/bestellung |
| Phase 3.1 — sqlx migrations | `MEDOC_* env cargo test --tests` + `fresh_db_records_sqlx_migration` | **PASS** | 2026-05-19 | `0001_initial_schema.sql` deduped; legacy path for existing DBs; demo seed via `should_run_demo_seed` |
| Phase 3.1–3.2 — full stack | `cargo test --tests && clippy -D warnings && npm lint/test/build` | **PASS** | 2026-05-19 | 107 vitest; all integration suites green |
| PDF professional layout — full stack | `MEDOC_DB_KEY` + `MEDOC_VENDOR_PUBKEY` → `cargo test --tests` + clippy + npm | **PASS** | 2026-05-19 | `clinical_pdf_layout`; `pdf_document_tests` 5/5; 107 vitest; `sqlcipher_tests` flake fixed |
| Document Phases C–E — Frontend | `cd app && npm run lint && npm test && npm run build` | **PASS** | 2026-05-19 | 105 vitest tests; praxis guards + GOZ PDF UI |
| Document Phases C–E — Rust PDF | `cargo test --test pdf_document_tests` | **PASS** | 2026-05-19 | GOZ markers (`GOZ`, `Fak`, `IBAN`, …) |
| Document Phases C–E — Rust full | `cargo test --tests && clippy -D warnings` | **PASS** | 2026-05-19 | `db_migrations_tests` +4 (rezept/attest round-trip); `sqlcipher_tests` hardened |
| Document Phases C–E — Frontend | `npm run lint && npm test && npm run build` | **PASS** | 2026-05-19 | `rezept-edit.tsx` AMVV fields |
| Phase 0 — Rust | `MEDOC_VENDOR_PUBKEY=… cargo check && cargo test --tests && cargo clippy -D warnings` | **PASS** | 2026-05-19 | `update_signature_tests` 4/4 |
| Phase 0 — Frontend | `npm run lint && npm test && npm run build` | **PASS** | 2026-05-19 | 101 vitest tests |
| Phase 1.4 — CORS tests | `cargo test --test cors_policy_tests` | **PASS** | 2026-05-19 | LAN 403 on evil origin; company rejects Origin |
| Full stack (post 1.4) | `cargo test --tests && clippy -D warnings && npm lint/test/build` | **PASS** | 2026-05-19 | All integration tests green |
| Phase 1.5 — SQLCipher | `cargo test --test sqlcipher_tests` + full suite with `MEDOC_DB_KEY` | **PASS** | 2026-05-19 | Wrong key / no-key rejected on file DB after migrate |
| Full stack (post 1.5) | `MEDOC_DB_KEY=… cargo test --tests && clippy && npm lint/test/build` | **PASS** | 2026-05-19 | 105 vitest tests |
| Phase 1.6 — audit chain | `cargo test --test audit_chain_tests` | **PASS** | 2026-05-19 | 50 concurrent inserts; `BEGIN IMMEDIATE` |
| Phase 1.7 — brute-force | `cargo test --test brute_force_tests` | **PASS** | 2026-05-19 | 6 tests: IP+subject keys, hydrate, admin clear |
| Full stack (post 1.7) | `MEDOC_* env cargo test --tests && clippy -D warnings && npm lint/test/build` | **PASS** | 2026-05-19 | All integration tests green; 105 vitest |
| Phase 2.1–2.2 | `crypto_tests` (5) + `npm test` (107) + build | **PASS** | 2026-05-19 | Policy + login rehash; fixed `pdf_hline` arity |
| Phase 2.3 — TOTP | `totp_tests` (5) + full `cargo test --tests` + npm lint/test/build | **PASS** | 2026-05-19 | ARZT enroll/verify login flow |
| Phase 2.4 — break-glass audit | `audit_break_glass_tests` (1) + full suite + npm lint/test/build | **PASS** | 2026-05-19 | `under_break_glass` / filter on audit page |
| Phase 2.5 — audit chain gate | `audit_chain_guard` unit test + full suite + npm lint/test/build | **PASS** | 2026-05-19 | Startup `verify_chain`; `ops.*` blocked until ack |
| Phase 2.6 — backup retention + sig | `backup_tests` (2) + full suite + npm lint/test/build | **PASS** | 2026-05-19 | GFS 30d/12w/12m; `.db.sig` HMAC; `signature_ok` in list |
| Phase 2.7 — DSGVO backups + logs | `dsgvo_erasure_tests` (2) + full suite + npm lint/test/build | **PASS** | 2026-05-19 | Backup redact + `MEDOC_LOG_DIR` log scrub |
| `cargo fmt --check` | after `cargo fmt` | **PASS** | 2026-05-19 | Large repo-wide format sync |
| Phase 1.1 — LAN TLS test | `cargo test --test lan_tls_tests` | **PASS** | 2026-05-19 | HTTPS `/health` via self-signed cert |
| Build fails without vendor key | `cargo check` (no env) | **FAIL** (expected) | 2026-05-19 | `MEDOC_VENDOR_PUBKEY must be set` |
| `cargo audit` | `cargo audit` | **NOT RUN** | 2026-05-19 | Binary not installed locally; CI has `cargo-audit` step |

| Check | Command | Result | Date | Notes |
| ----- | ------- | ------ | ---- | ----- |
| Frontend lint + test + build | `cd app && npm run lint && npm test && npm run build` | **PASS** | 2026-04-26 | Statistiken: single `PANELS` tablist (Überblick + four Detailauswertungen) controls main `tabpanel`; temp fragment removed; `tabIndex` on nav reverted to default order |
| Frontend lint + test + build | `cd app && npm run lint && npm test && npm run build` | **PASS** | 2026-04-26 | Step 2: `index.css` tokens, `IconButton`/`Spinner`/`Skeleton`/`Separator`, `ui/index.ts` barrel, field-error shake, modal/toast z-index, ESLint: JSDoc nbsp + `patient-detail` unlock effects + `zahlEditMaxBetragEur` IIFE |
| Frontend lint | `cd app && npm run lint` | **PASS** | 2026-04-19 | eslint src --max-warnings 0 |
| Frontend unit tests | `cd app && npm test` | **PASS** | 2026-04-19 | vitest run — 1 file |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-19 | tsc + vite |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Termin dropdown+draft flow and cascading Arbeitszeiten/Sonder-Sperrzeiten changes |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Termin draft/URL merge + popover clamp + Akte composer UX gaps |
| Frontend type-check | `cd app && npx tsc --noEmit` | **PASS** | 2026-04-25 | After enum serde fix, popover portal, Untersuchung composer, Behandlung autonum, validation hardening |
| Frontend unit tests | `cd app && npm test -- --run` | **PASS** | 2026-04-25 | 19 tests / 3 files (smoke, string-suggest, rbac) |
| Frontend type-check | `cd app && ./node_modules/.bin/tsc --noEmit` | **PASS** | 2026-04-25 | After cascading combo Rezept (per-patient + global) + shared MEDIKAMENT_SUGGESTIONS module + CardHeader subtitle prop |
| Frontend unit tests | `cd app && npm test --silent` | **PASS** | 2026-04-25 | 19 tests / 3 files — unchanged after combo Rezept refactor |
| Frontend type-check | `cd app && npx tsc --noEmit` | **PASS** | 2026-04-25 | After Vorlage-loader in Rezept dialogs, Termin edit-mode wiring, vorlage-editor Krankheiten free-text, patient-create Medikation/Allergien default-open |
| Frontend unit tests | `cd app && npm test --silent` | **PASS** | 2026-04-25 | 19 tests / 3 files — unchanged after Vorlage/Termin-edit fixes |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Vorlage-loader + Termin edit-mode + Krankheiten free-text — all bundles emit |
| Frontend type-check | `cd app && npx tsc --noEmit` | **PASS** | 2026-04-25 | After Bestellungen end-to-end overhaul (D17) — entity, controller, page, EmptyState all clean |
| Frontend unit tests | `cd app && npm test --silent` | **PASS** | 2026-04-25 | 29 tests / 4 files — unchanged after Bestellungen overhaul (D17) |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Bestellungen overhaul (D17) — `bestellungen` chunk now ~24 kB / 7 kB gz |
| Rust check | `cd app/src-tauri && cargo check` | **PASS** | 2026-04-25 | After Bestellungen backend (D17): new `update_bestellung` command, `bestellnummer`/`pharmaberater` columns + idempotent migration |
| Rust tests | `cd app/src-tauri && cargo test --tests` | **PASS** | 2026-04-25 | All 5 test binaries green (db_migrations, dsgvo_erasure, audit_chain, etc.) after Bestellung schema extension |
| Rust check | `cd app/src-tauri && cargo check --offline` | **PASS** | 2026-04-25 | No Rust changes this session — sanity confirms FE-only patches did not implicitly break anything |
| Rust tests | `cd app/src-tauri && cargo test --tests` | **PASS** | 2026-04-19 | Includes integration suites |
| Rust check | `cd app/src-tauri && cargo check --no-default-features` | **PASS** | 2026-04-25 | After `#[serde(rename_all = "UPPERCASE")]` on every domain enum + seed-data reordering |
| Rust tests | `cd app/src-tauri && cargo test --no-default-features` | **PASS** | 2026-04-25 | Migration idempotency + DSGVO erasure + crypto + RBAC + audit chain — all green after FK seed-order fix |
| Frontend lint | `cd app && npm run lint` | **PASS** | 2026-04-25 | After D18 (Statistik aggregations + new charts) and D19 (Bestellungen Detail-Route) — clean |
| Frontend type-check | `cd app && ./node_modules/.bin/tsc --noEmit` | **PASS** | 2026-04-25 | After D18+D19 — `bestellungen.tsx`, `bestellung-detail.tsx`, `statistik.tsx`, `App.tsx`, `rbac.ts` clean |
| Frontend unit tests | `cd app && npm test` | **PASS** | 2026-04-25 | 29/29 (smoke, rbac, schemas, string-suggest) — unchanged |
| Rust check | `cd app/src-tauri && cargo check --no-default-features` | **PASS** | 2026-04-25 | After D18 — `chrono::Datelike` import added to fix private `year()`/`month()`/`day()` errors in `statistik_commands.rs::altersgruppe` |
| Rust tests | `cd app/src-tauri && cargo test --no-default-features` | **PASS** | 2026-04-25 | All 5 binaries green after D18 backend + D19 routing changes |
| Rust clippy (deny warnings) | `cd app/src-tauri && cargo clippy --all-targets -- -D warnings` | **PASS** | 2026-04-19 | Includes tests; `manual_contains` fixes in `db_migrations_tests.rs` |
| Next.js reference build | `cd src && npm run build` | **PASS** | 2026-04-19 | Run before CSP fixes; Next 16 |
| Frontend type-check | `cd app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **PASS** | 2026-04-26 | After D20: modal→page conversion (`/finanzen/neu`), `patient-detail` header refactor, two-mode Behandlung composer with auto B-Nummer/Sitzung + collapsible "Nächsten Termin planen", per-section Validierung mit `localStorage`, Termin-create Tipp-Card, Rezept-Vorlagen quick-pick chips |
| Frontend lint | `cd app && ./node_modules/.bin/eslint src --max-warnings 0` | **PASS** | 2026-04-26 | After D20 — fixed missing `activeTab` dep in Rezept-Vorlagen-Loader effect |
| Frontend unit tests | `cd app && ./node_modules/.bin/vitest run` | **PASS** | 2026-04-26 | 29 tests / 4 files (smoke, string-suggest, rbac, schemas) — unchanged after D20 |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-05-02 | Einstellungen cull + neue Client-Settings (`idleLogout`, Tagesabschluss-Toast, VN-Suche, …); `search_patienten` optional arg; Hilfe-Route `/hilfe` |
| Frontend unit tests | `cd app && npm test -- --run` | **PASS** | 2026-05-02 | 90 tests |

## Pending / not yet run

| Check | Why pending | Blocker |
| ----- | ----------- | ------- |
| `tauri build` full bundle | Not run this session | Optional heavy check |
| E2E | NOT RUN | No runner invoked |
| Code-evidence sweep for WAAD-derived NEW-PH IDs (`FA-AKTE-14/15/16`, `FA-DOK-08`, `FA-LEIST-05`, `FA-PERS-07/08`, `NFA-USE-09/10`) | Implementation pending (see `actions.md` A2–A13) | Implementation tasks |
| 5-client load smoke (WAAD 9.4 / `NFA-PERF-04`) | No multi-client harness yet | Test harness for parallel Tauri sessions (Action A9) |

## WAAD intake — code-evidence audit (read-only, 2026-04-25)

Findings recorded as part of the WAAD-PDF intake. Each row cites the actual ripgrep query
or file inspection that was performed.

| WAAD-ID(s) | Question | Evidence | Verdict |
| ---------- | -------- | -------- | ------- |
| 1.2.1 / 8.1 | RBAC roles enforced for medical data? | `app/src-tauri/src/application/rbac.rs` defines `Role` + `allowed`; `akte_commands.rs:27` strips `diagnose`/`befunde` for non-ARZT roles | ✅ **VERIFIED** |
| 1.2.2 | Per-personal granular permission overrides? | `rg "personal_permission|permission_override" app` → **0 hits**. Only role-based RBAC exists | 🔴 **PENDING** — covered by new `FA-PERS-07` |
| 1.3.1 | "Akte an Arzt weiterleiten" UI? | `rg "weiterleit\|forward.*akte" app/src` → only Labor-Auftragsweiterleitung in `einstellungen.tsx`. No Akte-Weiterleitung UI | 🔴 **PENDING** — covered by new `FA-AKTE-14` |
| 1.4 | Internal note/ticket Rezeption→Arzt? | `rg "personal_ticket\|ticket.*system\|inbox.*arzt\|notiz.*system" app` → only i18n string in `app/src/lib/i18n.ts`. No domain entity, no UI | 🔴 **PENDING** — covered by new `FA-PERS-08` |
| 1.5 / NFA-USE-H10 | In-app help / tooltip / onboarding? | `rg "tooltip\|onboarding\|tutorial\|help.*dialog" app/src` → matches in `feedback.tsx`, `compliance.tsx`, `app-layout.tsx`, `hilfe.tsx`, `DentalMiniBar.tsx`. Generic Hilfe-Page exists; per-route walkthrough does not | 🟡 **PARTIAL** — `NFA-USE-09` formalises walkthrough |
| 2.1.1 / 2.2.1 | Akten-Status `VALIDIERT` + read-audit-log? | `app/src-tauri/src/infrastructure/database/connection.rs` defines status `VALIDIERT`; `audit_repo.rs` + `akte_commands.rs` log read access | 🟡 **PARTIAL** — Status & audit OK, but separate Validierungs-Queue UI missing (`FA-AKTE-15`) |
| 5.1.1 | Patient-Discharge-Summary / Merkblatt? | `rg "discharge\|merkblatt\|nachsorge" app` → only seed strings in `connection.rs`. No PDF generator | 🔴 **PENDING** — covered by new `FA-DOK-08` |
| 6.1.2 / 6.2.4 | Arzt-Freigabe vor Abrechnung? | `rg "freigegeben_von_arzt\|approval\|approve.*leistung" app/src-tauri` → **0 hits**. Leistung-Eintrag wird ohne Freigabe-Flag erfasst | 🔴 **PENDING** — covered by new `FA-LEIST-05` |
| 7.3.3 | Akten-Vollständigkeits-Indikator? | `rg "akte.*completeness\|complete.*akte\|missing.*pflicht" app/src` → no dedicated lib | 🔴 **PENDING** — covered by new `FA-AKTE-16` |
| 7.4 | Konfigurierbares Autocomplete? | `app/src/lib/string-suggest.ts` exists for Patient-Suche; vocabulary not yet praxis-extensible via `app_kv` | 🟡 **PARTIAL** — `NFA-USE-10` formalises extension |
| 8.4 | Backup / Restore? | `rg "backup\|wiederherstell\|restore.*db" app` → matches `backup.rs`, `ops_commands.rs` | ✅ **VERIFIED** |
| 9.4 | 5 parallele Clients ohne spürbare Verlangsamung? | Architektur-Vorgabe (Tauri+SQLite-WAL) erfüllt; Last-Test nicht durchgeführt | 🟡 **PARTIAL** — Last-Test offen (siehe N3) |

## Regressions / failed runs (do not delete; append)

| Check | Command | Failure summary | Date |
| ----- | ------- | ----------------- | ---- |
| Migration idempotency | `cargo test --no-default-features --test db_migrations_tests` | `FOREIGN KEY constraint failed` on first run because `seed_demo_data` inserted `anamnesebogen`/`patientenakte` rows referencing `seed-pat-006/007/008` *before* those patients existed. **Fixed** in this session by reordering inserts in `connection.rs`. | 2026-04-25 |
| DSGVO erasure | `cargo test --no-default-features --test dsgvo_erasure_tests` | `assert_eq! left=14 right=0` on global behandlung count. The test asserted `SELECT COUNT(*) FROM behandlung` was 0 after erasing one patient, but `seed_demo_data` legitimately seeds behandlungen for unrelated Akten. **Fixed** by scoping the assertion to `WHERE akte_id = 'akte-dsgvo-1'`. | 2026-04-25 |
