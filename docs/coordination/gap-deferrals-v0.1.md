# Gap deferrals — MeDoc v0.1

**Last updated:** 2026-06-02  
**Scope:** Explicit out-of-scope / deferred gaps after P0–P2 remediation. Skipped by product directive 2026-06-02: **GAP-08**, **GAP-09**, **GAP-12**.

## Skipped (not v0.1 scope)

| ID | Gap | Reason | Evidence |
| -- | --- | ------ | -------- |
| GAP-08 | Termin SMS/E-Mail | No outbound connector; dashboard MVP only (G9) | `notifications.rs` scaffold; settings culled in `docs/settings-cull.md` |
| GAP-09 | Notfall toolbar default | CAL2 feature flag — intentional experiment toggle | `settings-arbeitsablaeufe-section.tsx` |
| GAP-12 | VDDS/BDT full migration | Parser/wizard stub; CSV import ✅ | `migration-wizard.tsx` notes stub adapters |

## P3 — deferred (honest stubs)

| ID | Gap | v0.1 status | Evidence |
| -- | --- | ----------- | -------- |
| GAP-13 | TI/KIM/E-Rezept live | **Deferred** | `app/src/lib/integration-capabilities.ts` — all `available: false` |
| GAP-14 | Mobile REZ LAN parity | **Deferred** | No mobile client; LAN client UI code-only |
| GAP-15 | Production subscription billing | **Deferred** | Company server `_demo: true`; `licensing.md` “not built” |

## Closed in v0.1 (reference)

| IDs | Summary |
| --- | ------- |
| GAP-01/02 | REZ redaction + tab/load gates — Rust `rezeption_redact.rs`, FE `patient-detail.tsx`, `collaboration-g21.test.ts` |
| GAP-03/04 | Posteingang + `practice_task` (G16–G19) |
| GAP-05–07 | LEIST-06/07 + auto ABRECHNUNG (G14–G18) |
| GAP-10/11 | Tagesabschluss sidebar + Quittung from Finanzen (2026-06-02) |

## Live verification still required

- **G21b:** `bash tools/g21-verify-automated.sh` then `bash tools/g21-dev-smoke.sh` — [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md)
- **G12** per-patient RBAC — product deferred (`actions.md`)
