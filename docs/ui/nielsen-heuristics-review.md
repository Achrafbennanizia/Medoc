# Nielsen heuristics review — MeDoc practice app

Status: November 2026, branch `claude/ui-ux-architecture-refactor-ea9775`.
Scope: every screen reachable from the shell (login, dashboard, appointments, patients and the patient record,
tasks, finance, administration, settings, help) plus the pre-shell gates (database setup, licence, pairing,
cluster onboarding).

Each heuristic lists **what the app does now** (with the file that owns the behaviour, so a regression can
be traced) and **what is still open**. "Open" items are ordered by impact.

---

## H1 — Visibility of system status

**Now**
- One status vocabulary for the whole app: `packages/shared/src/lib/status/status-registry.ts` defines 22
  entities (appointment, patient, chart, treatment, prescription, certificate, payment, invoice, contract,
  practice task, device, pairing, connection…). Every badge is rendered by `StatusBadge`, so the same word
  always has the same colour, tooltip and meaning. Full guide: `docs/manual/status-guide.<lang>.md`.
- Tables that used to print raw wire values (`ISSUED`, `ACTIVE`, `DRAFT`) now show the translated badge:
  prescriptions list, privacy (GDPR) list, records-to-validate queue.
- Notifications: polled sources → notification centre → OS notification + optional chime
  (`packages/app/practice-host/src/notifications/`). Unread count in the top bar.
- Contract activation shows the cost accrued so far and the cost up to the chosen deactivation date
  before confirming (`administration-contracts.tsx`).
- Clock is corrected against the host (`practice-clock.ts`), so "today", "overdue" and countdowns agree
  on every device.

**Open**
1. Long exports (PDF batch, balance sheet) show a spinner but no progress fraction.
2. LAN sync state is only visible in Settings → Network; a small connection dot in the top bar would
   surface "offline / syncing / conflict" where people work.

## H2 — Match between system and the real world

**Now**
- Status names follow practice language (e.g. *Checked in*, *In treatment*, *Ready for billing*) and every
  status has a one-sentence description in all four languages.
- Dates, times, currency and numbers use the selected locale; Arabic renders RTL, including PDFs
  (`pdf/text.rs` bidi pass, bracket mirroring).
- PDFs are generated in the app's language unless the user pins a document language
  (`document-locale.ts`).

**Open**
1. Some administration labels are still developer terms ("Order master", "Special blocks"); rename in
   the locale files after checking with users.

## H3 — User control and freedom

**Now**
- Status transitions are explicit: only allowed next statuses are offered (`canTransition`,
  appointment drawer, task flow), and reversible steps offer *Reopen*.
- Destructive actions use `ConfirmDialog`; contracts are **deactivated** (with an end date) instead of
  deleted, and can be re-activated.
- `Esc` closes every dialog/drawer; `G` sequences and `⌘K` let people jump out of any page.

**Open**
1. No undo toast after delete (e.g. *Task deleted — Undo*). The toast store needs an action slot first;
   then wire it for tasks and blocked times.

## H4 — Consistency and standards

**Now**
- **Tables:** one `DataTable` primitive (`packages/ui/src/data-table.tsx`) for list/master-detail tables:
  services, treatment catalogue, products, staff, contracts, special closure times, templates,
  purchase orders, order-master combinations, prescriptions, certificates, cash receipts, privacy, audit
  log, records to validate, work days, LAN discovery hits. Same header, row height, selection marker,
  keyboard behaviour, truncation tooltip and responsive column hiding everywhere.
- **Spacing:** inline styles and feature CSS use the 4/8 px token scale (`--space-1…8`) instead of
  off-grid values (6/10/14/18/22 px). The density and accessibility settings now scale those gaps too.
- **Master-detail panes:** a single owner (`styles/layout/master-detail.css`) keeps the right-hand pane
  sticky with its own scrollbar, sized from the measured visible height of `<main>`.
- **Errors:** every error has a stable code `MD-<AREA>-NNN`, the same text in UI, logs and the manual.

**Open**
1. Tables that edit rows in place (patient record: prescriptions, certificates, payments, treatment
   groups; staff work plan; statistics pivots; day-close form; export pickers) keep bespoke markup.
   They should move to a second primitive (`EditableTable`) rather than be forced into `DataTable`.
2. The finance transactions table uses incremental scrolling; it needs `DataTable` to support a scroll
   container ref before it can migrate.

## H5 — Error prevention

**Now**
- Status capabilities (`statusAllows(entity, status, "edit" | "delete" | "reschedule" | "bill" …)`) hide or
  disable actions that the status forbids — e.g. a completed appointment cannot be dragged in the
  calendar, an issued prescription cannot be deleted.
- Backend enforces the same transitions (`AppointmentStatus::require_transition`), so the UI cannot be
  bypassed.
- Contract deactivation date is validated against the start date before saving.
- Backups: two snapshots in the same second no longer collide (restore used to abort).

**Open**
1. Forms validate on submit; inline validation on blur for required fields (patient create, appointment
   create) would catch mistakes earlier.

## H6 — Recognition rather than recall

**Now**
- Command palette (`⌘K`) lists pages and actions with their shortcut.
- Help → Keyboard shortcuts is generated from the shortcut registry (`packages/shared/src/lib/shortcuts.ts`),
  so it can never drift from the handlers. Sequences render as `G → D`.
- Status tooltips explain what each state means and what can be done next.
- Insurance-number search suggestions appear while typing when the setting is on.

**Open**
1. Recently opened patients are not offered in the palette; add a "Recent" group.

## H7 — Flexibility and efficiency of use

**Now** (all listed in Help → Keyboard shortcuts)
- Global: `⌘K` / `⇧⌘P` palette, `⌘N` new appointment, `⇧⌘N` new patient, `⇧⌘T` new task, `/` focus search,
  `⌘,` settings, `⌘/` shortcut list, `?` help, `Alt+1…9` sidebar items.
- Go-to sequences: `G D` dashboard, `G A` appointments, `G P` patients, `G T` tasks, `G F` finance,
  `G S` settings, `G H` help.
- Calendar: `D/W/M` views, `T` today, `N` new, `←/→` previous/next.
- Tables: `↑/↓` move between rows, `Enter`/`Space` open the row.
- Appearance: text size, contrast, density, reduced motion, larger click targets, start page.

**Open**
1. Shortcuts are not user-remappable.
2. No bulk actions in tables (multi-select + action bar).

## H8 — Aesthetic and minimalist design

**Now**
- About 400 lines of per-table CSS (`nth-child` width hacks, duplicate sticky rules) were removed; column
  widths live next to the column definition.
- Secondary table columns hide by container width (`hideBelow`) instead of squeezing every column.
- Row actions are a single non-wrapping group aligned to the end of the row.

**Open**
1. The dashboard still shows every widget to every role; role-specific defaults would cut noise.

## H9 — Help users recognise, diagnose and recover from errors

**Now**
- Error catalogue with 482 codes (`packages/shared/src/lib/errors/error-catalog.ts`), each with cause and
  fix in four languages: `docs/manual/error-codes.<lang>.md`.
- Help → Recent errors lists the session's errors with code, page and time, and can copy them for support.
- Backend errors are sent as `error.<domain>.<name>|param=value`, so the UI can show a translated message
  instead of raw English.

**Open**
1. "Retry" is offered on page load errors but not on failed background sync items in the notification
   popover.
2. Recent errors do not yet link each code to its manual entry.

## H10 — Help and documentation

**Now**
- Help centre with manual, status guide, error catalogue and shortcuts, all generated from source
  (`npm run manuals`, checked by `npm run manuals:check`).
- Contextual hints on complex forms (e.g. the treatment-plan hint in appointment create).

**Open**
1. No first-run tour for new staff accounts.

---

## How to keep this true

- New list table → use `DataTable`; never add `nth-child` width rules.
- New status → add it to the status registry, then run the i18n patch and `npm run manuals`.
- New error → use a coded `AppError`, rerun `scripts/errors/generate-error-catalog.mjs`.
- New shortcut → add it to `shortcuts.ts` and the handler in `use-global-shortcuts.ts`.
- New spacing → `var(--space-N)` only.
