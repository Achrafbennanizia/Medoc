# G21 — Live Tauri smoke checklist

**Purpose:** Manual verification after automated G21 unit/smoke tests pass. Mark each row when observed in a real Tauri session.

## Prerequisites

```bash
bash tools/g21-dev-smoke.sh
# optional: MEDOC_PRINT_LICENSE=1 bash tools/g21-dev-smoke.sh
```

Or directly: `bash tools/dev-tauri.sh`

This sets `MEDOC_DEV_SEED=1`, stable SQLCipher keys, and demo data. On first run, complete DB unlock/setup if prompted.

**Demo logins** (seed password for all: `passwort123`):

| Role | E-Mail | Name |
| ---- | ------ | ---- |
| REZEPTION | `aya@praxis.de` | Aya M. |
| ARZT | `ahmed@praxis.de` | Dr. Ahmed R. |

**License:** If activation gate appears, generate a dev token:

```bash
cd app && MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32 \
  MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  cargo test --test gen_dev_license_once print_dev_licenses -- --ignored --nocapture
```

Paste the **V2 LICENSE** into the activation screen or Einstellungen → Lizenz.

**Suggested patient for rows 3–6:** Lena Hoffmann (`seed-pat-001`) — Patienten → first row.

---

| # | Role | Steps | Expected | Observed |
| - | ---- | ----- | -------- | -------- |
| 1 | REZEPTION | Sidebar → **Posteingang** | Page loads; list or empty state; no access denied | ☐ |
| 2 | REZEPTION | Wait ≥6s on Posteingang | List refreshes (5s poll — watch network/IPC or add a task in row 3 first) | ☐ |
| 3 | ARZT | Patientenakte (Lena Hoffmann) → **Aufgabe an Rezeption** | Dialog saves; log out → REZ login → Posteingang shows new task | ☐ |
| 4 | REZEPTION | Posteingang → **Erledigen** (with Kurznotiz) | Status updates; log out → ARZT → bell icon shows notification | ☐ |
| 5 | REZEPTION | Patientenakte → tabs Anamnese, Befund, … | Tabs disabled or blocked toast | ☐ |
| 6 | REZEPTION | Tab **Kundenleistungen** (Zahl) | Payment view; no clinical freitext fields | ☐ |
| 7 | ARZT | **Einstellungen → Betrieb** → Backup wählen → Prüfen → Wiederherstellen | Confirm dialog; success message; reload hint | ☐ |
| 8 | ARZT | **Praxis-Tickets** | Banner links to Posteingang; legacy tickets still work | ☐ |

**Automated coverage (not a substitute for rows above):**

- `app/src/lib/collaboration-g21.test.ts`
- `app/src/views/pages/posteingang.smoke.test.tsx` (rows 2, 4 UI transition)
- `app/src/lib/nav-sections.test.ts` (G17 — posteingang in sidebar section config)
- `app/src-tauri/tests/praxis_aufgabe_tests.rs` (`g21_arzt_to_rez_flow_*` — rows 3–4 backend E2E)
- `app/src/views/pages/praxis-tickets.smoke.test.tsx` (row 8)
- `app/src/views/components/patient-akte-workflow-dialogs.smoke.test.tsx` (row 3 proxy)
- `app/src/systems/practice-host/pages/patient-detail/patient-detail-akte-subnav.smoke.test.tsx` (rows 5–6 proxy)
- `app/src/g21-routing.smoke.test.tsx` (row 1 proxy — REZEPTION sidebar → Posteingang)
- `app/src/views/pages/ops.smoke.test.tsx` (row 7 proxy — backup validate/restore)
- `app/src/lib/rbac.test.ts` (GAP-01, posteingang route)
