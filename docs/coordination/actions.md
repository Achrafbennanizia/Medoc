# Action ledger

**Last updated:** 2026-07-26 (CI/CD tier migration)

## Now

- **Manual QA:** examinations billing release, attachments/scanner import, focus-mode nav — **NOT RUN**
- **Page migration:** `apps/practice-host-ui/src/views/pages` → `packages/app/practice-host/src/pages` — incremental, not started
- **Refactor & harden pass:** [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md) — register at [`refactor-register.md`](refactor-register.md); Phases A–F incremental.
- **Geplant / future development:** single status register — [`geplant.md`](geplant.md) (not in-app UI).
- **Deferred roles (MVP):** `STEUERBERATER` / `PHARMABERATER` — [`todos-deferred-roles.md`](todos-deferred-roles.md).
- **Deferred Datenschutz (DSGVO) UI:** [`todos-deferred-features.md`](todos-deferred-features.md).
- **Deferred security (MVP):** Break-Glass off, 2FA off, 5-user cap — [`todos-deferred-security-features.md`](todos-deferred-security-features.md).
- **CI baseline debt for new verify gate:** `npm run lint -w medoc`, `npm run typecheck -w medoc`, `npm run typecheck -w medoc-lan-web-client`, and `cargo fmt --all --check` are currently red (see `validation.md` 2026-07-26 snapshot).

**Last updated (prior):** 2026-06-07 (MVP plan execution — pending todos closed)

## Master plan

Active cost-priority delivery plan and test allow-list:

| Document | Purpose |
| -------- | ------- |
| [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md) | Incremental refactor, quality pass, workflow audit (Phases A–F) |
| [`mvp-cost-priority-plan.md`](mvp-cost-priority-plan.md) | Workflows W1–W12, MS/UX/T items, phases, MVP checklist |
| [`mvp-test-scope.md`](mvp-test-scope.md) | T-U1/T-U2 100% module allow-list |

## Done (2026-07-26 — CI/CD tiered pipeline wiring)

- Added tiered workflows: `.github/workflows/{verify,autofix,fix-proposal,release}.yml`.
- Retired legacy `.github/workflows/ci.yml` to avoid parallel stale pipeline behavior.
- Added `scripts/assert-axe-critical.mjs` for critical-only WCAG A/AA gate in tier-1 `a11y`.
- Added coordination design doc: `docs/coordination/ci-cd-plan.md`.
- Logged verification snapshot in `docs/coordination/validation.md` (includes current baseline failures to be remediated separately).

## Done (2026-07-10 — Patient Akte MVC / domain split)

- `akte-anlagen` pure domain → `packages/shared/src/lib/akte-anlagen.ts`; Tauri `convertFileSrc` stays in `apps/practice-host-ui/src/platform/akte-anlagen.ts`.
- `desktop-window-frame` Tauri calls → `src/platform/desktop-window-controls.ts`.
- ESLint `no-restricted-imports`: views/pages cannot import `@tauri-apps/*` or transport/registry directly.
- `audit`, `compliance`, `ops` pages → `packages/app/practice-host/src/pages/` (+ `ops.smoke.test.tsx`; G21 script path updated).
- Pre-existing build errors fixed: duplicate `className`, login CapsLock handler, `WorkTimeReconcileReport` type.
- `npm run build` **PASS** (2026-07-10).

## Done (2026-06-18 — Work-Time & Team Overview)

- Schema + RBAC + extended work_time/krank/adjustment IPC (294 handlers).
- Employee `/personal/arbeitszeit`, admin `/verwaltung/team/arbeitszeit`, Krankenbescheinigung Verwaltung, Statistik `sec-arbeitszeit`.
- Per-user auto-record prefs; REZEPTION post-login → Arbeitszeit; focus-mode nav filter.

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
- **ux-workflows:** Field hints (patient, termin, deployment, pairing); abandon confirm; export PDF smoke; P0 route smokes.
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
- **Staff limit (raise or license-wire):** Adjust `MAX_ARZT` / `MAX_REZEPTION` / `MAX_TOTAL_PERSONAL` in `mvp_security.rs` — currently **1 ARZT + 4 REZEPTION**.

- **Einstellungen → Benachrichtigungen (re-enable):** Set `BENACHRICHTIGUNGEN_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when company-portal push / notification microservices are deployed and `companyPortalFetchFeatureFlags` is production-ready. Panel: `einstellungen-benachrichtigungen-section.tsx`; gate: `settingsSectionVisible("benachrichtigungen", …)`.
- **Einstellungen → System — ausgeblendete Panels (re-enable):** Flags in `settings-ui-flags.ts` — set `SYSTEM_SERVERLESS_FOCUS_ENABLED = false` to restore full System panel; or enable individually:
  - `SYSTEM_APPEARANCE_TOGGLES_ENABLED` — Benutzeravatar, Tastenkürzel (`einstellungen-system-section.tsx` legacy block)
  - `SYSTEM_AKTE_PHOTO_VIEWER_ENABLED` — externe App für Akten-Anlagen
  - `SYSTEM_DIAGNOSTICS_ENABLED` — Auto-Abmeldung, Health-Check, Performance-Schwelle
  - `SYSTEM_LAN_HOST_PANEL_ENABLED` — vollständiges LAN-Host / Zweitgeräte-Panel (`einstellungen-lan-host.tsx`)
  - `SYSTEM_COMPANY_PORTAL_ENABLED` — Hersteller-Portal (`einstellungen-company-portal-section.tsx`)
  - `SYSTEM_OPS_EXTRAS_ENABLED` — Backup jetzt, Ops-Vorschau, Weitere-Seiten-Links
  - `SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED` — Betriebsmodi Praxis-Desktop + LAN-Client im Deployment-Select
  - `SYSTEM_MESH_SYNC_ENABLED` — experimenteller Mesh-Sync zwischen Replicas
- **Posteingang (re-enable):** Aufgaben sind auf **`/tickets`** integriert (Praxis-Tickets & Aufgaben). Ein separater Posteingang-Nav-Eintrag ist nicht geplant — bei Bedarf nur Badge/Polling-Verhalten anpassen. Admin-CRUD bleibt unter **Verwaltung → Praxis-Aufgaben** (`/verwaltung/aufgaben`).
- **Einstellungen → Darstellung → Dunkle Seitenleiste (re-enable):** Set `DARK_SIDEBAR_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when sidebar dark-tone styling is polished and QA’d across light/dark themes. Toggle: `einstellungen-darstellung-section.tsx`; runtime still reads `appearance.darkSidebar` via `applyAppearanceFromSettings`.
- **Termin: Pause / Notfall-Werkzeuge (CAL2, re-enable):** Set `CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when Pause/Notfall toolbar dialogs in `termine.tsx` are product-ready. Settings toggle: `einstellungen-arbeitsablaeufe-section.tsx` (`workflows.calendarEmergencyToolbarEnabled`); Notfall-Filter in Termine stays available regardless.
- **Einstellungen → Integrationen (re-enable):** Set `INTEGRATIONEN_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when company-portal integration status and local capability toggles are production-ready. Panel: `einstellungen-integrationen-section.tsx`; gate: `settingsSectionVisible("integrationen", …)`.
- **Einstellungen → Migration (re-enable):** Set `MIGRATION_SETTINGS_ENABLED = true` in `packages/shared/src/lib/settings-ui-flags.ts` when the dedicated Migration settings nav should appear again (CSV wizard remains at `/migration` via System → Datenmigration until then). Panel: `einstellungen-migration-section.tsx`; gate: `settingsSectionVisible("migration", …)`.

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
- **Tier-1 hooks:** `rezept` + `praxis_ticket` in `sync_outbox_hooks_tests.rs`.
- **Port e2e:** `port_sync_rezept_push_applies_on_master`, `port_sync_praxis_ticket_push_applies_on_master`; mesh duplicate guard.
- **W7/T-S3:** Playwright JWT login test; TLS/CORS doc.
- **W8/T-S2:** `two-device-sync-smoke.sh` Tier-1 + live steps.
- **UX:** Migration CSV MVP copy; REZ bestellungen policy in i18n/onboarding; export-preview unit test.
- **T-U2:** `pairing.controller.test.ts`, expanded `deployment-config.test.ts`.

## Done (2026-06-02 MVP serverless execution)

- **Phase 0:** `mvp-cost-priority-plan.md`, `mvp-test-scope.md`; G21 verify GREEN; **188** Vitest.
- **MS-3 Tier-1:** 7 synced tables + hooks; `sync_peer_vector` mesh delivery.
- **MS-6:** `patient.read` / `termin.read` activation-token routes + pairing inbox.
- **UX:** SyncStatusBadge, sync error toasts, pairing URL fallback.
- **T-I1:** +6 Rust e2e (75+ total in-process).
- **T-S2/T-S3:** `two-device-sync-smoke.sh`; Playwright LAN (opt-in).
- **Docs:** `serverless-sync.md` updated.

## Done (2026-06-02 gap sweep)

- **GAP-10:** Tagesabschluss in sidebar (`nav-sections.ts`).
- **GAP-11:** Quittung from `/finanzen` + shared `quittung-export-flow.ts`.
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
  - Frontend: replica `pairing-scan.tsx`, master `einstellungen-pairing-inbox.tsx`,
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
  (anamnesebogen, zahnbefund, etc.) — domain review required first.
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
| **P0** | GAP-01..04 | REZ clinical leak; Posteingang; FA-AUFG bidirectional | **Done (proxy)** — GAP-01/02 automated + Rust redaction; GAP-03/04 G16–G19; G21b live **pending** |
| **P1** | GAP-05..07 | FA-LEIST-07 Untersuchung; LEIST-06 U; auto Aufgabe | **Done** (G14–G18) |
| **P2** | GAP-08..12 | Termin SMS/Notfall; REZ nav; Quittung; VDDS/BDT | **GAP-10/11 Done**; **GAP-08/09/12 skipped v0.1** |
| **P3** | GAP-13..15 | TI/KIM; mobile LAN; Abo live | **Deferred v0.1** — [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) |

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
