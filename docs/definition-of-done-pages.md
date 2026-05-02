# MeDoc — Definition of Done by page (2026-05 verification)

Architecture overview: **`docs/README-frontend.md`**.

This checklist applies **one row per routed screen** in `app/src/App.tsx`.  
**Global automated gate (this session):** `npm run build` ✅, `npm test` ✅, `cargo test` ✅ (with workspace-local `CARGO_TARGET_DIR`; see `docs/audit-2026-05-followup.md`).

**Column legend**

- **Route / component** — React lazy import target
- **Role gate** — `RoleRoute` `routePath` from `App.tsx`
- **Static** — route + component file present; TypeScript builds
- **Smoke** — covered by one of the five `critical-flows.smoke.test.tsx` flows (a–e), or “—”
- **Manual** — product/UX/a11y spot-check in real Tauri app (not automated here)

| Route | Page module | Role gate | Static | Smoke | Manual |
|-------|-------------|-----------|--------|-------|--------|
| `/login` | `views/pages/login.tsx` | (public) | ✅ | (a) login | Full session + keyboard |
| `/` | `views/pages/dashboard.tsx` | `""` | ✅ | (a) dashboard | KPIs refresh |
| `/termine` | `views/pages/termine.tsx` | `termine` | ✅ | — | Calendar filters |
| `/termine/neu` | `views/pages/termin-create.tsx` | `termine/neu` | ✅ | — | Create + validation |
| `/patienten` | `views/pages/patienten.tsx` | `patienten` | ✅ | — | Search + list |
| `/patienten/neu` | `views/pages/patient-create.tsx` | `patienten/neu` | ✅ | — | Zod + IPC |
| `/patienten/:id` | `views/pages/patient-detail.tsx` | `patienten/:id` | ✅ | — | Akte tabs |
| `/patienten/:id/rezept/neu` | `views/pages/rezept-create.tsx` | `patienten/:id/rezept/neu` | ✅ | — | — |
| `/patienten/:id/rezept/:rezeptId` | `views/pages/rezept-edit.tsx` | `patienten/:id/rezept/:rezeptId` | ✅ | — | — |
| `/finanzen` | `views/pages/finanzen.tsx` | `finanzen` | ✅ | — | — |
| `/finanzen/neu` | `views/pages/zahlung-create.tsx` | `finanzen/neu` | ✅ | — | — |
| `/bestellungen` | `views/pages/bestellungen.tsx` | `bestellungen` | ✅ | — | — |
| `/bestellungen/neu` | `views/pages/bestellung-create.tsx` | `bestellungen/neu` | ✅ | — | — |
| `/bestellungen/:id` | `views/pages/bestellung-detail.tsx` | `bestellungen/:id` | ✅ | — | — |
| `/bilanz` | `views/pages/bilanz.tsx` | `bilanz` | ✅ | — | — |
| `/bilanz/neu` | `views/pages/bilanz-neu.tsx` | `bilanz/neu` | ✅ | — | — |
| `/verwaltung` | `views/pages/verwaltung.tsx` | `verwaltung` | ✅ | — | Hub links |
| `/verwaltung/team` | `views/pages/verwaltung-team.tsx` | `verwaltung/team` | ✅ | — | — |
| `/verwaltung/arbeitstage` | `views/pages/arbeitstage.tsx` | `verwaltung/arbeitstage` | ✅ | — | — |
| `/verwaltung/praxisplanung` | `views/pages/praxisplanung.tsx` | `verwaltung/praxisplanung` | ✅ | — | — |
| `/verwaltung/arbeitszeiten` | `views/pages/arbeitszeiten.tsx` | `verwaltung/arbeitszeiten` | ✅ | — | — |
| `/verwaltung/sonder-sperrzeiten` | `views/pages/sonder-sperrzeiten.tsx` | `verwaltung/sonder-sperrzeiten` | ✅ | — | — |
| `/verwaltung/praxis-praeferenzen` | `views/pages/praxis-praeferenzen.tsx` | `verwaltung/praxis-praeferenzen` | ✅ | — | — |
| `/verwaltung/vorlagen` | `views/pages/vorlagen-rezepte-atteste.tsx` | `verwaltung/vorlagen` | ✅ | — | — |
| `/verwaltung/vorlagen/editor` | `views/pages/vorlage-editor.tsx` | `verwaltung/vorlagen/editor` | ✅ | — | — |
| `/verwaltung/vorlagen/editor/:id` | `views/pages/vorlage-editor.tsx` | `verwaltung/vorlagen/editor` | ✅ | — | — |
| `/verwaltung/behandlungs-katalog` | `views/pages/behandlungs-katalog.tsx` | `verwaltung/behandlungs-katalog` | ✅ | — | — |
| `/verwaltung/bestellstamm` | `views/pages/bestellstamm-verwaltung.tsx` | `verwaltung/bestellstamm` | ✅ | — | — |
| `/verwaltung/finanzen-berichte` | `views/pages/verwaltung-finanzen-berichte.tsx` | `verwaltung/finanzen-berichte` | ✅ | — | — |
| `/verwaltung/finanzen-berichte/tagesabschluss` | `views/pages/tagesabschluss.tsx` | `verwaltung/finanzen-berichte/tagesabschluss` | ✅ | (d) form | Full page load |
| `/verwaltung/finanzen-berichte/rechnung` | `views/pages/verwaltung-finanz-werkzeuge.tsx` | `verwaltung/finanzen-berichte/rechnung` | ✅ | — | PDF path |
| `/verwaltung/lager-und-bestellwesen` | `views/pages/verwaltung-lager-bestellwesen.tsx` | `verwaltung/lager-und-bestellwesen` | ✅ | — | — |
| `/verwaltung/vertraege` | `views/pages/verwaltung-vertraege.tsx` | `verwaltung/vertraege` | ✅ | — | — |
| `/verwaltung/leistungen-kataloge-vorlagen` | `views/pages/verwaltung-leistungen-kataloge-vorlagen.tsx` | `verwaltung/leistungen-kataloge-vorlagen` | ✅ | — | — |
| `/rezepte` | `views/pages/rezepte.tsx` | `rezepte` | ✅ | — | — |
| `/atteste` | `views/pages/atteste.tsx` | `atteste` | ✅ | — | — |
| `/leistungen` | `views/pages/leistungen.tsx` | `leistungen` | ✅ | — | — |
| `/produkte` | `views/pages/produkte.tsx` | `produkte` | ✅ | — | — |
| `/personal` | `views/pages/personal.tsx` | `personal` | ✅ | — | — |
| `/personal/arbeitsplan` | `views/pages/personal-arbeitsplan.tsx` | `personal/arbeitsplan` | ✅ | — | a11y sample |
| `/statistik` | `views/pages/statistik.tsx` | `statistik` | ✅ | — | Heavy charts |
| `/audit` | `views/pages/audit.tsx` | `audit` | ✅ | — | — |
| `/datenschutz` | `views/pages/datenschutz.tsx` | `datenschutz` | ✅ | (e) DSGVO | Export + erase live |
| `/einstellungen` | `views/pages/einstellungen.tsx` | `einstellungen` | ✅ | — | — |
| `/logs` | `views/pages/logging.tsx` | `logs` | ✅ | — | — |
| `/ops` | `views/pages/ops.tsx` | `ops` | ✅ | — | — |
| `/compliance` | `views/pages/compliance.tsx` | `compliance` | ✅ | — | — |
| `/hilfe` | redirect → `/einstellungen?tab=hilfe` | `hilfe` | ✅ | — | — |
| `/feedback` | `views/pages/feedback.tsx` | `feedback` | ✅ | — | — |
| `/migration` | `views/pages/migration-wizard.tsx` | `migration` | ✅ | — | — |

**IPC-focused smoke (not full page render):**

| Flow | What is verified |
|------|------------------|
| **(b)** | `create_patient` → `get_akte` → `update_zahnbefund` → `set_akte_section_validated` call order |
| **(c)** | `create_termin` → `update_termin` → `create_zahlung` → `update_zahlung_status` call order |

**SQLite cleanliness for DSGVO:** frontend smoke asserts `dsgvo_erase_patient` IPC + legacy browser key removal; database guarantees are covered by `app/src-tauri/tests/dsgvo_erasure_tests.rs`.

*End of DoD matrix.*
