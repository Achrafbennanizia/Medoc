# G21 — Live Tauri smoke checklist

**Purpose:** Manual verification after automated G21 unit/smoke tests pass. Mark each row when observed in a real `npm run tauri dev` session.

| # | Role | Steps | Expected | Observed |
| - | ---- | ----- | -------- | -------- |
| 1 | REZEPTION | Sidebar → **Posteingang** | Page loads; list or empty state; no access denied | ☐ |
| 2 | REZEPTION | Wait ≥6s on Posteingang | List refreshes (network/IPC reload) | ☐ |
| 3 | ARZT | Patientenakte → **Aufgabe an Rezeption** | Dialog saves; item appears in REZ Posteingang | ☐ |
| 4 | REZEPTION | Posteingang → Aufgabe **Erledigt** | Status updates; ARZT gets notification | ☐ |
| 5 | REZEPTION | Patientenakte → clinical tabs (Anamnese, …) | Tabs disabled or blocked toast | ☐ |
| 6 | REZEPTION | Tab **Kundenleistungen** | Zahlung view without clinical freitext | ☐ |
| 7 | ARZT | **Einstellungen → Ops** → validate backup → restore | Confirm dialog; success toast; reload hint | ☐ |
| 8 | ARZT | **Praxis-Tickets** | Banner links to Posteingang; legacy tickets still work | ☐ |

**Automated coverage (not a substitute for rows above):**

- `app/src/lib/collaboration-g21.test.ts`
- `app/src/views/pages/posteingang.smoke.test.tsx`
- `app/src/lib/rbac.test.ts` (GAP-01, posteingang route)
