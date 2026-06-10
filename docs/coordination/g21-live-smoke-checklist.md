# G21 — Live Tauri smoke checklist

**Purpose:** Manual verification after automated G21 unit/smoke tests pass. Mark each row when observed in a real Tauri session.

## Prerequisites

**Step 0 — automated proxies (must PASS before manual rows):**

```bash
bash tools/g21-verify-automated.sh
```

Then launch the app:

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
cd "$ROOT" && MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32 \
  MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  cargo test -p medoc-core --test gen_dev_license_once print_dev_licenses -- --ignored --nocapture
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
| 9 | ARZT + REPLICA | **Serverless pairing (W8)** — Master: Einstellungen → Pairing → accept replica. Replica: `serverless_peer` + pairing scan or paste master URL → sync | Patient + `praxis_ticket` visible on master after sync; revoke blocks push (403) | ☐ |

**Automated coverage (not a substitute for rows above):**

- `packages/shared/src/lib/collaboration-g21.test.ts`
- `apps/practice-host-ui/src/views/pages/posteingang.smoke.test.tsx` (rows 2, 4 UI transition)
- `packages/shared/src/lib/nav-sections.test.ts` (G17 — posteingang in sidebar section config)
- `apps/practice-host/tests/praxis_aufgabe_tests.rs` (`g21_arzt_to_rez_flow_*` — rows 3–4 backend E2E)
- `apps/practice-host-ui/src/views/pages/praxis-tickets.smoke.test.tsx` (row 8)
- `apps/practice-host-ui/src/views/components/patient-akte-workflow-dialogs.smoke.test.tsx` (row 3 proxy)
- `packages/app/practice-host/src/pages/patient-detail/patient-detail-akte-subnav.smoke.test.tsx` (rows 5–6 proxy)
- `apps/practice-host-ui/src/g21-routing.smoke.test.tsx` (row 1 proxy — REZEPTION sidebar → Posteingang)
- `apps/practice-host-ui/src/views/pages/ops.smoke.test.tsx` (row 7 proxy — backup validate/restore)
- `packages/shared/src/lib/quittung-export-flow.test.ts` (GAP-11 Finanzen Quittung)
- `bash tools/g21-verify-automated.sh` — runs all proxies + Rust G21/redaction in one command
- `bash scripts/validate-docker-multi-device.sh` — **17/17** port e2e (Tier-1 `rezept` + `praxis_ticket`, mesh, RBAC)
- `bash tools/two-device-sync-smoke.sh` — Docker proxy + live 2-host steps for row 9
