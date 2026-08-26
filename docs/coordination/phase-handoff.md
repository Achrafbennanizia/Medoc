# Phase handoff

**Last phase label:** CI/CD pipeline tiers wiring (2026-08-26)  
**Last closed:** Added verify/autofix/fix-proposal/release workflows for live `apps/` + `crates/` + `packages/` workspace; recorded static validation evidence.

### Verified (2026-08-26 — CI/CD pipeline tiers)

- **Tier 1:** `.github/workflows/verify.yml` created with non-mutating Rust + JS + a11y gates, lockfile-based package-manager detection, per-job timeouts, and `concurrency.cancel-in-progress`.
- **Tier 2:** `.github/workflows/autofix.yml` created for PR branches only (`pull_request`), with bot loop guard and compliance-sensitive path block (`security|audit|crypto|rbac`).
- **Tier 3:** `.github/workflows/fix-proposal.yml` created for manual dispatch or failed `verify` on `main`, opening draft PRs with evidence and applying `needs-human-review` when sensitive domains are touched.
- **Tier 4:** `.github/workflows/release.yml` rewritten to call tier-1 verify as gate, then build signed cross-platform artifacts under protected `release` environment with provenance attestation.
- **Coordination docs:** `docs/coordination/ci-cd-plan.md` added; `docs/coordination/validation.md` updated with command evidence (`yaml.safe_load`, `git diff --check`, stale path scan).

### Remains unverified

- First live GitHub Actions execution of `verify.yml`, `autofix.yml`, `fix-proposal.yml`, and the rewritten `release.yml` on runners.
- Repository variable `CI_FIX_PROPOSAL_AGENT_CMD` behavior in tier-3 (required for automated substantive fix attempts).
- Protected `release` environment approval path and secret availability in a real tag/dispatch run.

### Next

1. Run one PR through tier-1 + tier-2 to validate loop guard and deterministic-fix boundaries.
2. Trigger tier-3 manually with `CI_FIX_PROPOSAL_AGENT_CMD` configured and verify draft PR evidence quality.
3. Execute a tag/dispatch dry run for tier-4 to validate protected environment approvals and signed artifact outputs.

---

**Last phase label:** Sell-ready MVP + sync C8 (2026-07-05)  
**Last closed:** UI honesty, Arabic/RTL runtime fixes, CSS responsive, sync pull `last_seen_at` e2e test.

### Verified (2026-07-05 — Sell-ready MVP)

- **Workflow blinds:** `ONBOARDING_COACHMARK_ENABLED`, `WORKFLOW_ONBOARDING_PREFS_UI_ENABLED`, `WORKFLOW_AKTE_CONFIRMATION_PREFS_UI_ENABLED` remain **false**; documented in [`geplant.md`](geplant.md).
- **UI honesty:** License section shows portal-not-connected (no demo billing); E-Rezept button hidden when TI stub; KARTE labeled as booking; replica sync errors in Deployment settings via `useReplicaSyncStatusStore`.
- **i18n/locale:** `bcp47ForLocale`, locale-aware `formatDate`/`formatCurrency`, 12+ `localeCompare` sites, statistik `Intl` tags, export section/report keys (4264 × 4 locales).
- **Print/export:** `document-print-html` / `clinical-pdf-layout` use active locale; export preview `lang`/`dir`; akte export section labels via `akteExportSectionLabel`.
- **RTL/CSS:** sidebar logical properties, termin context menu RTL anchor, settings shell @900px, viewport min 1024px, fixed broken `@media 720px` brace.
- **Sync C8:** e2e test `touch_replica_seen_updates_last_seen_on_sync_pull` added; push+pull `last_seen_at` assertions extended on existing push test.
- **Tests:** `npm test` **PASS** (247); `npm run build` **PASS**; `npm run i18n:verify` **PASS**; `g21-verify-automated.sh` **PASS**.

### Remains unverified

- G21b live Tauri manual checklist rows 1–9.
- `cargo test` for new e2e (needs `MEDOC_VENDOR_PUBKEY` in env).
- Tag-driven `release.yml` / clippy / cargo audit for release gate.

### Next

1. Run G21b manual smoke + HTTP two-device pairing sign-off.
2. Wave 5 calendar/PDF export (separate track).

---

**Previous phase label:** Work-Time & Team Overview Program (2026-06-18)

### Verified (2026-06-18 — Work-Time program)

- **Schema:** `work_time_pause_segment`, `work_time_preference`, `arbeitsplan_adjustment`; extended `krankenbescheinigung` + `pause_minutes` on sessions (`rust_only.rs`).
- **RBAC:** `work_time.self`, `work_time.team.read`, `work_time.admin`, `statistik.read` in `config/rbac.yaml`; routes in `rbac.ts`.
- **IPC:** 14 work-time commands + krank list/end + `list_arbeitsplan_adjustments`; logout auto-end when `auto_record_on_logout`; **294** invoke handlers.
- **UI:** `/personal/arbeitszeit` (live timer, week bars, focus mode); `/verwaltung/team/arbeitszeit`; Krankenbescheinigung Verwaltung; `sec-arbeitszeit` in Statistik; per-user auto-record in Arbeitsplan.
- **Tests:** `cargo test -p medoc-practice --lib work_time` **PASS** (2); invoke registry **PASS** (294); `npm test` **PASS** (242); `npm run build` **PASS**.

### Remains unverified

- Live Tauri manual QA of focus-mode nav + file upload Krankenbescheinigung on disk.
- Full `cargo test --workspace --tests` green (pre-existing medoc-core FK failures).

### Next

1. Manual smoke: REZEPTION login → Arbeitszeit; ARZT team overview; KB create/end.
2. v1 Wave 5 calendar/PDF export (separate track).

---

**Previous phase label:** MVP Security Hardening (2026-06-18)

### Verified (2026-06-18 — MVP security hardening)

- **TOCTOU fix:** `create_with_quota` / `update_with_quota` use `BEGIN IMMEDIATE` + `enforce_staff_quota_on_conn` before insert/update (`mvp_security.rs`, `personal.rs` repo).
- **Centralized limits:** `staff_quota_limits()` feeds `staff_quota()` and enforcement.
- **IPC guards:** `require_break_glass_enabled()` / `require_totp_enabled()` in break-glass, auth, personal TOTP commands.
- **Tests:** `staff_quota_tests` (10), `mvp_security_gates_tests` (4), `auth_session_audit_tests` (1) — all **PASS**.
- **UI:** `formatQuotaLine` + grandfathered over-cap hint on Personal page.
- **npm:** `npm test` 242 pass; `npm run build` pass.

### Remains unverified

- Full `cargo test --workspace --tests` green (6 pre-existing `medoc-core` lib unit FK failures unrelated to quota work).
- Live HTTP two-device pairing; `release.yml` tag build.

### Next

1. Fix or quarantine pre-existing `medoc-core` license/sync_outbox lib test FK failures.
2. v1 program Wave 5 calendar/PDF export (separate track).

---

**Previous phase label:** MeDoc v1 Completion Program (2026-06-18)  
**Last closed:** Waves 0–4, 6 (partial 5, 7).

### Verified (2026-06-18 — v1 program)

- **Wave 1:** `v1-ui-flags.ts` blinds broken surfaces; `NOT_IMPLEMENTED` connector paths not reachable from UI (grep: telematik/payment/dicom stubs only).
- **Wave 2:** `require_owner_activation_device` on `import_owner_activation` + `activate_cluster_license`; HTTP pairing cancel on replica scan; runbook [`docs/runbooks/http-two-device-pairing.md`](../runbooks/http-two-device-pairing.md); merge ordering **C8** in contradictions.
- **Wave 3:** Locale `de|en|fr|ar`; RTL `dir` on `<html>`; `i18n-locales.test.ts` key parity.
- **Wave 4 (MVP):** `work_time_session` table + 7 IPC commands; `/personal/arbeitszeit`; `/verwaltung/krankenbescheinigung`; auto-record on login hook.
- **Wave 5 (partial):** Bestellungen price column; table CSS `table-layout:fixed`; NEU→AKTIV on first `create_termin`. Calendar compression / PDF export **NOT DONE**.
- **Wave 6:** Login demonstrator copy trimmed (Wave 1); Tauri `plugins.updater` stub in `tauri.conf.json`; `installer/README.md` token notes.
- **Tests:** `npm test` 242 pass; `npm run build` pass; invoke registry 284 commands.

### Remains unverified

- Live HTTP two-device pairing acceptance.
- First tag-driven `release.yml` on all platforms.
- Full `cargo test --workspace --tests` / `cargo clippy -D warnings`.
- R-009 / R-012 resolution.
- Wave 5 calendar month/week fixes; full FR/AR page externalization.

### Next

1. Tag release for `release.yml` smoke.
2. Wave 5 calendar + PDF export fixes.

**Merge ordering (C8):** Confirmed — push (member LWW) then pull (admin authoritative via `admin_pull`); see [`serverless-sync.md`](../architecture/serverless-sync.md).

---

**Previous phase label:** Activation security remediation (2026-06-16)

### Verified (2026-06-16 — security fixes)

- **Pre-login gate:** owners require `licensed`; members pass on `provisioned` (`verbund-onboarding-gate.tsx`, `verbund-store.ts`).
- **Import:** `import_owner_activation` no longer calls `mark_provisioned`; manifest removed after success; `ImportActivationResult` IPC.
- **License step:** `activate_cluster_license` calls `mark_owner_provisioned_if_ready` after vendor verify.
- **Backend:** `verbund_network_ready` / `require_owner_vendor_license` on listener start and `accept_join_request`.
- **Interop:** C++ UUIDv4 `cluster_id`; dalek sign/verify of `medoc-activation-check`; tests **PASS** (see [`validation.md`](validation.md)).

### Remains unverified

- Full `cargo test --workspace --tests` (spot checks green).
- `installer/build-app-installers.sh` / release workflow on CI runners.
- Windows keygen build (vcpkg path in release.yml).

### Next

1. Tag release to exercise `release.yml`.
2. Ops: distribute `medoc-keygen` separately from app installers.

---

**Previous phase label:** Admin installer + offline keygen (2026-06-16)  
**Last closed:** Phases A–F; register at [`refactor-register.md`](refactor-register.md); workflow map at [`workflow-map.md`](workflow-map.md).

### Verified (2026-06-10 — Refactor & harden)

- **Plan:** [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md) persisted; Geräteverbund exclusion zone respected for structural work.
- **Register:** 20 entries; P0 Geräteverbund items deferred to feature track; R-004–R-006, R-013, R-017 addressed.
- **Tests:** `cargo test --workspace --tests` **PASS**; `cargo clippy --workspace -D warnings` **PASS**; `npm test` **240 PASS**; `npm run build` **PASS**.
- **Safety net:** IPC golden list (275 commands); architecture boundary test; pairing e2e updated for PIN confirm flow.
- **Docs:** [`retired-paths.md`](retired-paths.md), [`workflow-map.md`](workflow-map.md).

### Remains unverified / deferred

- Geräteverbund wire handshake (R-001–R-003) — active feature track.
- G21b live Tauri manual rows 1–9 (R-011).
- Stale v-model/architecture doc paths (R-004) — quarantined, not bulk-updated.

### Next

1. Geräteverbund: wire Noise transcript + mDNS (phase-handoff items).
2. G21b live Tauri sign-off when ready.
3. Optional: refresh high-traffic stale docs from [`retired-paths.md`](retired-paths.md) index.

---

**Previous phase label:** Geräteverbund evolution (2026-06-10)  
**Last closed:** Schema/domain/crypto/net/services/IPC/FE onboarding + admin panel; pairing shim; e2e seat caps; test fixes.

### Verified (2026-06-10 — Geräteverbund evolution)

- **Spec + schema:** `docs/v-model/03-architektur/feature-geraeteverbund.md`; migration `verbund_tables.rs`; domain `medoc-sync/src/verbund/`.
- **Crypto/net:** Noise XX + mDNS discovery + private-bind guard (`medoc-sync/src/net/`, `verbund/crypto/`).
- **Services + IPC:** 13 `verbund_*` commands in `medoc-practice`; auto-start listener in `apps/practice-host/src/lib.rs`.
- **FE:** pre-login onboarding gate, `/onboarding/*` routes, `geraeteverbund-panel` in Einstellungen.
- **Shim:** `pairing_list_pending` merges legacy HTTP + verbund kopplung sessions (`transport: "verbund"`).
- **Tests:** `cargo test -p medoc-sync` **PASS**; `cargo test -p medoc-e2e --test verbund_seat_caps` **PASS**; `npm test` **240 PASS**.
- **Compliance docs:** SOUP list, ISO-14971 R-11–R-14, VVT §2.6, two-device runbook.

### Verified (2026-06-10 — plan follow-up todos)

- **Hybrid arch docs:** `feature-geraeteverbund.md` §3.1 — retire HTTP **pairing** only; `medoc-lan` web UI host stays (NFA-NET-04/05).
- **Tier seat caps:** `seat_budget_from_edition()` in `lizenz_service` (Basis 2/1/1, Pro 5/2/3, Enterprise 10/3/7).
- **HTTP cutover timing:** both transports until phase-5 frontend cutover (documented in spec).
- **Forced re-pair:** migration marks NULL/zero identity → `PENDING`; seat count + `verify_peer_connection` reject incomplete identity; `needsReprovision` in status.
- **Reinstall reclaim:** `verbund_reclaim_device`, `suggestedReclaimFingerprint` on pending, admin panel actions.

### Remains unverified / deferred

- Full Noise wire protocol through join/accept IPC (transcript placeholders in some paths).
- HTTP pairing endpoint removal (after phase-5 cutover).
- `pairing_decide` / `pairing_revoke` verbund delegation.
- G21b live Tauri manual rows 1–9.

### Next

1. Wire real handshake transcript through join/accept IPC.
2. Retire HTTP pairing endpoints when verbund onboarding is default.
3. G21b live Tauri sign-off.

---

**Previous phase label:** MVP plan todos complete (2026-06-07)  
**Last closed:** UX field hints, P0 smokes, W7/W8 automated paths, release-gate ticks.

### Verified (2026-06-07 — MVP plan execution)

- **UX:** Field hints on patient/termin/deployment/pairing; patient abandon confirm; statistik Krankheitsbild empty hint.
- **Tests:** `npm test` **236 PASS**; `p0-routes.smoke.test.tsx`; `export-preview-dialog.smoke.test.tsx`.
- **W7/W8:** Playwright LAN patient list; `two-device-sync-smoke.sh` **17/17**; lan-client-deployment doc paths fixed.
- **Release gate:** automated items ticked in `releases/v0.1.0/release-gate-checklist.md`.

### Next

1. **G21b live Tauri** rows 1–9 — manual sign-off only remaining P0 gate item.
2. **T-U1 XL:** `medoc-sync` engine/repo toward 100% allow-list.

---

**Previous phase label:** T-U1 medoc-sync tests + full Docker GREEN (2026-06-07)

### Verified (2026-06-07 — T-U1 + Docker)

- **T-U1:** `cargo test -p medoc-sync` **PASS** — 10 `repo_store_tests` + 5 engine lib tests + proptests.
- **Fixes:** `append_outbox` path in `engine/run.rs`; peer-vector test uses UUID device id not label; `cargo fmt`.
- **Docker:** `bash scripts/validate-docker.sh` **PASS** (~7 min) — FE + Wave V1 + e2e + multi-device **17/17**.
- **MVP checklist:** automated items ticked in [`mvp-cost-priority-plan.md`](mvp-cost-priority-plan.md).

### Next

1. **G21b live Tauri** rows 1–9 — `bash tools/g21-dev-smoke.sh` + [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md).
2. **T-U1 XL:** expand `medoc-sync` coverage toward 100% allow-list (`tools/mvp-rust-coverage.sh`).
3. **Optional:** `VALIDATE_DOCKER_FULL=1 bash scripts/validate-docker.sh` (Tauri link in Docker).

---

**Previous phase label:** Docker Wave V1 scoped verified (2026-06-06)

### Verified (2026-06-06 — Docker Wave V1 user run)

- **Command:** `docker run … medoc-rust-wave-v1:latest` from repo root (see [`validation.md`](validation.md)).
- **Stages:** fmt, clippy (Wave V1), crate tests, 13× in-process `medoc-e2e`, proptests — all **PASS**.
- **Fixes validated:** `core.rs` module rename (clippy `module_inception`), fmt module order, e2e clippy, dead-code removal.
- **Still optional:** full `validate-docker.sh`, `VALIDATE_DOCKER_FULL=1` (Tauri link), G21 live Tauri smoke.

### Next

1. G21 live Tauri rows 1–9 — `bash tools/g21-dev-smoke.sh` + [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md).
2. Optional: `bash scripts/validate-docker.sh` for frontend + e2e + multi-device in one shot.

---

### Verified (2026-06-06 — post-restructure todo continuation)

- **Path refresh:** coordination docs + release gate use `apps/practice-host`, `crates/*`, `packages/*`.
- **Automated:** `npm test` 232; `g21-verify-automated.sh` PASS; Docker multi-device 17/17; lan-web build PASS.
- **T-U2:** `npm run test:mvp-coverage -w medoc` GREEN (100% on 5 FE modules).

### Next

1. G21 live Tauri rows 1–9 (manual — `bash tools/g21-dev-smoke.sh`).
2. T-U1: expand `medoc-sync` engine/repo tests toward 100% allow-list.

---

**Previous phase label:** Final cleanup + optional Docker full (2026-06-06)

### Verified (2026-06-06 — final cleanup)

- **Dead code (2nd pass):** re-deleted 52 `archive_flat` + 4 orphan `systems/` + 3 FE barrels + stale `.cursor/rules/Untitled`.
- **Config:** ESLint ignore `src-tauri` → `../practice-host`; `medoc-core/infrastructure/mod.rs` stale comments removed.
- **Tests:** `npm test` **232 PASS**; `npm run build` PASS; added `rustls` dev-dep for `lan_tls_tests`.
- **Docker full:** `VALIDATE_DOCKER_FULL=1 bash scripts/validate-docker.sh` — see validation.md.

### Next

1. G21 live Tauri smoke (manual).
2. Expand lan-web only if product needs more routes.

---

**Previous phase label:** LAN web profile + dead code cleanup (2026-06-06)  
**Last closed:** Profil tab in lan-web; removed ~58 archived/uncompiled source files.

### Verified (2026-06-06 — Docker + lan-web)

- **Docker fix:** `run-e2e-wave-v1.sh` skips `multi_device_port_http` (needs live servers); target volume `/work/target`; multi-device enabled by default in `validate-docker.sh`.
- **LAN web:** session restore on reload, logout, patient search + detail panel.
- **Local:** `validate-lan-web-client.sh` PASS; `npm test` **232 PASS**; `npm run build` PASS.
- **Docker:** `bash scripts/validate-docker.sh` **PASS** (~8.1 min) — frontend + lan-web + Rust Wave V1 + e2e + multi-device **17/17**.

### Verified (2026-06-06 — profile + dead code cleanup)

- **LAN web:** Profil tab via `getOwnProfile()` → `GET /api/v1/me`.
- **Dead code removed:** 52 `archive_flat` files, 3 `archive_monolith`, 2 legacy shims, stale `app/docs/`, orphan FE re-export.
- **Validation:** `cargo check` PASS; `validate-lan-web-client.sh` PASS; `npm test` **232 PASS**; `npm run build` PASS.

### Next

1. Optional: `VALIDATE_DOCKER_FULL=1` for Tauri link in Docker.
2. Further lan-web routes as needed.

---

**Previous phase label:** Docker revalidation + lan-web session restore (2026-06-06)  
**Last closed:** `project-truth.md` path refresh; legacy `app/` artifacts removed (~6.5 GB); lan-web termine view.

### Verified (2026-06-06 — post-R10)

- **`project-truth.md`:** paths updated to `apps/`, `crates/`, repo-root CI/npm.
- **Cleanup:** removed stale `app/{target,node_modules,dist,coverage,test-results}`; `app/` is README + docs only.
- **LAN web:** login + Patienten + Termine (by date); `list_termine_by_date` HTTP route alias.
- **Validation:** `validate-lan-web-client.sh` PASS; `validate-fe-three-systems.sh` PASS; `npm test` **232 PASS**; `npm run build` PASS.

### Next

1. Run `bash scripts/validate-docker.sh` after path migration (**NOT RUN**).
2. Further lan-web routes (patient detail, session restore on reload).

---

**Previous phase label:** LAN web client R10 (2026-06-06)  
**Last closed:** Browser-only `apps/lan-web-client`; Docker/tools paths updated for repo root.

### Verified (2026-06-06 — R10)

- **`apps/lan-web-client`:** Vite app on `:1421`, `HttpPracticeAdapter` shim, no `@tauri-apps`.
- **Docker/scripts:** `docker/ci/*`, `validate-docker.sh`, `tools/*`, `generate-sbom.sh` → repo-root paths.
- **Validation:** `validate-lan-web-client.sh` PASS; `npm test` **232 PASS**; practice-host `npm run build` PASS.

### Next

1. Expand lan-web-client routes (beyond login + patient list).
2. Run `bash scripts/validate-docker.sh` after path migration (**NOT RUN** this session).

---

**Previous phase label:** Repo-root promotion R9 (2026-06-06)  
**Last closed:** `apps/`, `crates/`, `packages/` at repository root; root Cargo + npm workspaces.

### Verified (2026-06-06 — R9)

- **Layout:** `apps/{practice-host,practice-host-ui}`, `crates/`, `packages/` at repo root.
- **Workspaces:** root `Cargo.toml`, root `package.json` with npm workspaces.
- **CI:** `.github/workflows/ci.yml` updated to repo-root paths.
- **Codegen:** `medoc-core/build.rs` TS output → `packages/shared/src/lib/`.
- **Validation:** `cargo check --workspace` PASS; `validate-three-systems.sh` PASS; `validate-fe-three-systems.sh` PASS; `npm test` **232 PASS**; `npm run build` PASS.

### Next

1. **R10:** standalone `lan-web-client` app (browser-only, no Tauri).
2. Update Docker/scripts still referencing `app/` paths.

---

**Previous phase label:** Docker revalidation GREEN + G21 live checklist prep  
**Last closed:** 2026-06-01 — Fixed `cargo fmt` import order (`praxis_aufgabe_commands.rs`). **`bash scripts/validate-docker.sh` PASS** (~6.4 min). Enhanced `g21-live-smoke-checklist.md` with dev credentials (`passwort123`, seed emails) and license helper steps. Added nav ordering regression in `collaboration-g21.test.ts`.

**Previous phase label:** G21 row 4 FE proxy + full-stack validation  
**Previous closed:** 2026-05-31 — `notifications-popover.smoke.test.tsx`; flaky g21-routing fix. **`npm test` 179 PASS**; **`cargo test --tests` PASS**.

**Previous phase label:** FA-AUFG-04 notification test (G21 row 4 backend)  
**Previous closed:** 2026-05-31 — Extracted `praxis_aufgabe_notify`; 2 Rust tests. **`cargo test --test praxis_aufgabe_tests` 5/5 PASS**; **`npm test` 178 PASS**.

**Previous phase label:** G21 sidebar fix + automated proxy completion  
**Previous closed:** 2026-05-31 — Posteingang was missing from `NAV_SECTIONS` (route/RBAC/badge existed). Added `/posteingang` to Behandlung section. Fixed and validated `g21-routing.smoke.test.tsx` (row 1) and `ops.smoke.test.tsx` (row 7). **`npm test` 178 PASS**.

**Previous phase label:** Full Docker pipeline GREEN (OOM fix)  
**Previous closed:** 2026-05-31 — `validate-docker.sh` now uses `--shm-size=4g`, `CARGO_BUILD_JOBS=1`, and shared `medoc-target-linux-e2e` for Rust containers. **`bash scripts/validate-docker.sh` PASS** end-to-end (~7.4 min). **`npm test` 176 PASS** (prior session).

**Previous phase label:** Pro compare sweep — personal admin unlock UI  
**Previous closed:** 2026-05-31 — Compared remaining ~24 `app/` diffs; ported Login-Sperre UI to `personal.tsx`.

**Previous phase label:** G21 Posteingang re-enabled + clearLicense + GAP verification  
**Previous closed:** 2026-05-31 — Re-enabled Posteingang UI; wired `clearLicense`; GAP-01 redaction unit tests + GAP-02 contract test.

**Previous phase label:** Phase C — pro compare/fix (no frontend UI layout changes)  
**Previous closed:** 2026-05-31 — Continued pro→main port after backend/PDF phases: IPC wrappers for `adminUnlockBruteForce`, G21 inbox (`listPraxisAufgabenForMe` / `transitionPraxisAufgabe` / `countOpenPraxisAufgabenForMe`), `clearLicense`; hybrid `gen_dev_license_once` device-id resolution; new `praxis-tickets.smoke.test.tsx`. **Still skipped:** G21 Posteingang UI/routes/RBAC, Docker Wave D paths. **`cargo test --tests` PASS**; **`npm test` 170 PASS + 1 SKIP**.

**Previous phase label:** Backend port from pro/Medoc (no frontend UI changes)  
**Previous closed:** 2026-05-31 — Ported non-UI improvements from `/Users/achraf/pro/Medoc`: SQLCipher test-key hardening (`db_key.rs`, `connection.rs`), `OsRng` invoice fallback (`pricing.rs`), demo audit-log seeds, e2e harness `MEDOC_DEV_SEED`, tokio `Mutex` in `license_gate_negatives`, migration-based crypto/TOTP tests, `tools/dev-tauri.sh`, dev-only tests (`dev_local_db_password_tests`, `gen_dev_license_once`). **Skipped:** G21 Posteingang UI/routes/RBAC, Docker Wave D path drift (`/work` vs `/work/app`). **`cd app && cargo test --tests` PASS**; **`npm test` 169 PASS + 1 SKIP** (unchanged).

**Previous phase label:** Testing matrix expansion v3 (proptest property invariants + UI smoke expansion)  
**Previous closed:** 2026-05-27 (evening) — Property-based tests wired across three crates with 12 invariants and **2352 random scenarios** (1024 license envelopes + 1280 activation tokens + 48 sync-merge scenarios). Two new `critical-flows.smoke.test.tsx` flows added: (f) login rejection and (g) license activation; the file-wide `afterEach` now calls `cleanup()` to prevent DOM bleed between describes. Full Wave V1 + e2e + proptest test suite GREEN locally (155+ tests, zero failed); frontend full suite 169 PASS + 1 SKIP (was 167+1). **`bash scripts/validate-docker.sh` NOT RUN** for proptest commits — Docker Desktop's VM disk hit 100% mid-link (`No space left on device`); host validation above is the proxy. Commit `9f1d8a0` (pre-proptest) has the most recent end-to-end Docker GREEN evidence. See [`validation.md`](validation.md) latest block for the full table.

**Previous phase label:** Testing matrix expansion v2 (multi-replica conflict + license gate negatives)  
**Previous closed:** 2026-05-27 (afternoon) — `medoc-e2e` grew 40 → **56** HTTP integration tests after adding `multi_replica_roundtrip.rs` (9) and `license_gate_negatives.rs` (7). The multi-replica suite drives the full HTTP push/pull pipeline on the master (`SyncEngine::ingest_push` → `apply_remote_entry` → `MasterWinsWithFreshness`) and pushed `medoc-sync/merge.rs` coverage from **57.04% → 71.85%**. The license-gate suite walks every negative path of `master_license::require_master_license` from the LAN HTTP surface (unlicensed, tampered envelope, wrong-device binding, skip-switch, replica-role exemption). Full Docker pipeline GREEN end-to-end.

**Previous phase label:** Testing matrix expansion + coverage wiring (Wave V1 follow-up)  
**Previous closed:** 2026-05-27 (morning) — `medoc-e2e` doubled from 20 → 40 HTTP integration tests (revocation/rotation, behandlung+untersuchung outbox lifecycle, serverful `lan_client` RBAC). One real security defect found and fixed: revoked slaves could keep using activation tokens on `/sync/*` and `/pairing/peers` because the gate trusted the token claims when `slave_permission` rows were missing. Real coverage numbers measured with `cargo-llvm-cov` + `@vitest/coverage-v8` and recorded below (no more hand-waving on "100% coverage"). See [`validation.md`](validation.md) 2026-05-27 block.

### 2026-05-27 (afternoon) — Verified

- **e2e count: 56** (was 40). Full Docker pipeline GREEN.
- **`medoc-e2e/tests/multi_replica_roundtrip.rs`** (9 tests):
  - `replica_push_applies_one_patient_row_on_master` — full HTTP roundtrip;
    asserted via `sync_applied` row, not vectors.
  - `replica_pull_sees_master_local_writes` — pulls patient + auto-created
    patientenakte after enabling serverless MASTER mode on the master.
  - `older_push_does_not_overwrite_newer_master_row` — freshness keeps
    the master's locally-newer row.
  - `newer_push_overwrites_older_master_row` — freshness applies the
    newer replica push.
  - `two_replicas_push_same_entity_freshness_resolves_winner` — three
    interleaved INSERT+UPDATE pushes from two replicas; the freshest
    wins regardless of arrival order; older retry never regresses the
    row.
  - `push_with_mismatched_from_device_id_is_rejected` — token claim vs
    body mismatch → 403 from `sync_push`.
  - `push_with_inner_entry_device_id_mismatch_returns_400` — token+body
    agree but inner `OutboxEntry.device_id` differs → 400.
  - `pull_with_unknown_master_device_id_returns_empty_entries` — pull
    against an unknown device id returns `entries: []`, not 500.
  - `idempotent_push_same_seq_does_not_double_apply` — three identical
    pushes; verified via single `sync_applied` row.
- **`medoc-e2e/tests/license_gate_negatives.rs`** (7 tests, serialised by
  a per-file `Mutex` because they mutate `MEDOC_SKIP_MASTER_LICENSE`):
  - `unlicensed_master_rejects_sync_status_with_403`
  - `unlicensed_master_rejects_pairing_decide_with_403`
  - `unlicensed_master_rejects_pairing_submit_with_403`
  - `tampered_license_master_rejects_sync_status` — flips the last byte
    of the stored envelope; `verify` returns invalid, gate returns 403.
  - `wrong_device_license_master_rejects_pairing_submit` — license bound
    to a different `device_id`; envelope decrypt fails locally.
  - `skip_enforcement_env_bypasses_gate_even_without_license` — ops
    kill-switch verified end-to-end.
  - `replica_role_in_serverless_peer_does_not_require_master_license` —
    REPLICA role exemption verified (matches `acts_as_sync_master`).
- **Real coverage delta** (host run via `cargo llvm-cov`, scoped to
  Wave V1 + e2e tests, ignoring `tests/`):
  - `medoc-sync/merge.rs`: **57.04% → 71.85%** (+14.81 pp, conflict
    paths now exercised end-to-end).
  - `medoc-lan/master_license.rs`: **85.96% → 89.47%**.
  - `medoc-lan/sync_http.rs`: **88.51% → 89.86%**.
  - `medoc-lan/pairing_http.rs`: **85.81% → 86.16%**.
  - `medoc-sync/engine.rs`: 55.06% → 55.36% (marginal — `run_mesh_sync`
    and `push_to_master`/`pull_from_master` are still mostly only hit
    by `two_replica_mesh.rs`).
  - TOTAL workspace: 25.61% → **25.94%** lines (still dragged down by
    the same untested non-Wave-V1 surface: PDF, telematik, DSGVO,
    devices, ~half the `infrastructure/database` repos).
- Outputs at `app/target/coverage/{summary.txt,lcov.info}`.

**Previous phase label:** Master/slave pairing + License v2 (Wave V1)  
**Previous closed:** 2026-05-26 — perpetual device-bound encrypted license, master Ed25519 keypair, replica activation tokens, freshness-aware conflict resolution, auto outbox hooks, and BEST-EFFORT mesh scaffolding. See [`actions.md`](actions.md) "Wave V1" entry and [`validation.md`](validation.md) for the per-slice evidence.

### 2026-05-27 — Verified (this session)

- **Docker pipeline GREEN end-to-end**: `bash scripts/validate-docker.sh` —
  Frontend (167 + 1 skipped Vitest), Rust Wave V1 scoped (fmt + clippy +
  tests), `medoc-e2e` (40/40 in Linux Docker), headless `medoc-server`
  HTTPS smoke. Wall clock ≈ 3.2 min on this host.
- **New e2e tests, evidence-driven (20 added, all green)**:
  - `revoke_and_rotation.rs` (7) — revoke clears `slave_permission`,
    revoked token rejected on `/sync/status` AND `/pairing/peers`,
    re-pairing mints fresh token, double-decide rejected, master
    pairing toggle gate, revoke route requires `ops.system` JWT.
  - `outbox_clinical_writes.rs` (3) — `behandlung` lifecycle
    (create/update/delete) emits exactly 3 outbox rows; same for
    `untersuchung`; `practice_desktop` mode emits zero (no sync).
  - `serverful_lan_client_flows.rs` (10) — REZEPTION vs ARZT JWT
    boundaries, JWT-not-accepted-on-`/sync/*` (mt2 only), `app-kv`
    PUT/GET/DELETE round trip with whitelist enforcement, login
    failure modes (wrong pw, unknown user, missing bearer).
- **SECURITY FIX (high)** — `medoc-lan/src/sync_http.rs::verify_activation_for_path`
  and `medoc-lan/src/pairing_http.rs::peers`: previously, when the master
  had revoked a slave, the deletion of `slave_permission` rows caused
  the gate to silently fall through to the token's baked-in
  `allowed_actions`. Revoked slaves could keep using their (perpetual)
  activation tokens until the underlying signing key rotated. Replaced
  with a default-deny gate that consults `pairing_request.status` and
  rejects on `REVOKED`; mesh peer pushes (where no row exists for the
  sibling's device_id) still pass via the master signature. Regression
  test: `revoke_and_rotation::revoked_action_rejects_sync_status_even_with_valid_token`
  + `::revoked_slave_cannot_access_pairing_peers_either`.
- **Frontend regression fix** — `critical-flows.smoke.test.tsx` flow (a)
  now mocks `sync_get_status` and `current_license_status` (introduced
  by `LicenseAndPairingGate` + `ReplicaSyncBackground` startup).
- **Coverage wired and measured (real numbers, not aspirational)**:
  - Frontend (`@vitest/coverage-v8` + `npm run test:coverage`):
    Statements 14.65% (6867/46873), Branches 57.57%, Functions 35.57%,
    Lines 14.65%. Big untested surface = UI screens / pages.
  - Rust workspace (`cargo-llvm-cov`, scoped to wave-V1 + e2e tests):
    TOTAL 25.61% lines (16455/22120 uncovered). On the Wave V1 critical
    path:
    - `medoc-lan/lib.rs` 100%, `medoc-lan/jwt.rs` 98.39%,
      `medoc-lan/sync_http.rs` 88.51%, `medoc-lan/pairing_http.rs`
      85.81%, `medoc-lan/master_license.rs` 85.96%,
      `medoc-lan/http.rs` 80.30%.
    - `medoc-sync/pairing.rs` 89.86%, `medoc-sync/schema.rs` 84.48%,
      `medoc-sync/repo.rs` 80.94%, `medoc-sync/master_keys.rs` 76.32%,
      `medoc-sync/merge.rs` 57.04%, `medoc-sync/engine.rs` 55.06%.
    - `medoc-core/license.rs` 81.31%,
      `medoc-core/database/sync_outbox.rs` 87.85%.
    Outputs: `app/target/coverage/summary.txt`, `lcov.info`.

### 2026-05-27 — Unverified / not-run / deferred

- **"100% coverage" and "10,000 use cases"** — explicitly NOT achieved
  in this session. The pragmatic scope (agreed up-front) was a measured
  baseline + ~20 new e2e cases + coverage wiring. Real coverage on the
  Wave V1 critical path is 55–100%; the rest of `medoc-core`
  (PDF, telematik, DSGVO, devices, many repos) is largely untested
  Rust code that is out of Wave V1 scope.
- **Tauri-driver UI E2E**, **3-slave conflict matrix**,
  **license tamper / expiry**, **proptest for sync/license/pairing** —
  NOT-RUN. These are the next four scope chunks in the agreed plan and
  were de-prioritised in favour of the security fix + honest coverage
  numbers. Tracked in `actions.md`.
- **Coverage in Docker** — the new `MEDOC_COVERAGE=1` switch in
  `docker/ci/run-rust-validate-wave-v1.sh` was authored but only the
  *host* run was executed end-to-end this session. The Docker image
  rebuild (with `cargo install cargo-llvm-cov`) was not re-tested
  inside Docker; flagged for the next CI pass.

### Wave V1 — Verified

- `LicenseV2` envelope encrypts + signs against the master's `device_id`;
  rejection paths covered in `app/crates/medoc-core/tests/license_v2_tests.rs`.
- Pairing handshake compiles + unit-tests pass (4 tests in
  `medoc_sync::pairing::tests`).
- Activation tokens authenticate `/sync/{push,pull,status}` and
  `/pairing/peers`. Non-allow-listed routes reject mt2 tokens (403).
- Outbox hooks recorded for all 8 allow-listed tables — 7 integration
  tests in `app/crates/medoc-core/tests/sync_outbox_hooks_tests.rs`
  green.
- `ConflictPolicy::MasterWinsWithFreshness` — 2 new merge tests in
  `medoc_sync::engine::tests` (older master push is rejected; newer
  master push wins).
- UI: replica `pairing-scan.tsx`, master `einstellungen-pairing-inbox.tsx`,
  `license-activate.tsx`, top-level `LicenseAndPairingGate` integrated
  into `App.tsx`.
- **Docker E2E (`medoc-e2e`)** — 20 HTTP integration tests + headless
  `medoc-server` HTTPS smoke pass in Linux Docker
  (`./scripts/validate-docker-e2e.sh`, 2026-05-26).
- **Gap fixes (2026-05-26 follow-up):** replica license gate bypass when
  `activationToken` present; `ReplicaSyncBackground` (30s + online event);
  replica `sync_run_now` without `ops.system`; mesh peer URLs + signature
  verify; `pairing.enabled.v1` master toggle in Einstellungen inbox.

### Wave V1 — Unverified / BEST-EFFORT

- **Live two-device pairing smoke** — DEFERRED (needs second physical host;
  in-process HTTP e2e covers the same API contract).
- **Mesh fan-out to peer HTTPS endpoints** — peer list uses
  `sync_device.peer_base_url` when set; signature verification matches full
  peer payload. Live two-replica mesh push **OBSERVED** in
  `medoc-e2e::mesh_push_delivers_outbox_entry_to_peer_replica` (TCP
  `axum::serve`, 2026-05-26).
- **Repository coverage** stays at the 8 allow-listed tables.
- **Documentation audit** is partial — only the architecture docs
  touched by this wave were updated.

### Wave V1 — Understanding delta

- Activation token bypass is now scoped: any `mt2.*` bearer hitting a
  non-sync protected route gets HTTP 403 instead of falling through to
  the JWT path. Replicas paired before Slice 4 keep working only because
  the JWT branch is still wired in `jwt_auth_middleware`.
- `app_kv` writes are partially synced (internal `sync.*`, `license.*`,
  `pairing.*` keys are excluded). This is a deliberate tradeoff documented
  in `serverless-sync.md`.

### Required next steps (ordered)

1. Run the Slice 8 validation matrix (cargo fmt/clippy/test workspace +
   npm lint/test/build) and append results to `validation.md`.
2. Spin up two physical/VM hosts and execute the live pairing → push →
   pull → revoke smoke.
3. Verify the peer list signature in `run_mesh_sync`; flip
   `unstable_mesh` to supported once mesh works end-to-end.
4. Migrate the remaining write paths beyond the 8 outbox-hooked tables.

---

## Previous handoff (archived)

**Phase label:** Three-system deployment + **serverless peer sync (foundation)**  
**Closed:** 2026-05-26 — Wave B8 binaries + **`medoc-sync`** crate; **PASS** (`cargo test/clippy --workspace`, 158 vitest). The user's "3 fully separated models" goal is physically real: `cargo build -p medoc-lan-server` and `cargo build -p medoc-company-server` both produce working standalone binaries (`target/debug/medoc-server` 39 MB, `target/debug/medoc-company-server` 19 MB) without compiling any Tauri code. The desktop Tauri app (`cargo build -p medoc`, `target/debug/medoc` 82 MB) still works.

### Three-system split — outcome (after Wave B8)

```
app/
├── Cargo.toml                            # workspace root, 7 members
├── crates/
│   ├── medoc-codegen/                    # build-time RBAC + enums + pubkey codegen
│   ├── medoc-core/                       # domain + application + non-Tauri infra
│   ├── medoc-lan/                        # LAN HTTP server library
│   ├── medoc-lan-server/                 # LAN binary (medoc-server)
│   ├── medoc-company/                    # Company HTTP server library
│   ├── medoc-company-server/             # Company binary (medoc-company-server)
└── src-tauri/                            # Tauri desktop binary (medoc)
```

| Binary | Crate | Pull-in | Run with |
|--------|-------|--------|----------|
| Practice host | `medoc` (src-tauri/) | medoc-core + medoc-lan + medoc-company + tauri | `cargo run -p medoc` |
| LAN server | `medoc-lan-server` | medoc-core + medoc-lan (no Tauri) | `cargo run -p medoc-lan-server -- --data-dir <path>` |
| Company server | `medoc-company-server` | medoc-core + medoc-company (no Tauri, no LAN) | `cargo run -p medoc-company-server -- --data-dir <path>` |

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
| Wave B5.0 `a74fd82` — give `medoc_codegen::{enums,rbac}::run` explicit `yaml_path` + `ts_out_dir` (+ `sql_out_path`) parameters (prereq for codegen migration across crates) | **PASS** (159 tests; generated artefacts byte-identical) |
| Wave B5.1 `6aef090` — move `AppError` into `medoc-core::error`; `app/src-tauri/src/error.rs` becomes `pub use` shim; first true cross-crate source lift | **PASS** (159 tests; `medoc-core` is now a load-bearing dep of `medoc`) |
| Wave B5.2 `2c0307c` — move entire `domain/` (24 files, entities + enums + rbac + repositories + services) into `medoc-core/src/domain/`; new `medoc-core/build.rs` drives enums codegen; `app/src-tauri/src/domain.rs` shim re-exports everything | **PASS** (159 tests; generated artefacts byte-identical) |
| Wave B6.0 `8e1f8b5` — pre-lift untanglings (`BreakGlassState` → `medoc-core::break_glass`, `PermissionOverride` → `medoc-core::domain::rbac`, `lan_server::discovery` → `medoc-core::discovery`) | **PASS** (159 tests; resolves 3 upward `use crate::*` edges before bulk lift) |
| Wave B6.1 `975f96c` — bulk-lift ~50 non-Tauri infrastructure files (backup, clinical_*, cors_policy, crypto/, database/, devices/, dsfa/dsgvo, license, logging/, migration, notifications, payment, pdf*, perf, photo_viewer_scan, retention, secret_store, telematik, totp, update, vvt) + `migrations/` directory into `medoc-core`; vendor pubkey codegen relocated to `medoc-core/build.rs` (third OUT_DIR migration after enums + RBAC) | **PASS** (159 tests; macros `log_*!` re-exported at practice crate root) |
| Wave B7.0 `5f82295` — lift `application/` (10 files) + `infrastructure/company_portal/` (3 files) into `medoc-core`; RBAC codegen moved to `medoc-core/build.rs`; practice's `application.rs` becomes a 17-line facade with a `rbac` shim that merges medoc-core's matrix with practice's Tauri-State guards | **PASS** (159 tests; medoc-codegen build-dep removed from practice crate) |
| Wave B7.1 `5c7251d` — create **`medoc-lan` crate** (workspace member). Lift `infrastructure/lan_server/` (7 files) into it. Also lift `systems/company/{port,adapter}.rs` into `medoc-core::company` so both LAN + practice consume the same `COMPANY_PORTAL` singleton. Practice's `infrastructure/lan_server.rs` = `pub use medoc_lan::*;` shim | **PASS** (159 tests; `cargo check -p medoc-lan` builds with zero Tauri code) |
| Wave B7.2 `400f8ca` — create **`medoc-company` crate**. Lift `infrastructure/company_host/` (4 files) into it. Practice's `infrastructure/company_host.rs` = `pub use medoc_company::*;` shim | **PASS** (159 tests; `cargo check -p medoc-company` builds with zero Tauri, zero LAN code) |
| Wave B8 `ed362bc` — split `bin/medoc-server.rs` + `bin/medoc-company-server.rs` into **`medoc-lan-server`** + **`medoc-company-server`** binary crates. Drop the `[[bin]]` entries from practice's Cargo.toml. `LanSystemFactory` lifted from practice into `medoc-lan` so the standalone binary doesn't need the practice crate. Cold rebuild **proves** each binary builds in isolation | **PASS** (159 tests; `cargo build -p medoc-lan-server` 39 MB; `cargo build -p medoc-company-server` 19 MB; `cargo build -p medoc` 82 MB) |
| Wave C — npm workspace split | **NOT STARTED** — independent of B; can proceed |
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

**Wave B closed `ed362bc` (2026-05-26).** Eight successive commits (B6.0, B6.1, B7.0, B7.1, B7.2, B8) lifted the entire shared backend out of `app/src-tauri/` and produced three independent Cargo crates that build standalone binaries. Validation green at every step (159 tests / 0 fail).

#### The user-facing payoff (verified)

| Step | Command | Output | Tauri compiled? |
|------|---------|--------|-----------------|
| Cold build LAN binary | `cargo build -p medoc-lan-server` | `target/debug/medoc-server` (39 MB) | **No** — only medoc-core + medoc-lan + their deps |
| Cold build Company binary | `cargo build -p medoc-company-server` | `target/debug/medoc-company-server` (19 MB) | **No** — only medoc-core + medoc-company |
| Cold build desktop | `cargo build -p medoc` | `target/debug/medoc` (82 MB) | Yes — Tauri practice host |

This delivers the user's "3 fully separated models" goal as a hard, verifiable artefact (cold rebuild from clean target — no shared object files between the LAN and Company binaries beyond `medoc-core`, no Tauri runtime in either standalone binary).

#### Serverless sync (2026-05-26 — foundation)

| Item | Status |
|------|--------|
| `medoc-sync` crate (outbox, vector, master/replica engine) | **PASS** — 2 unit tests |
| DB tables `sync_device`, `sync_vector`, `sync_outbox`, `sync_applied` | **PASS** — `ensure_sync_replication_tables` in `connection.rs` |
| LAN HTTP `/api/v1/sync/{push,pull,status}` | **PASS** — compiles; JWT-protected like other LAN routes |
| Tauri IPC `sync_get_status`, `sync_set_deployment`, `sync_run_now`, `sync_record_change` | **PASS** |
| UI Einstellungen → Bereitstellung & Sync | **PASS** (code); live two-device sync **NOT OBSERVED** |
| Auto outbox on every clinical write | **NOT STARTED** — v1 uses explicit `sync_record_change` / manual append |

Design doc: [`docs/architecture/serverless-sync.md`](../architecture/serverless-sync.md).

#### Outstanding work (Waves C + D, independent of each other)

1. **Wave C — npm workspace split (frontend).**  
   `app/src/` is still a single TypeScript tree. The mapping document `docs/coordination/wave-c-package-mapping.md` already triages all 97 files in `app/src/lib/`. Goal: split into `@medoc/shared`, `@medoc/ui`, `@medoc/system-practice`, `@medoc/system-lan` (a future browser/tablet client for the LAN server), `@medoc/system-company`. Steps: (a) introduce `app/package.json` workspaces; (b) move shared types out first; (c) per-system Vite roots; (d) per-system smoke tests.

2. **Wave D — repo-root restructure.**  
   Promote the workspace from `app/` into root: `apps/{practice,lan,company}/`, `crates/{medoc-*}/`, `packages/{shared,ui,system-*}/`, `tools/`. Updates required: CI workflow (`.github/workflows/ci.yml`), README, `AGENTS.md`, every `docs/coordination/*.md` path reference. Highest blast radius — should run last.

3. **Wave B follow-ups (lower priority, deferrable).**  
   - Trim practice crate's `Cargo.toml` deps that are now only used transitively (axum, axum-server, rustls, rcgen, rustls-pemfile, tower, tower-http, if-addrs, jsonwebtoken, reqwest, urlencoding, tracing-appender, hmac, sha2, zeroize, ed25519-dalek, base64, zip, regex, dirs, keyring, totp-rs — many already covered by medoc-core/medoc-lan/medoc-company). Run `cargo machete` or manual pruning + `cargo check` per removal.
   - Move `commands/lan_commands::start_lan_embedded` to call `medoc_lan::*` directly instead of through the `infrastructure::lan_server` shim.
   - Reduce the `lan_server.rs` + `company_host.rs` re-export shims once consumers are repointed.

#### Continuity notes for the next session

- **`MEDOC_VENDOR_PUBKEY`** is now required at build time for **medoc-core** (it generates `pubkey.rs` in `OUT_DIR`). CI value: `79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`. The variable is read by `medoc-core/build.rs` (was `app/src-tauri/build.rs` before B6.1).
- **Disk space:** `app/target/debug/incremental/` was cleared mid-Wave-B6 (it had grown to 15 GB). Future bulk lifts may need the same cleanup.
- **No coordination contradictions** detected between the lifted code and the docs; the only stale paths are in `docs/coordination/wave-b-crate-mapping.md` (mentions migrations as still-in-src-tauri — but they're now in medoc-core; minor).

3. **Wave B8 — binary crates.** `bin/medoc-server.rs` and `bin/medoc-company-server.rs` move into `app/crates/medoc-{lan,company}-server/src/main.rs` (or similar). Practice-host `medoc` crate keeps only `lib.rs` + `main.rs` + `commands/` + `systems/` and uses `medoc_core` + `medoc_lan` (for the embedded LAN server) as deps.

4. **Other constraints to revisit during B6/B7** (not blockers yet):
   - `application/audit_chain_guard::blocks_ops()` is called from `commands::rbac_state::require` (Wave B2.b). If `audit_chain_guard.rs` later moves to `medoc-core`, the call stays where it is; only `commands::rbac_state` lives in the practice crate. Verify before splitting `application/`.
   - `application/akte/*` reference `commands::auth_commands::SessionState` indirectly via `rbac::require` — confirm no remaining `tauri::State` usage before lifting `application/` into `medoc-core`.
   - `application::rbac` has `include!(concat!(env!("OUT_DIR"), "/rbac_generated.rs"))`. If `application/` ever moves to `medoc-core`, that codegen invocation must follow it (same pattern as B5.2 did for enums). For now it's fine in the practice crate.

5. **Live UI smokes from earlier phases remain NOT OBSERVED.**
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
