# Geplant — project status for future development

**Last updated:** 2026-06-10  
**Purpose:** Authoritative register of features **not yet active** in the product. Maintained here in coordination docs — **not** as in-app UI lists.

**How to use**

- Add or update rows when deferring scope; link evidence (gate module, stub file, checklist).
- When a item ships, move it to **Done** in [`actions.md`](actions.md) and remove or mark closed here.
- Detailed re-enable steps live in linked checklist docs where applicable.

---

## Security & compliance (Einstellungen)

| Item | Status | Notes | Evidence |
| ---- | ------ | ----- | -------- |
| Organisations-2FA erzwingen | Geplant | Praxis-weite Richtlinie über Hersteller-Portal; client JSON only today | Comment block in `einstellungen-sicherheit-section.tsx` |
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

## Checklist index

| Topic | Document |
| ----- | -------- |
| Advisor roles re-enable | [`todos-deferred-roles.md`](todos-deferred-roles.md) |
| Datenschutz UI re-enable | [`todos-deferred-features.md`](todos-deferred-features.md) |
| Gap IDs & v0.1 scope | [`gap-deferrals-v0.1.md`](gap-deferrals-v0.1.md) |
| Active execution | [`actions.md`](actions.md) |
