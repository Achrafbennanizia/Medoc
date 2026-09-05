# Geplant — project status for future development

**Last updated:** 2026-07-05  
**Purpose:** Authoritative register of features **not yet active** in the product. Maintained here in coordination docs — **not** as in-app UI lists.

**How to use**

- Add or update rows when deferring scope; link evidence (gate module, stub file, checklist).
- When a item ships, move it to **Done** in [`actions.md`](actions.md) and remove or mark closed here.
- Detailed re-enable steps live in linked checklist docs where applicable.

---

## Security & compliance (Einstellungen)

| Item | Status | Notes | Evidence |
| ---- | ------ | ----- | -------- |
| Break-Glass (Notfallzugriff) | **Deferred (MVP off)** | IPC + audit schema remain; UI hidden | [`todos-deferred-security-features.md`](todos-deferred-security-features.md), `mvp_security.rs` |
| TOTP 2FA (PHYSICIAN-Pflicht) | **Deferred (MVP off)** | Password-only login; TOTP IPC gated | Same checklist |
| Staff cap 5 (1 PHYSICIAN + 4 RECEPTION) | **Active (MVP)** | Enforced on create/update; `get_staff_quota` IPC | `mvp_security.rs`, `staff.tsx` |
| Organisations-2FA erzwingen | Geplant | Praxis-weite Richtlinie über Hersteller-Portal; blocked until TOTP re-enabled | Comment block in `settings-sicherheit-section.tsx` |
| HBA / eGK-Kartenleser | Geplant | Live-Status vom Terminal (Orga 6141) | Portal stub; legacy UI commented out |
| Audit-Kettenprüfung in Einstellungen | Geplant | Integritätsstatus direkt in Sicherheit | `getAuditChainStatus` used on Ops page only |
| Auto-Sperre: Minuten wählen | Geplant | Feineinstellung der Inaktivitätsdauer | Toggle Ein/Aus mit festen 5 Min. |
| Datenschutz (DSGVO) — Patientenexport & Löschanfrage | **Deferred (UI off)** | Backend IPC ready; nav/route hidden for MVP | [`todos-deferred-features.md`](todos-deferred-features.md), `privacy-config.ts` |

---

## Roles & access

| Item | Status | Notes | Evidence |
| ---- | ------ | ----- | -------- |
| TAX_ADVISOR login & navigation | **Deferred** | MVP: PHYSICIAN + RECEPTION only | [`todos-deferred-roles.md`](todos-deferred-roles.md), `deferred-roles.ts` |
| PHARMA_CONSULTANT login & navigation | **Deferred** | Same as above | [`todos-deferred-roles.md`](todos-deferred-roles.md) |

---

## Integrations & platform (reference)

See also [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) for GAP-08/09/12 skips and GAP-13–15 deferred stubs (TI/KIM, mobile LAN, billing).

| Item | Status | Notes |
| ---- | ------ | ----- |
| Termin SMS/E-Mail (GAP-08) | Out of scope v0.1 | No outbound connector |
| VDDS/BDT full migration (GAP-12) | Stub | CSV import ✅ |
| TI / KIM / E-Rezept live (GAP-13) | Deferred | `integration-capabilities.ts` — `available: false` |

---

## v1 deferred surfaces (Wave 1 blinds)

| Item | Status | Flag / evidence |
| ---- | ------ | ----------------- |
| E-Rezept **An TI senden** | **Hidden** | `integration-capabilities.ts` · `eprescription.available: false` |
| Lizenz Nutzung diesen Monat | **Hidden** | `LICENSE_USAGE_METERS_ENABLED` |
| Lizenz Zahlungsmethode / Rechnungen / Plan wechseln | **Hidden** | `LICENSE_BILLING_CONNECTORS_ENABLED` |
| KBV-Zulassung row | **Hidden** | `LICENSE_KBV_ROW_ENABLED` |
| Support-Vertrag row | **Hidden** | `LICENSE_SUPPORT_ROW_ENABLED` |
| PDF Dokumentvorlage picker | **Hidden** | `PDF_LAYOUT_TEMPLATE_PICKER_ENABLED` |
| Einführung coachmark (NFA-USE-09) | **Hidden** | `ONBOARDING_COACHMARK_ENABLED` + `WORKFLOW_ONBOARDING_PREFS_UI_ENABLED` (settings reset row); runtime coachmark unmounted |
| Bestätigung bei kritischen Aktionen (Akte) | **Hidden (settings UI)** | `WORKFLOW_AKTE_CONFIRMATION_PREFS_UI_ENABLED`; runtime modal confirms via `akte-confirm-presentation.tsx` (default modal) |
| Migration GDT/DICOM/Scanner steps | **Hidden** | `MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED` |
| Geräteverbund admin panel | **Hidden** | `VERBUND_ADMIN_PANEL_V1_ENABLED` (v1.1) |
| KIM / process_payment / DICOM C-STORE | **No UI** | stubs only — see [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) |

Re-enable checklist: [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) · program: [`v1-completion-program.md`](v1-completion-program.md)

---

## Onboarding

| Item | Status | Notes | Evidence |
| ---- | ------ | ----- | -------- |
| Subscription plan tier picker (BASIC / PRO / ENTERPRISE) | **Deferred** | UI commented out on `/onboarding/abonnement`; backend still accepts `plan`, default `PRO` | `abonnement-registrieren.tsx` |

---

## Clinical / dental UI

| Item | Status | Notes | Evidence |
| ---- | ------ | ----- | -------- |
| Zahnschema popover — Befunde / Diagnosen list | **Removed (MVP)** | Per-tooth Zahnbefund history list removed from header tooth-chart hover; status color + Untersuchungen + Behandlungen remain | `DentalMiniBar.tsx` (2026-07-05); i18n keys `dental.mini.findings_heading`, `dental.mini.no_findings` kept for re-enable |
| Zahnschema popover — Befunde / Diagnosen list re-enable | Geplant | Restore list section if structured Zahnbefund timeline is needed alongside Untersuchung `toothNotes` | See row above |
| Untersuchung — structured sections (Hauptbeschwerde/VAS, Extraoral, Intraoral, Parodontal, Funktion, Bildgebung) | **Removed (MVP UI)** | Composer + detail summary show general note, Zahnschema tooth notes, diagnosis & plan only; legacy fields remain in `UntersuchungV1` JSON for export/migration | `UntersuchungComposer.tsx`, `patient-detail-unter-tab.tsx` (2026-07-05) |
| Untersuchung — structured sections re-enable | Geplant | Restore tabbed composer + detail grid when full dental exam protocol is required | i18n keys `examination.composer.section_*` retained |
| Untersuchung detail — Diagnosis + Treatment plan | **Active (MVP)** | List row + Show detail panel; `clinicalSummaryFromUntersuchung`; backend `diagnosis` column + `plan` in V1 JSON | `UntersuchungDetailPanel.tsx`, `examination.ts`, `patient-detail-unter-tab.tsx` |
| Sidebar + Verwaltung — Rezepte & Atteste | **Blinded (MVP)** | `/prescriptions`, `/administration/templates*` hidden; patient Akte tab unchanged | `catalog-menu-flags.ts` → `REZEPTE_ATTESTE_MENU_ENABLED` |
| Sidebar + Verwaltung — Leistungen | **Blinded (MVP)** | `/services` + Verwaltung hub row hidden; Behandlungskatalog hub remains | `LEISTUNGEN_MENU_ENABLED` |
| Sidebar + Verwaltung — Produkte | **Enabled (MVP)** | `/products` via Verwaltung → Lager only (not main sidebar); Bestellstamm/Verträge remain | `PRODUKTE_MENU_ENABLED` |
| Produkte — stock column + min-stock alerts | **Blinded (MVP)** | Table STOCK column hidden; form shows **Amount** only (maps to `stock`); min-stock inputs blinded | `PRODUKT_STOCK_UI_ENABLED` |
| Produkte — stock + min-stock form re-enable | Geplant | Restore stock/min-stock fields and table column when full inventory tracking is ready | See row above |
| Patient Akte header — Task to reception | **Blinded (MVP)** | PHYSICIAN → Rezeption Aufgabe dialog; backend wired | `v1-ui-flags.ts` → `PATIENT_AKTE_WORKFLOW_HEADER_BUTTONS_ENABLED` |
| Patient Akte header — Request review | **Blinded (MVP)** | Forward Akte to physicians dialog | Same flag |
| Patient Akte header — Discharge sheet | **Blinded (MVP)** | Discharge Merkblatt PDF export | Same flag |
| Patient Akte workflow header buttons re-enable | Geplant | Set `PATIENT_AKTE_WORKFLOW_HEADER_BUTTONS_ENABLED = true`; polish UX + manual QA on G21 rows | [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) |

---

## Checklist index

| Topic | Document |
| ----- | -------- |
| v1 surface blinds | [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) |
| Incomplete UI options skipped for now (Export/Import blinds, …) | [`todos-deferred-ui-blinds.md`](todos-deferred-ui-blinds.md) |
| Advisor roles re-enable | [`todos-deferred-roles.md`](todos-deferred-roles.md) |
| Datenschutz UI re-enable | [`todos-deferred-features.md`](todos-deferred-features.md) |
| Gap IDs & v0.1 scope | [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) |
| Active execution | [`actions.md`](actions.md) |
