# Geplant — project status for future development

**Last updated:** 2026-06-18  
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
| TOTP 2FA (ARZT-Pflicht) | **Deferred (MVP off)** | Password-only login; TOTP IPC gated | Same checklist |
| Staff cap 5 (1 ARZT + 4 REZEPTION) | **Active (MVP)** | Enforced on create/update; `get_staff_quota` IPC | `mvp_security.rs`, `personal.tsx` |
| Organisations-2FA erzwingen | Geplant | Praxis-weite Richtlinie über Hersteller-Portal; blocked until TOTP re-enabled | Comment block in `einstellungen-sicherheit-section.tsx` |
| HBA / eGK-Kartenleser | Geplant | Live-Status vom Terminal (Orga 6141) | Portal stub; legacy UI commented out |
| Audit-Kettenprüfung in Einstellungen | Geplant | Integritätsstatus direkt in Sicherheit | `getAuditChainStatus` used on Ops page only |
| Auto-Sperre: Minuten wählen | Geplant | Feineinstellung der Inaktivitätsdauer | Toggle Ein/Aus mit festen 5 Min. |
| Datenschutz (DSGVO) — Patientenexport & Löschanfrage | **Deferred (UI off)** | Backend IPC ready; nav/route hidden for MVP | [`todos-deferred-features.md`](todos-deferred-features.md), `datenschutz-config.ts` |

---

## Roles & access

| Item | Status | Notes | Evidence |
| ---- | ------ | ----- | -------- |
| STEUERBERATER login & navigation | **Deferred** | MVP: ARZT + REZEPTION only | [`todos-deferred-roles.md`](todos-deferred-roles.md), `deferred-roles.ts` |
| PHARMABERATER login & navigation | **Deferred** | Same as above | [`todos-deferred-roles.md`](todos-deferred-roles.md) |

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
| Einführung coachmark (NFA-USE-09) | **Hidden** | `ONBOARDING_COACHMARK_ENABLED` |
| Migration GDT/DICOM/Scanner steps | **Hidden** | `MIGRATION_LIVE_DEVICE_ADAPTERS_ENABLED` |
| Geräteverbund admin panel | **Hidden** | `VERBUND_ADMIN_PANEL_V1_ENABLED` (v1.1) |
| KIM / process_payment / DICOM C-STORE | **No UI** | stubs only — see [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) |

Re-enable checklist: [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) · program: [`v1-completion-program.md`](v1-completion-program.md)

---

## Checklist index

| Topic | Document |
| ----- | -------- |
| v1 surface blinds | [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md) |
| Advisor roles re-enable | [`todos-deferred-roles.md`](todos-deferred-roles.md) |
| Datenschutz UI re-enable | [`todos-deferred-features.md`](todos-deferred-features.md) |
| Gap IDs & v0.1 scope | [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) |
| Active execution | [`actions.md`](actions.md) |
