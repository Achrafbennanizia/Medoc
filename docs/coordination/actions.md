# Action ledger

**Last updated:** 2026-05-25 (Wave A complete)

## Now

- **Workspace restructure — see [`restructure-plan.md`](restructure-plan.md):**
  - **Checkpoint:** `33171bd` — wave-23 state committed (290 files, +17,548/-10,023).
  - **Test fix:** `dbd146d` — backup retention test made day-of-week independent (was failing on Mondays/Sundays).
  - **Wave A — DONE** `f402f28` — dropped 41 legacy controller shims + 15 legacy page shims; repointed ~90 imports to `@/systems/*/controllers/*` and `@/systems/*/pages/*`. `npm run lint && npm test (155) && npm run build` PASS.
  - **Wave B1 (mapping) — DONE** [`wave-b-crate-mapping.md`](wave-b-crate-mapping.md). Every `.rs` file under `app/src-tauri/src/` assigned to a target crate (medoc-{core,practice,lan,company,codegen}); 6 known constraints catalogued (Tauri leakage in `application/rbac.rs` + `infrastructure/database/connection.rs`; inverted `domain → application::rbac::Role`; crate-root macro re-homing; OUT_DIR codegen pathing; TS-file relative paths).
  - **Wave B3 (workspace skeleton) — DONE** — `app/Cargo.toml` virtual workspace; new placeholder crates `app/crates/medoc-codegen/` and `app/crates/medoc-core/` (empty `lib.rs`, no deps). Workspace target dir is now `app/target/`; orphan `app/src-tauri/Cargo.lock` removed. `cargo check --workspace`, `cargo test --workspace --tests`, `cargo clippy --workspace --all-targets -- -D warnings` ALL PASS. No source code lifted yet.
  - **Wave B2/B4–B8 — NOT STARTED.** Real lifts (untangle Tauri leakage, move `domain/`, `error.rs`, non-Tauri `application/`, non-Tauri `infrastructure/`, then `lan_server/` → `medoc-lan`, `company_host/` → `medoc-company`, `commands/` → `medoc-practice`, finally binaries) require focused follow-up sessions.
  - **Wave C prep — DONE** [`wave-c-package-mapping.md`](wave-c-package-mapping.md). 97 files in `app/src/lib/` categorised: 3 generated, ~50 pure helper candidates for `@medoc/shared`, 3 Tauri-coupled, 1 React component, ~38 system-aware (require dependency inversion or relocation).
  - **Waves C/D execution** — depend on B; not started.
- **Three-system — previous:** live LAN-client browser E2E **NOT RUN**; optional `einstellungen.tsx` → `practice-host/pages/`.

## Done (2026-05-22 three-system wave)

- **`application/akte/pdf_export.rs`** — FA-AKTE-04 + FA-DOK-08; `akte_commands.rs` **~369** lines (thin IPC wrappers)
- **Einstellungen sections** — `systems/practice-host/pages/einstellungen/` (12 modules); re-export stubs in `views/pages/`
- **Company-portal section** — `systems/company-portal/pages/einstellungen-company-portal-section.tsx`; view stub retained
- **LAN client login flow** — `http-practice.adapter.test.ts` (fetch mock + token persistence); live browser E2E **NOT RUN**

## Done (2026-05-21 three-system wave)

- **Structure:** `app/src/systems/{practice-host,lan,company-portal}/`, `app/src-tauri/src/systems/{practice,lan,company}/`, `docs/architecture/three-systems.md`
- **Patient feature folder:** `systems/practice-host/pages/patient-detail/` (17 modules); stub `views/pages/patient-detail.tsx`
- **Validation:** `systems-structure.test.ts`; smoke IPC assert fix; transport delegate for Vitest
- **`HttpPracticeAdapter` + `practice-transport` factory** — `systems/practice-host/adapters/`
- **`application/akte/billing_release.rs`** — first akte use-case extraction from `akte_commands.rs`
- **Clippy:** `needless_borrows` + `AbrechnungAufgabeParams` in DB repos (**PASS** `cargo clippy --lib`)
- **LAN client UI** — `einstellungen-lan-host.tsx` (`medoc.lan.client.v1`, discovery → URL)
- **`application/akte/rezeption_redact.rs`** — REZ redaction extracted from `akte_commands.rs`
- **`backup_tests`** — `tokio::sync::Mutex` (**PASS** `cargo clippy --all-targets`)
- **`application/akte/clinical_line_persistence.rs`** — B/U CRUD + FA-LEIST-06/07 + FA-AUFG-02 side effects
- **LAN UI** — `systems/lan/pages/einstellungen-lan-host.tsx` (re-export stub in `views/pages/`)

## Now (previous) (gap remediation — active)

> **Phase 0:** Ledger truth sync (this file). **Phases 1–6:** G1–G13 below.  
> Legacy WAAD IDs **A1–A13** retained for traceability; see **Status** column.

| ID | Action | Blocked by | Status |
| -- | ------ | ---------- | ------ |
| G0 | Reconcile `project-truth.md`, `06-validierung.md`, `phase-handoff.md` with code (close stale A-rows) | — | **Done** 2026-05-21 |
| G1 | FA-AKTE-15 sidebar badge: `count_akten_zu_validieren` IPC + nav UI | — | **Done** 2026-05-21 |
| G2 | WAAD 9.1 restore: `restore_backup` + Ops UI + confirm dialog (scheduler in `lib.rs`) | — | **Done** 2026-05-21 |
| G3 | Error surfacing: replace silent `.catch` on ops, gates, patient-detail, app-layout | — | **Done** 2026-05-21 (portal `null` documented offline-by-design in `einstellungen.tsx`) |
| G4 | Discharge PDF test in `pdf_document_tests.rs` + DoD routes `/akten/zu-validieren`, `/tickets` | — | **Done** 2026-05-21 |
| G5 | `patient-detail` shell further split (rezept tab / shell &lt;1200 lines) | P3h | **Done** 2026-05-21 (shell **~1029** lines; clinical/zahl/akte hooks + `patient-detail-overlays.tsx`) |
| G6 | NFA-USE-09 onboarding wizard (`app_kv` + per-route coverage ≥80%) | Product copy | **Done** 2026-05-21 (coachmark, nested-route match, `ONBOARDING_MIN_COVERAGE_RATIO`, settings %) |
| G7 | NFA-USE-10 configurable autocomplete + disable toggle (`app_kv`) | — | **Done** (already in `client-settings` + Arbeitsabläufe toggle) |
| G8 | WAAD 9.5 / A10: Krankheitsbild-Verlauf charts + CSV in `statistik.tsx` | — | **Done** 2026-05-21 |
| G9 | Termin reminders: dashboard panel MVP (full SMS/email deferred) | — | **Done** 2026-05-21 |
| G10 | Integration capability matrix + disable/label stubs (TI/KIM/pay/DICOM) | Product D3 | **Done** 2026-05-21 |
| G11 | A9 stress test harness (5 parallel clients) | CI budget | **Done** 2026-05-21 (`stress_tests.rs`) |
| G12 | Per-patient RBAC spike (WAAD 2.1.1) | Product decision | **Deferred** |
| G13 | FA-LEIST-05 doc rescope (B/U not catalog `leistung`) + billing UI hints | — | **Done** 2026-05-21 (`pflichtenheft.md`, traceability, zahl-tab + `billing-release.ts`) |
| CAL2 | Termin Pause/Notfall toolbar: re-enable OR formal feature flag (D1) | Product D1 | **Done** 2026-05-21 (flag + banner + settings toggle) |
| N3 | E2E test: release B/U → Zahlung OK; without release → FA-LEIST-05 error | G13 | **Done** 2026-05-21 (`zahlung_repo_tests` + `billing-release-flow.test.ts`; full UI E2E **NOT RUN**) |
| G14 | **FA-LEIST-06:** Nach B/U+Leistung → Tab `zahl` + offene Buchung (`AUSSTEHEND`); implizite `freigegeben_*` | G13 | **Done** 2026-05-21 (Behandlung; `ensure_open_booking_for_billable_behandlung` + `billing-open-booking.ts`) |
| G15 | **FA-LEIST-07:** `untersuchung` + UI Leistung/Preis wie `behandlung`; `pricing`/`zahlung-buchung` | G14 | **Done** 2026-05-21 |
| G16 | **FA-AUFG-01/06:** `praxis_aufgabe` + Statusmaschine + IPC + migrate `praxis_ticket` | Product | **Done** 2026-05-21 |
| G17 | **FA-AUFG-02–05:** Posteingang REZ, erledigen→notify, Arzt VALIDIERT/ZURUECK; poll/badge | G16 | **Done** 2026-05-21 (`/posteingang`, 5s poll, `PRAXIS_AUFGABE_ERLEDIGT`) |
| G18 | Auto-Aufgabe `ABRECHNUNG` bei B/U+Leistung speichern (verknüpft G14+G17) | G14, G17 | **Done** 2026-05-21 (`ensure_abrechnung_aufgabe_for_clinical_line`) |
| G19 | **FA-AUFG-02 manual:** „Aufgabe an Rezeption“ in Patientenakte (ARZT → `create_praxis_aufgabe`) | G17 | **Done** 2026-05-21 (`patient-akte-workflow-dialogs.tsx`, shell button) |
| G2b | **G2 fix:** restore backup → SQLCipher (`opens_with_sqlcipher_key` or plaintext migrate) | G2 | **Done** 2026-05-21 (`backup.rs`, `sqlcipher.rs`) |

### Gap register (P0–P3) — master audit

Vollständige Tabelle: [`docs/uml/10-master-feature-workflow-audit.md`](../uml/10-master-feature-workflow-audit.md) §6–§8.

| Priority | IDs | Theme | Status (2026-05-21) |
| -------- | --- | ----- | ------------------- |
| **P0** | GAP-01..04 | REZ clinical leak; Posteingang; FA-AUFG bidirectional | **Mitigated in code** — `redact_*_for_rezeption` (`akte_commands.rs`); REZ patient-detail gates (`canViewClinical` / `canListBehandlungenForZahlung`); G16–G19 Posteingang + manual Aufgabe. **NOT OBSERVED:** live REZ UI audit |
| **P1** | GAP-05..07 | FA-LEIST-07 Untersuchung; LEIST-06 U; auto Aufgabe | **Done** (G14–G18) |
| **P2** | GAP-08..12 | Termin SMS/Notfall; REZ nav; Quittung; VDDS/BDT |
| **P3** | GAP-13..15 | TI/KIM; mobile LAN; Abo live |

**Recommended implementation order:** Phase 1 (GAP-01/02) → Phase 2 (G15/G14-U) → Phase 3 (G16–G18) → Phase 4 (REZ IA).

### WAAD backlog (reconciled 2026-05-21)

| ID | Action | Status | Notes |
| -- | ------ | ------ | ----- |
| A1 | NFA-SEC-08 SQLCipher | **Done** | `sqlcipher.rs`, `DbSetupGate` |
| A2 | FA-PERS-07 permission overrides | **Done** | `personal.tsx` + RBAC session |
| A3 | FA-DOK-08 discharge merkblatt PDF | **Done** | G4 adds PDF test |
| A4 | FA-PERS-08 praxis tickets | **Done** | `/tickets`; verify audit-on-read if required |
| A5 | FA-LEIST-05 physician release | **Done** | B/U `freigegeben_*`; G13 docs |
| A6 | NFA-USE-09 onboarding | **Done** → **G6** | Per-route coachmark + ≥80 % target |
| A7 | FA-AKTE-16 completeness | **Done** (extend) | `akte-completeness.ts` |
| A8 | Auto backup + restore UI | **Done** | scheduler `lib.rs` + **G2** restore + test |
| A9 | Stress test | **Done** → **G11** | `five_parallel_clients_audit_inserts_remain_valid` |
| A10 | Disease pattern statistik | **Done** → **G8** | Proxy from Behandlungsaggregaten |
| A11 | FA-AKTE-14 forward akte | **Done** | `PatientAkteWorkflowDialogs` |
| A12 | FA-AKTE-15 validation queue | **Done** | page + **G1** nav badge |
| A13 | NFA-USE-10 autocomplete | **Done** → **G7** | |

## Prior Now (audit remediation — complete)

| ID | Action | Status |
| -- | ------ | ------ |
| DOC | Document Phases B–E + professional PDF layout | **Validated** 2026-05-19; uncommitted |
| P0–P3h, P1*, P2*, CAL | Security, codegen, page splits | **Done** (see phase-handoff) |

## Next (queued)

| ID | Action | Dependency | Priority |
| -- | ------ | ---------- | -------- |
| G20 | Deprecate `/tickets` → banner + nav; Posteingang in sidebar + `ROUTE_VISIBILITY` | — | **Done** 2026-05-21 (no full redirect — REZ→ARZT tickets remain FA-PERS-08) |
| G21a | Automated G21: `collaboration-g21.test.ts`, `posteingang.smoke.test.tsx`, tab guard util | — | **Done** 2026-05-21 |
| G21b | Live Tauri checklist | G21a | **Pending** — [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md) (manual) |
| — | G12 per-patient RBAC | Product | **Deferred** |

## Done (recent; keep short)

| ID | Outcome | Date |
| -- | ------- | ---- |
| G7–G10, G8–G9, CAL2 | Queue items wired + validated | 2026-05-21 |
| G21a | Collaboration unit + Posteingang poll smoke tests | 2026-05-21 |
| G20, G17-fix | Posteingang sidebar + route guard; tickets→Posteingang banner | 2026-05-21 |
| G19, G2b | Manual Aufgabe dialog; backup restore SQLCipher re-encrypt | 2026-05-21 |
| G16–G18 | FA-AUFG praxis_aufgabe + Posteingang + auto ABRECHNUNG | 2026-05-21 |
| G15 | FA-LEIST-07 Untersuchung billing fields + open booking + zahl tab | 2026-05-21 |
| G14 | FA-LEIST-06 auto open booking + zahl tab | 2026-05-21 |
| N2, N6, G3 | CI tauri smoke; Verwaltung RBAC split; portal offline doc | 2026-05-21 |
| N1, N4, N5 | README desktop-only; termin alt slots; invoice LS→app_kv | 2026-05-21 |
| G6, G13, N3 | Onboarding ≥80 %, FA-LEIST-05 docs, billing IPC tests | 2026-05-21 |
| G5 | patient-detail shell &lt;1200 lines + overlays | 2026-05-21 |
| G1–G4, G2 restore | Gap remediation batch 1 | 2026-05-21 |
| D1–D20, P0 | See prior entries | 2026-04-19 … 2026-05-20 |
