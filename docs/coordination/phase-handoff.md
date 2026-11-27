# Phase handoff

**Last phase label:** Verification §6 gap close (2026-11-27)

### Verified

- Closed `docs/coordination/verification-2026-11-27.md` §6 gaps: backup flake (8/8 PASS), order-form doctor pickers, `invoice_document` signer re-queue + `updated_at`, `MEDOC_SUPPORT_EMAIL` in `release.yml`, F9 error DE/FR/AR (`i18n:verify` 6813×4), statistics tsc/eslint/clippy.
- `purchase-order-create` helpers extracted so create page stays under its size baseline.

### Remains unverified

- Live desktop UI / Docker GATE4. **NOT RUN**. Release secrets / first release. `check:size` still red (~19 other files). Full-tree fmt **NOT RUN**.

### Required next

1. Do not commit unless asked.

---

**Previous last phase label:** Product site merge + package rename (2026-11-27)

### Verified

- Merged sifralabs `/medoc/` series framing into `website/` home (`SeriesBand`, `MoroccoStrip`, pilot; dropped Explore/Highlights from home).
- Slimmed `sifralabs/medoc/` to series hub with deep links; fixed `partials/cta.html` `#contact` → `#/demo`.
- Renamed npm workspace package `medoc-product-website` → `medoc-dentist` (scripts, workflow, locks). GH Pages path stays `/Medoc/` (repo name).
- Builds: `npm run build -w medoc-dentist` **PASS**; `npm run build --prefix sifralabs` **PASS**.

### Remains unverified

- Live browser pass of merged home EN/FR/AR. **NOT OBSERVED**.
- Deploy to GitHub Pages / sifralabs.com. **NOT RUN**.

### Required next

1. Do not commit unless asked.
2. Optional: preview both builds locally.

---

**Previous last phase label:** Verification pass T5.4 + editions requirements check (2026-11-27)

### Verified

- Details and commands: `docs/coordination/verification-2026-11-27.md`; brief vs code: `docs/coordination/editions-requirements-check-2026-11-27.md`.
- Fixed: task owner could be a receptionist; admin task list filtered after the 500 limit; signing doctor on `issued_document` not synced (`recorded_write_guard` was red); finance orders under "Collected by"; unshared doctors offered in filters; misleading empty states; 3× duplicated sharing scope → `commands/share_scope.rs`; stale error catalogue (16 codes added).
- New tests: ownership (tasks, orders), task SQL scope, order scope, collected-by filter, UI↔`register.rs` wiring, 3 TS component/unit/contract suites. Vitest 642 pass; medoc-core lib 317 pass; sync/LAN/support/e2e (in-process) pass; 5 edition builds compile.

### Remains unverified

- Live desktop UI (two dentists, "Nobody" rule). **NOT OBSERVED**. Docker multi-device e2e **NOT RUN** (Docker off).
- `backup_tiers_tests::attachments_are_backed_up…` flaky (1 in 3), untouched.
- Other session's in-flight files fail tsc/lint/clippy/fmt (`statistics-multi-doctor-charts.tsx`, `statistics-overview-filters.tsx`, `statistics/doctor.rs`, `number_sequence.rs`).

### Required next

1. Owner decisions in the requirements check §G. 2. Do not commit unless asked.

---

**Previous last phase label:** Guest health/docs/orders polish (2026-11-27)

### Verified

- Health summary now includes `os`/`osArch`/`osFamily`, `errorsByArea7d`, and log file facts (`logs.errors`/`app`/`client`); Help → Support shows OS + logs. Solo `cargo check` **PASS**.
- Guest documents read is a **separate** Settings switch (`documentsRead`); clinical no longer bundles documents. Templates: `solo.guest` / `_clinical` / `_documents` / `_clinical_documents`.
- Guest orders: create refused (`error.guest.order_create_forbidden` = MD-APP-057); receive/confirm via `purchase_order.receive`. New-order CTA blinded for guests.
- Guest login without email (Solo only) already present; Duo/Group have no `guest_inbox` — confirmed exclusive in editions.yaml; Duo check **PASS**.
- Font segment wraps/ellipsizes; guest security card overflow visible.
- `guest_inbox_tests` **5 PASS**; `i18n:verify` **6798×4**; arabic-numerals + document-export-locale **PASS**.

### Remains unverified

- Live Solo UI for guest calendar/cash/orders and Appearance/Font in FR. **NOT OBSERVED**.
- Full Arabic writing-rules pass beyond existing unit tests. **LOW CONFIDENCE**.
- App size growth / every setInterval cleanup audit — spot-checked only (dev-capture loop is DEV-only).

### Required next

1. Do not commit unless asked.
2. Optional: browser Solo guest pass.

---

# Phase handoff

**Last phase label:** Punch-list audit + guest clinical redaction fix (2026-11-27)

### Verified

- **Guest clinical option ("Peut consulter le dossier clinique"):** UI + i18n + `solo.guest_clinical` + `guest_inbox_tests::clinical_read_switch` were already wired. **Bug found:** `list_treatments` / `list_examinations` always redacted for `RECEPTION`, so the switch granted the tab but stripped clinical fields. Fixed in `reception_redact.rs` (honour `patient.read_medical` overrides) + chart command call sites. Unit tests **PASS** (4).
- **`backup_tests`:** `--no-run` **PASS** (still matches current retention API).
- **`sync_mesh_harness`:** failed on missing `CreateAbsence.staff_id` → set `None`; `--no-run` **PASS**.
- **Clippy `medoc-core` `--lib` / `--all-targets -D warnings`:** **PASS** (no cash_book/issue failures on current toolchain).
- **`main.tsx` 127.0.0.1:7291:** already removed; grep clean.
- **`npm run check:size`:** 14 oversized files (not 36); mix of website + app growth — not split this session.
- `cargo check -p medoc-practice` **PASS** (after redaction fix).

### Remains unverified

- Folding Administration into Settings / Solo nav rename — needs live Solo UI. **NOT OBSERVED**.
- Cold start on packaged app / reference machine. **NOT OBSERVED**.
- Solo licence / guest flow in running app. **NOT OBSERVED**.
- Full `cargo check --workspace --all-targets` (only the two named targets + medoc-practice checked).
- Commit of P1+P2 — not requested.

### Understanding delta

Punch list from prior review: most items already fixed or deferred by plan; one real functional bug remained (guest clinical redaction) and one compile break (`staff_id` on absence in e2e harness).

### Required next

1. Do not commit unless asked.
2. Optional: live Solo pass for guest clinical switch + Admin/Settings.
3. Optional: reclaim file-size baselines after T5 growth (`cash_book` / `issue` / UI pages).

---

**Previous last phase label:** Editions T5.2 / T5.7 / T5.3 / T5.6 polish (2026-11-27)

### Verified

- **T5.2:** RecordPrivacy on examination, treatment, prescription, certificate, practice task; Sharing Chosen + staff section; `StaffTargetSelector` on work-days; `absence.staff_id`.
- **T5.7:** Clinical letterhead strips personal IDs; signing doctor on reports/invoices; certificate SICK_LEAVE path already stamped.
- **T5.3:** Drag to another doctor column updates `physician_id`; week shows doctor name.
- **T5.6:** treatment/payment filters + `per_doctor_series` multi-line charts (UI + backend).
- `cargo check -p medoc-practice` **PASS**; `clinical_letterhead_omits_personal_clinician_ids` **PASS**; `statistics_doctor_tests` **PASS**; `tsc --noEmit` **PASS**; calendar pack vitest **PASS**.
- `docs/architecture/editions-plan.md` updated.

### Remains unverified

- Live browser for Sharing staff, privacy controls, calendar drag, statistics filters. **NOT OBSERVED**.
- ChartExtract/discharge signing doctor; chair columns; professional-charts redesign.

### Required next

1. Do not commit unless asked.
2. Optional: browser pass on Group sample data.

---

# Phase handoff

**Last phase label:** Live site product screens (2026-11-22)

### Verified

- Worktree site `.claude/worktrees/medoc-website-launch-a7a03b/website`: product sections are real screenshots in FR/AR/EN/DE. `npm run build` (`tsc --noEmit && vite build`) succeeded.
- On `http://127.0.0.1:4173`: EN light/dark, MAD prices (24,900 / 29,900 / 34,900 and 110 / 290 / 540), AR `dir=rtl`, 24 product images, 0 broken. Clinique copy is one dentist login. In preparation lists AMO/NGAP, 2FA, DICOM, and more than one dentist account.
- Examination composer on the running app shows the selected-tooth card (number, status pill, note). Saving a new exam on demo patient `seed-yr-pat-0152` recorded `U-2026-001`.

### Remains unverified

- Native read of Arabic and German. **NOT RUN**.
- Legal footer pages are still anchors. Contact mail is still `demo@example.com`.
- Two older MeDoc windows were left blank when Vite on port 1420 restarted. **NOT OBSERVED** after that. Reload them if they are still white.

### Required next

1. Reload the other MeDoc windows if they are blank.
2. Real e-mail and WhatsApp before the site is public. Do not commit unless asked.

---

**Previous last phase label:** Worktree cleanup — keep medoc-website (2026-11-22)

### Verified

- Main checkout `fix/finance-workflows` fast-forwarded to UI/UX tip `0605c37` (was `fcae8af`). Brought in: API failure logging (`19b0b1d`) + cleanup of one-off i18n scripts/dumps/credentials (`0605c37`).
- Ported uncommitted **app** work from `medoc-website-launch` into main working tree (not committed): dental chart/CSS/odontogram, locale keys, `docs/launch/*`. Skipped temp `zz_tmp_sql_runner.rs`.
- Removed inactive worktrees: `five-skills-integration-9aadac`, `git-config-push-issue-4cb067`, `magical-dhawan-8eea48`, `mystifying-brattain-5a61f1`, `ui-ux-architecture-refactor-ea9775`.
- Kept: `.claude/worktrees/medoc-website-launch-a7a03b` (website WIP still dirty there).
- Remaining worktrees: main + `medoc-website-launch-a7a03b` only. Local Claude branches deleted except `claude/medoc-website-launch-a7a03b`.

### Remains unverified

- Ported dental/launch files on main are **uncommitted**. **NOT RUN**: commit.
- Website worktree still at `fcae8af` with dirty website + app copies; not rebased onto `0605c37`.
- Full test suite after FF. **NOT RUN**.
- Five-skills unique commits (`44ccdc6`, `3d48e85` + untracked `.claude/skills`) intentionally discarded (agent tooling, not product).

### Required next

1. Commit or discard ported dental/`docs/launch` changes on `fix/finance-workflows` when ready.
2. Optionally rebase/update `medoc-website-launch` onto `0605c37` and finish website WIP.
3. Optional: clear `medoc-website-launch/.../target` (~16G build cache) if disk pressure continues.

---

**Previous last phase label:** Fix Practice tasks + Patient records filters (2026-11-20)

### Verified

- **Select:** choosing a portal option called `onChange` twice (explicit value, then a native event that could report the previous controlled value) — now once. Portal menu also mounts while measuring.
- **Patient records:** IN_TREATMENT / INVOICE_OPEN / CHART_OPEN / CLOSED tabs used page-1 + client filter → empty list while counts stayed >0. Those tabs now load the full matching set.
- Vitest `patient-status-filter` + prior display tests: **PASS**; `tsc --noEmit`: **0 errors**.

### Remains unverified

- Live click-through on running MeDoc windows. **NOT OBSERVED** (Computer Use permissions off).
- Full `cargo test --workspace`. **NOT RUN**.

### Required next

1. Practice tasks: pick type/view filters — list must update to matching rows.
2. Patient records: open each status tab — rows must appear when the count is >0.

---

**Previous last phase label:** UI prefs anti-regression harden (2026-11-20)

### Verified

- Root cause closed: shared-origin `localStorage` no longer wins on boot. Boot order hydrates `ui-prefs.json` **before** importing i18n/client-settings.
- Zustand rehydrate respects disk locale authority; `setLocale` / `saveClientSettings` await/queue file writes; calendar workflow sync also writes the file.
- Regression: Rust ui_prefs **4 PASS**; Vitest `ui-prefs.controller.test.ts` **2 PASS** (file wins over polluted LS).
- Both instances rebuilt/restarted.

### Remains unverified

- Manual UI refresh check after changing language once (to pin locale into file if missing). **NOT OBSERVED**.
- Full `cargo test --workspace`. **NOT RUN**.

### Required next

1. Live-check: set language + Appearance → refresh → hold; independent per instance.
2. Continue removing duplicated rules.

---

**Previous last phase label:** One assignee notice (2026-11-20)

### Verified

- A remote practice-task insert fills a missing assignee notification with the same title, body, and payload as a local create, including `service_name`.
- The gap-fill still skips the creator, skips staff who are not on this device, skips a notice that already exists, and does not write an outbox row.
- `cargo test -p medoc-core --offline --lib practice_task_sync_notify` **PASS** (1).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Billing task title (2026-11-20)

### Verified

- A new automatic billing task stores the service name as its title (empty when there is no service). The body is that name, or `Service (12.00 EUR)` / `(12.00 EUR)` when an amount is known. It no longer stores the English sentence `Record payment`.
- The task list, dashboard, inbox, comments, and billing notifications add the translated “Record payment” heading from `kind` and `service_name`. Older rows that still start with `Record payment`, `Payment erfassen`, or the other stored prefixes still display the same way.
- A billing task someone typed, whose title is not the service name, stays as written.
- `cargo check -p medoc-core -p medoc-practice --offline --lib` **PASS**. Vitest finance-order labels and notification display **PASS** (9).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One app data directory (2026-11-20)

### Verified

- Desktop commands that fail when the app data directory is missing call `commands::app_data_dir`. The cluster watch still falls back to a home path when the directory cannot be resolved.
- `cargo check -p medoc-practice --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules. Billing tasks still store the English title `Record payment` / `Record payment: {service}`; the client rewrites that prefix. Changing the stored title changes the task list unless the display knows the task kind.

---

**Previous last phase label:** Ticket notice label (2026-11-20)

### Verified

- A practice ticket notice title is the patient name. The client adds the translated heading. The body stays the ticket text.
- Chart review and ticket creation each load the patient once.
- `cargo check -p medoc-practice --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Chart and hint notices (2026-11-20)

### Verified

- A fulfilled appointment hint stores the patient name and an empty body. The date and time stay in the payload. The client writes the sentence.
- A chart review stores the patient name, or the sender when the patient name is empty. The body is only the note.
- Older English rows still display from their payload.
- `cargo check -p medoc-core -p medoc-practice --offline --lib` **PASS**. Display vitest **PASS** (3).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One status notice (2026-11-20)

### Verified

- `status_notice` builds the title, the note, and the payload when a task is completed or returned. An empty note stays empty.
- `notify_except` writes that notice for every recipient except the person who made the change. A new task uses it too.
- `cargo check -p medoc-core --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One task notice payload (2026-11-20)

### Verified

- `task_notice_payload` is the JSON for an assigned, completed, or returned task. A completed notice now includes `status`, which the client does not read.
- `cargo check -p medoc-core --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One task assignee notice (2026-11-20)

### Verified

- `assignee_recipients` chooses the assigned user, or every reception account when the role is reception.
- `assigned_notice` builds the title, body, and payload for a new task. Creating the task and notifying later both use it.
- `cargo check -p medoc-core --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Task notice label (2026-11-20)

### Verified

- A task notification title is `notice_label`: the patient name, or the task title when the patient is unknown. The client adds the translated heading.
- Display vitest **PASS** (3). `cargo check -p medoc-core --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Task notice fallback (2026-11-20)

### Verified

- A completed or returned task with no note stores an empty notification body. The client supplies the translated sentence.
- Notifications already stored with the old English sentences are still recognized.
- Display vitest **PASS** (3). `cargo check -p medoc-core --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One invoice cent conversion (2026-11-20)

### Verified

- `moneyToInvoiceCents` is the client conversion from euros to invoice cents. Reading a stored line and appending a legacy invoice both use it.
- The server still has its own guard in `issue.rs` before `pricing::euros_to_cents`.
- Related vitest **PASS** (7). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One outside-hours message (2026-11-20)

### Verified

- `outsideHoursItemCopy` builds the title and body for an hours conflict. The stored notification and the later display use it. A time with seconds is stored as `HH:MM`.
- Related vitest **PASS** (12). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One outside-hours reason (2026-11-20)

### Verified

- `outsideHoursReasonLabel` in `appointment-hours-compliance.ts` is the label for absence, closure, break, and other hours conflicts. The scan notification and the later display both call it.
- The scan window uses `addCalendarDays`.
- Related vitest **PASS** (12). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One calendar-day span (2026-11-20)

### Verified

- Inclusive day counts and “add days” use `inclusiveCalendarDays` and `addCalendarDays`. A certificate end date is a calendar day, not a UTC instant.
- Clinical printouts share `formatWrittenDay` (`DD.MM.YYYY`). The noon workaround used only to format a date is gone.
- Related vitest **PASS** (16). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One display date (2026-11-20)

### Verified

- `formatDate` uses `parseDisplayDate`. A value `yyyy-MM-dd` stays that calendar day. Any other timestamp goes through `parseDbUtc`.
- License dates use the same read before they call `formatDate`.
- Related vitest **PASS** (28). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Database timestamp callers (2026-11-20)

### Verified

- `parseDbUtc` is only defined in `utils.ts`. Day close no longer re-exports it.
- Notifications, the pairing request time, and the calendar “edited” check read timestamps through it.
- Related vitest **PASS** (15). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One database timestamp (2026-11-20)

### Verified

- `parseDbUtc` lives in `utils.ts`. `formatDateTime` and `formatDbTime` use it, so a timestamp without a zone is UTC.
- Cash close rows and the dashboard cash clock use `formatDbTime`. The close form no longer adds the day and month in that time column.
- Related vitest **PASS** (26). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One payment-counts rule (2026-11-20)

### Verified

- Cash close and the daily report use `paymentCountsTowardPaid` in `payment-booking.ts`. A cancelled payment is left out of cash, posted income, and the report lines.
- Related vitest **PASS** (15). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One appointment clock parse (2026-11-20)

### Verified

- The calendar uses `timeToMinutes` in `appointment-availability.ts`. An unreadable time is 08:00. The copied parser is gone.
- Practice-hours validation still returns `NaN` for an unreadable time so it can report `invalid_time`.
- Related vitest **PASS** (10). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One planned-appointment rule (2026-11-20)

### Verified

- `appointmentCountsAsPlanned` in `appointment-domain.ts` is the check that a cancelled or no-show row does not occupy the schedule. The calendar, the hours scan, and the slot grid call it.
- The same-time conflict check still skips only `CANCELLED`, matching the server.
- Related vitest **PASS** (22). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One date and money format (2026-11-20)

### Verified

- License dates and the portal fee use `formatDate` and `formatCurrency`. Report “generated at” stamps, including an import that has none, use `formatDate` as well.
- A task-drawer check compared a status to `VIEWED` after that status was already excluded. The extra check is gone. Marking a viewed task done is unchanged.
- Report vitest **PASS** (10). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Euro parser next to currency format (2026-11-20)

### Verified

- `parseEuroInput` lives in `utils.ts` beside `formatCurrency`. Cash close, contracts, payments, treatment cost, product price, and exported-grid sorting call it from there.
- Related vitest **PASS** (18). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One euro input parser (2026-11-20)

### Verified

- Typed money amounts go through `parseEuroInput` in `day-close.ts`. Payment create and edit, the treatment cost, and the product price use it. `1.234,56` is 1234.56.
- Related vitest **PASS** (11). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One id hue (2026-11-20)

### Verified

- An id’s avatar color is `hueFromId` in `utils.ts`. Patient avatars and the work-plan lanes use it. The unused `hueForStaff` helper is gone. The work-plan page no longer keeps a second hash.
- Related vitest **PASS** (10). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One name initial (2026-11-20)

### Verified

- Avatar letters are `initialsFromName` in `utils.ts`. The dashboard, staff list, work plan, patient grid, and the account menu use it. A name uses the first and last word. A single name uses its first two letters. An empty name is `?`.
- Related vitest **PASS** (6). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One clock label (2026-11-20)

### Verified

- Minutes from midnight become `HH:MM` through `minutesToTime` in `utils.ts`. The work plan, practice hours, compliance scan, and time-slot picker use it. `minToLabel` is gone.
- `hmToMinutes` in `practice-planning.ts` is the shared clock parse that treats a missing part as 0. The compliance scan uses it.
- Appointment booking still maps an unreadable time to 08:00. Work-hours validation still returns NaN for an unreadable time so it can report `invalid_time`.
- Related vitest **PASS** (48). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Local calendar day aliases removed (2026-11-20)

### Verified

- `localIsoDate` is the only local `yyyy-MM-dd` formatter. `ymd`, `formatIsoDate`, `todayYmd`, and `localComplianceIsoDate` are gone. Work plan, calendar range, contracts, cash, invoices, and the period screen call it directly.
- `ymdInTimeZone` stays. It is the practice time zone, which is a different day.
- Related vitest **PASS** (28). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One local calendar day (2026-11-20)

### Verified

- A local calendar day `yyyy-MM-dd` is `localIsoDate` in `packages/shared/src/lib/utils.ts`. Work-plan dates, the calendar range, contract “today”, period bounds, compliance stamps, chart and discharge filenames, and the practice-timezone fallback use it.
- Related vitest **PASS** (38). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** One chart number sequence (2026-11-20)

### Verified

- The next `B-{year}-{nnn}` treatment number and the next `U-{year}-{nnn}` examination number both come from `previewNextYearNumber` in `patient-detail-utils.ts`.
- Unused output aliases `CreatePatientInput` and `CreateAppointmentInput` are removed. Write calls still use `z.input` of the schemas.
- Related vitest **PASS** (20). Practice-host `tsc --noEmit` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Write payloads follow schemas (2026-11-20)

### Verified

- Practice-host create and update calls take `z.input` of the Zod schema in `packages/shared/src/lib/schemas.ts`. The second handwritten field lists are gone.
- Appointment kind and status, patient sex, and staff role are the schema enums at the form that sends them. Editing an appointment no longer sends `patient_id` on undo; that field is not in the update schema.
- `tsc --noEmit` **PASS**. `schemas.test.ts` **PASS** (11).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules.

---

**Previous last phase label:** Reception pending tasks + note-as-task (2026-11-20)

### Verified

- Reception dashboard left card is **Pending tasks** (`listPracticeTasksForMe`, OPEN/IN_PROGRESS/BACK); click → `/tickets?task=id`. Planned-appointment freigabe removed from that card.
- Physician **Task for reception** is a practice-task composer (kind/title/body → reception pool); reception no longer sees plan-next controls.
- Vitest actionable filter + locale parity **13/13 PASS**.

### Remains unverified

- Live GUI send → dashboard → complete → row gone. **NOT OBSERVED**.

### Required next

1. Manual smoke of physician send → reception Pending tasks → Done/Validate.

---

**Previous last phase label:** One treatment line name (2026-11-20)

### Verified

- A treatment’s display name is `treatmentLineLabel` in `clinical-service-label.ts`: service, then description, then kind. Payment links, invoice lines, the receipt price lookup, the continue label, and the treatment table use it.
- An examination’s display name for payment links and invoice lines is `examinationLineLabel`: service, then diagnosis.
- A row is released for billing only through `billing-release.ts`. The chart helper passes the row’s two fields into that function. A physician id that is only spaces is not a release.
- Related vitest **PASS** (20). Practice-host `tsc --noEmit` **PASS**. The dashboard patient lookup is a map of patients, the same shape `taskPatientLabel` already uses.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Continue removing duplicated rules. The practice-host typecheck is green.

---

**Previous last phase label:** One booking tolerance (2026-11-20)

### Verified

- `pricing::PAYMENT_BOOKING_TOLERANCE_EUR` (0.005) is the “a payment has started” cutoff. Payment booking and chart line deletion use it. The practice app uses `PAYMENT_EUR_EPS` for the same cutoff, including the billable-line hint.
- `pricing::MONEY_ZERO_EUR` (1e-6) is the “treat as zero” cutoff. Payment status and the paid-line check use it.
- `cargo check -p medoc-core --offline --lib` **PASS**. `billing-open-booking.test.ts` **PASS** (3).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** One euro-to-cents conversion (2026-11-20)

### Verified

- `pricing::euros_to_cents` is the plain euro-to-cents conversion. Cash closing, the legacy day-close command, contract pro-rata, and delivered purchase orders use it. Invoice lines still use `money_to_invoice_cents`, which can raise a tiny positive amount to 1 cent.
- `cargo check -p medoc-core -p medoc-practice --offline --lib --tests` **PASS**. `euro_formatting` and `contract_pro_rata` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** One euro rounding function (2026-11-20)

### Verified

- Cent rounding of euro amounts is `pricing::round_money_2`. The payment repository and the balance overview no longer repeat `(n * 100.0).round() / 100.0`.
- `cargo check -p medoc-core --offline --lib` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** One payment-method label (2026-11-20)

### Verified

- `paymentStatusDisplay` and `paymentMethodLabel` live in `finance-order-labels.ts`. The `payment-booking` copies and `paymentMethodLabelFin` are gone. Finance export uses `enum.payment_method.bankTransfer`, which is the catalog key.
- `loadPracticePreferences()` and `hydratePracticePreferencesFromKv()` are gone. Settings calls `loadPracticePreferencesFromKv`. `inbox.tsx` is gone; `/inbox` still redirects to `/tickets`.
- `tsc --noEmit` **PASS**. Label and document-export vitest **PASS** (8).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Unused print HTML and deprecated aliases removed (2026-11-20)

### Verified

- The HTML print builders and the `medoc-practice-logo-v1` cache are gone. Practice logo stays in app KV `practice.logo.v1`.
- Deprecated aliases with no callers are gone: HTML filenames, German invoice/slot/date helpers, untranslated select lists, `ChartExportDialog`, `PatientSexSchema`, the auto-record work-time wrappers, and `deleteBalanceSheetSnapshot`.
- `apps/practice-host-ui` `tsc --noEmit` **PASS**. Billing and document-export vitest **PASS** (7).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Activation + recovery UI locale + build version (2026-11-20)

### Verified

- USB activation app (`medoc-usb-setup`) and recovery UI (`medoc-recovery-ui`): EN/DE/FR/AR switcher; chrome via `ui_i18n`; build line from `CARGO_PKG_VERSION`.
- Practice license gate: `LocaleSwitcher` + `VITE_APP_VERSION`; Help About passes version.
- Tests: `ui_i18n` **PASS** in both crates; `cargo check -p medoc-usb-setup -p medoc-recovery` **PASS**.

### Remains unverified

- Live GUI of both egui windows. **NOT OBSERVED**.

### Required next

1. Optional smoke: open USB Setup + Recovery, switch AR/FR, confirm Build line.

---

**Previous last phase label:** Document export locale consistency (chart / Rx / cert / invoice / receipt) (2026-11-20)

### Verified

- Root causes: (1) chart PDF labels were de/en-only leftovers; (2) invoice issuer forced `locale="de"` + German chrome; (3) HTML print (`document-print-html`) used UI `useLocale` while PDF layouts used `documentLocale()`; (4) rehydrate/login did not keep documents LS ↔ KV aligned.
- Fixes: chart `l()`/`pick` 4-locale + leftover `de` removed; invoice `document_locale` + localized GOZ chrome; HTML builders → `documentLocaleForI18n()`; `hydrateDocumentLocaleFromAppKv` on login; i18n rehydrate mirrors document LS/KV.
- Tests: `invoice_goz` **8/8 PASS** (incl. locale chrome); chart label locale **PASS**; Vitest document-export-locale + print/receipt **8/8 PASS**; `cargo check -p medoc-core` **PASS**.

### Remains unverified

- Live GUI: switch UI language to FR/AR and export all five documents. **NOT OBSERVED**.
- Already-issued invoice reprints still return stored bytes (immutable) — by design; new issue/preview follow locale.

### Required next

1. Manual smoke: Settings language de/en/fr/ar → patient chart, Rx, certificate, new invoice, receipt.

---

**Previous last phase label:** Practice currency + timezone UI refresh (2026-11-20)

---

**Previous last phase label:** Arabic PDF shaping + leftover English (2026-11-20)

---

**Previous last phase label:** Safe Bridge Revision v2 (2026-11-20)

### Verified

- ADR v2: Bridge C = printed random practice share (forgotten passphrase); vendor seal = X25519 ECDH + HKDF + XChaCha20-Poly1305 with AAD; KCV + `key_id`; per-device keys; auth ticket audit-only.
- `medoc-keygen` emits share v2 + printable sheet; verify **PASS**.
- Rust `medoc-recovery` workspace member: recover A/B/C, write-wrap (no keychain), verify-db on copy, gated export. `smoke-bridges-v2.sh` **PASS**.
- `db_key` KCV + password-policy wrap + backup sidecars; unit tests **8/8 PASS**.

### Remains unverified

- Live UI Bridge B gate. **NOT OBSERVED**.
- Full `cargo test --workspace`. **NOT RUN**.

### Required next

1. Dry-run Bridge C with printed sheet on clean app-data.
2. Confirm backup sidecars when wrap exists.

---

**Previous last phase label:** PDF i18n — all document locales (2026-11-20)

### Verified

- Document locales `de` / `en` / `fr` / `ar` (pin `documents.locale.v1` or follow UI).
- TS `document.print.*` key parity: **126 keys × 4 locales**.
- Clinical layouts already used `documentLocale()` + RTL for `ar`.
- Chart/report chrome now uses full `pdf/i18n.rs` (was de/en only). Cash-book + period-report labels use `pick()` for all four locales.
- Receipt amount formatting: `en-GB` / `fr-FR` / `ar-EG-u-nu-latn` / `de-DE`.
- Vitest receipt + clinical PDF + locales **16/16 PASS**. Rust phrase + chart chrome + receipt 4-locale **PASS**.

### Remains unverified

- Live GUI export with document locale `fr` / `ar`. **NOT OBSERVED**.
- GOZ invoice + payment reminders stay German by design. **INTENTIONAL**.

### Required next

1. Optionally set document language to FR/AR in Settings and print a receipt + chart.

---

**Previous last phase label:** Notification list full i18n (en/de/fr/ar) (2026-11-20)

### Verified

- All displayed in-app notification kinds localize via `localizeInAppNotification` (tasks, plan hint, chart forward, ticket, outside-hours, seed STOCK/SYSTEM/…).
- Locale catalogs include matching keys; vitest display + i18n **14/14 PASS**. Rust payloads enriched with `patient_name` / dates; `cargo check -p medoc-core -p medoc-practice --lib` **PASS**.

### Remains unverified

- Live language switch while Notifications popover is open. **NOT OBSERVED**.

### Required next

1. Switch UI language and open Notifications to confirm titles/bodies follow locale.

---

**Previous last phase label:** Safe Bridge Architecture + medoc-recovery (2026-11-20)

### Verified

- ADR + JSON schemas under `docs/architecture/safe-bridge-recovery.md` and `docs/architecture/schemas/`.
- `medoc-keygen` emits Bridge C `practice-recovery.share.v1.json` + `vendor-recovery.share.v1.json` (XOR split); verify proves A db_key == practice⊕vendor and vendor-alone ≠ db_key.
- `installer/medoc-recovery` CLI: bridges A/B/C, export-key, rehydrate, verify-db, auth-check. Smoke script **PASS**. Rust `db_key` tests **6/6 PASS** including Bridge B C++↔Rust wrap interop.
- Bridge B mandatory via `bridge_b_passphrase_required` + `DbSetupGate` checklist; `provision_user_passphrase` wraps existing activation key. `cargo check -p medoc-sync -p medoc-practice` **PASS**.

### Remains unverified

- Live onboarding click-path after activation → Bridge B gate. **NOT OBSERVED**.
- `auth-check` with a real vendor-signed ticket. **NOT RUN** (schema + verifier only).
- Full `cargo test --workspace`. **NOT RUN** (disk pressure).

### Required next

1. Manually import activation then confirm passphrase gate + checklist.
2. Mint a sample `medoc-recovery-auth.v1` ticket for ops dry-run of `auth-check`.

---

**Previous last phase label:** Notification list copy + newest-first (2026-11-20)

### Verified

- Notifications list merges tasks + in-app rows and sorts by timestamp **newest → oldest**.
- Outside-hours copy rewritten (summary + per-appointment); dates formatted for display; body wraps up to 3 lines.
- Display rehydrates outside-hours text from payload + current locale. Vitest compliance + i18n **19/19 PASS**.

### Remains unverified

- Live popover after a fresh compliance scan. **NOT OBSERVED**.

### Required next

1. Trigger a schedule edit or clear the daily stamp, then open Notifications and confirm order + wording.

---

**Previous last phase label:** Daily appointment↔hours compliance precaution (2026-11-20)

### Verified

- Precaution scan runs at least once per local calendar day via `runDailyAppointmentHoursComplianceIfDue` (localStorage day stamp; stamp only on success).
- Wired in `PracticeWorkHoursBackground`: on login, every 15 min, and on tab visibility; schedule edits still force `notifyAppointmentsOutsideWorkHours` (bypass day stamp).
- Non-working classification: `classifyAppointmentHoursBlock` → `absence` | `closure` | `break` | `outside_hours`; notification bodies use reason i18n keys.
- Vitest: `appointment-hours-compliance.test.ts` **9/9 PASS**; `i18n-locales.test.ts` **10/10 PASS**.

### Remains unverified

- Live UI: next-day (or cleared stamp) login shows Notifications without editing hours. **NOT OBSERVED**.

### Required next

1. Optionally clear `medoc.appointment_hours_compliance.day.v1` in DevTools and confirm one scan + notifications.

---

**Previous last phase label:** Thursday extended hours booking merge (2026-11-20)

### Verified

- Root cause: `resolveBookingWorkHoursForPhysician` replaced practice day segments with a doctor profile’s active day, so a stale shorter doctor Thursday hid practice evening extensions from drag-snap and New appointment slots (calendar still drew practice-open evening).
- Fix: when practice and doctor days are both active, open segments are the **union** (`unionWorkSegments`). Practice baseline times stay bookable; doctor-only early windows still add.
- Regression suite `appointment-hours-extended-day.test.ts` covers late Thursday, stale doctor, early Wednesday union, split segments, Saturday omit, closure, holiday, busy evening slot. **25/25 PASS** with drag-snap + slot-grid + compliance.

### Remains unverified

- Live UI drag into Thursday evening after Opening hours save. **NOT OBSERVED**.

### Required next

1. Reload the running app (or restart Vite + MeDoc) and confirm Thursday evening slots + drag.

---

**Previous last phase label:** Blank first-instance webview — Vite IPv6 vs Tauri IPv4 (2026-11-20)

### Verified

- Cause of blank MeDoc window in dev: Vite listened on `[::1]:1420` only; Tauri/`localhost` used `127.0.0.1` → connection refused → empty webview. Proven with `lsof` + IPv4 connect FAIL / IPv6 OK.
- Fix: default Vite `host` to `127.0.0.1`; `tauri.conf.json` `devUrl` → `http://127.0.0.1:1420`; `tools/dev-tauri.sh` health-checks **IPv4** (`curl -4`) and exits if Vite is not reachable on `127.0.0.1:1420`.
- After restart, Vite listens on `127.0.0.1:1420`; `curl -4` returns 200.

### Remains unverified

- User Cmd+R / relaunch of the first window after the Vite restart. **NOT OBSERVED** from this agent.

### Required next

1. Reload or relaunch the first MeDoc window so it picks up `http://127.0.0.1:1420`.

---

**Previous last phase label:** Work-hours compliance notifications + two instances (2026-11-20)

### Verified

- After Opening hours, special closures, or holiday/absence saves, the UI scans upcoming appointments and creates in-app notifications: one summary (`APPOINTMENT_OUTSIDE_HOURS_SUMMARY`) plus one per conflict (`APPOINTMENT_OUTSIDE_HOURS`) with `appointment_id` payload.
- New IPC: `create_in_app_notification`, `dismiss_unread_in_app_notifications_by_kind` (requires `administration.practice_planning.write`).
- Unit tests for `findAppointmentsOutsideWorkHours` **PASS** (3). `npx tsc --noEmit` **PASS**. `cargo check -p medoc` **PASS**.
- Instance 1: `tools/dev-tauri.sh` / tauri dev (rebuilt). Instance 2: `MEDOC_INSTANCE=2` binary at `target-inst2/debug/medoc` started (`DB_READY`, `LAN_AUTO_START_SKIP`).

### Remains unverified

- Live UI click-path: save shorter hours → bell shows summary + per-appointment rows. **NOT OBSERVED**.
- Full `cargo test --workspace`. **NOT RUN**.
- Fresh `cargo build -p medoc --target-dir target-inst2` hit disk-full; binary was copied from the successful default build instead.

### Required next

1. Manually confirm Notifications after editing Opening hours / special closures / holidays.
2. Free disk before another full dual-target rebuild if needed.

---

**Previous last phase label:** LAN and company portal call the adapters (2026-11-16)

### Verified

- `lan-server.controller.ts` keeps the LAN config and status types. Settings pages call `lanSystem` in `tauri-lan.adapter.ts`.
- `company-portal.controller.ts` keeps `CompanyPortalConfig`. Settings pages call `companySystem` in `tauri-company.adapter.ts`. The unused `companyPortalAttachPayment` wrapper is gone. Device-session helpers stay on `device-session.controller.ts`.
- `apps/practice-host-ui` `tsc --noEmit` **PASS** (exit 0).

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `cargo fmt --all -- --check` and `cargo clippy --workspace --all-targets -- -D warnings`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Cluster repos are one type (2026-11-15)

### Verified

- `LicenseRepo`, `DeviceRepo`, and `PairingRepo` are gone. `SqliteClusterRepos` methods call `cluster::repo`. The unused generic `load_cluster` is gone.
- `logo_placement` copies the placement string before parsing it, so the JSON value can be dropped.
- `cargo check -p medoc-sync -p medoc-e2e --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Pairing calls the store directly (2026-11-15)

### Verified

- `PairingPersistence` and `SqlitePairingStore` are gone. `medoc_sync::pairing::*` calls `store`.
- The unused `systems` registry and the test that only checked it was defined are gone.
- `cargo check -p medoc-sync -p medoc-lan -p medoc-practice --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Remove pairing pin wrappers and the IPC identity bridge (2026-11-15)

### Verified

- `generate_confirm_pin` and `generate_confirm_pin_from_transcript` are gone. Random pins call `generate_confirm_pin_random`. A handshake transcript calls `derive_sas_from_transcript`.
- Pin test **PASS** (1). `cargo check -p medoc-sync --offline --tests` **PASS**.

### Remains unverified

- `npx tsc --noEmit` after deleting `ipc-bridge.ts`, `searchPatients`, and the unrouted onboarding pages. **NOT RUN**.
- Full `cargo test --workspace`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** One sync route table (2026-11-15)

### Verified

- Sync HTTP paths live in `medoc_sync::paths`. The LAN router, the permission check, and the sync client all use them. Wire-format tests still spell the `/api/v1/...` strings.
- Route permission test **PASS** (1). `cargo check -p medoc-sync -p medoc-lan --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** One handshake decoder (2026-11-15)

### Verified

- Handshake base64 is decoded by `decode_handshake_transcript`. Cluster load, pairing confirm, and the coupling code all call it.
- `snapshot_denied_column` is gone. Merge uses `deny_column`.
- SAS tests **PASS** (4). `cargo check -p medoc-sync --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** One hybrid clock and one replica count (2026-11-15)

### Verified

- `tick`, `observe`, `parse_hlc`, and `format_hlc` live in `medoc-core`. `medoc-sync` re-exports them. `sync_row_hlc` is created by `ensure_sync_row_hlc`.
- `sync.deployment.v1`, `sync.device_id.v1`, and `sync.hlc.v1` are constants in `sync_registry`. The remote-replica count SQL lives in `count_remote_replicas`.
- Sync clock tests **PASS** (2). `cargo check -p medoc-core -p medoc-sync --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.
- `MEDOC_INSTANCE` still suffixes the SQLCipher account with a dash and the cluster key with a dot. Left in place because those are different stored keys.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Remove unused ports, shims, and tautological tests (2026-11-15)

### Verified

- Unused second outbox writer is gone. `record_or_noop` still delegates to `recorded_write` and still ignores `payload_json`. Outbox tests **PASS** (6).
- Unused `StaffRepository`, `DatabasePool`, `SyncReplicationStore`, the cluster PIN wrapper, five page re-export shims, and `*.orig` backups are gone.
- `domain-enums.test.ts` no longer restates Zod for patient and chart status. **PASS** (8). The clock test parses a stamp instead of comparing two literals. **PASS** (2).
- `cargo check -p medoc-core -p medoc-sync --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.
- LAN master-license checks are still per handler, because sync and pairing return different error bodies.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Untangle IPC registry and repository paths (2026-11-15)

### Verified

- Tauri IPC registration is only `commands/register.rs`. The unused per-module `register_*` macros are gone, including the misspelled `regisappt_statistics_commands`. `EXPECTED_INVOKE_COMMAND_COUNT` (stale at 330, list is 346) is gone.
- Command modules and repository modules have one path each. Flat `*_commands` and `database::*_repo` shims are gone. Call sites import `commands::<domain>::…` and `database::repos::<domain>::…`.
- `invoke_command_registry_tests` **PASS** (2). `cargo check -p medoc-practice -p medoc-lan -p medoc-sync -p medoc --offline --tests` **PASS**.

### Remains unverified

- Full `cargo test --workspace`. **NOT RUN**.
- `npx tsc --noEmit`. **NOT RUN**.
- LAN master-license checks are still per handler, because sync and pairing return different error bodies.

### Required next

1. Run the workspace test suite before relying on this for a release build.

---

**Previous last phase label:** Dev app launch and license key (2026-11-15)

### Verified

- Debug binary `target-inst2/debug/medoc` is running (pid 76349) with Vite on `http://localhost:1420/`. Log events: `DB_READY`, `LAN_SERVER_STARTED` port 8787, `LOGIN_SUCCESS` for the existing physician session.
- License for this install (`sync.device_id.v1` = `ce284a1e-82b9-4800-aa83-8f9dea590e86`) was minted with the dev signing key. PRO, 99 users. The v2 token is device-bound. The v1 token is the any-device fallback, valid through 2036-01-01.
- Startup no longer aborts on 967 pre-existing foreign-key orphans (`practice_task` 837, `work_time_session` 128, `work_time_preference` 2). `medoc.db` stayed the practice file (no quarantine, no new `sqlcipher.key`). Size after migration: 94,392,320 bytes.

### Remains unverified

- The desktop window itself. **NOT OBSERVED**.
- Pasting the license into onboarding. **NOT OBSERVED**.
- `WORK_TIME_SWEEP_FAILED` (database locked, code 5) once during startup. The process stayed up.

### Required next

1. Paste the v2 license if the app asks for one.
2. Leave this debug process running. The September `/Applications/MeDoc.app` quarantines this database.

---

**Previous last phase label:** Practice currency on screens and documents (2026-11-14)

### Verified

- Screen labels that say € or EUR follow Settings → Practice when the currency is not EUR. Amounts already going through `formatCurrency` follow it, including payment history, treatment and examination costs, receipts, and the finance CSV column.
- Invoice, cash-report, period-report, and chart PDF headings use the practice currency code. Money figures use the same code. `euro_formatting` and `format_eur_groups_thousands` **PASS**. `npx tsc --noEmit` from `apps/practice-host-ui` **PASS** (`TSC_EXIT:0`).

### Remains unverified

- A non-EUR practice on screen and on a printed invoice, receipt, and cash report. **NOT OBSERVED**. Rust document text needs a rebuild.

### Required next

1. Rebuild and restart MeDoc, set a currency other than EUR, and check a payment screen plus an invoice PDF.

---

**Previous last phase label:** Sync queues, task order, page refresh (2026-11-13)

### Verified

- A product delete still applies while a supplier template points at it. `product_delete_applies_while_a_template_still_points_at_it` **PASS**. Each page queue is its own push. Accepted rows are marked by id, so a 400 on the orders queue does not mark the tasks queue delivered.
- Practice tasks inbox is newest `created_at` first. A task moved to `IN_PROGRESS` stays listed. `inbox_lists_newest_task_first_after_take_over` **PASS**.
- The open page reloads every 5 seconds. A hidden window reloads every 3 minutes. Opening a data page calls `sync_exchange_queue`. A queue already in the current exchange is not requested again. `npx tsc --noEmit` **PASS**. `cargo check -p medoc` **PASS**. `npm run build -w medoc` **PASS**. `cargo build -p medoc --target-dir target-inst2` **PASS**.

### Remains unverified

- The running windows. **NOT OBSERVED**. Quit both and open the rebuilt binary.
- The loading bar, and a task push that used to sit behind `DELETE product`. **NOT OBSERVED**.

### Required next

1. Quit both MeDoc windows and open them again.

---

**Previous last phase label:** Patient list, work time, currency, idle lock, hide network (2026-11-10)

### Verified

- Patient lists order by `name, id`. The payment Patient * combo drops duplicate ids and shows the date of birth when two patients share a name.
- Weekly bars scale to 8 hours when no target is set, and the open session is not added on top of the week summary. `weekBarScaleMinutes` tests **PASS** (3). `day-close` tests **PASS** (9).
- Logout with “Pause on logout” calls `workTimePause` for that account’s running session. Login resumes that account’s paused session. A new session starts only when auto-start is on and that account has no open session.
- Settings → Practice stores `currency` on `invoice.practice.v1`. `formatCurrency` and cash amounts follow it. PDF money uses the same code after `PracticeProfile::load`. Default remains EUR. `euro_formatting` and `format_eur_groups_thousands` **PASS**.
- Auto-lock reads the saved minutes when settings are saved, keyed by user id. Hide network no longer reopens the port when the switch is off, and the network panels stay hidden while it is on.
- `npx tsc --noEmit` from `apps/practice-host-ui` **PASS** (`TSC_EXIT:0`).

### Remains unverified

- On-screen Patient * list, weekly bars, logout pause, currency change, auto-lock, and hide network. **NOT OBSERVED**. Rust PDF currency needs a rebuild.

### Required next

1. Rebuild and restart MeDoc, then check those six flows in the app.

---

**Previous last phase label:** Practice fax and document logo (2026-11-10)

### Verified

- Settings → Practice has its own fax row. Saving writes `fax` on `invoice.practice.v1`. Reports use `document_address_lines()`, which includes `Fax …`. Invoices and clinical documents already used `letterhead_lines()`.
- `practice.logo.v1` stores `showOnDocuments`. Missing means show. `practice_logo` returns nothing when the flag is false, and a hidden logo clears `logoKvJson` on preview and reprint. Report PDFs take the same logo. HTML print skips the logo when the cache flag is false.
- `letterhead_matches_official_form`, `a_missing_flag_shows_the_logo_and_false_hides_it`, and `renders_financial_report_with_summary_and_table` **PASS**. `cargo check -p medoc-practice` **PASS**. `npx tsc --noEmit` from `apps/practice-host-ui` **PASS**. `npm run build -w medoc` **PASS**. `cargo build -p medoc --target-dir target-inst2` **PASS** (1m 30s).

### Remains unverified

- The settings page and a printed PDF in the running app. **NOT OBSERVED**. The processes started at 15:26 still have the previous binary.
- Push after quit and reopen (the product-delete 400 fix). **NOT OBSERVED**.

### Required next

1. Quit both MeDoc windows and open them again.

---

**Previous last phase label:** Push 400 on product delete (2026-11-10)

### Verified

- The replica outbox starts with `DELETE product` (`seed-prod-007` and the following product ids). The master log for that push is `LAN_SYNC_PUSH_FAILED` foreign key 787, returned as an empty 400. `product_delete_applies_while_a_template_still_points_at_it` **PASS**: the product is removed and the template row stays.
- Reception can read `practice.header_privacy.v1` and `invoice.practice.v1`. Writing them still requires `ops.system`. `cargo test -p medoc-core --lib -- app_kv_policy::tests` **PASS** (8).
- `cargo build -p medoc --target-dir target-inst2` **PASS**. The two processes that started at 15:26 are still the previous binary.

### Remains unverified

- Push after quit and reopen. **NOT OBSERVED**.

### Required next

1. Quit both MeDoc windows and open them again.

---

**Previous last phase label:** Day close cash report, cents, and selection lag (2026-11-10)

### Verified

- Cash report and Print on an older closing no longer fail with `error.day_close.no_report`. The first request issues the cash report from the stored figures; the next request reprints it. `older_closing_without_a_stored_report_still_prints` **PASS**. The PDF for counted `12.345` contains `12.35` and not `12.345`.
- Cash amounts use two digits after a decimal point: `1,234.56 EUR`. `application::documents::cash_book::tests::euro_formatting` **PASS**. `cargo test -p medoc-core --test finance_workflow_tests` **PASS** (5).
- Typed cash `1,234.50` and `245.500` stay in euros (`1234.5` and `245.5`). `npx vitest run src/lib/day-close.test.ts` from `apps/practice-host-ui` **PASS** (9). `npx tsc --noEmit` **PASS**.
- Opening a closing that is already recorded skips the full journal reconcile. Cash-checked payments are counted in one query. The detail reload follows the protocol id.

### Remains unverified

- On-screen Cash report, Print, and how fast the day-close page feels after quit and reopen. **NOT OBSERVED**. The Rust binary must be rebuilt.

### Required next

1. Rebuild and restart MeDoc.

---

**Previous last phase label:** Sync logical clock and mesh file pickup (2026-11-10)

### Verified

- A live write keeps a logical stamp ahead of a wall clock that is already behind. `a_live_write_stays_ahead_of_a_slow_wall_clock` **PASS**. `records_on_practice_desktop_when_a_replica_is_registered` **PASS**.
- When both copies of a row have a logical stamp, the newer stamp wins even if its wall `updated_at` is older. A later wall time with an older logical stamp does not replace it. `a_slow_wall_clock_wins_when_its_logical_stamp_is_newer` **PASS**. Stamps inside the two-minute window are still rewritten to the master clock (`a_future_stamp_is_clamped_to_the_master_clock` **PASS**). An unstamped edit two minutes ahead still beats an unstamped slower edit (`clock_two_minutes_ahead_overwrites_and_a_slow_clock_does_not` **PASS**).
- A mesh page that skips a missing file records delivery only through the last contiguous sent row. `a_failed_blob_holds_back_that_entry_and_everything_after_it` **PASS** (prefix seq 1 when seq 2 is omitted).
- A peer watermark that has already moved past a missing file moves back when the bytes exist, and the peer pending list includes that file. `a_peer_past_a_missing_file_sees_it_again_when_the_bytes_arrive` **PASS**. `peer_vector_tracks_mesh_delivery_watermark` **PASS**. The master delivery watermark still leaves the missing row pending (`delivered_watermark_leaves_a_missing_blob_row_pending` **PASS**).

### Remains unverified

- The two running `target-inst2/debug/medoc` processes. They need a rebuild. The practice LAN master was **NOT RUN**.
- A row queued only by the safety-net watch, or by a full snapshot, keeps its wall `updated_at` as the logical stamp. A slow edit that never passed through the live write hook can still lose to a newer wall stamp.
- After a missing file is given up, the next mesh page no longer contains that row, so a later cycle can move the watermark past it. The watermark moves back when the bytes arrive.

### Required next

1. Rebuild and restart both devices.

---

**Previous last phase label:** Official header prints each practice line once (2026-11-10)

### Verified

- The practice name, street, city, phone, and BSNR are drawn once. A repeated copy of the name and address under the letterhead is omitted, and a field listed twice in the header payload is kept once. `header_prints_each_practice_line_once` **PASS**. `cargo test -p medoc-core --lib infrastructure::pdf::letterhead::tests` **PASS** (10).

### Remains unverified

- The on-screen document after quit and reopen. The Rust binary must be rebuilt.

### Required next

1. Rebuild and restart MeDoc.

---

**Previous last phase label:** Invoice and receipt are different documents (2026-11-10)

### Verified

- A receipt confirms money already received. Its title is Quittung / Payment receipt, the table is date / service / amount paid, and the closing line is “Betrag dankend erhalten.” It does not say the patient must pay. `buildReceiptExportForPayment returns receipt bundle` **PASS** (8 tests).
- The receipt number on the PDF is “Quittungs-Nr.” / “Receipt no.”, not the invoice number. `receipt_renders_in_every_supported_language` **PASS**. `cargo test -p medoc-core --lib infrastructure::pdf::clinical_layout::tests` **PASS** (15).
- Administration → Finance & reports → Invoice lists only assignments that still have an open balance (`buildOpenPaymentLinkSelectOptions`). Paid assignments are left out.
- Services & billing offers Invoice for an open treatment or examination and opens that invoice form with the patient and line selected. Receipt stays on paid and partially paid rows.
- `npx tsc --noEmit` in `apps/practice-host-ui` **PASS**.

### Remains unverified

- On-screen invoice and receipt preview after quit and reopen. The Rust binary must be rebuilt.
- A paid assignment is absent from the invoice dropdown at runtime. **NOT OBSERVED**.

### Required next

1. Rebuild and restart MeDoc so the receipt PDF uses the new layout.

---

**Previous last phase label:** Sync maintenance — blob hold, one schema, slower watch (2026-11-10)

### Verified

- A failed attachment upload keeps that outbox entry and every later entry in the page pending. `a_failed_blob_holds_back_that_entry_and_everything_after_it` **PASS**.
- `ensure_sync_tables` calls the core replication DDL and only adds `sync_pull_failure`, `sync_watch_seen`, and pairing pin columns. `sync_extras_do_not_rewrite_the_core_replication_tables` **PASS**.
- The shared-change scan queues a new row, skips a row whose stamp was already seen, and queues a delete. `queues_a_shared_row_once_then_a_later_edit_and_a_delete` **PASS**. It runs every 60 seconds.
- A naive SQLite timestamp compares equal to the same instant with a `Z` suffix. A stamp two hours later wins. `parse_ts_str_handles_rfc3339_and_sqlite_naive` **PASS**.
- `cargo check -p medoc-lan` **PASS**. Push and pull log `REPLICA_SEEN_FAILED` when `touch_replica_seen` returns an error. That error path was **NOT RUN**.
- `medoc-export-fixes 2/` is removed. It was not a workspace member. The applied-patch note below is historical.

### Remains unverified

- The two running `target-inst2/debug/medoc` processes. They need a rebuild.
- A stamp from 2 minutes behind the master through any time ahead is rewritten to the master's clock (`a_future_stamp_is_clamped_to_the_master_clock` **PASS**). An edit older than that window keeps its stamp. There is no hybrid logical clock.
- A missing chart file is held for 8 tries, then marked `BLOB_MISSING`. The delivery watermark does not consume that row (`delivered_watermark_leaves_a_missing_blob_row_pending` **PASS**). When the bytes appear, the row is pending again (`a_missing_blob_is_queued_again_when_the_bytes_arrive` **PASS**).
- Pool cap is 10, acquire timeout 10s (`extra_connection_stops_at_the_acquire_timeout` **PASS**). The practice LAN master was **NOT RUN**.

### Required next

1. Rebuild and restart both devices.

---

**Previous last phase label:** Arabic PDFs mirrored right to left (2026-11-10)

### Verified

- An Arabic document is the mirror of the Latin page: title, address, tables, columns, and the logo. `arabic_receipt_is_the_mirror_of_the_latin_page` **PASS** (German title at x=71, Arabic title flush to the right margin).
- `cargo test -p medoc-core --lib infrastructure::pdf --offline` **PASS** (67). `cargo build -p medoc --offline` **PASS**.
- The German GOZ invoice stays left to right (`locale: "de"` in `invoice_goz.rs`).

### Remains unverified

- On-screen Arabic preview after quit and reopen.
- `npx tsc --noEmit` **NOT RUN**.

### Required next

1. Quit MeDoc and open it again so the new binary loads.

---

**Previous last phase label:** Arabic receipt font and practice-sync lock (2026-11-10)

### Verified

- Arabic preview is no longer rejected. `check_renderable` and GOZ validation use `is_pdf_renderable`. `non_latin_payload_is_rejected` **PASS** (Arabic `محمد` accepted, `中文` still rejected).
- Receipt titles render for `de` Rechnung, `en` Invoice, `fr` Facture, `ar` فاتورة. Arabic runs use embedded Noto Naskh (`/F3`, `/NotoNaskhArabic`). `receipt_renders_in_every_supported_language` and `arabic_receipt_text_uses_the_embedded_font` **PASS**.
- `cargo test -p medoc-core --lib infrastructure::pdf --offline` **PASS** (66). `cargo build -p medoc --offline` **PASS** (`dev`, `target-inst2`).
- SQLCipher pool sets `busy_timeout = 20000` and WAL in `after_connect` (after the key). `app_kv` get/set retry SQLITE_BUSY. Frontend practice sync retries 6 times. Lock behavior at runtime is **NOT OBSERVED** (no second process held the database during this run).

### Remains unverified

- On-screen PDF preview and the settings “فشل مزامنة العيادة” toast after quit and reopen.
- `npx tsc --noEmit` **NOT RUN**.
- Cyrillic is still not in the embedded font. The error text mentions it; only Latin and Arabic are covered.

### Required next

1. Quit MeDoc and open it again so the new binary loads.

---

**Previous last phase label:** Prescription columns, right header, receipt as invoice (2026-11-10)

### Verified

- Pack size / quantity removed from the prescription PDF table (4 columns) and the combo form column. `prescription_headers_do_not_share_a_baseline_with_the_dose` **PASS**.
- Header middots are split onto their own lines. Info block ends on the right margin. `header_splits_middot_fields_onto_their_own_lines` and `header_info_block_aligns_to_the_right_margin` **PASS**. Footer still matches the sample (`footer_matches_sample_document` **PASS**).
- Patient receipt uses the `01-rechnung.pdf` title, window address, and 7-column fee table.
- `cargo test -p medoc-core --lib infrastructure::pdf --offline` **PASS** (64). `cargo build -p medoc --offline` **PASS**.

### Remains unverified

- On-screen preview after quit and reopen.
- `npx tsc --noEmit` **NOT RUN**.

### Required next

1. Quit MeDoc and open it again so the new binary loads.

---

**Previous last phase label:** Patient PDF header, prescription wrap, PDF i18n (2026-11-10)

### Verified

- Prescription table headers wrap inside the column. `prescription_headers_do_not_share_a_baseline_with_the_dose` **PASS**. Dose `1-0-1` sits below every 8 pt header baseline.
- `cargo test -p medoc-core --lib infrastructure::pdf --offline` **PASS** (62). `letterhead_matches_official_form` **PASS**.
- `cargo build -p medoc --offline` **PASS** (`dev`, `target-inst2`). Pre-existing `replica_desktop_name` warning.
- PDF chrome catalog: `crates/shared/medoc-core/src/infrastructure/pdf/i18n.rs` (`de`, `en`, `fr`, `ar`). Document locale follows a pin, otherwise the UI language.

### Remains unverified

- On-screen preview after quit and reopen (binary is rebuilt; the running app still has the old process).
- `npx tsc --noEmit` after the locale/label edits. **NOT RUN** this pass.
- Arabic glyphs. Helvetica/WinAnsi stores `?` for Arabic letters (`text_operand_never_emits_utf16_into_content_streams`).

### Understanding delta

- Patient PDF headers are one field per line. Footer lines stay middot-joined, matching the sample PDFs.
- Clinical preview watermark uses the catalog (`ENTWURF` / `DRAFT` / `BROUILLON` / `مسودة`). GOZ invoice body stays German.

### Required next

1. Quit MeDoc and open it again so the new binary loads.
2. Embed a Unicode font before Arabic can be drawn on the page.

---

**Previous last phase label:** Official documents patch applied (2026-11-10)

### Verified

- `medoc-export-fixes 2/medoc-export-fixes.patch` applied (symlink duplicates `apps/practice-host-ui/src/lib` and `src-tauri` skipped; those paths alias `packages/shared` and `apps/practice-host`).
- Rejects merged by hand: audit CSV BOM + session, `documents.locale.v1` on `ops.system`, `issued_document` in `sync_registry` (Numbered), CSV formula unguard, export `context` literals, GOZ fields on `Treatment`.
- `invoice_sequence.rs` deleted. IPC count **330** (`invoke_command_registry_tests` **PASS** 2).
- `cargo test -p medoc-core --offline --lib` **PASS** (164). `document_registry_tests` **PASS** (6). `official_pdf_samples` **PASS** (1).
- `npx tsc --noEmit` in `apps/practice-host-ui` **PASS**. `npx vitest run` **PASS** (383).
- i18n: 28 keys added to `packages/shared/locales/{de,en,fr,ar}.json`.

### Remains unverified

- Full `cargo test --workspace`.
- Browser issue/preview of the new PDFs (samples rendered by the Rust test only).
- Items the package left open: billing input UI, PDF/A embedded fonts, logo alpha, money as cents, telematics, server-side prescription completeness, archive PDF bytes.

### Understanding delta

- Official numbers (`RE`/`ST`/`QU`/…) are allocated in `issued_document` on the MASTER device, not by `allocate_invoice_document_number`.
- The packaged `register.rs` is an older dump. This tree kept newer handlers (`decline_patient_chart`, `export_patients_csv`, `sync_reconcile_now`, …) and only added the document commands.

### Required next

1. Fill practice tax number, BSNR/ZANR and bank on the MASTER device before issuing.
2. Billing form for fee schedule / GOZ number / points / factor (backend `set_treatment_billing` is in place).
3. Parts E remainder and F–K from the previous handoff.

---

**Previous last phase label:** Part E start — F44/F52/F57 + replica `/sync/number` (2026-11-08)

### Verified

- Replica POST `/api/v1/sync/number` with a `sync.push` activation token allocates unique daily numbers: `replica_sync_push_token_can_allocate_document_number` **PASS** (1).
- F44: GET `/api/v1/appointments` is 404 in `docs/coordination/backend-http-route-matrix-results.md` (Closed, not applicable).
- F52: CSV crate + quoted `;` + Windows-1252; `create_from_import` (NEW, chart, anamnesis, outbox); skip name+DOB; missing insurance NULL. Tests **PASS** (4) + `migration_import_tests` **PASS** (6).
- F57: paged search on name/insurance/phone/email, cap 50, `idx_patient_name`, `export_patients_csv`. Tests **PASS** (2). Invoke count **319**.
- Invoke registry **PASS** (2). `status_check_tests` **PASS** (8) after patient-table rebuild for nullable insurance.

### Remains unverified

- Full `cargo test --workspace`.
- Parts E remainder: F59, F60, F63–F67, F70, F94, F97, F99, F122 (F62/F126 already in earlier batch).
- Parts F–K. Browser patients page search/export. Two-process replica numbering (TLS).

### Understanding delta

- `patient.insurance_number` is `Option<String>` so CSV import can store NULL (UNIQUE still applies when set).
- Patient list IPC `search` replaces the dedicated `search_patients` path on the patients page.

### Required next

1. F59/F69 double-option updates.
2. F60, F63–F67, F70, F94, F97, F99, F122.
3. Parts F–K.

---

**Previous last phase label:** workspace PASS (2026-11-08)

### Verified

- `cargo test --workspace --offline --no-fail-fast -- --test-threads=1` **PASS** (EXIT 0).
- Mesh harness 20 **PASS**. Billing release / cash-verify LWW ties fixed by `next_updated_at`.

### Remains unverified

- Live replica POST `/api/v1/sync/number`. Parts E–K IDs not in this batch.

### Understanding delta

- Same-millisecond INSERT then UPDATE ties under D8; master keeps INSERT and relays an unreleased row. Release/cash-verify stamps are now strictly later.

### Required next

1. Parts E–K remaining IDs.

---

**Previous last phase label:** workspace suite + H2/mesh fixes (2026-11-08)

---

**Previous last phase label:** pasted-diff leftover tests (2026-11-07)

### Verified

- Pasted plan files are in tree (F9, F24, F32, F45–46, F52–53, F62, F74–76, F85, F89, F92, F119, F123, F126, F134, F143–147).
- F144 `legacy_database_gets_widened_status_checks_and_keeps_rows` **PASS** (appointment count scoped to `id = 'a-1'` because demo seed fills `appointment`).
- `status_check_tests` **PASS** (8): F62, F74, F75, F92, F144.
- `sync_outbox_hooks_tests` **PASS** (11): F147 composite `chart_validation` ids; F119 GDPR erase outbox.
- `sync_registry_tests` **PASS** (4). `staff_delete_fk_tests` **PASS** (3). `recorded_write_guard` **PASS** (2).
- `invoke_command_registry_tests` **PASS** (2), count **318**. `ipc_sync_pairing_tests` **PASS** (10), including `fresh_pool_has_empty_outbox_outside_serverless_peer`.
- Earlier this apply: merge F146/F147 **PASS**; vitest `staff-work-plan-sync` **PASS** (3); numbering, wrap v2, F24 port.

### Remains unverified

- `cargo test --workspace`. Live replica POST `/api/v1/sync/number`. Parts E–K IDs not in this batch.

### Understanding delta

- Demo seed in `cfg!(test)` makes global `COUNT(*)` on `appointment`/`payment` unusable in focused tests.

### Required next

1. `cargo test --workspace`.
2. Parts E–K remaining IDs.

---

**Previous last phase label:** F9/F24/F32/F45–76/F85/F119/F123/F143–147 apply (2026-11-07)

### Verified

- IPC invoke count **318** (`sync_record_change` removed). `invoke_command_registry_tests` **PASS** (2).
- Number styles Daily/Monthly + legacy floor: `number_sequence_tests` **PASS** (5).
- H2 command-layer scan: `recorded_write_guard` **PASS** (2).
- Replica HTTPS URL uses join `master_http_port` (default 8787, not 49300): license_service tests **PASS** (6), including F24 9443.
- F45 wrap v2 XChaCha20-Poly1305 + v1 upgrade: `db_key` tests **PASS** (3).

### Remains unverified

- `cargo test --workspace`. Extra status/merge/vitest cases from the brief (now landed). Live replica number POST.

### Understanding delta

- Document numbers come from cluster `number_sequence` (DeviceLocal); replicas POST `/api/v1/sync/number`. Composite `chart_validation` keys (`patient_id|section`). GDPR erase records each child DELETE. Scanner button hidden when capability off. Work-plan slice persist per staff.

### Required next

1. `cargo test --workspace`.
2. Add/run vitest work-plan sync + remaining merge/status tests from the pasted diff.
3. Parts E–K IDs not in this batch.

---

**Previous last phase label:** Part D hourly reconcile (2026-11-07)

### Verified

- POST `/api/v1/sync/digest`, `/sync/row-hashes`, `/sync/rows` with action `sync.reconcile` (mt2). Staff JWT on digest is **401**.
- Digest returns 256 buckets (`digest_returns_256_buckets_with_activation_token` **PASS**).
- `hash_row_json` is key-order stable. IPC `sync_reconcile_now` (`ops.system`), invoke count **319**.
- Replica hourly hook after a caught-up `run_replica_sync` (outbox empty, pull < 500, no error, 60 min kv).
- Settings Deployment: Reconcile now. LAN http_sync **13 PASS**. IPC pairing/registry **PASS**.
- `set_cash_verified_for_ids_reaches_replica_b` isolation **PASS** (1). Earlier batch **FAIL** looks flaky.

### Remains unverified

- Replica end-to-end digest catch-up against a live master (HTTP runner). 429 in-flight lock. Vitest F32 / locales. `cargo test --workspace`.

### Understanding delta

- Reconcile force-applies main rows (skip LWW). Outbox must be empty. `sync.repair.required.v1` blocks. Staff JWT on digest is 401; other `/sync/*` JWT stays 403.

### Required next

1. `cargo test --workspace`.
2. Parts E–K remaining IDs.
3. Mesh harness for digest overwrite if the brief still lists it.

---

---

**Previous last phase label:** Part C F22/F34–F56 (2026-11-07)

### Verified

- Staff directory import: `two_receptionists_both_arrive` **PASS**, `tax_advisor_arrives` **PASS**. Export includes all roles, `token_version`, `available`. Missing directory rows set `available = 0`. First PHYSICIAN/RECEPTION fallback removed.
- `replica_cannot_create_staff` **PASS**.
- F15–F17 still **PASS** from prior phase.

### Remains unverified

- Harness `set_cash_verified_for_ids_reaches_replica_b` and sibling F34/F35/F68/F96 tests **NOT RUN**.
- Full `cargo test --workspace`. F5 live pin. F31 blobs. F32 localStorage. H2 guard.

### Understanding delta

- Replica staff writes return `AppError::Validation` with the English sentence (unit `Forbidden` cannot carry a message).
- `delete_patient` archives; `restore_patient` is a new IPC (`EXPECTED_INVOKE_COMMAND_COUNT` 318).

### Required next

1. Add harness `*_reaches_replica_b` for remaining outbox writes.
2. F31 blob routes; F32 app_kv migration.
3. `cargo test --workspace` after disk is stable.

---

**Previous last phase label:** 2FA deferred (2026-11-07)

### Verified

- `TOTP_2FA_ENABLED` is false. `authenticate` skips the authenticator branch while the flag is off.
- `totp_login_tests` **PASS** (4), `mvp_security_gates_tests` **PASS** (10), `auth_session_audit_tests` **PASS** (1).

### Remains unverified

- Live login click on the master window. The master still fails `foreign_key_check` (967 violations) before the window opens. Replica process was left running from the earlier rebuild.

### Understanding delta

- F27 is no longer active. Stored `totp_secret` rows are kept and ignored until the deferred checklist turns the flag back on.

### Required next

1. Part B remainder: F11, desktop `authorize`, keychain, unlock, scanner hide, live TLS pin.
2. `cargo test --workspace` before closing P2.

---

**Previous phase label:** Remediation Part A H5–H8 + F27 (2026-11-07)

### Verified

- H5: status CHECK inserts ARCHIVED / DECLINED / IN_PROGRESS **PASS** (`status_check_tests`).
- H6: unique `allocate_number` **PASS**.
- H8: JSON password/email redaction **PASS**.
- F27: `unenrolled_physician_must_enroll` **PASS**. `lan_http_route_matrix_all_endpoints` **PASS**.
- `medoc-core --lib` **PASS** (125).

### Remains unverified

- H2 `every_synced_write_is_recorded`. Replica `/sync/number` from a second process. `cargo test --workspace`. Frontend tests. Playwright. Parts C–K.

### Required next

1. Part B remainder: F11, desktop `authorize`, keychain, unlock, scanner hide, live TLS pin.
2. `cargo test --workspace` before closing P2.

---

**Previous phase label:** Remediation P3 TOTP, sessions, export path (2026-11-07)

### Verified (2026-11-07 — authenticator, password generation, export folder)

- An enrolled physician without a current code is rejected. The same account with the current code signs in. `enrolled_physician_without_code_is_rejected` and `enrolled_physician_with_current_code_signs_in` **PASS**.
- Replacing a password increments `staff.token_version` and ends every other device session. `password_change_bumps_the_token_and_ends_other_sessions` **PASS**. `lan_http_route_matrix_all_endpoints` **PASS** after the middleware started comparing that version.
- Six failed logins from different addresses lock the account. `different_addresses_still_lock_the_account` **PASS**.
- An export file whose folder is outside the configured root, or whose name contains `..`, is rejected. `export_rejects_a_folder_outside_the_configured_root` **PASS**.
- The invoke registry counts 317 commands, including the two enrollment commands. `invoke_handlers_unique_and_match_documented_count` **PASS**.

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and Playwright. **NOT RUN**.
- Mandatory enrollment for every physician. `TOTP_2FA_ENABLED` is still false.
- A reception click on the export folder was **NOT OBSERVED**.

### Understanding delta

- A hash upgrade of the same password does not move `token_version`. A real password replace does.
- Lockout is counted twice: once for the address and once for the account.

### Required next

1. Finish P3: keychain unlock before the pool opens, the scanner path guard, and the setup screen when status fails.
2. Run `cargo test --workspace` before calling P2 done.

---

**Previous phase label:** Remediation P3 IPC gates (2026-11-07)

### Verified (2026-11-07 — IPC idle and sensitive reads)

- A desktop session older than 30 minutes is cleared. `idle_session_is_cleared` and `fresh_session_stays` **PASS**.
- `invoice.practice.v1`, `practice.logo.v1`, `export.path.v1`, and `practice.calendar-workflows.v1` require `ops.system` for read and write. `invoice_profile_requires_ops_system` **PASS**. `lan_http_route_matrix_all_endpoints` **PASS**.
- A DENY on `patient.read_documents` removes attachment names from the chart PDF. `denied_document_permission_hides_attachment_names` **PASS**.
- An override action outside `config/rbac.yaml` is rejected. `unknown_override_action_is_rejected` **PASS**.
- Setup is complete only when the stored value is `1`. `setup_is_complete_only_when_the_value_is_one` **PASS**. A joined device cannot create another staff account after that flag is set.

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and Playwright. **NOT RUN**.
- TOTP, password-change session version, lockout per account, the keychain unlock screen, and the export path guard.

### Understanding delta

- `require()` expires idle sessions. It still trusts the role stored at login.

### Required next

1. Finish P3: TOTP for physicians and admins, end other sessions on password change, and the export path guard.
2. Run `cargo test --workspace` before calling P2 done.

---

**Previous phase label:** Remediation P2 authorize() for LAN (2026-11-07)

### Verified (2026-11-07 — shared authorize)

- `authorize` rejects an idle clock and a device session last seen in 2000. Both return unauthorized. `idle_caller_is_unauthorized` and `stale_device_session_is_unauthorized` **PASS**.
- An account with `available = 0` does not sign in. `unavailable_account_does_not_sign_in` **PASS**.
- A DENY override blocks a physician. A `patient.read_medical` call writes one `audit_log` row, action `READ`, for that patient. `deny_override_blocks_a_physician_and_a_read_is_audited` **PASS**.
- LAN `DELETE /license` and e-prescription validate/submit call `authorize`. `lan_http_route_matrix_all_endpoints` **PASS**. `reception_cannot_delete_the_license_or_submit_a_prescription` **PASS** for the seeded reception account `seed-rez-001`.

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and Playwright. **NOT RUN**.
- F11 has no row in the findings table.
- Desktop IPC still calls `require()` and does not yet use `authorize()`.

### Understanding delta

- The role on the staff row is the one that is checked. A JWT role is not trusted on its own.
- Login loads permission overrides into the session. A later `authorize` loads them again.

### Required next

1. P3: route IPC commands through `authorize()`, then TOTP, session version, and the path guard.
2. Run `cargo test --workspace` before calling P2 done.

---

**Previous phase label:** Remediation P2 noise fingerprint and vendor portal (2026-11-07)

### Verified (2026-11-07 — pairing mint and vendor URL)

- A pending pairing row is not given an activation token. `pending_pairing_is_not_minted` **PASS**.
- An accepted row whose device key does not match the claimed fingerprint is not minted. `foreign_fingerprint_does_not_match_the_noise_key` **PASS**. A join message with a mismatched key is rejected before the session is stored. `cargo test -p medoc-sync --test cluster_net_loopback -- --test-threads=1` **PASS** (10).
- Vendor portal fetches send the API key only to `https` URLs, or to `http` on loopback. `vendor_url_accepts_https_and_loopback_http_only` **PASS**. Saving a portal URL uses the same check.
- Desktop portal summary, integrations, feature flags, and the update manifest require `ops.system`. `cargo check -p medoc-practice` finished with no errors. A reception session was not clicked. **NOT OBSERVED**.
- The desktop LAN adapter no longer maps patient or appointment lists. Vitest **NOT RUN**.

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and Playwright. **NOT RUN**.
- F11 has no row in the findings table. **NOT STARTED**.
- B1 `authorize()` (idle, availability, overrides, a READ audit row) is not the LAN check yet.

### Understanding delta

- Replica auth previously minted a token for any pairing row that was not revoked or rejected, including `PENDING`.
- The join fingerprint is the hash of the 32-byte device key. A different string is refused.

### Required next

1. Decide F11 from the source notes. Do not invent a defect for it.
2. B1 `authorize()` on the remaining LAN handlers, then P3 for IPC.
3. Run `cargo test --workspace` before calling P2 done.

---

**Previous phase label:** Remediation P2 sync reasons, role gates, and browser client removal (2026-11-07)

### Verified (2026-11-07 — sync 403 reasons, login role, license and prescription gates)

- Sync push, pull, status, and activation-token checks return JSON `reason`. `cargo test -p medoc-lan --test http_sync_tests -- --test-threads=1` **PASS** (10), including `from_device_mismatch`, `master_license_required`, and `staff_jwt_rejected`.
- The route matrix pull sends `requesterId` equal to the paired device. `lan_http_route_matrix_all_endpoints` **PASS** (33). A pull without that field was 403 `requester_mismatch`.
- `TAX_ADVISOR` with a valid password gets `Forbidden`. `tax_advisor_password_does_not_open_a_session` **PASS**. Seeded physician login in the matrix is still 200.
- `DELETE /api/v1/license` requires `ops.system`. E-prescription validate and submit require `patient.write_medical`. Reception is 403; physician clear is 204 and validate is 200.
- `apps/lan-web-client` is removed. `GET /api/v1/patients` and `GET /api/v1/appointments` are 404. Related e2e files **PASS**: `serverful_lan_client_flows` (10), `activation_token_rbac` (4), `lan_pairing_sync` (7), `license_and_outbox` (3), `three_replica_conflict_matrix` (1).

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and the Playwright job. **NOT RUN**.
- F11, F38 Noise binding, F132, F135. **NOT STARTED** this pass.
- Desktop LAN-client mode still routes `list_patients` through `HttpPracticeAdapter` to the removed path. **NOT CHANGED**.

### Understanding delta

- A missing patient or appointment route is 404 before the auth middleware, including for an activation token that used to be allowed to read those lists.
- Staff JWT never reaches the license check on `/sync/*`. An unlicensed main device returns `master_license_required` only for an mt2 token.

### Required next

1. P2 remainder: F11, bind the Noise fingerprint on mint (F38), portal reads require `ops.system` (F132), portal URL is https-only (F135).
2. Point the desktop LAN-client adapter off the removed patient and appointment routes, or stop offering that mode for chart reads.
3. Run `cargo test --workspace` before calling P2 done.

---

**Previous phase label:** Remediation P2 pairing, snapshot secrets, and join URL (2026-11-07)

### Verified (2026-11-07 — pairing token and snapshot secrets)

- Staff snapshot JSON has no `password_hash` or `totp_secret`, and applying it does not replace the stored hash. `snapshot_omits_staff_secrets_and_portal_keys` **PASS**. `company.portal.*` is not loaded into a relay payload.
- A revoked pairing row is not given a new token. `revoked_device_is_not_reminted` **PASS**. Revoke and block call `clear_device_activation`.
- Submit and status responses drop `activationToken`. Confirm still returns it. `public_view_drops_the_activation_token` **PASS**.
- Reset deletes `cluster.join.*`. `wipe_network_kv_clears_license_and_onboarding_keys` **PASS**.
- Replica deployment uses the port stored at join. `sas_replica_activation_demotes_owner_and_skips_onboarding` **PASS** (`https://192.168.1.10:49300`).
- A token device id is adopted only when it equals this install’s fingerprint. `align_moves_pending_outbox_onto_the_activation_token_device` **PASS**.

### Required next

1. P2 remainder: bare 403 reasons, `authorize()` on LAN login, licence, e-prescription, patients, and appointments, and dropping the browser client (D1 / F40).
2. Full `cargo test --workspace` is still **NOT RUN**.

---

**Previous phase label:** Remediation P1 data-loss tests passed; P2 TLS pin started (2026-11-07)

### Verified (2026-11-07 — P1 exit tests and the TLS pin)

- `cargo test -p medoc-core --test p1_data_loss_tests -- --test-threads=1` **PASS** (8): wrong key, rekey, plaintext sibling deleted, backup open, failed English upgrade, in-process restore, staff sick-leave, audit archive.
- Replica backoff is 500ms, then doubles, and stops at 30s. `backs_off_when_the_main_device_is_down` **PASS**.
- Sync, master probe, and pairing HTTP clients call `pinned_http_client`. An empty pin returns an error. `tls_pin` tests **PASS** (2). A live mismatched handshake was **NOT RUN**.
- A newly generated LAN certificate stores `127.0.0.1` as an IP SAN. `certificate_carries_loopback_as_an_ip_san` **PASS**.

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and the Playwright job. **NOT RUN**.
- The restore command was not driven inside a Tauri window. **NOT OBSERVED**.
- P2 remainder: token stripping, revoke/block, snapshot column deny-list, `authorize()`, dropping the browser client.

### Understanding delta

- Deleting the author of someone else's sick note used to delete that note. The note now stays, and `created_by` moves to another staff row so the foreign key still holds.
- Peer mesh push no longer accepts any certificate. It uses `sync_device.peer_cert_sha256` and skips the peer when that pin is missing.

### Required next

1. Finish P2: public pairing responses, revoke/block, snapshot deny-list, `authorize()` on LAN handlers, delete the browser client (D1).
2. Run `cargo test --workspace` before calling a later phase done.

---

**Previous phase label:** Remediation P0 started, P1 and P2 partial (2026-11-06)

### Verified (2026-11-06 — remediation P0 and first data/network fixes)

- `decline_patient_chart` is in `medoc_invoke_handler!`. `EXPECTED_INVOKE_COMMAND_COUNT` is 315. `cargo test -p medoc-practice --test invoke_command_registry_tests` **PASS** (2).
- `medoc-core` depends on `libsqlite3-sys` `bundled-sqlcipher`. `cargo test -p medoc-core --lib` compiled and the English schema upgrade tests **PASS** (6).
- Pull assertion in `replica_pull_sees_master_local_writes` matches the current create contract (patient row plus id-only chart and anamnesis). **PASS**.
- `SyncMesh` creates a patient on replica A and reads it on replica B through the LAN router. `cargo test -p medoc-e2e --test sync_mesh_harness` **PASS**.
- Relay outbox insert and `sync_applied` commit in one transaction. `replica_push_is_visible_to_a_later_replica_pull` **PASS**.
- Staff JWT on `POST /api/v1/sync/pull` is 403 `staff_jwt_rejected`. `sync_pull_rejects_staff_jwt` **PASS**. Paired mesh pull still **PASS**.
- Playwright job is in `.github/workflows/ci.yml`. **NOT RUN** in this session.

### Remains unverified

- Full `cargo test --workspace`, frontend Vitest, and the Playwright job against a live `medoc-server`. **NOT RUN**.
- Wrong-key quarantine, activation rekey, backup open, restore pool swap, and audit archive have code changes. Dedicated tests for those paths were **NOT RUN**.
- P2 remainder (TLS pin, backoff, cert SANs, token stripping), P3–P10, and decisions D3–D7 behavior beyond the locked choices. **NOT STARTED** or only the sync-route JWT rejection is in.

### Understanding delta

- The invoke list was already 314 handlers while the constant said 313. Adding `decline_patient_chart` makes 315.
- F49 is the migration `PRAGMA foreign_keys` running on the pool. The English upgrade and the two rebuild blocks now hold one connection.
- A staff JWT no longer reaches `/sync/*` or `/pairing/peers`. Pull requires `requesterId` equal to the mt2 device id, and a stored pairing row must be `ACCEPTED` with the same token.

### Required next

1. Run `cargo test --workspace`, `scripts/ci-frontend-test.sh`, and the Playwright job.
2. Finish P1 restore (stop LAN, install the reopened pool) and add the wrong-key / rekey / archive tests.
3. Continue P2 from the sync guard: pinned TLS, backoff, and the B1 `authorize()` core.

---

**Previous phase label:** Shared calendar sync after SAS (2026-10-01)

### Verified (2026-10-01 — replica ↔ master data)

- Master outbox records writes when a replica device is registered (including `practice_desktop`).
- First replica pull (`since_seq = 0`) queues a full snapshot; replica catch-up loops until a page < 500.
- Replica sync loop is **5s**; pull cursor advances via `set_observed_seq`.
- Tests: `enqueue_full_snapshot` **PASS** (3.78s); `set_observed_seq` **PASS**; desktop noop + replica-peer record **PASS**.

### Remains unverified

- Live two-window calendar match after SAS — **NOT OBSERVED**.

### Understanding delta

- Different calendars were expected: desktop master never wrote `sync_outbox`, and replica never received a bootstrap dump of existing rows.

### Required next

1. Rebuild both instances, confirm SAS, wait for initial pull; calendars should match, then 5s deltas.

---

### Verified (2026-10-01 — replica LAN after SAS)

### Verified (2026-10-01 — replica LAN after SAS)

- After SAS, master allows staff directory by join `session_id` / fingerprint (no license `SELECT 1` gate).
- Master mints `mt2.` activation token on SAS confirm; replica stores it for HTTPS sync to port 8787.
- Loopback: `cluster_net_loopback` 10/10; `roundtrip_join_accept_with_lan_credentials` **PASS**.

### Remains unverified

- Live two-instance handshake: staff import + `run_replica_sync` against master’s 8787 — **NOT OBSERVED**.

### Understanding delta

- Replica “connection to the server” failed because staff fetch was `STAFF_DENIED` and SAS join never issued the LAN activation token `pick_bearer` needs.

### Required next

1. Rebuild master + replica (`MEDOC_INSTANCE=2`) and pair again; confirm staff copy and replica sync.

---

### Verified (2026-09-30 — same-class SQLITE 787)

- Bare `DELETE FROM patient` failed with FK 787 when appointments/payments existed (`REFERENCES patient(id)` without CASCADE).
- `patient_repo::delete` now deletes dependents in a transaction, then the patient row. GDPR `erase_patient_records` uses the same helper (still anonymizes the stub).
- Sync merge DELETE of `patient`, `patient_chart`, and `service_item` detaches children / nulls `payment.service_item_id` first.
- Staff delete now removes pause segments and work-time preferences before sessions.
- Cluster reset deletes `sync_vector` before `sync_device`.

### Remains unverified

- Click-through delete patient / delete user in the running app — **NOT OBSERVED**.

### Required next

1. Rebuild practice-host and confirm patient delete no longer returns SQLITE 787.

---

### Verified (2026-09-05 — payment → billing list)

- Recording a real payment **updates** the FA-LEIST-06 0 € `OUTSTANDING` open booking in place (no second “still to fulfill” row).
- When status becomes `PAID`, matching open `BILLING` practice tasks are set to `VALIDATED` with `payment_id`.
- `ensure_billing_task_for_clinical_line` skips create if the clinical line is already fully paid.
- `cargo test -p medoc --test payment_repo_tests` **PASS** (6).

### Remains unverified

- Click-through in Finance / patient payment / tickets after pay — **NOT OBSERVED**.

### Required next

1. Record a payment against an auto-open booking and confirm finance shows one `PAID` row and tickets no longer list “Payment erfassen”.

---



### Verified (2026-09-02 — installer license UI)

- GUI install uses `PlanActivationMode::Manual` and `no_launch`.
- Window: **Create license key** + multiline field + **Copy license key**.
- `cargo build -p medoc-usb-setup --release` **PASS**; kit `MedocUsbSetup` replaced.

### Remains unverified

- Click-through Create/Copy in the live egui window — **NOT OBSERVED** (user may have old `./MedocUsbSetup` still open).

### Required next

1. Quit the running USB Setup window, then run `installer/dist/usb-kit/./MedocUsbSetup` again.
2. Install → Create license key → Copy → paste in MeDoc license screen. Close MeDoc first if key creation says the DB is in use.

---



### Verified (2026-09-02 — “app won’t open”)

- Direct exec of `~/Applications/MeDoc.app/Contents/MacOS/medoc` **starts** (`DB_READY`, pid 15217).
- Finder/`open` of the `.app` **does not start a process**: `spctl` → “code has no resources but signature indicates they must be present” / adhoc rejected. **NOT** a crash of the new UI binary.
- USB installer “exited immediately” on slot 2+ was **single-instance** while the first copy was already running.
- Installer now treats already-running as success; writes `~/Applications/Open MeDoc.command`. Host `show`/`set_focus` after overlay.

### Remains unverified

- User-visible window from this agent spawn — **NOT OBSERVED** (no screenshot).

### Required next

1. If MeDoc.app icon does nothing: double-click **Open MeDoc.command** in `~/Applications`.
2. Do not rely on Finder `open` of the unsigned `.app` until notarized.

---

**Last phase label:** White window — custom-protocol (2026-09-02)

### Verified (2026-09-02 — blank MeDoc window)

- Cause: USB `medoc` was `cargo build --release` **without** `--features custom-protocol`. Tauri kept `cfg(dev)` and loaded `http://localhost:1420` (no Vite) → empty white webview. Evidence: prior `target/release/build/medoc-*/output` had `cargo:rustc-cfg=dev` and no `tauri-codegen-assets`.
- Fix: `[features] custom-protocol = ["tauri/custom-protocol"]` on `apps/practice-host`; Vite `base: "./"`. Rebuild: `npm run build -w medoc` then `cargo build -p medoc --release --features custom-protocol`.
- New OUT_DIR has **124** `tauri-codegen-assets`; binary contains `index-f4ONlojG.js`; **no** `rustc-cfg=dev`.
- Process after replace: pid **4167**, logs `DB_READY` + `MAC_WINDOW_TRAFFIC_OVERLAY_OK`; **no** TCP to `:1420`.
- Kit payload `installer/dist/usb-kit/medoc-usb/payloads/{medoc,MeDoc.app}` updated to the same binary.

### Remains unverified

- Login / onboarding paint end-to-end — **NOT OBSERVED** (no visual screenshot this session)
- Finder `open` of adhoc `.app` (Gatekeeper) — still expected to fail; spawn exe.

### Required next

1. Look at the relaunched MeDoc window (should show UI, not white).
2. Future kits: `tauri build --bundles app` **or** `cargo build -p medoc --release --features custom-protocol` after `npm run build -w medoc`.

---


### Verified (2026-09-02 — installer UI + double-open)

- `cargo build -p medoc-usb-setup --release` **PASS**; kit binary `installer/dist/usb-kit/MedocUsbSetup` (7.1M).
- `./MedocUsbSetup --help` shows optional subcommand; no args / `gui` open native window.
- `cargo check -p medoc` **PASS** after Info.plist path fix (`macos/Info.plist`).
- `cargo test -p medoc-sync --test install_plan_apply_tests` **PASS**.
- Double-open: OS mutex `de.medoc.app.practice-host`; DB busy → Conflict (no recreate); LAN/cluster AddrInUse → Conflict.

### Remains unverified

- Live GUI click-through (Unlock / Install) — **NOT OBSERVED**
- Second live MeDoc launch while first is open — **NOT OBSERVED**
- Encrypted USB payloads, Authenticode/notarization, WebView2

### Required next

1. Double-click `installer/dist/usb-kit/MedocUsbSetup` (or run with no args).
2. Unlock with the campaign password, pick role, Install.
3. Confirm a second MeDoc open exits instead of crashing.

---

### Verified (2026-09-02 — USB kit)

- Password vault: wrong password → `wrong USB kit password`.
- Campaign init / status / install / audit on an isolated kit.
- Sidecar written to `Library/Application Support/de.medoc.app/install_plan.pending.json` with `MASTER` / `auto` / `en`.
- Practice app installed as `/Applications/MeDoc.app` (bundle `Contents` present).
- `cargo test` for vault + `install_plan_apply_tests` **PASS**.

### Remains unverified

- Live first launch of this `MeDoc.app` consuming the sidecar — **NOT OBSERVED**
- Encrypted payloads, Authenticode/notarization, WebView2 pack, egui GUI — **not implemented**
- Device-bound vendor license cannot be auto-applied from USB without `device_id`

### Required next

1. Open `/Applications/MeDoc.app` (sidecar applies role/locale on `DB_READY`).
2. For USB unlock: use the password you passed to `init-campaign`, e.g. if you ran `--password YOUR_PASSWORD`, type **YOUR_PASSWORD** (not `demo123`).

---

# Phase handoff

**Last phase label:** Swing CSS simulation from Tauri index.css (2026-08-20)

### Verified (2026-08-20 — Tauri CSS → Swing)

- Ported `:root` tokens (`--bg #F3F4F6`, `--accent #0EA07E`, `--fg*`, pill/status colors, radii 16/10/8/pill).
- Motion: `fadeUp` 6px + `--ease-out` approx, `--motion-ui` 200ms / `--motion-page` 400ms / wire 280ms.
- Shell: `.sb-item` / `.sb-group-label` / `.app-sidebar-user-card` radius 14; frosted topbar; `.app` radial washes via `AppCanvas`.
- Dashboard: `.kpi` layout, `.pill.*` colors, insights gradient `#0e455c→#0d7d66`, wire-approve buttons, Inter/SF font prefer.
- `./gradlew test --rerun-tasks` **PASS** — **104** tests.

### Remains unverified

- Live `./run` visual parity vs Tauri — **NOT OBSERVED**

### Required next

1. `./run` side-by-side with Tauri Overview.
2. Optional: SVG/nav icons instead of emoji glyphs.

---

### Verified (2026-08-20 — Overview CSS + motion)

- Tokens aligned to React light theme (`--accent #0EA07E`, radius 16/10/pill, soft/md shadows).
- Primitives: `RoundedPanel`, `SoftButton`, `UiMotion` (fade+slide enter, online pulse, stagger rows).
- Shell + dashboard use elevated cards, pill nav/active states, timeline severity bars, hover lift on KPIs.
- `./gradlew test --rerun-tasks` **PASS** — **104** tests.

### Remains unverified

- GUI pixel/motion feel vs React screenshot — **NOT OBSERVED** (run `./run`)

### Required next

1. `./run` and judge motion/spacing against the React Overview screenshot.
2. Optional: replace emoji glyphs with vector icons; wire ⌘K search.

---

### Verified (2026-08-20 — Overview dashboard UI)

- Swing shell: `TopBar` (crumbs / search / Online / actions) + restyled `Sidebar` (brand, practice name, active nav, user card).
- `DashboardPage` rebuilt to React overview layout: greeting, 4 KPI cards, pending approvals, review orders, next-24h, today timeline, MEDOC Insights.
- `DashboardController` loads revenue (PAID MTD), stock alerts (`stock=`/`min=` on PRODUCT extra), approvals, upcoming, overdue-first orders; approve master + confirm order wired.
- Demo seed: `Dental practice North`, overdue Henry Schein order, low-stock products.
- `./gradlew test --rerun-tasks` **PASS** — **104** tests.

### Remains unverified

- GUI walk after `./run` — **NOT OBSERVED** (pixel match vs screenshot)

### Required next

1. `./run` and visually compare Overview to the React screenshot.
2. Optional: wire TopBar search to patient/appointment jump; plan-next approval rows if product wants full Tauri parity.

---

### Verified (2026-08-20 — LAN e-Rx + license)

- **Rust LAN:** `POST /api/v1/eprescriptions/validate|submit`, `GET|DELETE /api/v1/license`, `POST /api/v1/license/activate` in `medoc-lan` (`eprescription.rs`, `license.rs`); router wired in `http/mod.rs`.
- **Swing:** `LanDialect` paths + request/response helpers; `HttpPracticeAdapter` POST/DELETE; Settings license/pairing + Prescriptions validate/submit enabled on LAN (`eRxSupported`); Rx create/list still demo-only.
- **Java:** `./gradlew test --rerun-tasks` **PASS** — **103** tests (new `eRxLicenseAndPairingHaveLanPaths`).
- **Rust:** `MEDOC_VENDOR_PUBKEY=… cargo check -p medoc-lan` **PASS**.

### Remains unverified

- Live HTTPS smoke against running `medoc-lan-server` — **NOT RUN**
- e-Rx **submit** still TI stub (same as Tauri) — expect error until connector exists
- Prescription CRUD on LAN — still unavailable

### Understanding delta

- True multi-host depth for license status/activate/clear and e-Rx validate now goes through LAN REST (parity with Tauri core), not Mock-only.
- Pairing list/decide was already on LAN; Swing now maps it.

### Required next

1. Live smoke: LAN login → Settings license GET; Prescriptions validate; submit expect TI stub failure; pairing list/decide with ops JWT.
2. Optional: Rx list/create LAN REST if product needs multi-host prescription rows.
3. GUI walk after `./run` — **NOT OBSERVED**

---

**Prior phase label:** Swing full demo seed dataset (2026-08-20)

### Verified (2026-08-20 — Swing full demo seed)

- `MockPracticeAdapter.seedFullDemo()` fills patients (12), week appointments, charts (all kinds), tickets, invoices, cash, orders, work time, Rx, certificates, day closes, balance snapshots, catalogs, events, pairing, scanner, settings KV letterhead/prefs, staff overrides.
- Tests updated for richer counts. `./gradlew test --rerun-tasks` **PASS** — **102** tests.

### Remains unverified

- GUI walk after `./run` — **NOT OBSERVED**

### Required next

1. Restart `./run` and walk every sidebar page; confirm tables look full.

---

**Last phase label:** Swing feature pack — drag / GOZ / e-Rx / license / staff / devices / composers (2026-08-20)

### Verified (2026-08-20 — Swing feature pack)

- **Drag calendar:** week-view DnD reschedule (`AppointmentsPage` + `TransferHandler`).
- **GOZ:** `OfficialGozCatalog` ~145 common positions; SERVICE catalog reseeded; billing hint updated (illustrative — not licensed dump).
- **E-prescription:** validate/submit UI + `PrescriptionController` + mock TI stub (PZN/KVNR/LANR rules).
- **License / pairing:** Settings activate/clear + pairing accept/reject (`LicensePairingController`).
- **Staff security:** password reset, quotas, RBAC overrides (`StaffSecurityController`).
- **Migration devices:** GDT parse, DICOM sniff, scanner list/attach (`MigrationDeviceController`).
- **Chart composers + disease patterns:** structured fields on chart tabs; statistics pattern table via `DiseasePatternStats`.
- `cd /Users/achraf/pro/Medoc-swing && ./gradlew clean test --rerun-tasks` → **PASS** — **101** tests.

### Remains unverified

- GUI walk after `./run` — **NOT OBSERVED**
- Live LAN HTTPS / real TI / OS scanner / cloud license — **NOT RUN** / out of scope for Swing demo

### Understanding delta

- These seven items are **demo-complete Subset** in Swing Mock + UI, not Tauri IPC clones.
- Password change / 2FA remain desktop-only (honest Settings copy).

### Required next

1. Restart `./run` and smoke the seven UIs.
2. Keep Subset honesty unless product adds LAN REST for multi-host writes.

---

**Prior phase label:** Leftover attribute sweep (2026-08-20)

### Verified (2026-08-20 — Leftover attribute sweep)

- Policy: German **values/names** in DB OK; German **attributes** not OK.
- Removed prod dual-reads: `fusszeile` (`document_pdf.rs`); draft `zahnschmerzenTeeth` / `statusWunsch` (`appointment-create.tsx`).
- Englishified default UI hints: `font-stack-preset.ts`, `accent-preset.ts`.
- Prod scan for known leftover attribute tokens (excl. upgrade maps / tests / `de.json` / LanDialect): **0 hits**.

### Intentionally kept

- Upgrade *from* maps; ignore/reject test fixtures; `selbst`/`vergessen` PDF label aliases until migrate.
- German **values**/messages: `TOOTHACHE_TAG_LEGACY`, conflict `terminkonflikt`.
- `de.json`; LanDialect inbound fallbacks.

### Remains unverified

- `cargo` / vitest for this sweep — **NOT RUN**.

---

**Prior phase label:** Swing UI coverage — catalog CRUD / staff / events / migration / stats (2026-08-20)

### Verified (2026-08-20 — Swing UI coverage batch)

- Catalog list screens: search + create/edit/delete (covers products, work plan, treatment, contracts, order master, planning, etc.).
- Staff dedicated page (PHYSICIAN/RECEPTION + email). Migration 6-step checklist (device adapters added in feature pack phase).
- Audit/logs/ops/compliance/feedback via seeded `list_practice_events`.
- Statistics week hours + staff table (disease patterns added in feature pack phase).
- `./gradlew clean test --rerun-tasks` **PASS**.

### Remains unverified

- GUI walk after `./run` — **NOT OBSERVED**
- Live LAN HTTPS — **NOT RUN**

### Required next

1. Restart `./run` and walk admin/staff/migration/events/stats UI.
2. Keep honest Subset for non-LAN desktop IPC.

---

**Last phase label:** English leftover identifiers (helpers / i18n / PDF / template kind) (2026-08-20)

### Verified (2026-08-20 — leftover helpers / i18n / PDF / template kind)

- PDF helpers `format_date_dmy` / `format_eur` / `wrap_text`; chart header `created_by`; IPC `list_sick_leave_certificates`; `DeviceClusterPanel`; contract helpers `amountEquivalentPerMonth` / `formatMonthlyEquivalentText` / `formatContractAmountLine` / `contractActiveToday` / `todayYmd`.
- i18n: `settings.device_cluster.*`, `payment.examination_*`, `enum.profession.*`, `patient.filter.ALL|NEW_PATIENT|CLOSED`, `patients_total_sub`, `*_month` chart keys.
- PDF default labels English (Date of birth, Findings, Duration, Privacy notice, Practice stamp, …). Legal UStG sample text kept.
- `document_template.kind`: `PRESCRIPTION` / `CERTIFICATE` (dual-read leftover `REZEPT` / `ATTEST`; upgrade ENUM + CHECK tokens). `0001` CHECK updated for fresh DBs.
- Payment assignment keys write `examination:`; dual-read leftover `unter:`.
- Vitest subset — **97 PASS** / 16 files.

### Remains unverified

- `cargo test` / `cargo check` (PDF, DTO, schema upgrade) — **NOT RUN** (`cargo` not on PATH).
- Live `document_template.kind` remap on existing DBs — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.

### Understanding delta

- Practice KV `invoice.practice.v1` German wires still stay (`bankverbindung_*`, `notfall_phone`, `payment_terms_tage`, `ust_befreiung_hinweis`).
- Certificate template payload keys `krankheiten` / `tage_anzahl` / `einschraenkung` not renamed this pass.
- Dual-read aliases from prior invoice-PDF pass stay.

### Required next

1. `cargo test` when cargo is on PATH (PDF + `db_migrations_tests`).
2. Optional: `invoice.practice.v1` KV English (needs Swing together).
3. Optional: certificate template payload keys English with dual-read.

---

**Prior phase label:** Swing prescriptions + invoice lines + day close (2026-08-20)

### Verified (2026-08-20 — Swing prescriptions + invoice lines + day close)

- Sidebar `/prescriptions` is `PrescriptionsPage` (patient picker, create/delete). No e-prescription submit. LAN `list_prescriptions` / `create_prescription` / `delete_prescription` paths **null**.
- Billing lines: add/remove positions; invoice amount = sum of lines. LAN `list_invoice_lines` / `add_invoice_line` / `delete_invoice_line` paths **null**.
- Day close: `DayClosePage` records counted cash vs today’s cash total and stores variance. No PDF. LAN `list_day_close` / `create_day_close` paths **null**.
- `./gradlew test --rerun-tasks` **PASS** — 66 tests / 17 classes.

### Remains unverified

- GUI walk of billing lines / prescriptions / day close after `./run` restart — **NOT OBSERVED**
- Live LAN HTTPS — **NOT RUN** (`cargo` not on PATH)
- Drag calendar, GOZ factor engine, rich template composer, e-prescription submit, license/pairing activate — still **Not started** / thinner **Subset**

### Understanding delta

- Prescriptions sidebar is patient scripts, not the medication catalog list.
- Invoice lines are flat code/description/amount; they are not a GOZ factor/qty engine.
- Day close uses in-session cash rows, not desktop IPC `day_close_protocol`.

### Required next

1. Restart `./run` and walk Billing lines, Prescriptions, Administration → Finance → Day close.
2. Live LAN login + list + settings when the server can run.
3. Optional: drag calendar / GOZ factor / e-prescription submit.

---

**Prior phase label:** Swing onboarding + month + invoice status + templates (2026-08-20)

### Verified (2026-08-20 — Swing onboarding + month + invoice status + templates)

- Onboarding wizard (`OnboardingPage`): welcome → display name → letterhead → locale. Skip → dashboard. Finish writes `onboardingComplete` into existing LAN KV `practice.preferences.v1` (merge-safe). License/pairing/subscription remain copy-only.
- Appointments month list: `AppointmentController.listMonth` = one `listByDate` per day. Double-click a day → day view. No drag.
- Billing Issue / Mark paid via `OpsController.updateInvoiceStatus` (`update_invoice`). LAN path **null**.
- Template editor (`TemplateEditorPage`) for `CatalogKind.TEMPLATE`; kind in `detail`, body in `extra`; `CatalogController.update`. LAN `update_catalog` path **null**.
- `./gradlew test --rerun-tasks` **PASS** — 64 tests / 16 classes.

### Remains unverified

- GUI walk of onboarding / month / billing status / templates after `./run` restart — **NOT OBSERVED**
- Live LAN HTTPS — **NOT RUN** (`cargo` not on PATH)
- Drag calendar, GOZ invoice engine, rich template composer, e-prescription, license/pairing activate — still **Not started** / thinner **Subset**

### Understanding delta

- Month calendar is LAN-safe because it reuses list-by-date; it is not a drag grid.
- Invoice status and template body writes are demo-mock only; HTTP adapter throws `LanCommandUnavailableException`.

### Required next

1. Restart `./run` and walk Dashboard → Open setup, Appointments → Month, Billing Issue/Paid, Administration → Services → Templates.
2. Live LAN login + list + settings when the server can run.
3. Optional: drag calendar / GOZ lines / rich template composer.

---

**Prior phase label:** English leftover identifiers (invoice PDF IPC) (2026-08-20)

### Verified (2026-08-20 — invoice PDF IPC)

- Invoice line IPC: `factor`, `unit_price_cents`, `tooth_nr`, `treatment_date`, `vat_percent`. Serde aliases keep leftover `faktor` / `einzelpreis_cents` / `zahn_nr` / `behandlungsdatum` / `ust_prozent`.
- Invoice payload: `bank_details` / `vat_notice` (aliases `bankverbindung` / `ust_hinweis`). TS `normalizeInvoiceInput` dual-reads stored history.
- Letterhead `emit_bank_details`; PDF labels Date / Tooth / Qty / Factor / Amount due / Bank details.
- `validate_tooth_number`; `lineFromServiceItemChoice` (dual-reads leftover `unter:` examination links); `allocateReceiptNumber`.
- Vitest subset — **95 PASS** / 15 files (incl. `receipt-export-flow.test.ts`).

### Remains unverified

- `cargo test` / `cargo check` of PDF + DTO mapping — **NOT RUN** (`cargo` not on PATH).
- Live reprint of stored invoices that still have German IPC keys — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.
- Full `critical-flows.smoke.test.tsx` — **NOT RUN** this pass.

### Understanding delta

- Invoice **PDF IPC** is English; leftover German keys still deserialize.
- `invoice.practice.v1` KV wires stay German (`bankverbindung_*`, `ust_befreiung_hinweis`, `notfall_phone`, `payment_terms_tage`, `einzelpreis_cents`). That `einzelpreis_cents` is the practice KV, not the invoice-line field.
- Document-template dual-read `ust_hinweis` → `vat_notice` is unchanged (template JSON leftover).

### Required next

1. `cargo test --test pdf_document_tests` (or crate PDF tests) when cargo is on PATH.
2. Optional: `invoice.practice.v1` German KV English wire (needs Swing together).
3. Optional: rename PDF helpers `format_date_de` / `format_eur_de` / `wrap_de`; chart header `erstellt_from`.

---

**Prior phase label:** Swing privacy + cash + anamnesis (2026-08-20)

### Verified (2026-08-20 — Swing privacy + cash + anamnesis)

- Privacy: demo JSON export + anonymise master data (`PrivacyController`); clinical rows kept. LAN `dsgvo_export_patient` / `dsgvo_erase_patient` have no HTTP path.
- Cash desk: today’s queue, KPI sum, patient column, create with patient (closer to React `finance-cash.tsx`).
- Inbox `/inbox` aliases tickets; `/finance` and `/finance/cash` alias billing/cash; practice-preferences → settings; sick-leave → certificate catalog.
- New patient form can store an anamnesis note as a HISTORY chart entry (demo).
- `./gradlew test --rerun-tasks` **PASS** — 61 tests / 16 classes.

### Remains unverified

- GUI walk of cash / privacy / anamnesis after `./run` restart — **NOT OBSERVED**
- Live LAN HTTPS — **NOT RUN** (`cargo` not on PATH)
- Onboarding, drag calendar, invoice engine, template editor — still not converted at React depth

### Understanding delta

- GDPR on this LAN client is demo-only anonymise of identifiers, not desktop IPC erasure of related tables.
- React inbox is a redirect to tickets; Swing matches that.

### Required next

1. Restart `./run` and walk Cash desk + Administration → Governance → Privacy.
2. Live LAN login + list + settings when the server can run.
3. Optional: onboarding and richer composers.

---

**Prior phase label:** English leftover identifiers (appointments / numbering / i18n) (2026-08-20)

### Verified (2026-08-20 — appointments / numbering / i18n)

- Appointment notes write `Duration: N min`; parse dual-reads leftover `Dauer:`.
- Toothache chief-complaint writes English; parse dual-reads leftover `Zahnschmerzen (Zahn|Zähne …)`.
- Calendar filter/query `EMERGENCY` (dual-reads leftover `NOTFALL`).
- Numbering helpers `nextInvoiceNumber` / `nextReportNumber` / `allocateInvoiceNumber` / `allocateReportNumber`.
- i18n keys: `login.emergency.*`, `dashboard.appointments.emergency`, `appointment.kind.EMERGENCY`, `appointment.status.changed`, chief-complaint suggestion keys.
- Index `idx_day_close_protocol_as_of_date` (upgrade drops leftover `idx_day_close_protocol_tag`).
- Export basenames `Receipt_` / `Prescription_`.
- Vitest subset — **89 PASS** / 13 files.

### Remains unverified

- `cargo test --test db_migrations_tests` / `cargo check` — **NOT RUN** (`cargo` not on PATH).
- Live draft KV `zahnschmerzenTeeth` / `statusWunsch` dual-read — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.

### Understanding delta

- Invoice LAN KV `invoice.practice.v1` German wire keys stay (`notfall_phone`, `payment_terms_tage`, `bankverbindung_*`, `einzelpreis_cents`).
- Invoice PDF line IPC still uses leftover `zahn_nr` / `behandlungsdatum` / `ust_prozent` / `bankverbindung`.

### Required next

1. `cargo test --test db_migrations_tests` when cargo is on PATH.
2. Optional: invoice practice KV English wire (needs Swing together).
3. Optional: invoice PDF line IPC fields (`zahn_nr`, `behandlungsdatum`, …) with serde aliases.

---

**Prior phase label:** English leftover identifiers (day-close columns / cash IPC) (2026-08-20)

### Verified (2026-08-20 — day-close leftovers)

- `day_close_protocol` columns: `note`, `day_payment_count`, `cash_verified_count`, `all_payments_verified`, `variance_eur`, `system_income_eur`, `recorded_at`. Upgrade maps keep German + mixed leftover names.
- IPC `set_payments_cash_verified`; helpers `sumCashDay` / `filterReceptionCashQueue`.
- i18n `page.day_close.field.recorded` / `col.recorded`.
- Vitest: prior subset + day-close unit — **76 PASS** / 10 files. Day-close smoke (`submits protocol`) **PASS**.

### Remains unverified

- `cargo test --test db_migrations_tests` / `cargo check` — **NOT RUN** (`cargo` not on PATH).
- Live `day_close_protocol` column rename on existing DBs — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.
- Full `critical-flows.smoke.test.tsx` (App routing) — **NOT RUN** this pass (isolated day-close case passed).

### Understanding delta

- Invoice LAN KV `invoice.practice.v1` German wire keys stay.
- Index name `idx_day_close_protocol_tag` was leftover then; renamed in the following phase.

### Required next (then; index rename now done)

1. `cargo test --test db_migrations_tests` when cargo is on PATH.
2. Optional: invoice practice KV English wire (needs Swing together).
3. Optional: leftover `idx_day_close_protocol_tag` index name — **done** in the following phase.

---

**Prior phase label:** Swing nested catalogs (2026-08-20)

### Verified (2026-08-20 — Swing nested catalogs)

- Administration TOC hubs in Swing: `AdminHubs` + `AdministrationPage.showHub`.
- Nested catalog routes share `CatalogListPage`; demo `MockPracticeAdapter` seeds and creates rows per `CatalogKind`.
- `LanDialect.path` for `list_catalog` / `create_catalog` is null; `HttpPracticeAdapter` throws `LanCommandUnavailableException`.
- Privacy is static copy only (GDPR export/erasure not on LAN HTTP).
- `./gradlew test --rerun-tasks` **PASS** — 59 tests / 15 classes.

### Remains unverified

- GUI walk of hubs / catalog create after `./run` restart — **NOT OBSERVED**
- Live LAN HTTPS — **NOT RUN** (`cargo` not on PATH)
- Inbox, live DSGVO export/erase, anamnesis wizard, drag calendar, invoice engine — still not converted at React depth

### Understanding delta

- Nested React pages that are lists (catalogs, day close, audit, …) map to one demo catalog table, not fake REST.
- Privacy stays honest: copy only, no desktop-only GDPR commands over LAN.

### Required next

1. Restart `./run` and walk Administration → hubs → catalog create in demo mode.
2. Live LAN login + list + settings when the server can run.
3. Optional: inbox and richer composers if Swing should match desktop.

---

**Prior phase label:** English leftover identifiers (VVT / done_note / PDF copy) (2026-08-20)

### Verified (2026-08-20 — English leftover identifiers)

- VVT generator copy in `vvt.rs` is English (legal citations kept).
- `practice_task.done_notiz` → `done_note` (SQL + IPC `doneNote`; serde aliases `doneNotiz` / `done_notiz`). Column rename in `english_schema_upgrade` `COLUMN_RENAMES`.
- Receipt/prescription/chart PDF default labels English; `is_total_label` still matches leftover `Gesamt` / `Endbetrag`.
- Medications defaults: `7 days`, dosage forms, pack size `Other`, statutory/private labels (values `KASSE`/`PRIVAT`/`BTM` unchanged).
- Vitest: prior subset + document-template + slot-grid + practice-tickets smoke — **68 PASS** / 9 files (inbox smoke skipped by flag).

### Remains unverified

- `cargo test --test db_migrations_tests` / `cargo check` — **NOT RUN** (`cargo` not on PATH).
- Live `practice_task.done_notiz` column rename on existing DBs — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.

### Understanding delta

- Invoice LAN KV `invoice.practice.v1` German wire keys (`notfall_phone`, `payment_terms_tage`, `ust_befreiung_hinweis`, `einzelpreis_cents`) stay.
- Day-close leftover columns were still mixed then; completed in the following English leftover phase.

### Required next (then; now done for day-close)

1. `cargo test --test db_migrations_tests` when cargo is on PATH.
2. Optional: day-close `notiz` → `note` (+ remaining German day-close columns) — **done** in the following phase.
3. Optional: invoice practice KV English wire (needs Swing together).

---

**Prior phase label:** English leftover identifiers (prefs / templates / DPIA) (2026-08-20)

### Verified (2026-08-20 — English leftover identifiers)

- Appointment prefs JSON: `bufferMin` / `emergencyBuffer` / `calendarDragDropEnabled`; reads leftover `pufferMin` / `notfallPuffer` / `kalenderDragDropEnabled`.
- Calendar view: `day` / `week` / `month`; `normalizeAppointmentCalendarView` maps `tag` / `woche` / `monat`.
- Document templates: English payload keys (`header`, `footer`, `unit_price`, …); `parseTemplatePayloadJson` dual-reads German wires; Rust PDF reads `footer` or `fusszeile`.
- Practice task kinds: `APPOINTMENT` / `PRINT`; `normalize_kind` and `ENUM_UPDATES` map `TERMIN` / `DRUCK`.
- DPIA: module `dpia.rs`, struct `Dpia`, IPC `generate_dpia`; i18n `page.compliance.dpia.*`.
- Vitest: i18n-locales, rbac, native-go-menu, report-export, administration-hierarchy, settings.rbac.smoke, appointment-slot-grid, document-template-schema — **67 PASS** / 8 files.

### Remains unverified

- `cargo test --test db_migrations_tests` / `cargo check` — **NOT RUN** (`cargo` not on PATH).
- Live KV/localStorage migration of prefs and calendar view — **NOT OBSERVED**.
- Stored `document_template_user.payload` rows — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.

### Understanding delta

- Invoice LAN KV `invoice.practice.v1` German wire keys (`ust_befreiung_hinweis`, `einzelpreis_cents`, …) stay; they are not document-template fields.
- VVT / `done_notiz` were still leftover then; completed in the following phase.

### Required next (then; now done)

1. `cargo test --test db_migrations_tests` when cargo is on PATH.
2. Optional: English VVT prose; `practice_task.done_notiz` column rename — **done** in the following phase.
3. Live walk of settings workflows + calendar view + compliance DPIA.

---

**Prior phase label:** Swing sidebar features (2026-08-19)

### Verified (2026-08-19 — Swing sidebar features)

- Every Swing sidebar route has a real page (not a LAN stub): dashboard, appointments, help, patients, charts to validate, tickets, statistics, billing, cash, orders, work time, administration, settings.
- Demo `MockPracticeAdapter` supports create/update for patients, appointments, chart notes, tickets, invoices, cash, orders, work time.
- `HttpPracticeAdapter` still throws `LanCommandUnavailableException` for those write commands (no fake LAN REST).
- `./gradlew test --rerun-tasks` **PASS** — 54 tests / 13 classes.

### Remains unverified

- Live LAN HTTPS — **NOT RUN** (`cargo` not on PATH)
- GUI walk of the new sidebar pages after restart — **NOT OBSERVED** this phase
- Nested React pages (inbox, catalogs, day close, privacy, …) — not in Swing nav

### Understanding delta

- “Implement all frontend features in order” for this client means **sidebar order**, with demo-local writes. Full React composers (anamnesis wizard, drag calendar, invoice engine) are still thinner subsets.

### Required next

1. Restart `./run` and walk demo sidebar.
2. Live LAN login + list + settings when the server can run.
3. Optional: nested React pages if Swing nav grows.

---

**Prior phase label:** English leftover identifiers (2026-08-19)

### Verified (2026-08-19 — English leftover identifiers)

- Cluster repo/audit fns: `list_devices`, `create_pairing_session`, `log_pairing`; audit entities `CLUSTER` / `PAIRING`.
- Help route `/help` (RBAC `help`, `HelpPage`); legacy `/hilfe` and `?tab=hilfe` redirect.
- Onboarding routes `/onboarding/account|subscription|join` with redirects from `/konto|/abonnement|/beitreten`.
- Settings section ids: `account` / `security` / `appearance` / `workflows`; finance KPI fields `incomeMtd` / `openCount` / `profitMtd`.
- Statistics chart labels English (`Completed`, `No-show`, `Cash`, …); UI panel `sec-disease-patterns`.
- Vitest: i18n-locales, rbac, native-go-menu, report-export, administration-hierarchy, settings.rbac.smoke — **60 PASS** / 6 files.

### Remains unverified

- `cargo check` / cluster type compile — **NOT RUN** (`cargo` not on PATH).
- Live navigation `/help` and onboarding English paths — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.

### Understanding delta

- `nav.help.*` tooltip keys coexist with flat `nav.help` (help page label) in the flat JSON catalogs.
- Document template persisted field ids (`einzelpreis`, `kopf`, …) still German — renaming needs a stored-template migration.

### Required next

1. `cargo test --test db_migrations_tests` when cargo is on PATH.
2. Optional: migrate `document-template-schema` persisted JSON ids; DPIA/`dsfa.rs` prose.
3. Optional: remaining German locals (`praef`, `Oeffnungszeiten`, `practice.tasks.workflow.offen`).

---

**Prior phase label:** Swing practice logo (2026-08-19)

### Verified (2026-08-19 — Swing practice logo)

- Settings can load, save, and remove a practice logo in LAN KV `practice.logo.v1` (`{ mime, data }` base64).
- MIME whitelist: png / jpeg / gif / webp (`image/jpg` → `image/jpeg`). Max 750_000 bytes.
- Remove uses `DELETE /api/v1/app-kv?key=practice.logo.v1` (`delete_app_kv`).
- `./gradlew test --rerun-tasks` **PASS** — 50 tests / 12 classes.

### Remains unverified

- Live LAN HTTPS (including logo GET/PUT/DELETE) — **NOT RUN** (`cargo` not on PATH)
- Swing UI launch `./run` — **PASS** (`de.medoc.MedocApplication`, window `MeDoc — Dr. Demo`)
- GUI logo file picker / preview — **NOT OBSERVED**

### Understanding delta

- Common LAN-backed practice settings KV is now converted: preferences, letterhead + billing IDs, logo. Remaining settings (license, pairing, password) need host APIs that LAN does not expose.

### Required next

1. Live login + list + settings saves (including logo) when `medoc-lan-server` can run.
2. Do not fake patient/appointment/chart REST.

---

**Prior phase label:** Swing invoice billing IDs (2026-08-19)

### Verified (2026-08-19 — Swing invoice billing IDs)

- Settings letterhead includes provider name, professional title, dentist ID (ZANR), practice site ID (BSNR), physician number (LANR), IBAN/BIC/bank/holder.
- App fields are English; KV wire keys remain `zanr`, `bsnr`, `lanr`, `bankverbindung_iban`, …
- Validation: nine digits for ZANR/BSNR; IBAN normalized (spaces stripped, uppercase). Invalid IBAN rejected.
- `./gradlew test --rerun-tasks` **PASS** — 47 tests / 12 classes.

### Remains unverified

- Live LAN HTTPS — **NOT OBSERVED** (`cargo` not on PATH)
- GUI launch this session — **NOT OBSERVED**

### Understanding delta

- Invoice billing IDs did not need new REST; they live in the same `invoice.practice.v1` blob. Logo (`practice.logo.v1`) is the remaining common LAN KV.

### Required next

1. Live login + list + settings saves when `medoc-lan-server` can run.
2. Optional: `practice.logo.v1`. Do not fake patient/appointment/chart REST.

---

**Prior phase label:** English SQLite schema upgrade (2026-08-19)

### Verified (2026-08-19 — English schema upgrade)

- Canonical SQL table names are snake_case English: `service_item`, `purchase_order` (was camelCase `serviceItem` / `purchaseOrder` in `0001` + queries).
- Cluster SQL: `device_blocklist`, `device_status`, `pairing_state` (was `geraet_blocklist` / `geraet_status` / `kopplung_state`).
- Idempotent `run_english_schema_upgrade` runs **before** CREATE IF NOT EXISTS: German table/column/enum wires + camelCase tables are renamed; German CHECK tables are rebuilt so `ARZT`→`PHYSICIAN` etc. can store.
- Existing encrypted DBs no longer skip migrations when `patient` already exists — otherwise the upgrade would never run.
- Seed/default physician specialty is `Dentistry` (was `Zahnmedizin`).
- Certificate migration test kind is `SICK_LEAVE`.

### Remains unverified

- `cargo check` / `cargo test` (including `english_upgrade_renames_legacy_german_and_camelcase_tables`) — **NOT RUN** (`cargo` not on PATH).
- Opening a real `medoc.db` that still has German or camelCase tables — **NOT OBSERVED**.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.

### Understanding delta

- Rewriting `0001_initial_schema.sql` in place is not enough for installed DBs. Runtime must rename leftover German/camelCase objects. sqlx is still skipped when a core table already exists (checksum of rewritten `0001` is not re-applied).

### Required next

1. `cargo test --test db_migrations_tests` when cargo is on PATH.
2. Open an existing practice DB once so the upgrade actually runs.
3. Optional: leftover German demo sentences in `seed.rs` (product names, treatment notes).

---

**Prior phase label:** Swing practice letterhead KV (2026-08-19)

### Verified (2026-08-19 — Swing practice letterhead)

- Settings letterhead subset of React practice section: name, address, phone, email, opening hours, KV number stored in LAN `invoice.practice.v1`. Merge keeps unknown keys (`zanr`, `bankverbindung_iban`, …).
- App model is English (`InvoicePracticeHeader.address`); KV wire keys stay `addr` / `opening_hours` / `kv_nummer`.
- `./gradlew test --rerun-tasks` **PASS** — 44 tests / 11 classes.

### Remains unverified

- Live LAN HTTPS (login, list, profile, letterhead) — **NOT OBSERVED** (`cargo` not on PATH)
- GUI launch this session — **NOT OBSERVED**

### Understanding delta

- `get_app_kv` / `set_app_kv` can carry more practice master data than `practice.preferences.v1`. Logo (`practice.logo.v1`) and full billing IDs remain unconverted.

### Required next

1. Live login + list + settings saves when `medoc-lan-server` can run.
2. Optional: remaining LAN KV (`practice.logo.v1`, invoice ZANR/IBAN). Do not fake patient/appointment/chart/billing REST.

---

**Prior phase label:** Swing own profile GET/PATCH /me (2026-08-19)

### Verified (2026-08-19 — Swing own profile)

- Settings includes My account: name, email, phone via `get_own_profile` / `update_own_profile` (`GET|PATCH /api/v1/me`). Role is read-only. Password change remains unavailable on LAN.
- `LanDialect.ownProfilePatchJson` uses English snake_case (`name`, `email`, `phone`). LAN `PHYSICIAN` maps to `Role.DOCTOR`.
- `./gradlew test --rerun-tasks` **PASS** — 42 tests / 11 classes.

### Remains unverified

- Live LAN login + list + profile PATCH — **NOT OBSERVED** (`cargo` not on PATH; nothing on :8787)
- GUI launch this session — **NOT OBSERVED**

### Understanding delta

- `PATCH /me` was already on the LAN server; it was not blocked. Next remaining LAN practice writes still missing: patient create, appointment create, billing, chart.

### Required next

1. Live login + list + own-profile PATCH when `medoc-lan-server` can run.
2. No further LAN-backed practice screens until patient/appointment/billing/chart REST exists.

---

**Prior phase label:** Swing LanDialect English LAN (2026-08-19)

### Verified (2026-08-19 — Swing LanDialect English LAN)

- `LanDialect` outgoing matches Medoc LAN `http/mod.rs`: `/api/v1/patients`, `/api/v1/appointments?date=`, login `password`, role wire `PHYSICIAN` → Swing `Role.DOCTOR`. Appointment kind `CHECKUP` → `FOLLOW_UP`. Patient `sex` / `date_of_birth` mapped to app `gender` / `dateOfBirth`.
- Inbound German field names still parsed as fallbacks (`LanDialectTest.mapsLegacyGermanPatientFieldsIfPresent`).
- `./gradlew test --rerun-tasks` **PASS** — 37 tests / 10 classes.

### Remains unverified

- Live LAN login + list against a rebuilt `medoc-lan-server` — **NOT OBSERVED** (`cargo` not on PATH; nothing on :8787)
- GUI launch this session — **NOT OBSERVED**

### Understanding delta

- The German-only LAN dialect is obsolete: Medoc LAN wires are English. `LanDialect` is now an English adapter with German inbound fallbacks, not the source of German wires.

### Required next

1. Live login + `list_patients` / `list_appointments` against `medoc-lan-server` when cargo/server is available.
2. No further LAN-backed practice screens until the HTTP API grows.

---

**Prior phase label:** Remaining German copy + English de.json (2026-08-19)

### Verified (2026-08-19 — leftover copy, default English, de.json = en.json)

- App errors, certificate FIRST/FOLLOW_UP, prescription ISSUED, catalog categories, dental status keys, chart tabs (`anamnesis` / `examination`) are English.
- Default i18n locale is `en`. `packages/shared/locales/de.json` values match `en.json`.
- Vitest subset **PASS** — 120 tests / 18 files (includes i18n-locales + treatment-catalog-categories).

### Remains unverified

- `cargo check` / `cargo test` — **NOT RUN** (`cargo` not on PATH).
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.
- Seed/demo German prose in `seed.rs`, DPIA text in `dsfa.rs`, some command-palette aliases — leftover German **sentences** may remain.
- Existing SQLite DBs — **NOT OBSERVED** (schema + stored enum/category values changed in place).
- Swing LAN live HTTPS — **NOT OBSERVED** (`LanDialect` outgoing English per prior pass).

### Understanding delta

- German is no longer kept in `de.json` values. The `de` language option currently shows English copy.
- Default UI language is English (`i18n.ts`).

### Required next

1. `cargo build` when cargo is on PATH.
2. Additive SQLite migration or reseed.
3. Sweep remaining German prose in seed/DPIA/comments if a clean-room English demo is required.
4. Prove Swing login + list against a rebuilt English LAN server.

---

**Prior phase label:** Swing conversion checklist docs (2026-08-19)

### Verified (2026-08-19 — Swing conversion checklist)

- Full screen/function/LAN map: sibling [`/Users/achraf/pro/Medoc-swing/CONVERSION.md`](../../Medoc-swing/CONVERSION.md) (outside this git tree).
- Pointer in this repo: [`swing-conversion-checklist.md`](swing-conversion-checklist.md); linked from [`actions.md`](actions.md).
- LAN path drift documented: Medoc `http/mod.rs` registers `/patients` and `/appointments`; Swing `LanDialect` still uses `/patienten` and `/termine`. Live HTTPS **NOT OBSERVED**.

### Remains unverified

- Live LAN login + list against a rebuilt `medoc-lan-server` — **NOT OBSERVED**
- GUI launch this session — **NOT OBSERVED**

### Understanding delta

- Conversion progress is now a checklist (Done / Subset / Stub / Not started / Blocked), not only README prose.
- Next product work is dialect/server path alignment, not more fake screens.

### Required next

1. Align `LanDialect` paths with live LAN (or keep dual routes on the server); prove with login + list.
2. No further LAN-backed practice screens until the HTTP API grows.

---

**Prior phase label:** Full English wires (2026-08-19)

### Verified (2026-08-19 — full English conversion, no skip list)

- IPC commands, SQLite tables/columns, enum wires, UI routes, RBAC actions, and i18n **keys** are English. Tauri/serde/sqlx German `rename` attributes were stripped.
- Collateral `_created_at` from the first wire pass was restored to `created_at`.
- Attachment document kind `UEBERWEISUNG` is `REFERRAL` (not payment `BANK_TRANSFER`).
- Vitest subset **PASS** — 111 tests / 16 files (includes prior 14 plus `chart-attachments` + `contract-domain`).

### Remains unverified

- `cargo check` / `cargo test` — **NOT RUN** (`cargo` not on PATH). Generated Rust enums/RBAC must match yaml on next build.
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.
- Live UI / existing SQLite DBs — **NOT OBSERVED**. Rewriting `0001_initial_schema.sql` in place breaks already-created databases (no additive migration).
- Swing LAN dialect in `/Users/achraf/pro/Medoc-swing` still expects German HTTP tokens unless updated.

### Understanding delta

- User overrode the keep-German-wires policy: nothing in app/code wires stays German except `de.json` **values**.
- Short-token maps (`art`→`kind`, `UEBERWEISUNG`→`BANK_TRANSFER`) caused collisions; ipc-bridge is now an identity passthrough.

### Required next

1. `cargo build` when cargo is on PATH.
2. Additive SQLite migration for existing installs (or accept wipe/reseed).
3. Convert remaining German **copy** still in code: PDF labels, `error.rs` “nicht gefunden”, catalog category DB strings (`Kontrolluntersuchung`, …), `ERST`/`FOLGE`, prescription `AUSGESTELLT`.
4. Align Swing `LanDialect` with English LAN routes **or** restore a dialect adapter.

---

**Prior phase label:** Swing week appointments + help (2026-08-19)

### Verified (2026-08-19 — Swing week appointments + help)

- Appointments Day / Week toggle. Week = seven `list_appointments` calls (Monday–Sunday). English UI keys.
- Help page. Billing, charts, orders, tickets, statistics, work time, administration open honest LAN stubs.
- `./gradlew test` **PASS** — 36 tests / 10 classes.

### Remains unverified

- Live LAN week list — **NOT OBSERVED**
- GUI launch this session — **NOT OBSERVED**

### Understanding delta

- LAN still has no appointment write or clinical/billing REST. Week view is composed from the existing day list.

### Required next

1. No further LAN-backed practice screens until the HTTP API grows (patient write, billing, charts).

---

**Prior phase label:** Full identifier conversion TS + Rust (2026-08-19)

### Verified (2026-08-19 — full identifier conversion)

- Token-aware rewrite of remaining German **identifiers** in TypeScript (269 + 29 files) and Rust (169 + 14 files). Strings/comments unchanged so IPC commands, routes, i18n keys, and SQL stay German.
- Rust persisted fields got `#[serde(rename = "…")]` / `#[sqlx(rename = "…")]`; Tauri commands got `#[tauri::command(rename = "list_appointments")]` (example) so the wire is unchanged.
- `config/enums.yaml` type/variant names are English; **wire values** still `PHYSICIAN`, `PLANNED`, `CASH`, …
- Vitest subset **PASS** — 106 tests / 14 files.

### Remains unverified

- `cargo check` / `cargo test` — **NOT RUN** (`cargo` not on PATH). Required after this pass (generated `OUT_DIR` enums must match yaml).
- Full `npm test` / `tsc --noEmit` — **NOT RUN**.
- i18n **keys** and UI **routes** still German (by policy, not this pass).
- `breakFrom` / `breakUntil` kept (persisted practice-preferences JSON).

### Understanding delta

- Conversion is identifier-only. SQLite columns, IPC command strings, enum wire tokens, and audit entity-marker strings remain German.

### Required next

1. Run `cargo build` so `domain_enums_generated.rs` matches English yaml names.
2. Full `npm test` + `tsc --noEmit`.
3. Optional later: English i18n keys (coordinated catalog pass).

---

**Prior phase label:** Englishify inventory — saldo / domain entities (2026-08-19)

### Verified (2026-08-19 — `balance_sheet_snapshot.rs` miss)

- File **was** scanned; gap was stem `saldo` (line 19 `balance_cents`) not in the glossary.
- Added stems: `saldo`, `as_of_date`, `gezaehlt`, `laut`, `stimmt`, `zurueck`/`begruendung`, `geliefert`, `unterwegs`, `bearbeitung`, `erledigt`.
- Rescan: **6872** unique identifiers, **104057** hits. `balance_cents` recorded at [`balance_sheet_snapshot.rs`](crates/shared/medoc-core/src/domain/entities/balance_sheet_snapshot.rs):19.
- Every `analyze_token` hit under `crates/shared/medoc-core/src/domain/entities/` is in the unique list (**0** missing).

### Remains unverified

- Rename of these Rust fields — not done (SQLite columns `balance_cents` stay German by policy).

---

**Prior phase label:** Englishify German-inventory cover-up (2026-08-19)

### Verified (2026-08-19 — last cover-up scan)

- Matcher now flags **fused German compounds** with no camelCase break (`bestellstamm`, `Rezeptverwaltung`, `zahlungsziel`, `Zahlbar`, `quittieren`, …): longest glossary stem as prefix; leftover stays German.
- Rescan: **1151** files, **776** with hits, **99547** line hits, **6811** unique identifiers.
- [`GermanToEnglish.json`](GermanToEnglish.json) `clipped.identifiers` **==** [`.englishify/clipped-identifiers.json`](.englishify/clipped-identifiers.json) (6811 keys).
- Live `collect_clipped()` matches the saved list (0 drift).
- Every first-party `files[]` match is in the unique list (**0** missing). `.englishify/` tokens are inventory/tooling only — not in the unique list by design.
- Independent family grep (`Zahl*|Behand*|Bestell*|Termin*|Akte*|…` in `.ts/.tsx/.rs/.js/.jsx`): **0** missing after English false-positive block (`terminal`/`terminated`/`terminals`).
- Must-haves present, including previously missed `ZahlRowAction`, `bestellstamm`, `zahlungsziel_text`, `Rezeptverwaltung`, `quittieren`.

### Remains unverified

- Rename pass for these identifiers — not done.
- Full `npm test` / `tsc` / `cargo check` — **NOT RUN** (inventory only).
- German **prose function words** not in the stem glossary (`innerhalb`, `wegen`, …) stay excluded by design (same as `und`/`der`/`die`).

### Understanding delta

- Coverage hole was fused lowercase/Pascal compounds (`Rezept`+`administration` with a lowercase `version`). CamelCase split cannot see the second noun. Prefix-stem match closes it.

### Required next

1. Rename clipped TS identifiers (`ZahlRowAction` → `PaymentRowAction`; `bestellstamm` **routes** stay German by policy).
2. Rust identifier pass still pending.

---

**Prior phase label:** Swing settings slice (2026-08-19)

### Verified (2026-08-19 — Swing settings slice)

- Settings page over LAN `get_app_kv` / `set_app_kv`. App and wire key is English `practice.preferences.v1` (LAN whitelist updated; legacy `practice.preferences.v1` kept for Tauri). App field is English `displayName`; writes merge so existing preference JSON is kept.
- Locale EN/DE on Settings refreshes sidebar copy. License/pairing stay on Tauri (honest hint).
- Sidebar **Settings** enabled (`/settings`).
- `./gradlew test` **PASS** — 35 tests / 10 classes (re-run after English KV key).

### Remains unverified

- Live LAN `app-kv` GET/PUT against `medoc-lan-server` — **NOT OBSERVED**
- Swing GUI launch this session — **NOT OBSERVED** (compile verified via tests)

### Understanding delta

- LAN stores a JSON blob, not a settings REST resource. Swing edits a subset (`displayName`) and merges. Full React settings (license, integrations, work hours) are not on this HTTP API.

### Required next

1. Billing/chart tabs stay placeholders until LAN REST grows.
2. Optional: live LAN QA of settings merge against a running `medoc-lan-server`.

---

**Prior phase label:** Swing dashboard slice (2026-08-19)

### Verified (2026-08-19 — Swing dashboard slice)

- English-only dashboard from `list_patients` + today's `list_appointments` (`DashboardController` / `DashboardPage`). No billing/orders/chart KPIs (not on LAN).
- Sidebar **Dashboard** enabled; post-login opens `/`.
- `./gradlew test` **PASS** — 30 tests / 9 classes.

### Remains unverified

- Live LAN dashboard against `medoc-lan-server` — **NOT OBSERVED**

### Understanding delta

- React dashboard pulls stats/orders/chart validation. Swing subset is honest: counts + today's appointment table only.

### Required next

1. Further Swing screens only where LAN REST exists (app-kv settings is the next real route). Billing/chart tabs stay placeholders.

---

**Prior phase label:** Swing appointments slice (2026-08-19)

### Verified (2026-08-19 — Swing appointments slice)

- Sibling client `/Users/achraf/pro/Medoc-swing`: login → sidebar → **read-only appointments day list** → patients → patient master data.
- LAN `GET /api/v1/appointments?date=` mapped in `LanDialect` (`date`/`time`/`kind`/`notes`/`chief_complaint`/`physician_id` → English app JSON).
- Mock adapter seeds today (2) + tomorrow (1). Create/update/delete stay `LanCommandUnavailableException`.
- `./gradlew test` **PASS** — 28 tests / 8 classes.

### Remains unverified

- Live LAN `list_appointments` against `medoc-lan-server` — **NOT OBSERVED**
- Full week/month calendar, drag/create — out of this slice (desktop Tauri only)

### Understanding delta

- LAN appointments are list-by-date only. Swing is a day table, not the React week grid.

### Required next

1. Optional: dashboard summary, then billing only if LAN REST grows.
2. Continue Englishify in the Medoc TS/Rust repo (unrelated track).

---

**Prior phase label:** Clipped-German cases in GermanToEnglish.json (2026-08-19)

### Verified (2026-08-19 — clipped section)

- Rescan wrote `clipped` into [`GermanToEnglish.json`](GermanToEnglish.json): **124** unique identifiers (`Zahl⊂Zahlung`, `Behand⊂Behandlung`, `Bestell⊂Bestellung`, …) with file:line examples.
- Same payload at [`.englishify/clipped-identifiers.json`](.englishify/clipped-identifiers.json).
- `ZahlRowAction` examples include `payment-row-actions-menu.tsx:6`. `befundText` excluded (full stem `finding`).

### Remains unverified

- Rename pass for these identifiers — not done.

---

### Verified (2026-08-19 — GermanToEnglish.json clipped stems)

- Matcher now treats camelCase prefixes of glossary stems (`Zahl` + `ung` → `payment` / payment) and adds `zahl`, `zuordnung`, `summe`.
- Prose articles (`und`/`der`/`die`/`für`) are no longer flagged as identifiers.
- Rescan: **1149** files listed, **765** with hits, **74346** hits.
- `ZahlRowAction` is recorded at [`payment-row-actions-menu.tsx`](apps/practice-host-ui/src/views/components/payment-row-actions-menu.tsx) **line 6** (was missing). Also `ZahlRowActionsMenu` line 40; `ZahlNewFormState`; `ZahlZuordnungSummaryRow`.

### Remains unverified

- Human pass over remaining clipped names; this is inventory only (no renames).

### Required next

1. Rename clipped TS identifiers (`ZahlRowAction` → `PaymentRowAction`, etc.) when doing the next Englishify pass.

---

### Verified (2026-08-19 — Swing Englishify rescan)

- Rescanned `/Users/achraf/pro/Medoc-swing` Java + i18n. App identifiers, commands, JSON fields, and UI keys are English.
- LAN German dialect is isolated in `packages/server/lan/.../LanDialect.java` (`password`, `role`, `PHYSICIAN`, `/api/v1/patients`, `date_of_birth`, …). Tests of that table live in `LanDialectTest`.
- German UI **values** stay in `messages_de.properties` only.
- Gender column/detail no longer show raw enum names; they use `patient.gender.*` i18n keys.
- Login rate-limit detection uses `LanDialect.looksRateLimited` (covers LAN German `"zu viele"`).
- `./gradlew test` **PASS** — 21 tests / 7 classes.

### Remains unverified

- Running the Swing UI (`:apps:practice-host-ui:run`) on a display — **NOT OBSERVED**
- HTTPS login to a real `medoc-lan-server` with `--lan-trust-all`

### Understanding delta

- Pass 1 left German LAN tokens scattered in adapters/tests. Pass 2 moved them into `LanDialect` so app code stays English while the live LAN server dialect still works.

### Required next

1. Optional: run mock-mode UI locally.
2. Later slices: appointments, then expand LAN REST if chart tabs should work outside Tauri.

---

**Prior phase label:** German inventory JSON (2026-08-19)

### Verified (2026-08-19 — GermanToEnglish.json)

- Scanner: `.englishify/scan_german_to_english.py` walked **1149** first-party files (no source file omitted; `.git` / `node_modules` / `target` / `dist` / `coverage` / `releases` only).
- Output: repo-root `GermanToEnglish.json` — each file path → `{line, match, english}` (line `0` = German in the path).
- **745** files with hits, **404** listed with empty arrays (scanned clean or binary), **83139** hits.
- Binary assets (png/pdf/`Cargo.lock`) listed empty; names in `_meta.skipped_binary` (20).

### Remains unverified

- Human review of false positives (`und` / `der` / `die` in prose; English adjective `staff` vs staff).
- This inventory is a scan, not a rename.

### Required next

1. Use the JSON to finish compound TS / Rust identifier Englishify.
2. Do not bulk-rename from this file without the keep-German policy (SQLite, enum wires, `de.json` values, IPC command strings, routes).

---

### Verified (2026-08-19 — TypeScript identifiers)

- TS/TSX identifiers in live code were rewritten German → English (types, functions, locals, object keys). IPC **command strings**, UI **routes**, and i18n **keys** stay German.
- `packages/shared/src/lib/ipc-bridge.ts` maps English TS fields ↔ German Tauri JSON (`date`→`date`, `kind`→`kind` or `kind` by command).
- Domain types in `packages/shared/src/models/types.ts` use English names (`Appointment`, `Payment`, `PatientChart`, `date_of_birth`, …). Enum **wire values** unchanged (`PHYSICIAN`, `PLANNED`, …).
- Vitest subset: 13 files, **96 tests PASS**.
- Route/settings **lookup keys** in `rbac.ts` restored to German (quoted) so they still match `App.tsx` (`appointments`, `administration`, settings `praxis` / `lizenz`).

### Remains unverified

- Full `npm test` / `npm run build` / `tsc --noEmit`
- Compound leftovers (e.g. `breakFrom` persisted KV JSON, `erst_oder_folge`, CSS class names, commented-out calendar demo)
- Rust structs/locals (`Termin`, `date`, …) and IPC command names
- i18n key namespaces

### Understanding delta

- Identifier rewriter must parse template `${…}` **and** regex literals; a `/"/` in a character class previously swallowed the rest of the file as a string.
- Short tokens `praxis` / `appointments` / `kind` / `kind` collide: route keys and i18n param names must stay quoted German; `kind`+`kind` in one object both became `kind`.

### Required next

1. Continue compound TS names that are not persisted keys (`breakFrom` needs a KV read alias if renamed).
2. Rust identifier pass (keep SQLite columns + `#[tauri::command(rename = "…")]` if function names change).
3. Full test/build; `cargo check` when `cargo` is on PATH.

---

### Verified (2026-08-19 — Swing sibling project)

- Sibling Gradle multi-module client at `/Users/achraf/pro/Medoc-swing` (outside this git tree). Modules mirror `apps/practice-host-ui`, `packages/shared`, `packages/app/practice-host`, `packages/server/lan`.
- Clinical chart tabs are honest LAN-unavailable placeholders.
- Transport: `PracticeSystemPort` + `HttpPracticeAdapter` (same command map as TS LAN adapter) + `MockPracticeAdapter` for offline demo.
- Tests: `./gradlew test` **PASS**. Java identifiers/commands English; LAN dialect isolated in `LanDialect`.
- Live LAN login against `medoc-server` — **NOT OBSERVED**.

### Remains unverified

- Running the Swing UI (`:apps:practice-host-ui:run`) on a display — **NOT OBSERVED**
- HTTPS login to a real `medoc-lan-server` with `--lan-trust-all`
- Further screens (calendar, billing, chart tabs) — out of this slice

### Understanding delta

- Swing cannot use Tauri IPC. It is a LAN-HTTP client like `apps/lan-web-client`, not a second desktop host.
- LAN REST has no per-patient or search route; Swing search/detail filter `list_patients`.

### Required next

1. Optional: run mock-mode UI locally (`./gradlew :apps:practice-host-ui:run`).
2. Later slices: appointments, then expand LAN REST if chart tabs should work outside Tauri.
3. Continue Englishify in this repo (unrelated track).

---

**Prior phase label:** Englishify source filenames (2026-08-19)

### Verified (2026-08-19 — code file names)

- **338** source files `git mv`’d German → English (tokenized on `-`/`_` so `praxis-aufgaben` → `practice-tasks`, not `practice-taskn`).
- Cargo crate folders (`medoc-practice`, `practice-host`) kept hyphenated.
- Rust `mod`/`use` module paths updated to match new files; leftover `*_repo` aliases rewritten (e.g. `akte_repo` → `chart_repo`).
- UI **routes** remain German (`/appointments`, `/administration`, …) to match `App.tsx` (filename pass does not change URLs). Accidental `/chartn` substring leak reverted.
- Vitest subset: 10 files, **76 tests PASS**.
- `cargo check` — **NOT RUN** (`cargo` not on PATH).
- Full `npm test` / `npm run build` — **NOT RUN**.

### Remains unverified

- Rust compile of renamed modules
- Every TS smoke test that imports pages
- Types/IPC/identifiers still German (`Termin`, `list_examinations`, …)

---

**Prior phase label:** Englishify completeness audit (2026-08-19) — **NOT CLEAN**

### Verified (2026-08-19 — repo-wide German scan)

- Claim “no German word exists” is **false**. Token grep + filename stem scan prove remaining German across `apps/`, `packages/`, `crates/`, `config/`.
- **256** paths with German-ish filenames (stems: `appointment`, `akte`, `administration`, `treatment`, …).
- Rust domain entities still German (`Anamnesebogen`, `Untersuchung`, `Termin`, `Zahlung`, …).
- TS `types.ts`: only `Examination` is English; `Termin`, `Patientenakte`, `Behandlung`, `Zahlung`, `Anamnesebogen`, etc. remain.
- `examination.test.ts` has no German identifier tokens (this file only).
- `de.json` German **values** are expected (locale); they are not an Englishify miss.

### Remains unverified

- Exhaustive word-by-word read of every file (256+ filename hits is a sample of stems, not every German lemma).
- Full `npm test` / `npm run build` — **NOT RUN**

---

**Prior phase label:** Englishify — Examination domain type (2026-08-19)

### Verified (2026-08-19 — Examination type fields)

- `Untersuchung` TS type is now `Examination` with English fields (`chart_id`, `chief_complaint`, `results`, `diagnosis`, `examination_number`, `category`, `service_name`, `total_cost`, …).
- `examination.test.ts` fixtures no longer use German property names.
- Tauri/SQLite still uses German column/JSON names; mapped only in `akte.controller.ts` (`ExaminationIpcRow`).
- Unit tests: `examination.test.ts` + related files **PASS** (24 in the filtered run).
- `tsc --noEmit`: no remaining **Examination**-related errors. Other pre-existing tsc errors remain (document-print-html, unused locals).

### Remains unverified

- Full `npm test` / `npm run build` — **NOT RUN**
- Rust `struct Untersuchung` and SQL table `examination` still German

---

### Verified (2026-08-19 — Englishify cluster)

- **Filenames:** `anamnesis.ts` → `anamnesis.ts`; `examination.ts` → `examination.ts` (+ tests); UI `AnamneseVisual` / `UntersuchungComposer` / `UntersuchungDetailPanel` → `anamnesis-visual` / `examination-composer` / `examination-detail-panel`.
- **Identifiers (this cluster):** `AnamnesisV1`, `parseAnamnesisV1`, `ExaminationV1`, `parseExaminationV1`, `ExaminationComposer`, `AnamnesisVisual`. Persisted JSON keys (`vorerkrankungen`, `krankenkasse`, `chief_complaint`, `total_cost`, …) and domain type `Untersuchung` **kept**.
- **i18n keys:** `anamnesis.field|visual.*` → `anamnesis.*`; `examination.composer|billing.*` → `examination.*`. Values unchanged.
- **CSS:** `.anam-acc-*` → `.anamnesis-acc-*`; `.examination-detail-sheet*` → `.examination-detail-sheet*`.
- **Tests:** `npm test -w medoc -- examination.test.ts akte-completeness.test.ts` — **PASS** (12).
- **i18n:** `node scripts/i18n-verify-parity.mjs` — **PASS** (4544 keys × 4).

### Remains unverified

- Full `npm test` / `npm run build` / `tsc` for this rename cluster — **NOT RUN** (only the two unit files above).
- Remaining German identifiers in `patient-detail.tsx`, `patient-detail-unter-tab.tsx`, `types.ts` (`Untersuchung`, `Zahnbefund`, …), IPC, routes, Rust modules.

### Understanding delta

- Bulk `apply_rename.py` is unsafe (substring bugs). File-by-file whole-token maps only.
- `apps/practice-host-ui/src/lib` is a **symlink** to `packages/shared/src/lib` — edit once.

### Required next

1. Continue file-by-file: `patient-detail-unter-tab.tsx`, then `patient-detail.tsx` / `use-patient-detail-clinical-actions.ts`.
2. Then `packages/shared/src/models/types.ts` domain types (code names only; keep SQLite/serde wires).
3. Then IPC command names + routes.
4. Run full `npm test` + `npm run build` before claiming the rename is complete.

---

**Previous phase label:** Sell-ready MVP + sync C8 (2026-07-05)  
**Last closed:** UI honesty, Arabic/RTL runtime fixes, CSS responsive, sync pull `last_seen_at` e2e test.

### Verified (2026-07-05 — Sell-ready MVP)

- **Workflow blinds:** `ONBOARDING_COACHMARK_ENABLED`, `WORKFLOW_ONBOARDING_PREFS_UI_ENABLED`, `WORKFLOW_AKTE_CONFIRMATION_PREFS_UI_ENABLED` remain **false**; documented in [`geplant.md`](geplant.md).
- **UI honesty:** License section shows portal-not-connected (no demo billing); E-Rezept button hidden when TI stub; CARD labeled as booking; replica sync errors in Deployment settings via `useReplicaSyncStatusStore`.
- **i18n/locale:** `bcp47ForLocale`, locale-aware `formatDate`/`formatCurrency`, 12+ `localeCompare` sites, statistics `Intl` tags, export section/report keys (4264 × 4 locales).
- **Print/export:** `document-print-html` / `clinical-pdf-layout` use active locale; export preview `lang`/`dir`; akte export section labels via `akteExportSectionLabel`.
- **RTL/CSS:** sidebar logical properties, appointment context menu RTL anchor, settings shell @900px, viewport min 1024px, fixed broken `@media 720px` brace.
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

- **Schema:** `work_time_pause_segment`, `work_time_preference`, `arbeitsplan_adjustment`; extended `sick_leave_certificate` + `pause_minutes` on sessions (`rust_only.rs`).
- **RBAC:** `work_time.self`, `work_time.team.read`, `work_time.admin`, `statistics.read` in `config/rbac.yaml`; routes in `rbac.ts`.
- **IPC:** 14 work-time commands + krank list/end + `list_work_plan_adjustments`; logout auto-end when `auto_record_on_logout`; **294** invoke handlers.
- **UI:** `/staff/work-time` (live timer, week bars, focus mode); `/administration/team/work-time`; Krankenbescheinigung Verwaltung; `sec-arbeitszeit` in Statistik; per-user auto-record in Arbeitsplan.
- **Tests:** `cargo test -p medoc-practice --lib work_time` **PASS** (2); invoke registry **PASS** (294); `npm test` **PASS** (242); `npm run build` **PASS**.

### Remains unverified

- Live Tauri manual QA of focus-mode nav + file upload Krankenbescheinigung on disk.
- Full `cargo test --workspace --tests` green (pre-existing medoc-core FK failures).

### Next

1. Manual smoke: RECEPTION login → Arbeitszeit; PHYSICIAN team overview; KB create/end.
2. v1 Wave 5 calendar/PDF export (separate track).

---

**Previous phase label:** MVP Security Hardening (2026-06-18)

### Verified (2026-06-18 — MVP security hardening)

- **TOCTOU fix:** `create_with_quota` / `update_with_quota` use `BEGIN IMMEDIATE` + `enforce_staff_quota_on_conn` before insert/update (`mvp_security.rs`, `staff.rs` repo).
- **Centralized limits:** `staff_quota_limits()` feeds `staff_quota()` and enforcement.
- **IPC guards:** `require_break_glass_enabled()` / `require_totp_enabled()` in break-glass, auth, staff TOTP commands.
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
- **Wave 4 (MVP):** `work_time_session` table + 7 IPC commands; `/staff/work-time`; `/administration/sick-leave-certificate`; auto-record on login hook.
- **Wave 5 (partial):** Bestellungen price column; table CSS `table-layout:fixed`; NEW→ACTIVE on first `create_appointment`. Calendar compression / PDF export **NOT DONE**.
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
- Stale version-model/architecture doc paths (R-004) — quarantined, not bulk-updated.

### Next

1. Geräteverbund: wire Noise transcript + mDNS (phase-handoff items).
2. G21b live Tauri sign-off when ready.
3. Optional: refresh high-traffic stale docs from [`retired-paths.md`](retired-paths.md) index.

---

**Previous phase label:** Geräteverbund evolution (2026-06-10)  
**Last closed:** Schema/domain/crypto/net/services/IPC/FE onboarding + admin panel; pairing shim; e2e seat caps; test fixes.

### Verified (2026-06-10 — Geräteverbund evolution)

- **Spec + schema:** `docs/version-model/03-architektur/feature-geraeteverbund.md`; migration `verbund_tables.rs`; domain `medoc-sync/src/verbund/`.
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
- **Reinstall reclaim:** `cluster_reclaim_device`, `suggestedReclaimFingerprint` on pending, admin panel actions.

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

- **UX:** Field hints on patient/appointment/deployment/pairing; patient abandon confirm; statistics Krankheitsbild empty hint.
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
**Last closed:** `project-truth.md` path refresh; legacy `app/` artifacts removed (~6.5 GB); lan-web appointments view.

### Verified (2026-06-06 — post-R10)

- **`project-truth.md`:** paths updated to `apps/`, `crates/`, repo-root CI/npm.
- **Cleanup:** removed stale `app/{target,node_modules,dist,coverage,test-results}`; `app/` is README + docs only.
- **LAN web:** login + Patienten + Termine (by date); `list_appointments_by_date` HTTP route alias.
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
**Previous closed:** 2026-05-31 — Posteingang was missing from `NAV_SECTIONS` (route/RBAC/badge existed). Added `/inbox` to Behandlung section. Fixed and validated `g21-routing.smoke.test.tsx` (row 1) and `ops.smoke.test.tsx` (row 7). **`npm test` 178 PASS**.

**Previous phase label:** Full Docker pipeline GREEN (OOM fix)  
**Previous closed:** 2026-05-31 — `validate-docker.sh` now uses `--shm-size=4g`, `CARGO_BUILD_JOBS=1`, and shared `medoc-target-linux-e2e` for Rust containers. **`bash scripts/validate-docker.sh` PASS** end-to-end (~7.4 min). **`npm test` 176 PASS** (prior session).

**Previous phase label:** Pro compare sweep — staff admin unlock UI  
**Previous closed:** 2026-05-31 — Compared remaining ~24 `app/` diffs; ported Login-Sperre UI to `staff.tsx`.

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
**Previous closed:** 2026-05-27 (morning) — `medoc-e2e` doubled from 20 → 40 HTTP integration tests (revocation/rotation, treatment+examination outbox lifecycle, serverful `lan_client` RBAC). One real security defect found and fixed: revoked slaves could keep using activation tokens on `/sync/*` and `/pairing/peers` because the gate trusted the token claims when `slave_permission` rows were missing. Real coverage numbers measured with `cargo-llvm-cov` + `@vitest/coverage-v8` and recorded below (no more hand-waving on "100% coverage"). See [`validation.md`](validation.md) 2026-05-27 block.

### 2026-05-27 (afternoon) — Verified

- **e2e count: 56** (was 40). Full Docker pipeline GREEN.
- **`medoc-e2e/tests/multi_replica_roundtrip.rs`** (9 tests):
  - `replica_push_applies_one_patient_row_on_master` — full HTTP roundtrip;
    asserted via `sync_applied` row, not vectors.
  - `replica_pull_sees_master_local_writes` — pulls patient + auto-created
    patient_chart after enabling serverless MASTER mode on the master.
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
  - `outbox_clinical_writes.rs` (3) — `treatment` lifecycle
    (create/update/delete) emits exactly 3 outbox rows; same for
    `examination`; `practice_desktop` mode emits zero (no sync).
  - `serverful_lan_client_flows.rs` (10) — RECEPTION vs PHYSICIAN JWT
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
- UI: replica `pairing-scan.tsx`, master `settings-pairing-inbox.tsx`,
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
- 15 view-page re-export shims (`settings-*-section.tsx`, `settings-lan-host.tsx`, `settings-company-portal-section.tsx`, `settings-praxis-billing.tsx`, `patient-detail.tsx`) deleted; consumers (notably `settings.tsx`, `App.tsx` lazy import, intra-system relative imports) repointed.
- `systems-structure.test.ts` now asserts the new layout instead of the legacy shims.
- `views/pages/` still contains ~53 not-yet-migrated pages (appointments, dashboard, staff, administration-*, etc.). These remain at their current path until a later wave decides to move them into `systems/practice-host/pages/`.

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
| `practice-host/pages/settings/` | **PASS** — 12 section modules + view stubs |
| `company-portal/pages/settings-company-portal-section` | **PASS** — view stub |
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
| LAN client UI (`settings-lan-host`) | **PASS** (code) — live **NOT OBSERVED** |
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
- **UI:** `settings-lan-host.tsx` shows fingerprint + `https://` URLs; `tlsCertSha256` on status DTO.
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
- **Ordering:** chain tip / verify use `rowid` (not `_created_at`) so same-second concurrent rows stay consistent.
- **Tests:** `audit_chain_concurrent_inserts_remain_valid` (50 tasks) **PASS**; CI `MEDOC_AUDIT_KEY` added.

### Phase 2.1 — Password policy

- **`crypto::evaluate_password_policy` / `validate_password_policy`:** ≥12 chars, upper, lower, digit.
- **Enforced:** `create_staff`, `change_password`, `set_staff_password_by_admin`.
- **UI:** `PasswordPolicyHints` on Personal + Einstellungen password flows; `password-policy.test.ts`.

### Phase 2.3 — TOTP 2FA

- **`totp-rs` v5** + `infrastructure/totp.rs`; columns `staff.totp_secret`, `totp_enrolled_at`.
- **PHYSICIAN:** login blocked until enrolled; optional `totp_code` on login / LAN API.
- **Commands:** `start/confirm_totp_enrollment`, `start/confirm_totp_enrollment_login`, `get_totp_status`.
- **UI:** login multi-step (enroll / verify); tests `totp_tests.rs` (5).

### Phase 2.2 — Re-hash on login

- **`auth_service::authenticate`:** upgrades legacy bcrypt to Argon2id after successful verify.
- **Test:** `crypto_tests::login_rehashes_legacy_bcrypt_to_argon2`.

### Phase 1.7 — Brute-force hardening

- **`BruteKey`:** `hashed_subject` via `audit_repo::subject_hmac` + `peer_ip` (`DESKTOP_PEER_IP` for Tauri login).
- **`brute_force_repo`:** table `brute_force_lockout`; hydrate on DB ready / LAN / company / headless server start.
- **Commands:** `admin_unlock_brute_force` (`staff.write`) clears all peer IPs for a subject.
- **Tests:** `tests/brute_force_tests.rs` (6) — IP/subject isolation, restart hydrate, admin clear.

### Document Phases A–E (GOZ invoice, AMVV prescription/certificate, praxis guards) — 2026-05-19

| Phase | Status | Evidence |
|-------|--------|----------|
| A Praxis model & settings | **Committed** `944fcd4` | `invoice-serviceItem.ts`, `settings-praxis-billing.tsx` |
| B DB & DTOs | **Done (uncommitted)** | `connection.rs` ALTERs; `prescription`/`certificate` entities + repos; FE schemas |
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

- **`clinical_pdf_layout.rs`:** per-kind renderers (certificate / prescription / quittung), DIN letterhead, gray table bands, patient panel, TK-style quittung summary + `Tag|Position|Kurzbeschreibung` columns.
- **`pdf.rs`:** shared `pdf_fill_rect`, `pdf_table_header_band`; invoice + Akte section styling.
- **Frontend:** `clinical-pdf-layout.ts` → `columnLayout`, `headerRightLines`, `footerMetaLines`; export picker passes `layoutJson`.
- **Tests:** `pdf_document_tests` 5/5 (invoice, akte, certificate, quittung markers); `clinical_layout_renders_pdf_bytes` unit test.

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
- **`domain/enums.rs`** — `include!` generated Rust + `NO_SHOW` serde test retained.

| Command | Result |
|---------|--------|
| `cargo test --tests` + `enums_codegen_tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (107 vitest) |

**Fix:** PDF integration tests no longer assert raw-byte `BSNR` (middle dot forces UTF-16 hex operand).

### Phase 3.6 — patient-scoped localStorage → SQLite (2026-05-20)

- **Already on SQLite:** `akte_validation`, `akte_next_termin_hint`, `rechnung_document` (+ one-shot LS migration helpers).
- **New:** Termin create drafts → `app_kv` key `appointment.draft.v1.{draftId}` (`appointment-draft.controller.ts`, `app_kv_policy` prefix whitelist).
- **Tests:** `appointment-draft.controller.test.ts` (3); `app_kv_policy` unit tests in Rust.

| Command | Result |
|---------|--------|
| `cargo test --tests` | **PASS** |
| `cargo clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (110 vitest) |

### Phase 3.7 — page decomposition (partial, 2026-05-20)

- **`lib/patient-detail-utils.ts`** — tab hash, validation helpers, treatment/prescription utils (~120 lines out of page).
- **`lib/appointment-calendar-ui.ts`** — labels, status pills, drag-pack logic, calendar constants (~200 lines out of `appointments.tsx`).
- **`lib/settings-format.ts`** — EUR/date/portal pill helpers from `settings.tsx`.
- **Line counts:** `patient-detail` 5091, `appointments` 2338, `settings` 2873 (was ~10.6k combined).

| Command | Result |
|---------|--------|
| `cargo test --tests` + clippy | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

### Phase 3.7b — appointment components (partial, 2026-05-20)

- **`appointment-detail-drawer.tsx`**, **`appointment-context-menu.tsx`**, **`appointment-month-calendar.tsx`**, **`appointment-doctor-legend.tsx`** — extracted and wired from `appointments.tsx`.
- **`appointments.tsx`:** ~1295 lines (was ~2338); month/week/day views in dedicated components.
- **`appointment-week-day-grid.tsx`:** week grid, day split, appt blocks, timeline hooks (~748 lines).

| Command | Result |
|---------|--------|
| `cargo test --tests` + `clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

**Phase 3.7b patient-detail:** **Done** — shell `patient-detail.tsx` ~2126 lines (was ~5091); tabs in `patient-detail-{stamm,anam,anlage,behand,unter,zahl}-tab.tsx`; prescription/certificate via `patient-detail-prescription-tab.tsx` + `use-patient-detail-prescription-tab.ts` + `patient-detail-prescription-tab-panel.tsx` + `lib/patient-detail-prescription-actions.ts`.

**Calendar UI (2026-05-20):** Pause / Notfall toolbar + confirm dialogs **disabled** in `appointments.tsx` (commented; filter „Notfall (Priorität)“ unchanged).

**Einstellungen:** **Done** — 13 section modules + shell `settings.tsx` ~470 lines (was 2874, −84%).

| Command | Result |
|---------|--------|
| `cargo test --tests` (MEDOC_* env) | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

## Gap remediation wave 2 (2026-05-21)

### Verified

| Item | Evidence |
|------|----------|
| G8 Krankheitsbild panel + CSV | `statistik_commands.rs` `krankheitsbilder_*`; `statistics.tsx` `sec-krankheitsbilder` |
| G9 Dashboard 24h reminders | `list_upcoming_appointments` + `dashboard.tsx` panel |
| G10 Integration stubs honesty | `integration-capabilities.ts` + integrationen section |
| G7 Autocomplete | Pre-existing toggle; confirmed in Arbeitsabläufe |
| CAL2 Emergency toolbar | `calendarEmergencyToolbarEnabled` + appointments banner + settings checkbox |
| G6 Onboarding (partial) | `OnboardingCoachmark` in `app-layout` |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `clippy -D warnings` | **PASS** |
| `npm lint/test/build` | **PASS** (114 vitest) |

### Remains unverified

- Live UI: validation nav badges, backup restore, dashboard upcoming list, statistics Krankheitsbild panel, onboarding coachmark dismiss — **NOT OBSERVED**.

### Understanding delta

- CAL2 resolved as **formal feature flag** (default off) rather than re-enabling commented toolbar code.
- G8 uses **Behandlungsaggregaten as proxy** until structured ICD diagnosis data exists.

## Gap remediation wave 3 (2026-05-21)

### Verified

| Item | Evidence |
|------|----------|
| G0 doc sync | `project-truth.md`, `06-validierung.md` §6.3a WAAD matrix updated |
| G3 error surfacing (more) | `app-layout` break-glass, `appointments` plan load, `onboarding-coachmark` KV |
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
| G6 | PHYSICIAN routes + certificates/audit; settings progress % + reset |

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
| G13 FA-LEIST-05 | Pflichtenheft + traceability: Freigabe on B/U, not Katalog-`serviceItem` |
| N3 billing | `billing-release-flow.test.ts` + `zahlung_repo_tests` |
| G3 praxis sync | Toasts on `syncInvoicePraxisToAppKv` failure |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `npm lint/test/build` | **PASS** (124 vitest) |

## Gap remediation wave 9 (2026-05-21)

| Item | Evidence |
|------|----------|
| N1 | `README.md` — desktop `app/` only, no phantom `src/` release |
| N4 | `suggestAlternativeTerminSlots` in `appointment-availability.ts`; conflict toast in `appointment-create.tsx` |
| N5 | `migrateInvoicePraxisLocalStorageToAppKv` + login hydrate in `app-layout.tsx` |

| Command | Result |
|---------|--------|
| `npm lint/test/build` + `cargo test --tests` | **PASS** (127 vitest) |

## Gap remediation wave 11 (2026-05-21)

| Item | Evidence |
|------|----------|
| G14 FA-LEIST-06 | `zahlung_repo::ensure_open_booking_for_billable_behandlung`; FE `billing-open-booking.ts`; PHYSICIAN → Tab `zahl` |

| Command | Result |
|---------|--------|
| `cargo test --tests` + `npm lint/test/build` | **PASS** (129 vitest, 4× `zahlung_repo_tests`) |

## Gap remediation wave 10 (2026-05-21)

| Item | Evidence |
|------|----------|
| N6 | `administration.team.read`, `administration.practice_planning.read/write` in `config/rbac.yaml`; routes + `praxis_commands` |
| N2 | CI job `tauri-smoke` (`--debug --no-bundle`) |
| G3 | Portal fetch `null` documented in `settings.tsx` |

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

- **G21a:** `collaboration-g21.test.ts`, `inbox.smoke.test.tsx`, `patientDetailTabBlocked`, `POSTEINGANG_POLL_MS`.
- **Validation:** 139 vitest; full stack **PASS**.

## Wave 15 delta (2026-05-21)

- **G17-fix:** `inbox` in `ROUTE_VISIBILITY` + `NAV_SECTIONS` (route was denied; nav item never shown).
- **G20:** Tickets page banner → Posteingang; nav/native-go-menu ordering.
- **Validation:** 132 vitest; `backup_tests` 3/3; `cargo test --tests` **PASS**.

## Wave 14 delta (2026-05-21)

- **G2b:** `restore_from_backup` re-encrypts plaintext `VACUUM INTO` snapshots via `sqlcipher::migrate_plaintext_to_sqlcipher` (`backup.rs`).
- **G19:** PHYSICIAN „Aufgabe an Rezeption“ in `patient-akte-workflow-dialogs.tsx` + shell header.
- **Validation:** `backup_tests` 3/3; `cargo test --tests` **PASS**; `npm lint/test/build` **PASS** (130 vitest).

## Wave 12 delta (2026-05-21)

- **G15 FA-LEIST-07:** `examination` billing columns; `ensure_open_booking_for_billable_untersuchung`; FE `UntersuchungBillingFields` + `payment-buchung` Soll for U-lines.
- **Validation:** `cargo test --tests` **PASS**; `npm lint/test` **PASS** (130 vitest).

## Continuity tokens

- **Local Rust builds:** `export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`
- **LAN TLS files:** `{app_data_dir}/lan-tls.crt`, `lan-tls.key`
