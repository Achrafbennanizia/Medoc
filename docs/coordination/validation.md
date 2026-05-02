# Validation ledger

**Last updated:** 2026-04-26 (Statistiken: merged nav + `activePanel` workspace)

## Verified (commands run, outcomes recorded)

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
