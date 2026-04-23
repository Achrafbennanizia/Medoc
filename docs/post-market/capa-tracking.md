# CAPA Tracking — Corrective and Preventive Actions

This register tracks all CAPAs opened against MeDoc. Each row is updated
through to closure; nothing is deleted. New rows are appended at the top.

| ID         | Opened     | Trigger source            | Title                                                  | Owner          | Status   | Due        | Closed     |
|------------|------------|---------------------------|--------------------------------------------------------|----------------|----------|------------|------------|
| CAPA-0001  | 2026-04-01 | Internal audit            | Establish formal CAPA workflow                         | Quality Mgr    | Open     | 2026-05-15 | —          |

**Evidenz / Akte:** [CAPA-0001.md](./capa/CAPA-0001.md)

## Workflow

1. **Open** — anyone may open a CAPA via PR adding a row above. Required
   fields: trigger, brief description, owner, target due date.
2. **Investigate** — owner attaches root-cause analysis under
   `docs/post-market/capa/<ID>.md`.
3. **Implement** — corrective action committed; PR linked from CAPA file.
4. **Verify effectiveness** — re-test or monitor for one full release cycle.
5. **Close** — Quality Manager approves; status set to `Closed` and the
   closure date filled in.

## SLA

- **Critical** (patient-safety / data-integrity) — close within 30 days.
- **Major** — close within 60 days.
- **Minor** — close within 90 days.

CAPAs older than the SLA appear on the next release-gate checklist as
blockers unless explicitly waived by the Quality Manager.
