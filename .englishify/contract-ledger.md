# Contract ledger

API / boundary translation registry for the Englishify pass.
Check this file before renaming any boundary identifier. Reuse existing English shapes exactly.

## Entry format

```
- Contract: <name>
- Type: command-name | dto-field | dto-type | enum-value | db-column | i18n-key
- German -> English: <old> -> <new>
- Status: DONE | PROPOSED | KEEP
- Migration required: yes/no (+ note)
- Defining file(s): <rust path> ; <ts path>
- Consumers / call sites: <path>, <path>, ...
- Notes: <anything the next file needs>
```

## Status meanings

- `DONE` — both sides English and consistent; consumers listed.
- `PROPOSED` — deferred; needs coordinated rename across catalogs + all `t()`/`tp()` call sites (and/or Rust+SQL when flagged). Do not execute mid-pass without both sides.
- `KEEP` — identifier must stay German (persisted value; no migration planned).

## Contracts

### Phase 2 checkpoint (Group 1 — first 5 files)

Catalog audit (`packages/shared/locales/{ar,de,en,fr}.json` + `packages/shared/src/lib/i18n.ts`):

- Key count: 4515 × 4 locales; `npm run i18n:verify` PASS (2026-08-01).
- No blank/`[TODO]` values.
- `i18n.ts` already English; no boundary renames applied.
- ~821 keys contain at least one German path segment. Renaming keys without updating every `t("…")` consumer would break UI (missing key → key string). Logged below as `PROPOSED` — do **not** rename until a coordinated catalog + consumer pass.

---

- Contract: i18n-key-namespace.praxis
- Type: i18n-key
- German -> English: `praxis` (path segment) -> `practice`
- Status: PROPOSED
- Migration required: no (catalog + all `t()`/`tp()` sites; ~160 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: all views/controllers using `praxis.*` keys (resolve when those files are processed; grep `t("praxis.` / `tp("praxis.`)
- Notes: Includes nested `praxis.aufgaben` → prefer `practice.tasks` when executed.

---

- Contract: i18n-key-namespace.termin
- Type: i18n-key
- German -> English: `termin` -> `appointment`
- Status: PROPOSED
- Migration required: no (~136 keys with segment)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `termin.` in `t()`/`tp()` call sites under apps/ and packages/
- Notes: Distinguish from enum wire values like appointment status codes (Tier C / KEEP separately).

---

- Contract: i18n-key-namespace.termine
- Type: i18n-key
- German -> English: `termine` -> `appointments`
- Status: PROPOSED
- Migration required: no (~64 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `termine.` in UI `t()`/`tp()` sites
- Notes: Plural namespace used by calendar/list pages.

---

- Contract: i18n-key-namespace.verwaltung
- Type: i18n-key
- German -> English: `verwaltung` -> `administration`
- Status: PROPOSED
- Migration required: no (~114 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `verwaltung.` / `nav.verwaltung`
- Notes: —

---

- Contract: i18n-key-namespace.einstellungen
- Type: i18n-key
- German -> English: `einstellungen` -> `settings`
- Status: PROPOSED
- Migration required: no (~7 keys, e.g. `nav.einstellungen`)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: `apps/practice-host-ui/src/views/layouts/app-layout.tsx`, `apps/practice-host-ui/src/views/components/user-account-menu.tsx`, plus any other `nav.einstellungen` / `*.einstellungen*` keys
- Notes: Partial English already exists under `settings.appearance.*`; merge carefully to avoid duplicate keys.

---

- Contract: i18n-key-namespace.zahlung
- Type: i18n-key
- German -> English: `zahlung` -> `payment`
- Status: PROPOSED
- Migration required: no (~73 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `zahlung.` in `t()`/`tp()` sites
- Notes: —

---

- Contract: i18n-key-namespace.bestellung
- Type: i18n-key
- German -> English: `bestellung` / `bestellungen` -> `order` / `orders`
- Status: PROPOSED
- Migration required: no (~46 + ~64 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `bestellung` in `t()`/`tp()` sites
- Notes: —

---

- Contract: i18n-key-namespace.behandlung
- Type: i18n-key
- German -> English: `behandlung` / `behandlungen` -> `treatment` / `treatments`
- Status: PROPOSED
- Migration required: no (~36 + ~3 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `behandlung` in `t()`/`tp()` sites
- Notes: Do not confuse with DB/entity `Behandlung` (likely Tier C).

---

- Contract: i18n-key-namespace.aufgaben
- Type: i18n-key
- German -> English: `aufgaben` -> `tasks`
- Status: PROPOSED
- Migration required: no (~53 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: often under `praxis.aufgaben.*`
- Notes: Execute together with `praxis` -> `practice`.

---

- Contract: i18n-key-namespace.leistung
- Type: i18n-key
- German -> English: `leistung` / `leistungen` -> `service` / `services`
- Status: PROPOSED
- Migration required: no (~1 + ~31 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `leistung` in `t()`/`tp()` sites
- Notes: —

---

- Contract: i18n-key-namespace.bilanz
- Type: i18n-key
- German -> English: `bilanz` -> `balance_sheet`
- Status: PROPOSED
- Migration required: no (~24 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `bilanz.` in `t()`/`tp()` sites
- Notes: —

---

- Contract: i18n-key-namespace.anamnese
- Type: i18n-key
- German -> English: `anamnese` -> `anamnesis`
- Status: PROPOSED
- Migration required: no (~23 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `anamnese.` in `t()`/`tp()` sites
- Notes: —

---

- Contract: i18n-key-namespace.atteste
- Type: i18n-key
- German -> English: `atteste` -> `certificates`
- Status: PROPOSED
- Migration required: no (~23 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `atteste` in `t()`/`tp()` sites
- Notes: —

---

- Contract: i18n-key-namespace.rezeption
- Type: i18n-key
- German -> English: `rezeption` -> `reception`
- Status: PROPOSED
- Migration required: no (~15 keys) — **if** only used as i18n path segment
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: grep `rezeption` in catalogs and UI
- Notes: Keys like `enum.rolle.rezeption` embed a **persisted role code** — treat that segment as KEEP / Tier C; only rename pure UI namespaces.

---

- Contract: i18n-key-namespace.patienten
- Type: i18n-key
- German -> English: `patienten` -> `patients`
- Status: PROPOSED
- Migration required: no (~9 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: `nav.patienten`, `nav.help.patienten`, …
- Notes: Cognate `patient.*` (EN/DE same stem) left as-is unless a later pass standardizes.

---

- Contract: i18n-key-namespace.rechnung
- Type: i18n-key
- German -> English: `rechnung` -> `invoice`
- Status: PROPOSED
- Migration required: no (~3 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: `document.kind.rechnung`, …
- Notes: May overlap document-kind codes — verify Tier B vs C before rename.

---

- Contract: i18n-key-namespace.stammdaten
- Type: i18n-key
- German -> English: `stammdaten` -> `master_data`
- Status: PROPOSED
- Migration required: no (~2 keys)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: workflow aufgabe_typ keys
- Notes: If value is also a persisted AufgabeTyp code, KEEP the code; only rename UI label keys.

---

- Contract: i18n-key-namespace.abwesenheit
- Type: i18n-key
- German -> English: `abwesenheit` -> `absence`
- Status: PROPOSED
- Migration required: no (~1 key: `error.entity.abwesenheit`)
- Defining file(s): `packages/shared/locales/en.json` ; (mirrors in de/ar/fr)
- Consumers / call sites: entity error mapping
- Notes: Entity name may be Tier C — confirm before rename.

### Phase 2 — Group 2 Rust domain (2026-08-01)

---

- Contract: ipc.appointment-conflict-message
- Type: dto-field
- German -> English: `Terminkonflikt` / `Arzt hat bereits einen Termin…` -> `Appointment conflict` / `Physician already has an appointment…`
- Status: DONE
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/domain/services/konflikt.rs` ; `packages/shared/src/lib/termin-availability.ts`
- Consumers / call sites: `crates/shared/medoc-core/src/infrastructure/database/repos/scheduling/termin.rs`, `packages/shared/src/lib/termin-availability.test.ts` (and any UI using `isTerminConflictErrorMessage`)
- Notes: FE matcher accepts EN + legacy DE. Rust helper renamed `terminkonflikt_short_message` -> `appointment_conflict_short_message`.

---

- Contract: ipc.device-session-suspected-reasons
- Type: dto-field
- German -> English: German prose reasons -> English prose reasons
- Status: DONE
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/domain/services/device_session_risk.rs` ; `packages/app/practice-host/src/pages/einstellungen/einstellungen-device-sessions-section.tsx` (displays raw)
- Consumers / call sites: device-session controller/repo; settings UI lists `suspected_reasons` as-is
- Notes: Not yet i18n keys — UI shows English strings in all locales until a later key-based pass.

---

- Contract: dto-type.Zahnbefund
- Type: dto-type
- German -> English: `Zahnbefund` -> `DentalFinding` (proposed)
- Status: PROPOSED
- Migration required: yes (requires coordinated Rust refactor + SQL migration — table `zahnbefund`)
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/zahnbefund.rs` ; `packages/shared/src/models/types.ts`
- Consumers / call sites: clinical commands, akte repo, TS models/controllers
- Notes: Fields `zahn_nummer`, `befund`, `notizen` are DB columns — same migration bundle. Validation message Englishified (Tier A) without renaming fields.

---

- Contract: dto-type.PraxisAufgabe
- Type: dto-type
- German -> English: `PraxisAufgabe` -> `PracticeTask` (proposed)
- Status: PROPOSED
- Migration required: yes (table + serde field bundle)
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/praxis_aufgabe.rs` ; practice-host controllers
- Consumers / call sites: commands/scheduling/praxis_aufgabe.rs, praxis-aufgabe.controller.ts, …
- Notes: Status/typ wires (`OFFEN`, `ABRECHNUNG`, …) KEEP until enum migration.

---

- Contract: dto-type.Behandlung
- Type: dto-type
- German -> English: `Behandlung` / `Untersuchung` -> `Treatment` / `Examination` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/behandlung.rs` ; TS models
- Consumers / call sites: clinical IPC + akte UI
- Notes: —

---

- Contract: dto-type.Termin
- Type: dto-type
- German -> English: `Termin` -> `Appointment` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/termin.rs` ; TS models
- Consumers / call sites: scheduling commands/controllers
- Notes: Status wires `GEPLANT`/`BESTAETIGT`/… KEEP.

---

- Contract: dto-type.Zahlung
- Type: dto-type
- German -> English: `Zahlung` -> `Payment` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/zahlung.rs` ; TS models
- Consumers / call sites: billing IPC
- Notes: Nested `Bilanz` summary DTO (no FromRow) also PROPOSED → `BalanceSummary` / field renames; treated as C when unsure.

---

- Contract: dto-type.Bestellung
- Type: dto-type
- German -> English: `Bestellung` -> `PurchaseOrder` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/bestellung.rs`
- Consumers / call sites: inventory/order IPC
- Notes: Status wires `OFFEN`/`UNTERWEGS`/`GELIEFERT`/`STORNIERT` KEEP.

---

- Contract: dto-type.BilanzSnapshot
- Type: dto-type
- German -> English: `BilanzSnapshot` -> `BalanceSheetSnapshot` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/bilanz_snapshot.rs`
- Consumers / call sites: billing/bilanz commands
- Notes: —

---

- Contract: dto-type.TagesabschlussProtokoll
- Type: dto-type
- German -> English: `TagesabschlussProtokoll` -> `DayCloseProtocol` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/tagesabschluss_protokoll.rs`
- Consumers / call sites: day-close IPC
- Notes: —

---

- Contract: dto-type.Patientenakte
- Type: dto-type
- German -> English: `Patientenakte` -> `PatientChart` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/patientenakte.rs`
- Consumers / call sites: clinical akte IPC
- Notes: —

---

- Contract: dto-type.Anamnesebogen
- Type: dto-type
- German -> English: `Anamnesebogen` -> `AnamnesisForm` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/anamnesebogen.rs`
- Consumers / call sites: clinical IPC
- Notes: —

---

- Contract: dto-type.Leistung
- Type: dto-type
- German -> English: `Leistung` -> `ServiceItem` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/leistung.rs`
- Consumers / call sites: catalog/billing
- Notes: —

---

- Contract: dto-type.Produkt
- Type: dto-type
- German -> English: `Produkt` -> `Product` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/produkt.rs`
- Consumers / call sites: inventory
- Notes: —

---

- Contract: dto-type.Rezept
- Type: dto-type
- German -> English: `Rezept` -> `Prescription` (proposed)
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/rezept.rs`
- Consumers / call sites: clinical
- Notes: —

---

- Contract: dto-type.DokumentTemplateUser
- Type: dto-type
- German -> English: `DokumentTemplateUser` -> `DocumentTemplateUser` (proposed)
- Status: PROPOSED
- Migration required: no (confirm table name before execute)
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/dokument_template_user.rs`
- Consumers / call sites: document templates
- Notes: Unsure B/C → C.

---

- Contract: dto-type.Personal
- Type: dto-type
- German -> English: `Personal` -> `StaffMember` (proposed); `AerztSummary` -> `PhysicianSummary`
- Status: PROPOSED
- Migration required: yes
- Defining file(s): `crates/shared/medoc-core/src/domain/entities/personal.rs`
- Consumers / call sites: admin personal IPC
- Notes: Field `passwort_hash` / `rolle` / `verfuegbar` etc. in same bundle.

---

- Contract: module.konflikt
- Type: dto-type
- German -> English: module `konflikt` -> `conflict` (proposed)
- Status: PROPOSED
- Migration required: no (Rust module rename + imports)
- Defining file(s): `crates/shared/medoc-core/src/domain/services/mod.rs` ; `konflikt.rs`
- Consumers / call sites: termin repo, any `domain::services::konflikt` imports
- Notes: File rename deferred.

---

- Contract: enum-value.workflow-status-wires
- Type: enum-value
- German -> English: `OFFEN`/`GEPLANT`/`ERLEDIGT_REZEPTION`/… -> English (TBD)
- Status: KEEP
- Migration required: yes (if ever changed — not planned this pass)
- Defining file(s): `crates/shared/medoc-core/src/domain/services/workflow_transitions.rs` ; `config/enums.yaml`
- Consumers / call sites: DB + generated TS enums
- Notes: Persisted wire values — do not rename without migration.

---

- Contract: enum-value.rbac-role-wires
- Type: enum-value
- German -> English: `ARZT`/`REZEPTION`/… -> English (TBD)
- Status: KEEP
- Migration required: yes (if ever changed)
- Defining file(s): `crates/shared/medoc-core/src/domain/rbac.rs` ; `config/enums.yaml`
- Consumers / call sites: auth, RBAC, DB
- Notes: —


### Phase 2 — Group 3 Rust application (2026-08-01)

---

- Contract: ipc.auth-hash-error
- Type: dto-field
- German -> English: `Hash-Fehler` -> `Hash error`
- Status: DONE
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/application/auth_service.rs` ; (FE surfaces AppError text)
- Consumers / call sites: login / password change paths
- Notes: —

---

- Contract: ipc.totp-deactivate-messages
- Type: dto-field
- German -> English: German TOTP validation/conflict strings -> English
- Status: DONE
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/application/totp_service.rs`
- Consumers / call sites: TOTP admin/self-service UI
- Notes: Prefer `error.*` i18n codes in a later pass.

---

- Contract: ipc.practice-task-notify-copy
- Type: dto-field
- German -> English: practice-task notification title/body -> English
- Status: DONE
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/application/praxis_aufgabe_notify.rs`
- Consumers / call sites: in-app notification list
- Notes: Status wires KEEP. UI may show EN until locale-aware notify copy.

---

- Contract: ipc.termin-hint-fulfill-notify-copy
- Type: dto-field
- German -> English: appointment-hint notify copy -> English
- Status: DONE
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/application/termin_hint_fulfillment.rs`
- Consumers / call sites: notifications
- Notes: —

---

- Contract: pdf.akte-export-labels
- Type: dto-field
- German -> English: chart/PDF section titles -> locale-aware via i18n / active locale
- Status: PROPOSED
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/application/akte/pdf_export.rs`
- Consumers / call sites: PDF export commands / print pipeline; mirror pattern in `document-print-html`
- Notes: **Decision 2026-08-01:** EN-only literals reverted. German display labels kept for DE-default product. Do not hardcode English PDF UI copy; wire through locale/i18n in a dedicated pass.

---

- Contract: dto-type.ExportDischargeMerkblattPdfArgs
- Type: dto-type
- German -> English: `ExportDischargeMerkblattPdfArgs` -> `ExportDischargeLeafletPdfArgs`; fields `zusatz_hinweise`/`ueberweisung_hinweise` -> EN
- Status: PROPOSED
- Migration required: no (confirm serde consumers; unsure B/C → C)
- Defining file(s): `crates/shared/medoc-core/src/application/akte/pdf_export.rs` ; TS export callers
- Consumers / call sites: discharge leaflet export invoke
- Notes: —


### Phase 2 — Group 4 Rust commands (2026-08-01)

---

- Contract: ipc.AppError.NotFound-resource
- Type: dto-field
- German -> English: resource label inside `"{0} nicht gefunden"` (e.g. `Patientenakte`) -> English resource + English template
- Status: KEEP (for this pass) / PROPOSED for coordinated change
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/error.rs` ; FE matchers e.g. `packages/shared/src/lib/patient-detail-utils.ts` (`isPatientenakteMissingError`)
- Consumers / call sites: all `AppError::NotFound("…")` call sites in commands
- Notes: **2026-08-01:** Attempted EN resource labels reverted. Changing resource alone yields mixed `Patient chart nicht gefunden` and breaks FE. Requires simultaneous template + matcher update.

---

- Contract: command-name.* (bulk)
- Type: command-name
- German -> English: German `#[tauri::command]` stems (`list_termine`, `create_praxis_aufgabe`, `update_zahnbefund`, …) -> English stems
- Status: PROPOSED
- Migration required: no (but both-sides: `register.rs` + `tauri.service.ts` + all controllers)
- Defining file(s): `crates/app/medoc-practice/src/commands/**` ; `apps/practice-host-ui/src/services/tauri.service.ts`
- Consumers / call sites: all `invoke("…")` sites
- Notes: Not executed in Group 4 — too many consumers; rename only in a dedicated both-sides pass.

---

- Contract: ui.statistik-chart-labels
- Type: i18n-key
- German -> English: hardcoded DE chart labels in `statistik.rs` command -> locale-aware i18n
- Status: PROPOSED
- Migration required: no
- Defining file(s): `crates/app/medoc-practice/src/commands/praxis/statistik.rs`
- Consumers / call sites: statistik UI
- Notes: Same policy as PDF labels — do not hardcode EN for DE-default product.


### Phase 2 — Group 5 Rust infrastructure (2026-08-01)

---

- Contract: ipc.AppError.Display-templates
- Type: dto-field
- German -> English: `"{0} nicht gefunden"`, `Nicht autorisiert`, … -> English templates
- Status: PROPOSED
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/error.rs` ; FE matchers (`isPatientenakteMissingError`, …)
- Consumers / call sites: all serialized AppError paths
- Notes: KEEP for this pass. Coordinated change only.

---

- Contract: ui.native-menu-labels
- Type: i18n-key
- German -> English: DE OS menu labels -> locale-aware
- Status: PROPOSED
- Migration required: no
- Defining file(s): `crates/app/medoc-practice/src/infrastructure/app_menu.rs`
- Consumers / call sites: native menu
- Notes: DE labels kept (default locale).

---

- Contract: ui.default-device-display-name
- Type: dto-field
- German -> English: `Dieses Gerät` -> locale-aware / `This device`
- Status: KEEP (this pass)
- Migration required: no
- Defining file(s): `crates/shared/medoc-core/src/infrastructure/database/sync_outbox.rs` ; `crates/shared/medoc-sync/src/engine/run.rs` ; `…/repo/store.rs`
- Consumers / call sites: sync peer display; `engine_run_tests.rs`
- Notes: EN attempt reverted; test asserts DE default.


### Phase 3 — Reconciliation snapshot (2026-08-01)

- Manifest: **872 / 872** processable rows `[x]`; **9** generated `[G]` appendix untouched.
- `human-action.md` compiled from PROPOSED/KEEP ledger entries.
- `npm run i18n:verify` → parity OK — **4544** keys × 4 locales.
- `cargo check -p medoc-practice` → PASS (with `MEDOC_VENDOR_PUBKEY`).
- Full `npm test` / `npm run build` / workspace `cargo test`: **NOT RUN** in this closing slice (targeted suites earlier PASS).

