# Verification pass, 2026-11-27

Scope: the uncommitted editions work in this checkout (T5.4 tasks / orders / collected-by), plus the
architecture, error and log protocol, API wiring, update / support / sync features and the gates.
Another session edited the same checkout at the same time (T5.2 privacy, T5.3 calendar, T5.6
statistics, T5.7 PDFs). Findings in those files are listed, not fixed.

## 1. Fixes made in this pass

| # | Type | Where | What was wrong | Test that proves the fix |
|---|---|---|---|---|
| F1 | defect | `commands/ownership.rs` (`practice_task`) | A desk task assigned to another receptionist named that receptionist as its **doctor**. Owner is now: writer dentist, else assignee if a dentist, else the form's doctor if a dentist, else none. | `ownership_tests::task_owner_is_always_a_dentist` |
| F2 | defect | `repos/scheduling/practice_task.rs::list_all_admin` | Admin task list took the newest 500 rows **then** filtered by doctor / sharing, so a doctor's older tasks disappeared. Filter now runs in SQL before the limit (numbered placeholders). | `task_scope_tests` (limit-1 regression case) |
| F3 | defect (sync) | `application/documents/issue/signing_doctor.rs` | Signing doctor stamped on `issued_document` after the insert was queued, so it never reached other devices. Now re-queued when stamped. Caught by the H2 guard. | `recorded_write_guard` (was failing) |
| F4 | defect (UI) | `finance.tsx` | Orders (expenses) stayed in the list under a "Collected by" filter. | manual read; filter logic |
| F5 | workflow | tasks, orders, finance doctor filters | Doctors who do not share an area were offered in the filter; picking one only produced a refusal (tasks even kept the old rows silently). They are now left out. | `purchase-order-doctor.test.tsx` |
| F6 | workflow | tasks admin panel, orders page | A doctor filter with no rows showed "No orders/tasks yet, create one" and hid Reset. Now shows the filtered empty state with Reset. | read of render branches |
| F7 | pattern (DRY, layering) | `commands/share_scope.rs` (new) | `scope()` was copied 3× (payments, tasks, orders); the order visibility rule sat in the **repository** (infrastructure) while tasks kept it in commands. One `ShareScope` + `load()` now; the 3 modules are one-line wrappers. Behaviour unchanged. | `payment_scope_tests`, `order_scope_tests`, `task_scope_tests` |
| F8 | pattern (DRY) | `views/components/use-doctor-list.ts` (new) | `useTaskDoctors` and `useOrderDoctors` were identical. | component tests |
| F9 | gate | `finance-kpi-data.ts` (new), doctor UI files | `npm run lint` failed (react-refresh: helpers exported from component files). | lint green for these files |
| F10 | protocol | `config/error-codes.lock.json`, catalogue, manuals | Error catalogue and manuals were stale: 16 backend errors (updates, support file, number blocks, ownership) had no support code. Regenerated (append-only lock). | `generate-error-catalog.mjs --check`, `manuals:check` |
| F11 | dead code | `ownership.rs` (`purchase_order`) | Bound `paid_by` / `approved_by` to NULL (no-op) and re-queued sync even when nothing changed. | `ownership_tests::order_is_for_the_placing_dentist` |
| F12 | gate (committed code) | `infrastructure/database/number_sequence.rs` | Test module sat above `format_number` (clippy `items_after_test_module`) and took over its doc comment. Moved to the file end. | `cargo clippy -p medoc-core --tests -D warnings` clean |
| F13 | system test | `invoke_command_registry_tests::every_ui_invoke_is_registered` | Nothing checked that UI commands exist in the backend. | the test itself |

## 2. Tests added

| Level | Test | Covers |
|---|---|---|
| Integration (Rust, SQLite) | `ownership_tests::task_owner_is_always_a_dentist` | F1, 4 owner cases |
| Integration | `ownership_tests::order_is_for_the_placing_dentist` | order owner, no overwrite |
| Integration | `task_scope_tests` (rewritten on the SQL path) | sharing, doctor filter, hidden id, limit regression |
| Unit | `order_scope_tests::order_list_narrows_to_one_doctor_and_drops_hidden_ones` | order filter |
| Integration | `part_f_tests::payment_list_filters_by_collector` | `collectedBy` alone, with doctor, with sharing, count = rows |
| System (wiring) | `invoke_command_registry_tests::every_ui_invoke_is_registered` | every `invoke("…")` in the UI exists in `register.rs` (319 commands; 2FA allow-listed as deferred) |
| Unit (TS) | `finance-kpi-data.test.ts` | KPI deltas, status filter, % format |
| Component (TS, JSDOM) | `purchase-order-doctor.test.tsx`, `practice-task-doctor.test.tsx` | hidden in one-dentist editions, names, hidden-doctor note, filter excludes unshared doctors |
| Contract (TS) | `doctor-scoped-lists.controller.test.ts` | `doctorId` argument shape (camelCase, null when empty) |

## 3. Gate results (commands run this session)

| Gate | Result |
|---|---|
| `cargo test -p medoc-core -p medoc-practice --no-fail-fast` | 550 passed earlier; `minimal_document_samples` PASS on rerun; **`backup_tiers_tests::attachments_are_backed_up…` FIXED** (assert remaining manifests after restore retention; 8/8 consecutive PASS) |
| `cargo test -p medoc-core --lib` (update manifest, support seal, error reports, remote commands, rollout, health) | 317 passed |
| `cargo test -p medoc-sync -p medoc-lan -p medoc-support-open` | all passed (incl. 5-device convergence proptests, origin pull, catch-up, number blocks, field merge, HTTP route matrix, pairing) |
| `cargo test -p medoc-e2e` (in-process; Docker suites not run, Docker was off) | passed after `cargo build -p medoc-lan-server` (TLS replica test needs the binary). **Later run: does not compile**: the other session added `ordered_for_staff_id` / `paid_by_staff_id` / `approved_by` to `CreatePurchaseOrder` (order-form pickers, in progress) and `tests/sync_mesh_harness.rs:656` still builds the struct without them. |
| `cargo check -p medoc-practice` for solo, duo, duo+replica, group, group+replica | all compile |
| `cargo clippy -D warnings` | `medoc-core` clean after F12; `medoc-practice` **PASS** after needless `&earliest_*` binds fixed in `statistics/doctor.rs` |
| `rustfmt` | gap-fix files formatted; other committed files may still differ (`number_sequence.rs`, `blocks.rs`, …) — full-tree fmt **NOT RUN** on close-out |
| `npx vitest run` | 642 passed (135 files) earlier; doctor-field extract not re-run full suite |
| `npx tsc --noEmit` | **PASS** (practice-host-ui) after statistics imports + order-form wiring |
| `npm run lint` | **PASS** on create + statistics pages (`--max-warnings 0`) |
| `npm run i18n:verify`, `manuals:check`, `css:tokens` | pass (`i18n:verify` 6813×4 after F9 translations) |
| `check-edition-surface.sh solo` (with Solo web build) | no leaks |
| `npm run check:size` | still FAIL: ~19 files over limit/baseline (pre-existing T5 growth). Order-create helpers extracted so create page stays under its baseline. Not loosened. |

## 4. Architecture, patterns, structure

| Check | Result | Evidence |
|---|---|---|
| Frontend MVC: views → controllers → `practiceSystem.invoke` | respected | no `invoke` / `@tauri-apps/api` in the new view files |
| UI ↔ backend wiring | complete | new registry test, 0 missing |
| Backend layering (commands → application → infrastructure) | respected after F7 (sharing policy left the repository) | `share_scope.rs` |
| Capability gating, not edition names | respected | `cfg(feature = "cap-allowances")`, `DOCTOR_CONTEXT`, `CORE_CAPS.multi_doctor` |
| Solo bundle | inert doctor UI is bundled (hidden at runtime, no `list_physicians` call); no excluded commands | surface check |
| Logging protocol | new commands use `tracing::instrument` like their neighbours; no new log targets; refusal uses the catalogued code `MD-APP-055` (kind permission), not a free-text error | `log_targets_routed_tests`, catalogue |
| Error protocol | catalogue was stale (F10); update / support / number-block / ownership backend-text codes now **translated** (DE/FR/AR via `error-text-translations.json`) | `translated: true`; `i18n:verify` PASS |
| File size | 400-line rule broken by pre-existing files; T5.4 added 6 lines to `repos/billing/payment.rs` (1123 vs tightened baseline 1117) | `check:size` |

## 5. Updates, support files, Git

| Feature | Code + tests | Live |
|---|---|---|
| Signed update manifests per edition × flavor (T7.5) | unit tests pass (signature, kind, edition/flavor, version, `minSupported`) | **no GitHub release exists** (`gh release list` empty). 404/410 is handled as "no update". Repo has **no secrets** `TAURI_SIGNING_PRIVATE_KEY`, `MEDOC_VENDOR_SIGNING_KEY` and no variable `TAURI_UPDATER_PUBKEY` → a release today publishes no manifest and no updater package. |
| Rollout, after-hours security install, pre-update backup (T7.6) | unit tests pass | not observed |
| Support file sealed to vendor key (T7.1–T7.2) | seal/open, tamper, CLI round trip pass; `MEDOC_VENDOR_SUPPORT_PUBKEY` variable set on the repo | `MEDOC_SUPPORT_EMAIL` **wired** in `release.yml` from `vars.MEDOC_SUPPORT_EMAIL` (set the Actions variable for a non-empty mailto To) |
| Error reports, health, remote commands (T7.3–T7.4) | pass; remote commands off by design | – |
| Sync: star, origin pull, catch-up, number blocks, conflict inbox, compression | pass (medoc-sync, medoc-lan, e2e) | Docker multi-device suite not run |

## 6. Gaps closed in follow-up (same day)

| Gap | Fix | Evidence |
|---|---|---|
| Flaky backup attachment test | Assert every remaining `.files.json` after restore retention (middle same-day `.mdbk` may rotate out) | 8/8 PASS |
| Order form paid-by / approved-by / ordered-for | Schema + repo + Group pickers (`purchase-order-create-doctor-fields.tsx`) | `tsc` / eslint PASS |
| `invoice_document` signer not synced | `updated_at` column + stamp + outbox re-queue in `signing_doctor.rs` | `edition_columns`; stamp path |
| `MEDOC_SUPPORT_EMAIL` missing from release | `release.yml` env from `vars.MEDOC_SUPPORT_EMAIL` | workflow |
| F9 codes English-only | 13 templates in `error-text-translations.json`; regenerator | `translated: true`; `i18n:verify` |
| T5.6 tsc/lint/clippy | Statistics helper imports; `doctor.rs` bind fixes | `tsc`, eslint, clippy PASS |

## 7. Still open

- Live desktop UI for tasks / orders / finance with two dentists and a "Nobody" rule (needs `tools/dev-tauri.sh`). **NOT OBSERVED.**
- Docker multi-device e2e (`scripts/validate-docker-e2e.sh`): Docker was off. GATE4 **PENDING**.
- Release setup before any practice can receive an update: Tauri updater key pair, `MEDOC_VENDOR_SIGNING_KEY` secret, `TAURI_UPDATER_PUBKEY` variable, set Actions variable `MEDOC_SUPPORT_EMAIL`, a first release.
- `check:size`: ~19 files still over limit/baseline; decide split vs re-ratchet — not loosened.
- Full-workspace `cargo fmt --check` on remaining committed / other-session diffs.
