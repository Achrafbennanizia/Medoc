# Editions brief: requirements check, 2026-11-27

Source: the owner's editions brief (Solo / Duo / Group, build flags, sharing, sync, PDFs, admin, finance,
validation, logs, maintenance, tests), checked against `docs/architecture/editions-plan.md`, the code and
the test runs in `verification-2026-11-27.md`.

Status: **Done** = in code with a passing test · **Partial** = in code, part missing or not observed live ·
**Open** = not built · **Deferred** = postponed by an owner decision (§0.1 of the plan).

## A. Method and architecture

| # | Requirement (from the brief) | Status | Evidence / gap |
|---|---|---|---|
| A1 | Plan first: define features, goals, usefulness, classify them | Done | plan §1–§2 (inventory per edition), §0.1 decisions |
| A2 | Fill missing ideas from industry practice and law | Done | §5.1 law research (signing doctor), §11 ops, §7 test plan |
| A3 | Skeleton reusable for other medical fields, with patterns for the translation | **Open** | T6.1 `SpecialtyPack` / `SpecialtyModule` not started; no code found (`grep SpecialtyPack` empty) |
| A4 | One system, several products for different users | Done | `config/editions.yaml` → codegen → `CORE_CAPS` / TS `CAPS`; code checks capabilities, not edition names |
| A5 | Build-time flags; versions differ in workflow, backend services, communication, UI functions and options | Done | Cargo `cap-*` / `edition-*` features, Vite defines; `cargo check` passes for solo, duo, duo+replica, group, group+replica (this session) |
| A6 | Room to grow beyond three products | Done | editions are capability bundles in YAML; a new edition is one entry |
| A7 | Confirm Group changes with the owner before doing them | Done | §0.1 decisions Q1–Q13, Q-A…Q-E |

## B. Solo (Essentiel, 1 device)

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| B1 | No replica, sync or API exchange; local storage only | Done | `cap-net` off; `check-edition-surface.sh solo` → no leaks (this session) |
| B2 | Practice administration hidden or compiled out | Done | T2.2 / T2.5; command lists gated in `register.rs` |
| B3 | Light, fast, small, no extras | Partial | T2.6 measured binary size; **start-up time not measured**; Cabinet+ doctor-filter components are still bundled (inert) |
| B4 | UI/UX, database and services reviewed for Solo | Done | plan §6 Solo column, §4.2 |
| B5 | (decision Q1) one admin + one guest, guest changes staged, Add / Dismiss | Done | T2.3 / T2.4, guest inbox |

## C. Duo (Cabinet, 1 admin + 2 replicas)

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| C1 | Device limit 3 | Done | `seat_budget` (Duo 3/1/2), `cluster/tests.rs` seat tests, e2e `cluster_seat_caps.rs` (passed this session) |
| C2 | Conflict resolution | Done | T3.2 field merge, T3.3 conflict inbox; `field_merge_tests`, `merge_invariants_proptests` pass |
| C3 | Efficient data transfer | Done | T3.4 gzip push/pull, blob resume; `blob_resume_tests` pass |
| C4 | No doctor selection, column or filter; defaults instead | Done | `DOCTOR_CONTEXT` single-doctor; T3.5 |
| C5 | Task service and view optimized for one admin | Partial | recipient picker hidden, forward pre-selected (T3.5); no separate Duo task layout |
| C6 | Work time page, tables, statistics, backend, API, logs adapted | Partial | doctor columns hidden; **no Duo-specific log or API change** beyond sync status |
| C7 | UI components sized for 3 users | **Open** | no layout change found for a 3-person team |

## D. Group (Cabinet+, 2 admins + 3 replicas)

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| D1 | Device limit 5, 2 admins | Done | `seat_budget` Group 5/2/3, seat tests |
| D2 | Strong sync: distributed database, convergence, few conflicts | Done | T4.1 hybrid routing, T4.1b catch-up, T4.5 `five_device_convergence_proptests` (pass) |
| D3 | "Distributed indexing" | Partial | origin vectors + number blocks cover ordering and numbering; no separate distributed index design |
| D4 | Only the device that made a change sends it; initialization rules | Done | T4.1 origin-sends + `origin_pull`, T4.1b join with snapshot; tests pass |
| D5 | Data stored on both admin devices even when unused | Done | both hubs are full peers (§4.4) |
| D6 | Rectification and pairing workflow reconsidered | Partial | T4.4 takeover numbering + gap check; **re-pair = revoke + join**; recovering unsent entries from an old device not done |
| D7 | Define private vs public; what each user may set | Done | §4.5, §6.15; `domain::allowances`; `allowances_tests` |
| D8 | "Put this act to private / hide from someone" fully working | Partial | `record-privacy.tsx` on appointments, examinations, treatments, prescriptions, certificates, tasks (T5.2); **NOT OBSERVED live** |
| D9 | Only admins give access to their own data | Done | owner-only `set_my_rule` / `set_record_rule`; T4.2 owner-only rows in merge |
| D10 | Reception sees both admins or only one | Done | T5.2 staff section (per person, per area) |
| D11 | Calendar: per-doctor columns, colours, filters | Partial | T5.3: columns, chips, drag to another doctor; **no chair columns** (no rooms data); week view colours only |
| D12 | Tasks: filters and colours by doctor | Partial | doctor filter + column + sharing (T5.4, fixed this session); **no doctor colour** in task lists |
| D13 | Log architecture and change records (who, which device) | **Open** | T5.8 not started (per-author/per-device change records, per-device audit chains, maintenance view, remote log export) |
| D14 | PDFs name the doctor who treated / wrote / signed / took payment, per country law | Partial | T5.7: prescriptions, certificates, sick leave, reports, invoices; **chart extract / discharge leaflet still the practice clinician**; payment receipts name no collector |
| D15 | Administration redesigned for two admins | **Open** | only the target selector on absences and the Sharing page; no redesigned administration view |
| D16 | Finance: who paid for whom, who collected | Done | doctor + collected-by filters and columns (T5.4); tests pass |
| D17 | Orders: who ordered what, for whom, paid, approved | Partial | ordered-for stamped and filterable; **paid-by / approved-by never set; no pickers on the order form** |
| D18 | Validation: who validates what | Done | T5.5 `validation_routing_tests` |
| D19 | Same principle across backend, frontend, components | Partial | finance, tasks, orders, statistics, validation, calendar, PDFs follow it; administration, logs, audit (author + device columns) do not yet |
| D20 | Analytics: more filters, professional charts | Partial | doctor, treatment type, payment method filters; multi-doctor series; **full chart redesign not done** |
| D21 | Two legal entities ("2 different certificates") | Deferred | Q3: one legal entity for now; `units` capability later |
| D22 | Preferences and personalization per person | Partial | target selector "me / Dr B / both" on absences; **working hours still use the old profile picker** |
| D23 | Safety, conflict follow-up, who did what, error logging | Partial | conflict inbox, audit, error reports (T7.3) done; per-author change history is T5.8 (open) |
| D24 | Statistics and activity: broad view of everything | Partial | per-doctor statistics and dashboard tiles; no activity feed |
| D25 | Maintenance view: identify and localize errors | Partial | health summary + Help → Support (T7.4); **per-device maintenance view (§6.10) open** (T5.8) |

## E. Operations and delivery

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| E1 | Updates per edition from GitHub | Partial | signed manifests + rollout tested; **no release published; signing secrets and `TAURI_UPDATER_PUBKEY` not set on the repo** |
| E2 | Support file to vendor | Partial | sealed bundle tested; **`MEDOC_SUPPORT_EMAIL` not passed in `release.yml`** |
| E3 | Updates to replicas from the main, offline USB package | **Open** | T7.7 not started |

## F. Tests ("all needed tests")

| Plan §7 line | Status |
|---|---|
| Build matrix, 5 builds | Done (local `cargo check`; CI matrix exists per T0.5) |
| Compiled-out proof | Done (surface check, Solo) |
| Size / perf budget per edition | Partial (size only) |
| Capability unit tests | Done |
| Guest inbox | Done (per T2.4) |
| Sync property tests 3 / 5 devices | Done (pass) |
| Multi-device e2e with real processes | Partial: in-process and two-process TLS pass; Docker multi-device suite not run (Docker off) |
| Allowances matrix | Partial: per-area tests (payments, tasks, orders, statistics, validation, appointments); no generated full matrix |
| Migration / upgrade Solo → Duo → Group | **Open**: only `edition_columns_tests.rs` |
| Playwright per edition (nav, no doctor UI in Solo/Duo, Group calendar, Allowances, RTL) | **Open**: only `lan-server.spec.ts` exists |
| PDF signing resolution | Done (`second_doctor_signs…`, letterhead test) |
| Operations (seal, update signature, remote commands) | Done |
| Security (Solo open-port scan, admin B cannot change A's rules) | Partial: owner-only rule tests exist; port scan not run |

## G. Open items needing an owner decision before work

1. **T5.8 change records + maintenance view** (D13, D23, D25): largest remaining Group gap.
2. **Administration redesign for two admins** (D15): needs a design brief; none exists.
3. **Order form pickers** (D17): who sets paid-by / approved-by, and when (on payment? on approval status?).
4. **T6.1 specialty layer** (A3): when to start; it touches many modules.
5. **Duo 3-person layout** (C7): which components (calendar header, team cards, task board?).
6. **Release setup** (E1, E2): generate and store the Tauri updater key pair and the vendor signing key; set `MEDOC_SUPPORT_EMAIL`.
7. **Tests**: Playwright per edition and the Solo → Duo → Group upgrade test.
