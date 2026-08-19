# Translation changes — English code layer + app-wide i18n

English (`en`) is the **source/fallback** locale. Catalog: [`packages/shared/locales/{en,de,fr,ar}.json`](packages/shared/locales/en.json). Runtime: [`packages/shared/src/lib/i18n.ts`](packages/shared/src/lib/i18n.ts).

---

## Part 1 — Phase 1: English code layer

### 1A. Comments (German → English)

- Mechanical pass across scan roots: `apps/practice-host-ui/src`, `packages/app/practice-host/src`, `packages/ui/src`, `packages/server/lan/src`, `packages/server/company/src`, `apps/lan-web-client/src`, `packages/shared/src`.
- ~97 files updated; symbol names in comments left verbatim when backend-coupled.
- **Validation** (2026-06-29): umlaut-in-comment sweep → **0 hits** (one false positive in `dental.ts` regex code, not a comment).

### 1B. Developer strings (throws / console)

| File | Change |
|------|--------|
| [`billing-release.ts`](packages/shared/src/lib/billing-release.ts) | `billingReleaseError(t, entityLabel)`; `billingReleaseErrorDe` deprecated (English body); `requireReleasedForBilling` accepts optional `t` |
| [`http-practice.adapter.ts`](packages/app/practice-host/src/adapters/http-practice.adapter.ts) | English LAN config/command throws; `formatLanPracticeError(e, t, tp)` for UI boundaries |
| [`quittung-export-flow.ts`](packages/shared/src/lib/quittung-export-flow.ts) | English throw when praxis incomplete |
| [`export.ts`](packages/shared/src/lib/export.ts) | English throw |
| [`report-import.ts`](packages/shared/src/lib/report-import.ts) | English XML parse throws |
| [`tagesabschluss-invoice-pdf.ts`](packages/shared/src/lib/tagesabschluss-invoice-pdf.ts) | English throw; `praxisMissingFieldLabel` + `translateLocale` for field names in PDF error text |

**Validation**: umlaut-in-throw/console sweep → **0 hits**.

### 1C. Renamed identifiers (frontend-only)

| Old | New | Call sites |
|-----|-----|------------|
| `billingReleaseErrorDe` | `billingReleaseError` (preferred) | [`billing-release-flow.test.ts`](packages/shared/src/lib/billing-release-flow.test.ts) still uses deprecated alias for IPC contract test |

---

## Part 2 — Keep-as-is identifiers (do not rename)

| Category | Examples | Reason |
|----------|----------|--------|
| Enum / serialized values | `OPEN`, `IN_PROGRESS`, `AUSGESTELLT`, `DRAFT`, `Arbeitsunfähigkeitsbescheinigung` | Backend / DB / API |
| DTO / type names | `Patient`, `Termin`, `Zahnbefund`, `PraxisAufgabe`, `Behandlung` | TypeScript domain model |
| DB fields | `tooth_number`, `finding`, `patient_id`, `password`, `insurance_number` | Schema-coupled |
| Backend-keyed map keys | `st["Durchgeführt"]` in [`statistics.tsx`](apps/practice-host-ui/src/views/pages/statistics.tsx) | Stats API keys |
| German route segments | `/settings`, `/administration` | URL identifiers, not display |
| Persisted clinical payloads | `(Zähne …)` in [`appointment-create.tsx`](apps/practice-host-ui/src/views/pages/appointment-create.tsx) | Stored in records |
| Generated PDF/print (Rust + TS layout) | German column labels in [`report-export.ts`](packages/shared/src/lib/report-export.ts), [`clinical-document-pdf.ts`](packages/shared/src/lib/clinical-document-pdf.ts) | Out of interactive UI scope |
| Demo / seed data | `DEFAULT_KATEGORIEN`, `DEMO_VERTRAEGE` | Not production UI copy |
| Filename heuristics | `Foto-`, `Anlage-` in [`akte-attachments.ts`](apps/practice-host-ui/src/platform/akte-attachments.ts) | Persisted filenames |

---

## Part 3 — Phase 2: Display externalization

### Catalog

- **4081 keys × 4 locales** (`npm run i18n:verify` PASS as of 2026-06-29 follow-up).

### 2A. Dental status + mini bar

| File | Keys / helpers |
|------|----------------|
| [`dental.ts`](packages/shared/src/lib/dental.ts) | `DENTAL_STATES` → `labelKey`; `dentalStatusLabel(t, key)` |
| [`DentalMiniBar.tsx`](apps/practice-host-ui/src/views/components/DentalMiniBar.tsx) | `dental.mini.*`, `dentalStatusLabel` |
| [`DentalChart.tsx`](apps/practice-host-ui/src/views/components/DentalChart.tsx) | `dentalStatusLabel` in brush footer |

Keys: `dental.status.*` (8), `dental.mini.title`, `dental.mini.findings_heading`, `dental.mini.treatments_heading`.

### 2B. Shared label helpers

| Module | Pattern | Call sites updated |
|--------|---------|-------------------|
| [`praxis-completeness.ts`](packages/shared/src/lib/praxis-completeness.ts) | `missingFields` → `{ field, labelKey }`; `praxisReadinessDialogBody(t, tp, kind, missing)` | [`praxis-readiness-dialog.tsx`](apps/practice-host-ui/src/views/components/praxis-readiness-dialog.tsx) |
| [`patient-detail-utils.ts`](packages/shared/src/lib/patient-detail-utils.ts) | `validateRezeptLine(line, t)`, `rezeptStatusDisplay(status, t)` | [`use-patient-detail-prescription-tab.ts`](packages/app/practice-host/src/pages/patient-detail/use-patient-detail-prescription-tab.ts), [`patient-detail-prescription-tab-panel.tsx`](packages/app/practice-host/src/pages/patient-detail/patient-detail-prescription-tab-panel.tsx) |
| [`payment-buchung.ts`](packages/shared/src/lib/payment-buchung.ts) | `zahlungsartLabel(kind, t)`, `zahlStatusDisplay(status, t)`, `zahlungArtSelectOptions(t)`, `buildZahlLinkSelectOptions(treatments, examinations, t, tp)`, `buildOpenZahlLinkSelectOptions(..., t, tp)` | [`payment-create-panel.tsx`](apps/practice-host-ui/src/views/pages/payment-create-panel.tsx), [`use-patient-detail-zahl-actions.ts`](packages/app/practice-host/src/pages/patient-detail/use-patient-detail-zahl-actions.ts), [`patient-detail.tsx`](packages/app/practice-host/src/pages/patient-detail/patient-detail.tsx), [`administration-finanz-werkzeuge.tsx`](apps/practice-host-ui/src/views/pages/administration-finanz-werkzeuge.tsx) |
| [`photo-viewer-apps.ts`](packages/shared/src/lib/photo-viewer-apps.ts) | `photoViewerAppOptionsForSelect(apps, t)` | Consumer gated by `SYSTEM_AKTE_PHOTO_VIEWER_ENABLED` (currently false) |
| [`billing-release.ts`](packages/shared/src/lib/billing-release.ts) | `billingReleaseError(t, entityLabel)` | Optional `t` on `requireReleasedForBilling` |

New keys: `enum.rezept_status.*`, `praxis.readiness.body`, `praxis.readiness.kind.*`, `praxis.setup.*` (English fixes in `en.json`), `settings.photo_viewer.*`, `error.billing.not_released`.

**Twin sync**: shared libs copied to [`apps/practice-host-ui/src/lib/`](apps/practice-host-ui/src/lib/) where duplicated.

### 2C. UI gaps resolved

| File | Resolution |
|------|------------|
| [`vorlage-editor.tsx`](apps/practice-host-ui/src/views/pages/vorlage-editor.tsx) | `vorlage.suggestion.illness.*` keys; shared with certificate composer |
| [`certificate-composer.ts`](packages/shared/src/lib/certificate-composer.ts) | `attestTypSelectOptions(t)`, `illnessSuggestionLabels(t)`, `validateAttestComposer(fields, t)`; serialized `ATTEST_TYP_VALUES` unchanged |
| [`patient-detail-prescription-tab-panel.tsx`](packages/app/practice-host/src/pages/patient-detail/patient-detail-prescription-tab-panel.tsx) | Attest type select + illness datalist via `t` |
| [`privacy.tsx`](apps/practice-host-ui/src/views/pages/privacy.tsx) | `page.privacy.export_bundle_hint` with `{name}` |
| [`http-practice.adapter.ts`](packages/app/practice-host/src/adapters/http-practice.adapter.ts) | English throws + `formatLanPracticeError` at [`lan-client-app.tsx`](apps/lan-web-client/src/lan-client-app.tsx) catch sites |
| [`appointments.tsx`](apps/practice-host-ui/src/views/pages/appointments.tsx) | Commented `DISABLED` blocks unchanged; active UI externalized |
| [`appointment-availability.ts`](packages/shared/src/lib/appointment-availability.ts) | `terminSchedulingBlockReason(..., t)`, `validateTerminSchedulingUpdates(..., t)`, `formatAlternativeSlots(slots, tp)`; `formatAlternativeSlotsDe` deprecated | [`appointments.tsx`](apps/practice-host-ui/src/views/pages/appointments.tsx), [`appointment-create.tsx`](apps/practice-host-ui/src/views/pages/appointment-create.tsx) |
| [`administration-hierarchy.ts`](packages/shared/src/lib/administration-hierarchy.ts) | `VerwaltungBackTarget.labelKey` replaces hardcoded `label` | [`administration-back-button.tsx`](apps/practice-host-ui/src/views/components/administration-back-button.tsx) |
| [`export-settings.ts`](packages/shared/src/lib/export-settings.ts) | `describeResolvedExportPath(cfg, t)` | [`export-picker-dialog.tsx`](apps/practice-host-ui/src/views/components/export-picker-dialog.tsx), [`report-export-picker-dialog.tsx`](apps/practice-host-ui/src/views/components/report-export-picker-dialog.tsx), [`data-export-picker-dialog.tsx`](apps/practice-host-ui/src/views/components/data-export-picker-dialog.tsx) |

Keys: `error.lan.config_missing_url`, `error.lan.config_incomplete`, `error.lan.command_unavailable`, `error.lan.http_error`, `vorlage.suggestion.illness.*`, `page.privacy.export_bundle_hint`, `administration.back.*`, `appointments.scheduling.*`, `payment.link.*`, `export.path.*`.

### 2D. RTL / logical CSS

- [`index.css`](apps/practice-host-ui/src/index.css) — calendar/grid/work_plan (prior pass).
- **Inline TSX** (~20 files): `marginLeft`/`marginRight` → `marginInlineStart`/`marginInlineEnd`; `paddingLeft` → `paddingInlineStart`; table `textAlign: "right"` → `"end"`.
- [`appointments.tsx`](apps/practice-host-ui/src/views/pages/appointments.tsx) filter popover: `insetInlineStart` + RTL-aware anchor positioning via `isRtlLocale()`.

---

## Part 4 — Breaking changes + deliberately not changed

### Breaking changes (signature → call sites)

| Helper | New signature | Call sites |
|--------|---------------|------------|
| `passwordPolicyError` | `(t, password)` | [`staff.tsx`](apps/practice-host-ui/src/views/pages/staff.tsx), [`settings.tsx`](apps/practice-host-ui/src/views/pages/settings.tsx) |
| `evaluatePasswordPolicy` | rules expose `id` only | [`password-policy-hints.tsx`](apps/practice-host-ui/src/views/components/password-policy-hints.tsx) |
| `buildSystemEntries` | `(aufgabe, staff, t)` | [`praxis-aufgabe-kommentare.tsx`](apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-kommentare.tsx) |
| `labelForAkteDocumentKind` | `(t, id)` | [`akte-attachments-panel.tsx`](apps/practice-host-ui/src/views/components/akte-attachments-panel.tsx) |
| `validateAnlageFile` | `(t, file)` | [`patient-detail.tsx`](packages/app/practice-host/src/pages/patient-detail/patient-detail.tsx) |
| `validateRezeptLine` | `(line, t)` | prescription tab hook + panel |
| `rezeptStatusDisplay` | `(status, t)` | prescription tab panel |
| `zahlungsartLabel` / `zahlStatusDisplay` | `(value, t)` | payment panels, print HTML (via `docT`) |
| `zahlungArtSelectOptions` | `(t)` replaces `ZAHLUNG_ART_SELECT` | payment-create, patient-detail-zahl-tab |
| `praxisReadinessDialogBody` | `(t, tp, documentKind, missing)` | praxis-readiness-dialog |
| `billingReleaseError` | `(t, entityLabel)` | optional on `requireReleasedForBilling` |
| `validateAttestComposer` | `(fields, t)` | prescription tab hook, `patient-detail-prescription-actions` |
| `attestTypSelectOptions` / `illnessSuggestionLabels` | `(t)` | certificate tab panel, vorlage editor |
| `emptyAttestComposerForm` | `(today, t)` | prescription tab hook |
| `dentalStatusLabel` | `(t, key)` | DentalMiniBar, DentalChart |
| `getVerwaltungBackTarget` | returns `{ path, labelKey }` (was `label`) | administration-back-button |
| `terminSchedulingBlockReason` | `(praxisCfg, abwesenheiten, isoDate, startMin, endMin, t)` | appointments, appointment-create |
| `validateTerminSchedulingUpdates` | `(appointments, updates, slotDurMin, praxisCfg, abwesenheiten, t)` | appointments drag/pack |
| `formatAlternativeSlots` | `(slots, tp)` replaces `formatAlternativeSlotsDe` | appointments conflict hints |
| `buildZahlLinkSelectOptions` | `(treatments, examinations, t, tp)` | payment-create, patient-detail, finanz-werkzeuge |
| `buildOpenZahlLinkSelectOptions` | extended with `t`, `tp` | patient-detail zahl actions |
| `describeResolvedExportPath` | `(cfg, t)` | export picker dialogs |

### Deliberately not changed

| Location | Reason |
|----------|--------|
| [`certificates.tsx`](apps/practice-host-ui/src/views/pages/certificates.tsx) certificate type `value` strings | Serialized backend type |
| [`statistics.tsx`](apps/practice-host-ui/src/views/pages/statistics.tsx) `st["Durchgeführt"]` etc. | Backend stats keys |
| [`appointments.tsx`](apps/practice-host-ui/src/views/pages/appointments.tsx) commented emergency/pause blocks | Disabled UI |
| [`patient-detail-prescription-tab-panel.tsx`](packages/app/practice-host/src/pages/patient-detail/patient-detail-prescription-tab-panel.tsx) `.includes("Arbeitsunfähig")` | Matches stored German types |
| PDF/print Rust + layout TS | Generated document scope |
| `*.smoke.test.tsx` German fixtures | Test data only |
| [`http-practice.adapter.ts`](packages/app/practice-host/src/adapters/http-practice.adapter.ts) throw literals | English for logs; UI uses `formatLanPracticeError` |
| `formatZahlungBezugLine` in [`payment-buchung.ts`](packages/shared/src/lib/payment-buchung.ts) | Still inline `B-Nr.`/`U-Nr.` German abbreviations — optional follow-up |

---

## Validation (2026-06-29 follow-up)

| Command | Result |
|---------|--------|
| `npm run i18n:verify` | PASS — **4081** keys × 4 locales |
| `npm run i18n:scan` | PASS — 0 new hardcoded hits |
| `npm run build -w medoc` | PASS |
| `npm run test -w medoc` | PASS — 246 tests (3 skipped) |
| Phase 1 umlaut comment sweep | PASS — 0 hits |
| Phase 1 umlaut throw/console sweep | PASS — 0 hits |
| `npm run check -w medoc` | FAIL — pre-existing ESLint (`break-glass-banner.tsx` conditional hooks; React Compiler memoization warnings) — unchanged |

**Manual**: Settings → Appearance → `ar`; spot-check calendar week grid, aufgaben table, dental mini bar popover, appointments filter popover mirroring.
