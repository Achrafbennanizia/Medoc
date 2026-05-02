# Reception (REZEPTION) — Phase 0 discovery & alignment

**Scope:** Discovery only (no application code changes in this phase).  
**Date:** 2026-05-02  
**Evidence base:** Files cited below were read or searched in the workspace; path `src/...` in the work order maps to **`app/src/...`** in this repository.

---

## Sources read (0.1)

| Document / module | Path (workspace) |
|-------------------|------------------|
| RBAC matrix | `docs/rbac-matrix.md` |
| Benutzerhandbuch | `docs/benutzerhandbuch.md` (§1–§7; remainder NOT OPENED) |
| Use-case diagram | `docs/uml/02-use-case-diagram.md` |
| Sequence diagram | `docs/uml/03-sequence-diagram.md` |
| Activity diagram | `docs/uml/04-activity-diagram.md` |
| ISO 22600 / DSGVO notes | `docs/iso-standards/07-iso-22600-dsgvo.md` |
| Backend RBAC | `app/src-tauri/src/application/rbac.rs` |
| Frontend RBAC + nav | `app/src/lib/rbac.ts` |
| Dashboard | `app/src/views/pages/dashboard.tsx` |
| Patient list | `app/src/views/pages/patienten.tsx` |
| Patient detail | `app/src/views/pages/patient-detail.tsx` (substantial portions + targeted search) |
| Termine | `app/src/views/pages/termine.tsx` (header + domain constants) |
| Finanzen | `app/src/views/pages/finanzen.tsx` (header + helpers) |
| Zahlung | `app/src/controllers/zahlung.controller.ts`, `app/src/views/pages/zahlung-create-panel.tsx` |
| Termin / Patient API | `app/src/controllers/termin.controller.ts`, `app/src/controllers/patient.controller.ts` |
| Akte validation | `app/src/lib/akte-validation.ts`, `app/src/controllers/validation.controller.ts` |
| Plan-next-termin | `app/src/lib/plan-next-termin.ts`, `app/src/controllers/plan-next-termin.controller.ts` |
| Layout / sidebar | `app/src/views/layouts/app-layout.tsx` |
| Login | `app/src/views/pages/login.tsx` |
| Akte / Rezept / Attest commands | `app/src-tauri/src/commands/akte_commands.rs`, `rezept_commands.rs`, `attest_commands.rs`, `akte_next_termin_commands.rs`, `akte_validation_commands.rs` |
| Behandlung entity | `app/src-tauri/src/domain/entities/behandlung.rs` |

**Note:** Work order paths `docs/02-use-case-diagram.md` etc. live under **`docs/uml/`** in this repo.

---

## A. Reception’s daily job → system mapping

For each activity: **needed affordances**, **what exists today**, **gaps**.

### 1. Greet incoming patient, verify identity

| Need | Today | Gap |
|------|--------|-----|
| Open **Stammdaten** (Name, Geburtsdatum, VSNr., Kontakt) | `PatientDetailPage` tab **Stammdaten**; list/search in `patienten.tsx` | If patient detail **load fails** (see §C), identity verification breaks. |
| Optional: match **Termin heute** | Dashboard “Heute” list (`dashboard.tsx`); `termine.tsx` calendar | No dedicated “check-in” or **queue** tied to presence workflow. |

### 2. Find existing patient or create new one

| Need | Today | Gap |
|------|--------|-----|
| Search / list | `searchPatienten` / `listPatienten` | None critical. |
| Create | `/patienten/neu`, `createPatient` | None critical. |

### 3. Read doctor’s notes (read-only **Plan-next-Termin** hint, not medical content)

| Need | Today | Gap |
|------|--------|-----|
| **Structured** hint (urgency, interval, TerminArt, duration, weekdays, reception-safe free text) | Persisted in SQLite via `get_akte_next_termin_hint` / `set_akte_next_termin_hint` (`akte_next_termin_commands.rs`); FE loads with `loadPlanNextTerminWithMigration` (still **migrates legacy localStorage** once) | No **Posteingang** / inbox: reception must open each patient to see hints. **internalNote** is stored in the same JSON as reception-facing fields — Phase 3 must hide `internalNote` in REZEPTION UI while keeping it for ARZT. |
| Same hint when **creating Termin** | `termin-create` flow exists (referenced from patient detail); not re-audited line-by-line here | Ensure termin-create reads only **safe** subset for REZEPTION or trusts server-side `patient.read_plan_hint` (proposed §F). |

### 4. Schedule / reschedule / cancel appointments `termin.write` / `termin.read`

| Need | Today | Gap |
|------|--------|-----|
| Calendar + create/update/delete | `termine.tsx`, `termin.controller.ts` | None obvious at discovery level. |
| Status: **BESTÄTIGT / DURCHGEFÜHRT / NICHT_ERSCHIENEN** | Domain labels on dashboard; `updateTermin` available | Confirm one-click status changes match reception workflow (NOT OBSERVED in live UI). |

### 5. Record presence at appointment

| Need | Today | Gap |
|------|--------|-----|
| Set status on Termin | Supported in model/strings (`terminStatusLabel` on dashboard) | Discoverability: reception may need **direct action from “heute”** without deep navigation (workflow polish in later phases). |

### 6. Take payment (partial / full)

| Need | Today | Gap |
|------|--------|-----|
| Record Zahlung | `/finanzen`, `/finanzen/neu`, patient tab **Kundenleistungen** | **Zuordnung** uses `listBehandlungen` / `listUntersuchungen` which return **full clinical rows** (§C) — must move to **`akte.read_billing`**-style DTO. |
| steuerberater | `patient.behandlungen_list_for_zahlung` includes STEUERBERATER in `rbac.rs` | External role policy changes in Phase 1/7. |

### 7. Print Quittung + hand Attest/Rezept (never **author** Attest)

| Need | Today | Gap |
|------|--------|-----|
| Quittung | NOT FOUND in discovery pass as dedicated **PDF** from Zahlung (Phase 4 scope) | **Missing** production Quittung pipeline. |
| Attest / Rezept print for reception | `list_rezepte` / `list_atteste` require **`patient.read_medical`** (`rezept_commands.rs`, `attest_commands.rs`) | Patient detail `load()` **always** calls `listRezepte` / `listAtteste` after `getAkte` — **inconsistent** with backend RBAC: REZEPTION session likely gets **403** for whole load OR **must not** reach this code path unchanged. **Dedicated “zu drucken” tray** absent. |
| Doctor-only authoring | `canWriteMedical` gates compose actions in Rezept tab | OK for authoring; **printing** for reception still missing. |

### 8. Hand over prescription printed by doctor

| Need | Today | Gap |
|------|--------|-----|
| Physical handoff | Process | **Posteingang** `rezept_zu_drucken` + print queue (planned Phase 2–4). |

### 9. Document deliveries (Wareneingang / **GELIEFERT**)

| Need | Today | Gap |
|------|--------|-----|
| Mark order delivered | `bestellungen.tsx` — status select includes `GELIEFERT` when `canWrite` (`bestellung.write`) | Work order: reception should **only receive** delivery, not create orders — today REZEPTION has **`bestellung.write`** in `rbac.rs` and can open **Neue Bestellung** — **policy mismatch** with target IA (“delivery receipt only; no creation”). |

### 10. Tagesabschluss end of shift

| Need | Today | Gap |
|------|--------|-----|
| Run cash close | `TagesabschlussPage` at `/verwaltung/finanzen-berichte/tagesabschluss`, gated by `finanzen.read` | Not a **top-level sidebar** item for reception; buried under **Verwaltung → Finanzen & Berichte**. Target IA wants **“Tagesabschluss”** as explicit nav item (#8). |

---

## B. Communication gaps doctor ↔ reception

| Handoff | Where it lives now | Broken / weak | Fix (aligned to master prompt) |
|---------|-------------------|---------------|--------------------------------|
| **Follow-up scheduling hint** | SQLite `AkteNextTerminHint` + optional `plan-next-termin.controller.ts` legacy migration | Reception has **no queue**; must drill into patient | **Posteingang** (`plan_next_termin`), optional auto-erledigt when Termin booked (Workflow C). |
| **What to bill after treatment** | Doctor documents in **Behandlungen**; reception uses **`patient.behandlungen_list_for_zahlung`** lists | Full **Behandlung/Untersuchung** payloads expose **diagnose, Befund text, notes, material** (§C) | New command **`akte_list_billing`** + FE Kasse dropdown; strip medical fields at repo boundary. |
| **Intake / Anamnese validation (ENTWURF → Arzt)** | SQLite **`akte_validation`** (`list_akte_validation`, `akte_validation_commands.rs`); legacy **localStorage** one-shot migration in `validation.controller.ts` | `docs/coordination/phase-handoff.md` still mentions validation as LocalStorage-first — **stale vs code** | Treat as **resolved in DB**; ensure UI/audit parity only. |
| **Paper Rezept/Attest: doctor triggers, reception prints** | Doctor UI on patient detail; `list_*` medical-gated | Reception cannot list; no tray | **Posteingang** kinds `rezept_zu_drucken`, `attest_zu_drucken` + **`print.rezept` / `print.attest`** (render only). |
| **Akte freigegeben → billing** | Validation workflow + status on Akte | No dedicated **reception signal** | **Posteingang** `akte_freigegeben` (or equivalent) for “zur Abrechnung”. |

---

## C. Information leakage check (REZEPTION)

**Target:** REZEPTION must **not** see: Diagnose, Befunde, Anamnese answers, free-text doctor notes, Untersuchung detail text, Rezept **line** details (Wirkstoff/Dosierung/Dauer) **on screen**; printable PDF may embed what the doctor finalized **for printing only** (policy per master prompt).

### Backend / API observations

1. **`get_akte`** (`akte_commands.rs`): if role lacks `patient.read_medical`, `diagnose` and `befunde` on `Patientenakte` are **`None`**. ✓ for shell.
2. **`list_behandlungen` / `list_untersuchungen`**: both use action **`patient.behandlungen_list_for_zahlung`**, allowed for **REZEPTION** (`rbac.rs`). Returned structs include **`notizen`, `beschreibung`, `material`, `zaehne`** on `Behandlung` and **`beschwerden`, `ergebnisse`, `diagnose`** on `Untersuchung` (`behandlung.rs`). **→ HIGH finding: medical text is exposed to reception today.**
3. **`list_rezepte` / `list_atteste`**: require **`patient.read_medical`** — reception should not pass RBAC; combined with patient-detail `load()` calling these unconditionally, the **page is inconsistent** (likely error state for REZEPTION — **UNVERIFIED** at runtime).

### Frontend observations

1. **`PatientDetailPage`**: for `canListBehandlungenForZahlung && !canViewClinical`, still loads **full** behandlungen/untersuchungen arrays into React state (`patient-detail.tsx` ~612–616).
2. **Tab “Rezepte & Atteste”** is **not** `needsClinical`; table shows **Medikament, Dosierung, Dauer** when `rezepte` loaded (`patient-detail.tsx` ~3105+). If load ever succeeds for reception, **this is leakage**.
3. **Plan-hint panel** exposes **internalNote** field in the same form as reception fields (`patient-detail.tsx` ~2099–2105) — for ARZT-only internal use, should not be shown to REZEPTION (or should be stripped server-side for `patient.read_plan_hint`).
4. **ISO doc** (`07-iso-22600-dsgvo.md`) claims REZEPTION has **“Nur Lesen: medizinische Daten”** — **contradicts** product goal and current safest interpretation of GDPR minimization. Treat doc as **stale** vs intended policy.

---

## D. STEUERBERATER + PHARMABERATER deactivation (FE)

**Goal:** `EXTERNAL_ROLES_INTERACTIVE = false` in `FEATURE_FLAGS` (**Phase 1**): block login for these roles in `login.tsx`, hide all routes/nav; **keep** Rust `Role` enum + audit rows valid.

### Places identified (frontend)

| Area | Location | Role usage |
|------|----------|------------|
| **Login** | `app/src/views/pages/login.tsx` | No role chips in current file; text says role comes from account — Phase 1 adds **post-login gate** + toast. |
| **Sidebar labels / profile** | `app-layout.tsx` | `profileRoleLine` maps `STEUERBERATER` / `PHARMABERATER` via i18n |
| **Nav definitions** | `rbac.ts` `NAV_ITEM_DEFINITIONS`, `ROUTE_VISIBILITY` | many `roles: ["ARZT","STEUERBERATER"]`, produkte includes `PHARMABERATER`, `einstellungen` includes both, etc. |
| **Command palette / native menu** | `command-palette-data.ts`, `native-go-menu.ts`, tests | STEUERBERATER / PHARMABERATER paths |
| **Personal form (role picker)** | `personal.tsx` | `STEUERBERATER`, `PHARMABERATER` option values |
| **Types** | `models/types.ts` | `ROLLE_VALUES` still lists four roles (OK for data) |
| **i18n** | `i18n.ts` | `app.role_label.STEUERBERATER` / `PHARMABERATER` |
| **Tests** | `rbac.test.ts`, `native-go-menu.test.ts`, `domain-enums.test.ts` | Expect external roles |

**Plan:** Introduce `src/lib/feature-flags.ts`; in **`navItemVisible` / `routeChildPathAllowed`**, if role is STEUERBERATER|PHARMABERATER and flag false, return false (belt-and-suspenders after forced logout). **Login:** after success, same check → `logout` + toast (German copy from master prompt). **Do not** remove enum values from DB layer.

---

## E. Reception navigation map (target IA vs current)

### Target order (from work order)

1. Übersicht (dashboard, reception variant)  
2. **Posteingang** (NEW)  
3. Termine  
4. Patienten  
5. **Kasse** (rename from Finanzen; same data, reception view)  
6. **Belege & Druck** (NEW)  
7. **Bestellungen** (delivery receipt only; no creation)  
8. Tagesabschluss  
9. Hilfe  

### Current mechanism

- **Sidebar** is driven by `NAV_SECTIONS` in `app-layout.tsx` (grouped sections), each item resolving to **`NAV_ITEM_DEFINITIONS`** filtered by `navItemVisible`.
- **REZEPTION** `allowed()`: no `patient.read_medical`, has `patient.read`, `termin.*`, `finanzen.read/write`, `verwaltung.read`, `bestellung.read/write`, etc. (`rbac.rs` mirroring).

**Visible primary links for REZEPTION today** (from `NAV_SECTIONS` × visibility):

- **Übersicht:** `/` (dashboard), `/termine`  
- **Behandlung:** `/patienten` only (`/rezepte` and `/statistik` filtered out — rezepte needs `read_medical`, statistik is ARZT+STEUERBERATER only)  
- **Praxis:** `/finanzen`, `/bestellungen`, `/verwaltung`, `/einstellungen`  

**Not in sidebar (but routable if allowed):** `/hilfe` (uses `dashboard.read` in `ROUTE_VISIBILITY`) — access via command palette / direct URL, not IA slot #9.

### Diff summary

| Target | Current |
|--------|---------|
| Posteingang | **Missing** |
| Kasse label | Label **Finanzen** (`nav.finanzen`) |
| Belege & Druck | **Missing** (no aggregate print queue page) |
| Bestellungen (receive only) | Full **bestellung.write** + “Neue Bestellung” |
| Tagesabschluss top-level | Under **Verwaltung** hierarchy only |
| Hilfe in sidebar | **Missing** from `NAV_SECTIONS` |
| Dashboard content | **Same** page for all roles — includes e.g. **Audit** CTA (`/audit` — ARZT-only route); **MedOC Insights** card; best-effort **listTermine/listPatienten** (no role-specific simplification) |

**Implementation note (Phase 3):** Replace fixed `NAV_SECTIONS` with **`getSidebarForRole(role): NavItemDefinition[]`** (or ordered keys) — **one** nav component, config-driven.

---

## F. RBAC additions (proposed)

Add to **both** `app/src-tauri/src/application/rbac.rs` and `app/src/lib/rbac.ts` (with tests in `rbac.test.ts`).

| Action | Purpose | Proposed roles |
|--------|---------|----------------|
| **`patient.read_plan_hint`** | Read structured plan-next-termin / queue payload **without** `internalNote` in API surface (or strip server-side) | **REZEPTION**, **ARZT** (ARZT keeps full editor via existing `patient.write` + hint write, or `read_plan_hint` read-only accessor for symmetry) |
| **`akte.read_billing`** | List billing-safe Behandlung/Untersuchung DTOs (B-Nr., U-Nr., Leistungsname-only, Soll/Gezahlt/Offen); **no** diagnose/notizen/material body | **REZEPTION**, **ARZT**, optionally **STEUERBERATER** if still needs aggregates without PHI (revisit when external roles deactivated for interactive use) |
| **`print.rezept`** | Trigger PDF render for **doctor-finalized** Rezept only | **REZEPTION**, **ARZT** |
| **`print.attest`** | Trigger PDF render for **doctor-finalized** Attest only | **REZEPTION**, **ARZT** |
| **`posteingang.read`** | List/act on handoff queue (non-medical projection) | **REZEPTION**, **ARZT** (doctor may mark items or create entries — command design in Phase 2) |
| **`posteingang.write` or reuse** | `posteingang_mark_erledigt` / `posteingang_create_*`: either **new** action or gate with **`posteingang.read` + role check** as per master prompt | Spec says `posteingang.read` + rbac that user is REZEPTION or ARZT — **explicit sub-actions** (`posteingang.erledigt`, `posteingang.create_plan_hint`) can reduce ambiguity vs cramming into one action. |

**Deprecation / overlap:** Replace or narrow **`patient.behandlungen_list_for_zahlung`** for REZEPTION once **`akte.read_billing`** covers payment linking; keep STEUERBERATER behavior consistent with “reports on paper” policy after flag work.

---

## Phase 0 — Definition of Done (self-check)

- [x] All listed sources in 0.1 consulted (paths adjusted where the repo differs).  
- [x] Sections **A–F** present.  
- [x] No application code edits in Phase 0.  
- [ ] **Runtime verification** (log in as REZEPTION and open patient detail) — **NOT RUN** in this session; leakage findings above are from **static code review**.

---

## What changed in this phase

- **Added** this document: `docs/reception-discovery.md`.

## What’s next (Phase 1 — after your review)

- Implement **`feature-flags.ts`**, extend RBAC matrices + tests, login guard for external roles, adjust `navItemVisible` as specified, remove any remaining misleading login copy (current `login.tsx` already lacks HBA/BSI/Frankfurt/2FA strings).

**Stop:** Awaiting your review / go-ahead before Phase 1.
