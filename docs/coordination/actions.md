# Action ledger

**Last updated:** 2026-08-20 (English leftover identifiers — helpers / i18n / PDF / template kind)

## Now

- **Rust compile:** `cargo test` of PDF helpers + `document_template.kind` upgrade — **NOT RUN** (`cargo` not on PATH).
- **Existing DBs:** `REZEPT`/`ATTEST` → `PRESCRIPTION`/`CERTIFICATE` via `ENUM_UPDATES` after German CHECK rebuild. Live `medoc.db` — **NOT OBSERVED**.
- **Optional later:** invoice.practice.v1 German KV (needs Swing together); certificate payload `krankheiten` / `tage_anzahl` / `einschraenkung`.
- **Swing prescriptions / invoice lines / day close:** patient prescriptions; billing line items; cash reconciliation. LAN prescription/line/day-close paths stay **null**. GUI walk after `./run` restart — **NOT OBSERVED**.
- **Swing onboarding / month / invoice status / templates:** wizard in `practice.preferences.v1`; month list from day queries; demo Issue/Paid; template body editor. LAN `update_invoice` / `update_catalog` paths stay **null**. GUI walk after `./run` restart — **NOT OBSERVED**.
- **Rust compile:** `cargo test` of invoice PDF + `pdf_document_tests` — **NOT RUN** (`cargo` not on PATH).
- **Existing DBs:** upgrade is in `run_english_schema_upgrade` and runs on every open. Live `medoc.db` — **NOT OBSERVED**.
- **Stored templates / prefs / invoice history:** dual-read leftover German keys; live reprint of old invoice JSON — **NOT OBSERVED**.
- **Swing LAN:** `LanDialect` outgoing English (`/patients`, `/appointments`, `password`, `PHYSICIAN`). Live HTTPS **NOT OBSERVED**.
- **`de` language option** currently duplicates English catalog values.
- **Optional later:** invoice.practice.v1 German wire keys (needs Swing together); certificate template payload `krankheiten` / `tage_anzahl` / `einschraenkung`.
- **Swing client (sibling `/Users/achraf/pro/Medoc-swing`):** sidebar + admin TOC + catalogs + privacy + cash + onboarding + month list + invoice status/lines + templates + patient prescriptions + day close. Catalog/GDPR/invoice/prescription/day-close writes are demo-mock only. Drag calendar / GOZ factor / e-prescription submit remain not started. Progress map: [`swing-conversion-checklist.md`](swing-conversion-checklist.md) and `Medoc-swing/CONVERSION.md`.
- **Manual QA:** examinations billing release, attachments/scanner import, focus-mode nav — **NOT RUN**
- **Page migration:** `apps/practice-host-ui/src/views/pages` → `packages/app/practice-host/src/pages` — incremental, not started
- **Refactor & harden pass:** [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md) — register at [`refactor-register.md`](refactor-register.md); Phases A–F incremental.
- **Geplant / future development:** single status register — [`geplant.md`](geplant.md) (not in-app UI).
- **Deferred roles (MVP):** `TAX_ADVISOR` / `PHARMA_CONSULTANT` — [`todos-deferred-roles.md`](todos-deferred-roles.md).
- **Deferred Datenschutz (DSGVO) UI:** [`todos-deferred-features.md`](todos-deferred-features.md).
- **Deferred security (MVP):** Break-Glass off, 2FA off, 5-user cap — [`todos-deferred-security-features.md`](todos-deferred-security-features.md).

## Done (2026-08-20 — English leftover identifiers — helpers / i18n / PDF / template kind)

- PDF helpers, i18n keys (`device_cluster`, `examination_*`, `enum.profession`, patient filters), PDF labels, `document_template.kind` PRESCRIPTION/CERTIFICATE with leftover dual-read + upgrade.
- Vitest subset **97 PASS** / 16 files. `cargo` **NOT RUN**.

## Done (2026-08-20 — Swing prescriptions + invoice lines + day close)

- Patient prescriptions page (create/delete). E-prescription submit stays desktop-only.
- Invoice lines: add/remove; amount = line sum. Not a GOZ factor engine.
- Day close: counted cash vs today’s cash total + variance. No PDF.
- `./gradlew test --rerun-tasks` **PASS** — 66 tests / 17 classes.

## Done (2026-08-20 — Swing onboarding + month + invoice status + templates)

- Onboarding wizard writes `onboardingComplete` into `practice.preferences.v1` (merge-safe). License/pairing stay desktop copy.
- Appointments month list from one LAN-safe day query per date; double-click opens day view (no drag).
- Billing Issue / Mark paid (`update_invoice`). Template editor create/update (`update_catalog`). Both demo-mock; LAN paths **null**.
- `./gradlew test --rerun-tasks` **PASS** — 64 tests / 16 classes.

## Done (2026-08-20 — English leftover identifiers — invoice PDF IPC)

- Invoice PDF IPC English (`factor`, `tooth_nr`, `treatment_date`, `vat_percent`, `bank_details`, `vat_notice`) with serde + TS dual-read of leftover German keys.
- `validate_tooth_number`, `lineFromServiceItemChoice`, `allocateReceiptNumber`.
- Vitest subset **95 PASS** / 15 files. `cargo` **NOT RUN**.

## Done (2026-08-20 — Swing privacy + cash + anamnesis)

- Privacy demo JSON export and master-data anonymise (`PrivacyController`). LAN dsgvo commands stay unavailable.
- Cash desk today-queue with KPI and patient (React `finance-cash.tsx` subset).
- `/inbox` → tickets; `/finance` → billing; anamnesis note on new patient.
- `./gradlew test --rerun-tasks` **PASS** — 61 tests / 16 classes.

## Done (2026-08-20 — English leftover identifiers — appointments / numbering / i18n)

- Duration / toothache / emergency identifiers English with leftover dual-read. Numbering `allocateReportNumber`. i18n emergency/changed/toothache keys. Day-close index rename.
- Vitest subset **89 PASS** / 13 files. `cargo` **NOT RUN**.

## Done (2026-08-20 — English leftover identifiers — day-close)

- `day_close_protocol`: `notiz` → `note`, mixed leftover columns → English (`day_payment_count`, `recorded_at`, …). IPC `set_payments_cash_verified`.
- Vitest subset **76 PASS** / 10 files; day-close smoke **PASS**. `cargo` **NOT RUN**.

## Done (2026-08-20 — English leftover identifiers — VVT / done_note / PDF)

- VVT generator copy English. `practice_task.done_notiz` → `done_note` (IPC `doneNote`; serde aliases).
- Chart / receipt / prescription PDF labels English; medications defaults English (`7 days`, dosage forms).
- Vitest subset **68 PASS** / 9 files (inbox smoke skipped by flag). `cargo` **NOT RUN**.

## Done (2026-08-20 — Swing nested catalogs)

- Administration hubs (`AdminHubs`) matching React TOC: team, finance, inventory, services, planning, governance.
- Reusable `CatalogListPage` + `CatalogController` for prescriptions, certificates, services, products, staff, work plan, treatment, templates, contracts, order master, day close, balance, work days, blocked times, work hours, audit, logs, ops, compliance, feedback, migration.
- `PrivacyPage` static GDPR copy (no LAN export/erasure).
- `./gradlew test --rerun-tasks` **PASS** — 59 tests / 15 classes.

## Done (2026-08-20 — English leftover identifiers)

- Prefs: `pufferMin` → `bufferMin`, calendar view `tag|woche|monat` → `day|week|month`, settings locals `praef` / `Oeffnungszeiten`.
- Document templates: English JSON ids with dual-read; DPIA `generate_dpia` / `dpia.rs`.
- Practice task kinds `TERMIN`/`DRUCK` → `APPOINTMENT`/`PRINT`.
- Vitest subset **67 PASS** / 8 files. `cargo` **NOT RUN**.

## Done (2026-08-19 — Swing sidebar features)

- Sidebar order: charts to validate, tickets, statistics, billing, cash, orders, work time, administration.
- Demo mock: patient create/update, appointment create/update/delete, chart note tabs.
- `./gradlew test` **PASS** — 54 tests / 13 classes. LAN write commands stay unavailable on HTTP.

## Done (2026-08-19 — English leftover identifiers)

- Cluster fns `list_geraete` / `*_kopplung_*` → `list_devices` / `*_pairing_*`. Help `/hilfe` → `/help`. Settings sections and onboarding paths English. Finance KPIs and statistics labels English. Vitest subset **60 PASS** / 6 files. `cargo` **NOT RUN**.

## Done (2026-08-19 — Swing practice logo)

- Settings logo via LAN KV `practice.logo.v1` (`{ mime, data }` base64, max 750 KB). Remove uses `delete_app_kv`. `./gradlew test` **PASS** — 50 tests / 12 classes.

## Done (2026-08-19 — English SQLite schema upgrade)

- `serviceItem` / `purchaseOrder` SQL → `service_item` / `purchase_order` in schema + queries.
- Cluster SQL `geraet_*` / `kopplung_state` → `device_*` / `pairing_state`.
- Idempotent German→English table/column/enum upgrade; existing DBs run migrations on every open.
- Specialty seed `Dentistry`.

## Done (2026-08-19 — Swing invoice billing IDs)

- Letterhead now also stores clinician name, professional title, ZANR, BSNR, LANR, IBAN/BIC/bank. Wire keys `zanr` / `bankverbindung_iban` stay in the KV blob. `./gradlew test` **PASS** — 47 tests / 12 classes.

## Done (2026-08-19 — Swing practice letterhead)

- Settings letterhead: name, address, phone, email, opening hours, KV number via `invoice.practice.v1`. Unknown wire fields (ZANR, IBAN, …) kept. `./gradlew test` **PASS** — 44 tests / 11 classes.

## Done (2026-08-19 — Swing own profile)

- Settings My account: `OwnProfileController` `get` / `update` via `GET|PATCH /api/v1/me` (name, email, phone). Password change still not on LAN.
- `./gradlew test` **PASS** — 42 tests / 11 classes.

## Done (2026-08-19 — leftover German copy + English de.json)

- Errors, FIRST/FOLLOW_UP, ISSUED, catalog categories, dental status, chart tabs are English. Default locale `en`. `de.json` values = `en.json`.
- Vitest subset **120 PASS** / 18 files.

## Done (2026-08-19 — Swing LanDialect English LAN)

- Outgoing dialect matches Medoc LAN: `/api/v1/patients`, `/api/v1/appointments?date=`, `password`, `PHYSICIAN` → `Role.DOCTOR`. German names kept as inbound fallbacks.

## Done (2026-08-19 — Swing conversion checklist)

- File-by-file React → Swing map: sibling `Medoc-swing/CONVERSION.md`. Pointer: [`swing-conversion-checklist.md`](swing-conversion-checklist.md).

## Done (2026-08-19 — full English wires)

- Converted remaining German wires: IPC commands, SQL, enum values, routes, RBAC, i18n keys. Fixed `_created_at` collateral. ipc-bridge is identity.
- Vitest subset **111 PASS** / 16 files. `cargo` **NOT RUN**.

## Done (2026-08-19 — Swing week appointments + help)

- Appointments: Day / Week toggle. Week is seven LAN `list_appointments` calls (Monday–Sunday). No create/edit.
- Help page. Remaining sidebar items open an honest LAN-unavailable stub.
- `./gradlew test` 36 PASS.

## Done (2026-08-19 — Swing settings English KV on the wire)

- Swing GET/PUT uses English `practice.preferences.v1` with no German remapping.
- LAN whitelist in `app_kv_policy.rs` accepts that key (legacy `practice.preferences.v1` kept for Tauri).
- `./gradlew test` 35 PASS. `cargo test` **NOT RUN** (`cargo` not on PATH).

## Done (2026-08-19 — Swing settings English KV key)

- App code uses `practice.preferences.v1`. `LanDialect` maps it to the LAN stored key on GET/PUT. Adapter tests no longer contain the German literal.
- `./gradlew test` 35 PASS.

## Done (2026-08-19 — Swing settings slice)


## Done (2026-08-19 — full identifier conversion)

- TS + Rust identifiers converted token-aware (strings/comments skipped). Serde/sqlx/tauri rename keeps wires German.
- Enum yaml type/variant names English; wire values unchanged.
- Vitest subset 106 PASS. `cargo` **NOT RUN**.

## Done (2026-08-19 — saldo / domain entity stems)

- Glossary: `saldo`, `as_of_date`, `gezaehlt`, `laut`, `stimmt`, `zurueck`/`begruendung`, `geliefert`, `unterwegs`, `bearbeitung`.
- `balance_cents` now in unique list (`balance_sheet_snapshot.rs:19`). Unique count **6872**.

## Done (2026-08-19 — German-inventory cover-up)

- Scanner prefix-match for fused compounds (`bestellstamm`, `Rezeptverwaltung`, `zahlungsziel`, …).
- Rescan: **6811** unique identifiers; both JSON files in sync; family grep 0 missing; must-haves present.
- Inventory only — no identifier renames.

## Done (2026-08-19 — Swing dashboard slice)

- `DashboardController` + `DashboardPage`: patient/new/in-care/today KPIs + today's appointment table. English keys; DE values only in `messages_de.properties`.
- `./gradlew test` 30 PASS.

## Done (2026-08-19 — Swing appointments slice)

- Read-only day list: `AppointmentController` + `AppointmentsPage`; German LAN wires only in `LanDialect`.
- Sidebar **Appointments** enabled. Double-click opens patient master data.
- `./gradlew test` 28 PASS. Live LAN **NOT OBSERVED**.

## Done (2026-08-19 — Swing Englishify rescan)

- Isolated remaining German LAN wires in `LanDialect` (`password`, `role`/`PHYSICIAN`, `/api/v1/patients`, `date_of_birth`, …).
- Gender labels via i18n (`patient.gender.*`); `showPassword` renamed; rate-limit uses `LanDialect.looksRateLimited`.
- `./gradlew test` 21 PASS. Live LAN **NOT OBSERVED**.

## Done (2026-08-19 — Englishify TS identifiers)

- Rewrote live TS identifiers (types/functions/fields) German → English; IPC commands, routes, i18n keys unchanged.
- `ipc-bridge.ts` maps English fields to German JSON. Regex + template-interpolation aware rewriter in `.englishify/ident_rewrite.py`.
- Restored German RBAC route/section lookup keys (quoted). Vitest subset 96 PASS.

## Done (2026-08-19 — Java Swing frontend slice)

- External Gradle 8 / Java 21 Swing client at `/Users/achraf/pro/Medoc-swing`.
- Hexagonal port + HTTP/mock adapters; login, sidebar, patient table, master-data detail.
- Java identifiers Englishified (`Role`, `PatientsPage`, `dateOfBirth`, …). LAN JSON/command wires kept (`password`, `list_patients`).
- `./gradlew test` 18 PASS. Live LAN **NOT OBSERVED**.

**Last updated (prior):** 2026-08-19 (Englishify source filenames)

## Master plan

Active cost-priority delivery plan and test allow-list:

| Document | Purpose |
| -------- | ------- |
| [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md) | Incremental refactor, quality pass, workflow audit (Phases A–F) |
| [`mvp-cost-priority-plan.md`](mvp-cost-priority-plan.md) | Workflows W1–W12, MS/UX/T items, phases, MVP checklist |
| [`mvp-test-scope.md`](mvp-test-scope.md) | T-U1/T-U2 100% module allow-list |

## Done (2026-07-10 — Patient Akte MVC / domain split)

- `akte-attachments` pure domain → `packages/shared/src/lib/akte-attachments.ts`; Tauri `convertFileSrc` stays in `apps/practice-host-ui/src/platform/akte-attachments.ts`.
- `desktop-window-frame` Tauri calls → `src/platform/desktop-window-controls.ts`.
- ESLint `no-restricted-imports`: views/pages cannot import `@tauri-apps/*` or transport/registry directly.
- `audit`, `compliance`, `ops` pages → `packages/app/practice-host/src/pages/` (+ `ops.smoke.test.tsx`; G21 script path updated).
- Pre-existing build errors fixed: duplicate `className`, login CapsLock handler, `WorkTimeReconcileReport` type.
- `npm run build` **PASS** (2026-07-10).

## Done (2026-06-18 — Work-Time & Team Overview)

- Schema + RBAC + extended work_time/krank/adjustment IPC (294 handlers).
- Employee `/staff/work-time`, admin `/administration/team/work-time`, Krankenbescheinigung Verwaltung, Statistik `sec-arbeitszeit`.
- Per-user auto-record prefs; RECEPTION post-login → Arbeitszeit; focus-mode nav filter.

## Done (2026-06-16 — Admin installer + offline keygen)

- **`installer/medoc-keygen`:** C++ tool (libsodium, Argon2id + XChaCha20 manifest); Windows/Unix; `--passphrase-file` / `--passphrase-env`.
- **`installer/build-*.sh`:** keygen + app installer orchestration; `tauri.conf.json` bundle targets extended.
- **Rust:** `verbund/activation.rs` import + `activate_cluster_license` preserves imported keys.
- **IPC/UI:** `import_activation_manifest`; `/onboarding/aktivierung`.
- **CI:** `.github/workflows/release.yml`.

## Done (2026-06-07 — MVP plan todos)

- **persist-plan-docs:** Master plan links in actions.md; W6 boot path in mvp-cost-priority-plan.md.
- **w7-lan-client:** Playwright patient list RBAC; deployment hints; lan-client-deployment doc paths.
- **w8-two-device:** `two-device-sync-smoke.sh` AUTO_ONLY default + Docker 17/17 proxy.
- **ux-workflows:** Field hints (patient, appointment, deployment, pairing); abandon confirm; export PDF smoke; P0 route smokes.
- **phase2-hardening:** Statistik Krankheitsbild empty state; release-gate automated ticks; coordination ledgers.

## Done (2026-06-07 — T-U1 medoc-sync tests)

- **New:** `crates/shared/medoc-sync/tests/repo_store_tests.rs` — 10 tests (outbox, peer vector, sync_record_or_noop, status).
- **Engine:** `ingest_push_rejects_outbox_device_id_mismatch`, `collect_pull_returns_entries_after_since_seq` in `engine/run.rs`.
- **Validation:** `cargo test -p medoc-sync` **PASS**; `bash scripts/validate-docker.sh` **PASS** (~7 min, 17/17 port).
- **Docs:** MVP checklist + validation/phase-handoff updated.

## Now

1. **G21b live Tauri smoke** — rows 1–9: `bash tools/g21-dev-smoke.sh` + [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md)
2. **T-U1 XL:** `bash tools/mvp-rust-coverage.sh` — engine/repo still partial toward 100%
3. **Optional:** `VALIDATE_DOCKER_FULL=1 bash scripts/validate-docker.sh` (Tauri in Docker)

## Later

- **Break-Glass (re-enable):** Set `BREAK_GLASS_ENABLED = true` in `mvp_security.rs` + `mvp-security-config.ts` — checklist [`todos-deferred-security-features.md`](todos-deferred-security-features.md).
- **2FA / TOTP (re-enable):** Set `TOTP_2FA_ENABLED = true` — same checklist; un-ignore `totp_tests.rs`.
- **Staff limit (raise or license-wire):** Adjust `MAX_ARZT` / `MAX_REZEPTION` / `MAX_TOTAL_PERSONAL` in `mvp_security.rs` — currently **1 PHYSICIAN + 4 RECEPTION**.

- **Einstellungen → Benachrichtigungen (re-enable):** Set `BENACHRICHTIGUNGEN_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when company-portal push / notification microservices are deployed and `companyPortalFetchFeatureFlags` is production-ready. Panel: `settings-benachrichtigungen-section.tsx`; gate: `settingsSectionVisible("benachrichtigungen", …)`.
- **Einstellungen → System — ausgeblendete Panels (re-enable):** Flags in `settings-ui-flags.ts` — set `SYSTEM_SERVERLESS_FOCUS_ENABLED = false` to restore full System panel; or enable individually:
  - `SYSTEM_APPEARANCE_TOGGLES_ENABLED` — Benutzeravatar, Tastenkürzel (`settings-system-section.tsx` legacy block)
  - `SYSTEM_AKTE_PHOTO_VIEWER_ENABLED` — externe App für Akten-Anlagen
  - `SYSTEM_DIAGNOSTICS_ENABLED` — Auto-Abmeldung, Health-Check, Performance-Schwelle
  - `SYSTEM_LAN_HOST_PANEL_ENABLED` — vollständiges LAN-Host / Zweitgeräte-Panel (`settings-lan-host.tsx`)
  - `SYSTEM_COMPANY_PORTAL_ENABLED` — Hersteller-Portal (`settings-company-portal-section.tsx`)
  - `SYSTEM_OPS_EXTRAS_ENABLED` — Backup jetzt, Ops-Vorschau, Weitere-Seiten-Links
  - `SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED` — Betriebsmodi Praxis-Desktop + LAN-Client im Deployment-Select
  - `SYSTEM_MESH_SYNC_ENABLED` — experimenteller Mesh-Sync zwischen Replicas
- **Posteingang (re-enable):** Aufgaben sind auf **`/tickets`** integriert (Praxis-Tickets & Aufgaben). Ein separater Posteingang-Nav-Eintrag ist nicht geplant — bei Bedarf nur Badge/Polling-Verhalten anpassen. Admin-CRUD bleibt unter **Verwaltung → Praxis-Aufgaben** (`/administration/tasks`).
- **Einstellungen → Darstellung → Dunkle Seitenleiste (re-enable):** Set `DARK_SIDEBAR_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when sidebar dark-tone styling is polished and QA’d across light/dark themes. Toggle: `settings-darstellung-section.tsx`; runtime still reads `appearance.darkSidebar` via `applyAppearanceFromSettings`.
- **Termin: Pause / Notfall-Werkzeuge (CAL2, re-enable):** Set `CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when Pause/Notfall toolbar dialogs in `appointments.tsx` are product-ready. Settings toggle: `settings-arbeitsablaeufe-section.tsx` (`workflows.calendarEmergencyToolbarEnabled`); Notfall-Filter in Termine stays available regardless.
- **Einstellungen → Integrationen (re-enable):** Set `INTEGRATIONEN_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when company-portal integration status and local capability toggles are production-ready. Panel: `settings-integrationen-section.tsx`; gate: `settingsSectionVisible("integrationen", …)`.
- **Einstellungen → Migration (re-enable):** Set `MIGRATION_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when the dedicated Migration settings nav should appear again (CSV wizard remains at `/migration` via System → Datenmigration until then). Panel: `settings-migration-section.tsx`; gate: `settingsSectionVisible("migration", …)`.

## Done (2026-06-06 — Docker Wave V1 user run)

- **Linux container:** `medoc-rust-wave-v1:latest` — fmt, clippy, tests, in-process e2e, proptests **PASS** (documented in [`validation.md`](validation.md)).
- **Code fixes:** `praxis/core.rs`, `system/core.rs`; fmt module order; e2e clippy; `medoc` test dev-deps.

## Done (2026-06-06 restructure continuation)

- **Docs:** `mvp-test-scope.md`, `release-gate-checklist.md`, `g21-live-smoke-checklist.md`, `multi-device-api-catalog.md` — paths updated to `apps/`, `crates/`, `packages/`.
- **Scripts:** `tools/mvp-rust-coverage.sh`; root `npm run test:mvp-coverage`; `g21-dev-smoke.sh` row 9.
- **Validation:** `npm test` **232 PASS**; `test:mvp-coverage` **22/22 PASS**; `g21-verify-automated.sh` **PASS**; Docker multi-device **17/17**; `validate-lan-web-client.sh` **PASS**.
- **E2e count:** **85** HTTP integration tests (`crates/test/medoc-e2e`).

## Now

1. **G21b live Tauri smoke** — rows 1–9: `bash tools/g21-dev-smoke.sh` + [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md)
2. **Optional:** `bash scripts/validate-docker.sh` (full pipeline) or `VALIDATE_DOCKER_FULL=1` (Tauri in Docker)
3. **T-U1 Rust:** `bash tools/mvp-rust-coverage.sh` — engine/repo still partial (XL)

## Done (2026-06-06 restructure + lan-web)

- **R9:** `apps/`, `crates/`, `packages/` at repo root; root Cargo + npm workspaces.
- **R10:** `apps/lan-web-client` (browser LAN client, port 1421).
- **Dead code:** removed ~120 archived/unwired files (`archive_flat`, orphan systems modules, stale barrels).
- **Docker:** Wave V1 scoped container **PASS** (user 2026-06-06); `validate-docker.sh` + multi-device **17/17** (prior agent run); optional `VALIDATE_DOCKER_FULL=1` for Tauri link.
- **Validation:** `npm test` **232 PASS**; `npm run build` PASS; Wave V1 Docker container **PASS**.

## Done (2026-06-02 MVP plan completion)

- **Docs:** Plan + test scope linked; LAN client deployment guide; multi-device catalog Tier-1 rows.
- **MS-5:** Company `GET /health` returns `_demo` banner JSON.
- **Tier-1 hooks:** `prescription` + `practice_ticket` in `sync_outbox_hooks_tests.rs`.
- **Port e2e:** `port_sync_rezept_push_applies_on_master`, `port_sync_praxis_ticket_push_applies_on_master`; mesh duplicate guard.
- **W7/T-S3:** Playwright JWT login test; TLS/CORS doc.
- **W8/T-S2:** `two-device-sync-smoke.sh` Tier-1 + live steps.
- **UX:** Migration CSV MVP copy; REZ purchase-orders policy in i18n/onboarding; export-preview unit test.
- **T-U2:** `pairing.controller.test.ts`, expanded `deployment-config.test.ts`.

## Done (2026-06-02 MVP serverless execution)

- **Phase 0:** `mvp-cost-priority-plan.md`, `mvp-test-scope.md`; G21 verify GREEN; **188** Vitest.
- **MS-3 Tier-1:** 7 synced tables + hooks; `sync_peer_vector` mesh delivery.
- **MS-6:** `patient.read` / `appointment.read` activation-token routes + pairing inbox.
- **UX:** SyncStatusBadge, sync error toasts, pairing URL fallback.
- **T-I1:** +6 Rust e2e (75+ total in-process).
- **T-S2/T-S3:** `two-device-sync-smoke.sh`; Playwright LAN (opt-in).
- **Docs:** `serverless-sync.md` updated.

## Done (2026-06-02 gap sweep)

- **GAP-10:** Tagesabschluss in sidebar (`nav-sections.ts`).
- **GAP-11:** Quittung from `/finance` + shared `quittung-export-flow.ts`.
- **GAP-01/02:** Automated proxy closure — `collaboration-g21.test.ts` + Rust `rezeption_redact`.
- **Deferrals doc:** [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) (skips 08/09/12; P3 deferred).
- **Traceability refresh:** `01b-traceability-waad.md` reconciled for FA-AKTE-15, FA-DOK-08, FA-LEIST-06, etc.

## Done (this session)

- **Serverless sync port coverage:** 7 new tests — `SyncEngine::push_to_master`, `pull_from_master`, mesh replica→replica (8788/8789), pairing status poll, freshness conflict, revoke + spoof guards.
- **Master seed:** `prepare_master_data_dir` enables `serverless_peer` MASTER + seed patient for pull propagation.
- **Validation:** `bash scripts/validate-docker-multi-device.sh` **13/13 PASS** (~19s).

## Done (prior — multi-device port e2e)
- **Rustfmt:** `praxis_aufgabe_tests.rs` formatted (Docker fmt gate).
- **Truth ledger:** `project-truth.md` updated with merge completion + validation snapshot.

## Done (prior — G21 E2E + nav)

- **IPC wrappers from pro:** `adminUnlockBruteForce`, G21 inbox trio, `clearLicense` (+ settings re-export).
- **Dev tooling:** `gen_dev_license_once` hybrid device-id resolution.
- **Test:** `praxis-tickets.smoke.test.tsx` (Posteingang link banner).
- **Validation:** `cargo test --tests` PASS; `npm test` **170+1 SKIP**.

## Done (prior session — backend port)

## Done (prior — 2026-05-27 evening)
  - Property-based testing wired and green:
    - `medoc-core/tests/license_proptests.rs` — 4 invariants × 256
      cases = **1024 random envelopes** (round-trip valid, wrong-device
      rejects, single-byte tamper rejects, inner-device mismatch rejects).
    - `medoc-sync/tests/pairing_token_proptests.rs` — 5 invariants × 256
      cases = **1280 random activation tokens** (mint→verify, wrong key,
      body byte-flip, signature byte-flip, wrong version).
    - `medoc-sync/tests/merge_invariants_proptests.rs` — 3 invariants
      × 16 cases = **48 random sync-merge scenarios** through a real
      SQLCipher pool (freshest-wins, order-independence, idempotent
      apply).
  - Two new critical UI flows in `critical-flows.smoke.test.tsx`:
    - (f) login rejection on wrong password surfaces the backend error.
    - (g) `LicenseActivatePage` renders the activation prompt, accepts
      a `v2.…` token, and shows the active-license panel.
    - Fixed a pre-existing test-isolation bug: file-wide `afterEach`
      now calls `cleanup()` so `<App />` renders don't bleed between
      describes.
  - `docker/ci/run-rust-validate-wave-v1.sh` explicitly invokes the
    three proptest targets so CI logs show the random-case counts.
  - **Docker re-run NOT RUN** for proptest commits: Docker Desktop VM
    disk hit 100% mid-link. Local Rust/Frontend validation full GREEN
    (155+ tests across Wave V1 + e2e + proptests; 169+1 frontend).

- **Testing matrix expansion v2 (2026-05-27 afternoon) — DONE**
  - `medoc-e2e` grew 40 → **56** in-process HTTP integration tests.
    New files: `multi_replica_roundtrip.rs` (9) covering full HTTP
    push/pull/freshness conflict scenarios; `license_gate_negatives.rs`
    (7) covering every negative branch of
    `master_license::require_master_license` on the LAN HTTP surface
    (unlicensed, tampered envelope, wrong-device, skip-switch,
    replica-role exemption).
  - `medoc-sync/merge.rs` coverage **57.04% → 71.85%** (+14.81 pp).
    `medoc-lan/master_license.rs` **85.96% → 89.47%**.
  - All 56/56 e2e tests GREEN in Docker via
    `bash scripts/validate-docker.sh`.

- **Testing matrix expansion v1 (2026-05-27 morning) — DONE**
  - `medoc-e2e` doubled from 20 → 40 in-process HTTP integration tests.
    New files: `revoke_and_rotation.rs` (7), `outbox_clinical_writes.rs`
    (3), `serverful_lan_client_flows.rs` (10).
  - Security defect found by the new revoke test and fixed at
    `medoc-lan::sync_http::verify_activation_for_path` and
    `medoc-lan::pairing_http::peers` (default-deny via
    `pairing_request.status`).
  - Real coverage wired and measured:
    `npm run test:coverage` (vitest+v8) and `cargo llvm-cov` on the
    Wave V1 + e2e scope. Numbers recorded in `validation.md` and
    `phase-handoff.md` — no more aspirational "100%".
  - Frontend smoke regression fix in `critical-flows.smoke.test.tsx`
    flow (a).
  - Full Docker pipeline (`scripts/validate-docker.sh`) GREEN
    end-to-end on macOS host.

## Now (carried over)

- **Wave V1 — master/slave pairing + license v2 — DONE**
  - License v2 envelope (perpetual, device-bound, Ed25519-signed + AES-GCM
    encrypted, persisted in `app_kv`). `app/crates/medoc-core/tests/license_v2_tests.rs`.
  - Pairing crate (`medoc-sync::pairing`) + LAN routes
    `/api/v1/pairing/{request,status,master-info,decide,revoke,pending,peers}`.
  - Master Ed25519 keypair in OS keychain (`medoc-sync::master_keys`).
  - Activation tokens replace JWT for `/sync/push|pull|status` and
    `/pairing/peers`; legacy JWT still accepted for older installs.
  - `ConflictPolicy::MasterWinsWithFreshness` using `updated_at`.
  - Auto outbox hooks for the 8 allow-listed tables; 7 tests in
    `app/crates/medoc-core/tests/sync_outbox_hooks_tests.rs`.
  - Frontend: replica `pairing-scan.tsx`, master `settings-pairing-inbox.tsx`,
    `license-activate.tsx`, top-level `LicenseAndPairingGate`.

## Next

- **Pragmatic testing scope continuation** (2026-05-27, time-boxed):
  - **NOT-RUN this session:** 3-slave conflict matrix
    (newer-master / newer-replica / simultaneous writes); license tamper
    + activation-token expiry; tauri-driver (or Playwright on Vite dev
    server) for 5-10 critical UI flows; proptest for sync engine,
    license envelope, pairing token sign/verify; coverage rebuild
    inside Docker (host run was successful, Docker image rebuild
    deferred).
  - Coverage targets are still moving — the Wave V1 critical path is at
    55–100% per file but the workspace TOTAL is 25.61% lines because of
    untested non-Wave-V1 surface area (PDF rendering, telematik, DSGVO,
    devices, many `medoc-core/database` repos). "100% coverage" is not
    achievable in a single follow-up session; needs a multi-week
    UI/PDF/devices test-writing campaign.
- **Live two-device verification** of pairing + sync + mesh (needs two
  physical/VM hosts). Deferred from Slice 8 — scaffolding in place.
- **Mesh sync hardening** — verify the master-signed peer list in
  `SyncEngine::run_mesh_sync`, add per-peer `delivered_at` bookkeeping,
  flip `unstable_mesh` from BEST-EFFORT to supported.
- **Per-slave RBAC migration** for the remaining LAN routes
  (currently only `/sync/*` + `/pairing/peers` consume
  `allowed_actions[]`).
- **Repository allow-list expansion** beyond the 8 outbox-hooked tables
  (anamnesis_form, dental_finding, etc.) — domain review required first.
- **mDNS pairing** instead of UDP broadcast (cross-subnet support).
- Long-running: requirements-coverage audit per `AGENTS.md` Phase 1.6.

## Legacy Now (kept for context)
- **Workspace restructure — see [`restructure-plan.md`](restructure-plan.md):**
  - **Wave A — DONE** `f402f28` — three-system frontend cleanup; 155 tests / 28 files green.
  - **Wave B1 (mapping) — DONE** [`wave-b-crate-mapping.md`](wave-b-crate-mapping.md).
  - **Wave B3 (workspace skeleton) — DONE** `a1196d3`.
  - **Wave B2.a–c — DONE** `5696bea` / `65fbcfc` / `04843bf` — Tauri leakage closed in `application/rbac.rs` + `infrastructure/database/connection.rs`.
  - **Wave B4 — DONE** `5f09d58` — codegen lifted into `medoc-codegen` lib crate.
  - **Wave B5.0/5.1/5.2 — DONE** `a74fd82` / `6aef090` / `2c0307c` — explicit codegen paths, then `AppError` + `domain/` (24 files) lifted into `medoc-core`.
  - **Wave B6.0 — DONE** `8e1f8b5` — three pre-lift untanglings (`BreakGlassState`, `PermissionOverride`, UDP `discovery`) into medoc-core. 159 tests.
  - **Wave B6.1 — DONE** `975f96c` — bulk-lift of ~50 non-Tauri infrastructure files + `migrations/` directory into `medoc-core`; vendor pubkey codegen relocated. 159 tests.
  - **Wave B7.0 — DONE** `5f82295` — `application/` (10 files) + `company_portal/` (3 files) into `medoc-core`; RBAC codegen also moves to `medoc-core/build.rs`. 159 tests.
  - **Wave B7.1 — DONE** `5c7251d` — **`medoc-lan` is now a workspace crate**; `lan_server/` lifted into it; `cargo check -p medoc-lan` builds Tauri-free. 159 tests.
  - **Wave B7.2 — DONE** `400f8ca` — **`medoc-company` is now a workspace crate**; `company_host/` lifted into it. 159 tests.
  - **Wave B8 — DONE** `ed362bc` — **two new binary crates `medoc-lan-server` + `medoc-company-server`**. Verified cold builds:
    - `cargo build -p medoc-lan-server`     → `target/debug/medoc-server` (39 MB, no Tauri compiled)
    - `cargo build -p medoc-company-server` → `target/debug/medoc-company-server` (19 MB, no Tauri, no LAN compiled)
    - `cargo build -p medoc`                → `target/debug/medoc` (82 MB, Tauri desktop)
  - **Wave C prep — DONE** [`wave-c-package-mapping.md`](wave-c-package-mapping.md). 97 files triaged.
  - **Wave C (npm workspace split) — NOT STARTED.** Independent of B.
  - **Wave D (repo-root restructure) — NOT STARTED.** Depends on B + C.
- The user's "3 fully separated models" goal is **DELIVERED** — see [`phase-handoff.md`](phase-handoff.md) for the binary verification matrix.

## Done (2026-05-22 three-system wave)

- **`application/akte/pdf_export.rs`** — FA-AKTE-04 + FA-DOK-08; `akte_commands.rs` **~369** lines (thin IPC wrappers)
- **Einstellungen sections** — `systems/practice-host/pages/settings/` (12 modules); re-export stubs in `views/pages/`
- **Company-portal section** — `systems/company-portal/pages/settings-company-portal-section.tsx`; view stub retained
- **LAN client login flow** — `http-practice.adapter.test.ts` (fetch mock + token persistence); live browser E2E **NOT RUN**

## Done (2026-05-21 three-system wave)

- **Structure:** `app/src/systems/{practice-host,lan,company-portal}/`, `app/src-tauri/src/systems/{practice,lan,company}/`, `docs/architecture/three-systems.md`
- **Patient feature folder:** `systems/practice-host/pages/patient-detail/` (17 modules); stub `views/pages/patient-detail.tsx`
- **Validation:** `systems-structure.test.ts`; smoke IPC assert fix; transport delegate for Vitest
- **`HttpPracticeAdapter` + `practice-transport` factory** — `systems/practice-host/adapters/`
- **`application/akte/billing_release.rs`** — first akte use-case extraction from `akte_commands.rs`
- **Clippy:** `needless_borrows` + `AbrechnungAufgabeParams` in DB repos (**PASS** `cargo clippy --lib`)
- **LAN client UI** — `settings-lan-host.tsx` (`medoc.lan.client.v1`, discovery → URL)
- **`application/akte/rezeption_redact.rs`** — REZ redaction extracted from `akte_commands.rs`
- **`backup_tests`** — `tokio::sync::Mutex` (**PASS** `cargo clippy --all-targets`)
- **`application/akte/clinical_line_persistence.rs`** — B/U CRUD + FA-LEIST-06/07 + FA-AUFG-02 side effects
- **LAN UI** — `systems/lan/pages/settings-lan-host.tsx` (re-export stub in `views/pages/`)

## Now (previous) (gap remediation — active)

> **Phase 0:** Ledger truth sync (this file). **Phases 1–6:** G1–G13 below.  
> Legacy WAAD IDs **A1–A13** retained for traceability; see **Status** column.

| ID | Action | Blocked by | Status |
| -- | ------ | ---------- | ------ |
| G0 | Reconcile `project-truth.md`, `06-validierung.md`, `phase-handoff.md` with code (close stale A-rows) | — | **Done** 2026-05-21 |
| G1 | FA-AKTE-15 sidebar badge: `count_charts_zu_validieren` IPC + nav UI | — | **Done** 2026-05-21 |
| G2 | WAAD 9.1 restore: `restore_backup` + Ops UI + confirm dialog (scheduler in `lib.rs`) | — | **Done** 2026-05-21 |
| G3 | Error surfacing: replace silent `.catch` on ops, gates, patient-detail, app-layout | — | **Done** 2026-05-21 (portal `null` documented offline-by-design in `settings.tsx`) |
| G4 | Discharge PDF test in `pdf_document_tests.rs` + DoD routes `/charts/to-validate`, `/tickets` | — | **Done** 2026-05-21 |
| G5 | `patient-detail` shell further split (prescription tab / shell &lt;1200 lines) | P3h | **Done** 2026-05-21 (shell **~1029** lines; clinical/zahl/akte hooks + `patient-detail-overlays.tsx`) |
| G6 | NFA-USE-09 onboarding wizard (`app_kv` + per-route coverage ≥80%) | Product copy | **Done** 2026-05-21 (coachmark, nested-route match, `ONBOARDING_MIN_COVERAGE_RATIO`, settings %) |
| G7 | NFA-USE-10 configurable autocomplete + disable toggle (`app_kv`) | — | **Done** (already in `client-settings` + Arbeitsabläufe toggle) |
| G8 | WAAD 9.5 / A10: Krankheitsbild-Verlauf charts + CSV in `statistics.tsx` | — | **Done** 2026-05-21 |
| G9 | Termin reminders: dashboard panel MVP (full SMS/email deferred) | — | **Done** 2026-05-21 |
| G10 | Integration capability matrix + disable/label stubs (TI/KIM/pay/DICOM) | Product D3 | **Done** 2026-05-21 |
| G11 | A9 stress test harness (5 parallel clients) | CI budget | **Done** 2026-05-21 (`stress_tests.rs`) |
| G12 | Per-patient RBAC spike (WAAD 2.1.1) | Product decision | **Deferred** |
| G13 | FA-LEIST-05 doc rescope (B/U not catalog `serviceItem`) + billing UI hints | — | **Done** 2026-05-21 (`pflichtenheft.md`, traceability, zahl-tab + `billing-release.ts`) |
| CAL2 | Termin Pause/Notfall toolbar: re-enable OR formal feature flag (D1) | Product D1 | **Done** 2026-05-21 (flag + banner + settings toggle) |
| N3 | E2E test: release B/U → Zahlung OK; without release → FA-LEIST-05 error | G13 | **Done** 2026-05-21 (`zahlung_repo_tests` + `billing-release-flow.test.ts`; full UI E2E **NOT RUN**) |
| G14 | **FA-LEIST-06:** Nach B/U+Leistung → Tab `zahl` + offene Buchung (`OUTSTANDING`); implizite `freigegeben_*` | G13 | **Done** 2026-05-21 (Behandlung; `ensure_open_booking_for_billable_behandlung` + `billing-open-booking.ts`) |
| G15 | **FA-LEIST-07:** `examination` + UI Leistung/Preis wie `treatment`; `pricing`/`payment-buchung` | G14 | **Done** 2026-05-21 |
| G16 | **FA-AUFG-01/06:** `practice_task` + Statusmaschine + IPC + migrate `practice_ticket` | Product | **Done** 2026-05-21 |
| G17 | **FA-AUFG-02–05:** Posteingang REZ, erledigen→notify, Arzt VALIDATED/ZURUECK; poll/badge | G16 | **Done** 2026-05-21 (`/inbox`, 5s poll, `PRAXIS_AUFGABE_ERLEDIGT`) |
| G18 | Auto-Aufgabe `ABRECHNUNG` bei B/U+Leistung speichern (verknüpft G14+G17) | G14, G17 | **Done** 2026-05-21 (`ensure_abrechnung_aufgabe_for_clinical_line`) |
| G19 | **FA-AUFG-02 manual:** „Aufgabe an Rezeption“ in Patientenakte (PHYSICIAN → `create_practice_task`) | G17 | **Done** 2026-05-21 (`patient-akte-workflow-dialogs.tsx`, shell button) |
| G2b | **G2 fix:** restore backup → SQLCipher (`opens_with_sqlcipher_key` or plaintext migrate) | G2 | **Done** 2026-05-21 (`backup.rs`, `sqlcipher.rs`) |

### Gap register (P0–P3) — master audit

Vollständige Tabelle: [`docs/uml/10-master-feature-workflow-audit.md`](../uml/10-master-feature-workflow-audit.md) §6–§8.

| Priority | IDs | Theme | Status (2026-05-21) |
| -------- | --- | ----- | ------------------- |
| **P0** | GAP-01..04 | REZ clinical leak; Posteingang; FA-AUFG bidirectional | **Done (proxy)** — GAP-01/02 automated + Rust redaction; GAP-03/04 G16–G19; G21b live **pending** |
| **P1** | GAP-05..07 | FA-LEIST-07 Untersuchung; LEIST-06 U; auto Aufgabe | **Done** (G14–G18) |
| **P2** | GAP-08..12 | Termin SMS/Notfall; REZ nav; Quittung; VDDS/BDT | **GAP-10/11 Done**; **GAP-08/09/12 skipped v0.1** |
| **P3** | GAP-13..15 | TI/KIM; mobile LAN; Abo live | **Deferred v0.1** — [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) |

**Recommended implementation order:** Phase 1 (GAP-01/02) → Phase 2 (G15/G14-U) → Phase 3 (G16–G18) → Phase 4 (REZ IA).

### WAAD backlog (reconciled 2026-05-21)

| ID | Action | Status | Notes |
| -- | ------ | ------ | ----- |
| A1 | NFA-SEC-08 SQLCipher | **Done** | `sqlcipher.rs`, `DbSetupGate` |
| A2 | FA-PERS-07 permission overrides | **Done** | `staff.tsx` + RBAC session |
| A3 | FA-DOK-08 discharge merkblatt PDF | **Done** | G4 adds PDF test |
| A4 | FA-PERS-08 praxis tickets | **Done** | `/tickets`; verify audit-on-read if required |
| A5 | FA-LEIST-05 physician release | **Done** | B/U `freigegeben_*`; G13 docs |
| A6 | NFA-USE-09 onboarding | **Done** → **G6** | Per-route coachmark + ≥80 % target |
| A7 | FA-AKTE-16 completeness | **Done** (extend) | `akte-completeness.ts` |
| A8 | Auto backup + restore UI | **Done** | scheduler `lib.rs` + **G2** restore + test |
| A9 | Stress test | **Done** → **G11** | `five_parallel_clients_audit_inserts_remain_valid` |
| A10 | Disease pattern statistics | **Done** → **G8** | Proxy from Behandlungsaggregaten |
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
| G20 | Deprecate `/tickets` → banner + nav; Posteingang in sidebar + `ROUTE_VISIBILITY` | — | **Done** 2026-05-21 (no full redirect — REZ→PHYSICIAN tickets remain FA-PERS-08) |
| G21a | Automated G21: `collaboration-g21.test.ts`, `inbox.smoke.test.tsx`, tab guard util | — | **Done** 2026-05-21 |
| G21b | Live Tauri checklist | G21a | **Pending** — [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md) (manual) |
| — | G12 per-patient RBAC | Product | **Deferred** |

## Done (recent; keep short)

| ID | Outcome | Date |
| -- | ------- | ---- |
| G7–G10, G8–G9, CAL2 | Queue items wired + validated | 2026-05-21 |
| G21a | Collaboration unit + Posteingang poll smoke tests | 2026-05-21 |
| G20, G17-fix | Posteingang sidebar + route guard; tickets→Posteingang banner | 2026-05-21 |
| G19, G2b | Manual Aufgabe dialog; backup restore SQLCipher re-encrypt | 2026-05-21 |
| G16–G18 | FA-AUFG practice_task + Posteingang + auto ABRECHNUNG | 2026-05-21 |
| G15 | FA-LEIST-07 Untersuchung billing fields + open booking + zahl tab | 2026-05-21 |
| G14 | FA-LEIST-06 auto open booking + zahl tab | 2026-05-21 |
| N2, N6, G3 | CI tauri smoke; Verwaltung RBAC split; portal offline doc | 2026-05-21 |
| N1, N4, N5 | README desktop-only; appointment alt slots; invoice LS→app_kv | 2026-05-21 |
| G6, G13, N3 | Onboarding ≥80 %, FA-LEIST-05 docs, billing IPC tests | 2026-05-21 |
| G5 | patient-detail shell &lt;1200 lines + overlays | 2026-05-21 |
| G1–G4, G2 restore | Gap remediation batch 1 | 2026-05-21 |
| D1–D20, P0 | See prior entries | 2026-04-19 … 2026-05-20 |
