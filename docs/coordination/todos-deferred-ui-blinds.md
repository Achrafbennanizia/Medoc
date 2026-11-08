# Deferred UI blinds — incomplete options skipped for now (TODO)

**Purpose:** Catalog of **UI options we intentionally hid or commented out** because they are incomplete or need more effort. Use this list when polishing a page later — do **not** treat these as bugs.

**Last updated:** 2026-11-07

**Related deferred trackers (larger scopes):**

| Tracker | Scope |
| --- | --- |
| [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) | v1 flags, connectors, license meters, onboarding coachmarks |
| [`todos-deferred-features.md`](todos-deferred-features.md) | Datenschutz (DSGVO) UI |
| [`todos-deferred-security-features.md`](todos-deferred-security-features.md) | Break-Glass, 2FA |
| [`todos-deferred-roles.md`](todos-deferred-roles.md) | TAX_ADVISOR / PHARMA_CONSULTANT |
| [`geplant.md`](geplant.md) | Planned product work overview |

---

## How to use

1. When skipping an incomplete control: **comment it out** (or gate with a flag), add a `TODO(later)` pointing here, and **add a row** below.
2. When restoring: follow the re-enable steps, remove/update the row, update [`actions.md`](actions.md) if needed.

---

## Calendar appointment sidebar — Call / Reminder (email) — OFF

**Flag:** `APPOINTMENT_CALL_REMINDER_ENABLED = false` in [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts) (and [`apps/practice-host-ui/src/lib/v1-ui-flags.ts`](../../apps/practice-host-ui/src/lib/v1-ui-flags.ts))

**Gate:**

| Surface | What was removed |
| --- | --- |
| Calendar **side drawer** (`appointment-detail-drawer.tsx`) | **Call** (`appointment.drawer.call`) and **Reminder** (`appointment.drawer.reminder`, mail icon — intended email/SMS reminder) |
| Calendar **context menu** (`appointment-context-menu.tsx`) | **Reminder** item |

**Why deferred:** Both actions only toast. Call does not place a phone call. Reminder does not send email or SMS (`appointments.page.reminder_prepared`: “dispatch via TI connector later”). Hide until telephony and outbound email/SMS are wired.

### Re-enable checklist

1. Set `APPOINTMENT_CALL_REMINDER_ENABLED = true`.
2. Replace toast handlers in `appointments.tsx` (`onPhone`, `onReminder`) with real call and email/SMS reminder send.
3. QA: drawer Call with/without phone; Reminder from drawer and from calendar context menu.

---

## Patient list — Show archived — OFF

**Flag:** `PATIENT_LIST_SHOW_ARCHIVED_ENABLED = false` in [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts) (and [`apps/practice-host-ui/src/lib/v1-ui-flags.ts`](../../apps/practice-host-ui/src/lib/v1-ui-flags.ts))

**Gate:** [`patients.tsx`](../../apps/practice-host-ui/src/views/pages/patients.tsx) status filter row — **Show archived** checkbox (`patient.filter.show_archived`).

**Kept:** Patient list without archived rows. Backend `showArchived` filter stays available.

**Why deferred:** Archived browse is not ready to ship on the patient list.

### Re-enable checklist

1. Set `PATIENT_LIST_SHOW_ARCHIVED_ENABLED = true`.
2. QA: checkbox off hides archived patients; on includes them; search and status filters still match.

---

## Patient list overflow — Email / Call — OFF

**Flag:** `PATIENT_LIST_CALL_EMAIL_ENABLED = false` in [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts) (and [`apps/practice-host-ui/src/lib/v1-ui-flags.ts`](../../apps/practice-host-ui/src/lib/v1-ui-flags.ts))

**Gate:** [`patients.tsx`](../../apps/practice-host-ui/src/views/pages/patients.tsx) row **⋯** menu — **Email** (`mailto:`) and **Call** (`tel:`), plus the disabled “no contact” item.

**Why deferred:** Desktop `mailto:` / `tel:` is not a practice-ready mail or telephony workflow (same gap as calendar Call / Reminder). Hide until outbound email and calling are wired.

### Re-enable checklist

1. Set `PATIENT_LIST_CALL_EMAIL_ENABLED = true`.
2. Replace `window.location.href = mailto:` / `tel:` with the same send/call path as appointment reminders (or a documented OS-handler fallback).
3. QA: menu with email only, phone only, both, and neither.

---

## Chart validation queue — Decline — OFF

**Flag:** `CHART_QUEUE_DECLINE_ENABLED = false` in [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts) (and [`apps/practice-host-ui/src/lib/v1-ui-flags.ts`](../../apps/practice-host-ui/src/lib/v1-ui-flags.ts))

**Gate:**

| Surface | What was removed |
| --- | --- |
| Dashboard **Pending approvals** (`dashboard.tsx`) | **Decline** button |
| **Records to validate** (`charts-to-validate.tsx`) | **Decline** button |

**Kept:** **Validate** and the **X** remove-from-list control (still calls `decline_patient_chart`). Backend `decline_patient_chart` is unchanged.

**Why deferred:** Decline needs a clearer chart-status / return-to-reception flow before it sits next to Validate on dense queue rows.

### Re-enable checklist

1. Set `CHART_QUEUE_DECLINE_ENABLED = true`.
2. Confirm declined charts leave the queue with the intended status (not an accidental delete).
3. QA: dashboard Pending approvals + `/charts/to-validate`; Validate vs Decline vs X; row click still opens the patient.

---

## Workflows — Reminder before appointment / No-show treatment — OFF

**Flag:** `WORKFLOW_APPOINTMENT_REMINDER_NOSHOW_UI_ENABLED = false` in [`packages/shared/src/lib/settings-ui-flags.ts`](../../packages/shared/src/lib/settings-ui-flags.ts) (and [`apps/practice-host-ui/src/lib/settings-ui-flags.ts`](../../apps/practice-host-ui/src/lib/settings-ui-flags.ts))

**Gate:** [`settings-workflows-section.tsx`](../../packages/app/practice-host/src/pages/settings/settings-workflows-section.tsx) Appointment rules selects; [`practice-preferences.tsx`](../../apps/practice-host-ui/src/views/pages/practice-preferences.tsx) same two fields.

**Why deferred:** Values persist in practice `app_kv` but do not drive SMS/email reminders, finance no-show fees, or booking blocks. Dashboard “next 24 hours” is hardcoded independently.

### Re-enable checklist

1. Set `WORKFLOW_APPOINTMENT_REMINDER_NOSHOW_UI_ENABLED = true`.
2. Wire `prefs.reminder` (hours: 0 / 2 / 24 / 48) to a real reminder send (and optionally the dashboard window).
3. Wire `prefs.noShow` (`warn` / `fee` / `block`) when marking `NO_SHOW`: mark only vs finance note vs internal patient flag.
4. QA: Settings → Workflows and Practice preferences; save + reload; no-show from calendar.

---

## Report Import… (all pages) — OFF globally

**Flag:** `REPORT_IMPORT_UI_ENABLED = false` in [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts)

**Gate:** [`report-export-toolbar.tsx`](../../apps/practice-host-ui/src/views/components/report-export-toolbar.tsx) — Import button only renders when the flag is true **and** the caller passes `showImport`.

**Why deferred:** JSON/XML report round-trip import is incomplete / needs more effort before shipping.

### Per-page call sites (Import blinded)

| Page | Blinded | Export kept? | Where |
| --- | --- | --- | --- |
| **Analytics** (`/statistics`) | Entire Export+Import toolbar commented out | No (toolbar hidden) | `apps/practice-host-ui/src/views/pages/statistics.tsx` |
| **Finance** (`/finance`) | `showImport` commented | Yes | `apps/practice-host-ui/src/views/pages/finance.tsx` |
| **Balance sheet** | `showImport` commented | Yes | `apps/practice-host-ui/src/views/pages/balance-sheet.tsx` |
| **Audit log** | `showImport` commented | Yes | `packages/app/practice-host/src/pages/audit.tsx` |
| **Compliance** | `showImport` commented | Yes | `packages/app/practice-host/src/pages/compliance.tsx` |

### Re-enable checklist (report Import)

1. Set `REPORT_IMPORT_UI_ENABLED = true` in `v1-ui-flags.ts`.
2. Uncomment `showImport` on each page that should offer Import (Finance, Balance sheet, Audit, Compliance — and Analytics if the full toolbar is restored).
3. For Analytics: also restore `ReportExportToolbar` / `buildExportBundle` (currently fully commented).
4. QA: import JSON and XML round-trip on each page; verify preview + error handling (`export.report.import_*` i18n).

### Not in scope (do not blind via this flag)

| Feature | Why left alone |
| --- | --- |
| License / activation import onboarding | Required for first-run / USB activation |
| Ops CSV patient import | Admin ops tooling (separate product decision) |
| Chart scanner import dialog | Clinical attachment flow |

---

## Other skipped UI (pointers)

| Item | Notes |
| --- | --- |
| Overview — Audit log CTA | Removed from Approvals card (`dashboard.tsx`) — product choice |
| Overview — Stock KPI | Removed (`dashboard.tsx`) — product choice |
| Subscription plan tier picker | Comment in `subscription-register.tsx` / `geplant.md` |
| Calendar appointment sidebar — Call / Reminder (email) | `APPOINTMENT_CALL_REMINDER_ENABLED` — drawer + context menu |
| Chart validation queue — Decline | `CHART_QUEUE_DECLINE_ENABLED` — dashboard + Records to validate |
| Patient chart workflow header buttons | `PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED` — see v1 surfaces doc |
| Patient list — Show archived | `PATIENT_LIST_SHOW_ARCHIVED_ENABLED` — status filter row |

### Code markers

```text
TODO(later): restore … — see docs/coordination/todos-deferred-ui-blinds.md
REPORT_IMPORT_UI_ENABLED
APPOINTMENT_CALL_REMINDER_ENABLED
CHART_QUEUE_DECLINE_ENABLED
WORKFLOW_APPOINTMENT_REMINDER_NOSHOW_UI_ENABLED
PATIENT_LIST_SHOW_ARCHIVED_ENABLED
```
