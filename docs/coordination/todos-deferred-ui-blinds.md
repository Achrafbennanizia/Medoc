# Deferred UI blinds — incomplete options skipped for now (TODO)

**Purpose:** Catalog of **UI options we intentionally hid or commented out** because they are incomplete or need more effort. Use this list when polishing a page later — do **not** treat these as bugs.

**Last updated:** 2026-09-04

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
| Patient chart workflow header buttons | `PATIENT_CHART_WORKFLOW_HEADER_BUTTONS_ENABLED` — see v1 surfaces doc |

### Code markers

```text
TODO(later): restore … — see docs/coordination/todos-deferred-ui-blinds.md
REPORT_IMPORT_UI_ENABLED
```
