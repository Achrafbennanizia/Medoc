# G21 — Live Tauri smoke checklist

**Purpose:** Manual verification after automated G21 unit/smoke tests pass. Mark each row when observed in a real session via `bash tools/dev-tauri.sh` (or `cd app && npm run tauri dev`).

> **Nav note (2026-05-31):** Posteingang ist wieder aktiv (`/posteingang`). Verwaltung → Aufgaben bleibt für Admin-CRUD.

### Dev credentials (`MEDOC_DEV_SEED=1`, same as `tools/dev-tauri.sh`)

| Role | Email | Password | TOTP |
| ---- | ----- | -------- | ---- |
| ARZT | `ahmed@praxis.de` | `passwort123` | `1234` |
| REZEPTION | `aya@praxis.de` | `passwort123` | `1234` |

| # | Role | Steps | Expected | Observed |
| - | ---- | ----- | -------- | -------- |
| 1 | REZEPTION | **Posteingang** (Sidebar) | Page loads; list or empty state; 5s poll | ☐ |
| 2 | REZEPTION | Wait ≥5s on Posteingang | List refreshes (`POSTEINGANG_POLL_MS` = 5s) | ☐ |
| 3 | ARZT | Patientenakte → **Aufgabe an Rezeption** | Dialog saves; item appears in REZ Posteingang | ☐ |
| 4 | REZEPTION | Posteingang → **Erledigen** | Status updates; ARZT gets notification | ☐ |
| 5 | REZEPTION | Patientenakte → clinical tabs (Anamnese, …) | Tabs disabled or blocked toast | ☐ |
| 6 | REZEPTION | Tab **Kundenleistungen** | Zahlung view without clinical freitext | ☐ |
| 7 | ARZT | **Einstellungen → Ops** → validate backup → restore | Confirm dialog; success toast; reload hint | ☐ |
| 8 | ARZT | **Praxis-Tickets** | Banner links to Aufgaben/Posteingang; legacy tickets still work | ☐ |

**Automated coverage (not a substitute for rows above):**

- `app/src/lib/collaboration-g21.test.ts` — G21 contracts (poll interval, RBAC, native menu, tagesabschluss)
- `app/src/views/pages/posteingang.smoke.test.tsx` — Posteingang poll + Erledigen transition
- `app/src/views/pages/praxis-tickets.smoke.test.tsx` — Posteingang banner link
- `app/src/lib/rbac.test.ts` — route visibility including `verwaltung/aufgaben`

**Automated proxy run (agent, 2026-05-31):** `cd app && npm run check` **172 PASS**; G21 tests **9 PASS**; `cargo test --tests` **PASS** (from `app/`); live Posteingang workflow rows **NOT OBSERVED** — use `bash tools/dev-tauri.sh`.
