# Wireframe ↔ route map (Figma + prototype)

Use this table to close the remaining ~30% gap between **`Untitled-2.fig`**, the **Downloads prototype** (`view-*.jsx`, `MeDoc.html`), and the **shipped app** under `app/src/`.

## How to attach Figma evidence

1. In Figma: select the frame → **Export** → **PNG** @2x (or PDF for flows).
2. Save into **`docs/ui/figma-exports/`** using a stable slug, e.g. `2026-04-25-dashboard-overview.png`.
3. In the table below, set **Figma frame** to the frame name in Figma and **PNG** to the repo path (or PR attachment note).

## Route table

| URL path | RBAC `routePath` / key | Page component (`app/src/views/pages/`) | Prototype hint (Downloads) | Figma frame *(fill in)* | PNG *(optional)* | Parity notes |
|----------|-------------------------|----------------------------------------|----------------------------|-------------------------|------------------|--------------|
| `/login` | _(outside layout)_ | `login.tsx` | `view-auth.jsx`, `MeDoc.html` | | | |
| `/` | `""` | `dashboard.tsx` | `view-dashboard.jsx` | | | KPIs use real stats; Freigaben/Bestellungen honest placeholders |
| `/termine` | `termine` | `termine.tsx` | shell / calendar in `app.jsx` / `MeDoc.html` | | | |
| `/patienten` | `patienten` | `patienten.tsx` | `view-patients.jsx` | | | |
| `/patienten/neu` | `patienten/neu` | `patient-create.tsx` | `view-patients.jsx` (if covered) | | | |
| `/patienten/:id` | `patienten/:id` | `patient-detail.tsx` | `view-patients.jsx`, `dental.jsx` → `DentalChart.tsx` | | | |
| `/finanzen` | `finanzen` | `finanzen.tsx` | `view-others.jsx` / `view-more.jsx` *(verify)* | | | |
| `/bestellungen` | `bestellungen` | `bestellungen.tsx` | dashboard card / prototype orders *(verify)* | | | UI preview only until backend |
| `/bilanz` | `bilanz` | `bilanz.tsx` | *(verify in Figma)* | | | |
| `/rezepte` | `rezepte` | `rezepte.tsx` | *(verify)* | | | |
| `/atteste` | `atteste` | `atteste.tsx` | *(verify)* | | | |
| `/leistungen` | `leistungen` | `leistungen.tsx` | `dental.jsx` (catalog context) *(verify)* | | | |
| `/leistungen/neu` | `leistungen/neu` | `leistung-create.tsx` | *(verify)* | | | |
| `/produkte` | `produkte` | `produkte.tsx` | *(verify)* | | | |
| `/personal` | `personal` | `personal.tsx` | *(verify)* | | | |
| `/personal/neu` | `personal/neu` | `personal-create.tsx` | *(verify)* | | | |
| `/statistik` | `statistik` | `statistik.tsx` | *(verify)* | | | |
| `/audit` | `audit` | `audit.tsx` | *(verify)* | | | |
| `/datenschutz` | `datenschutz` | `datenschutz.tsx` | *(verify)* | | | |
| `/einstellungen` | `einstellungen` | `einstellungen.tsx` | `MeDoc.html` / settings patterns | | | |
| `/logs` | `logs` | `logging.tsx` | *(verify)* | | | |
| `/ops` | `ops` | `ops.tsx` | `view-others.jsx` *(verify)* | | | Migration entry → `/migration` |
| `/compliance` | `compliance` | `compliance.tsx` | *(verify)* | | | Links to `/feedback`, `/hilfe` |
| `/hilfe` | `hilfe` | `hilfe.tsx` | `MeDoc.html` (`.help-panel`), `interactions.jsx` | | | |
| `/feedback` | `feedback` | `feedback.tsx` | process docs / vigilance *(no single JSX)* | | | Local-only submit until API |
| `/migration` | `migration` | `migration-wizard.tsx` | ops / wizard narrative | | | ARZT + `ops.migration` |
| `/verwaltung` | `verwaltung` | `verwaltung.tsx` | admin hub | | | `personal.read` |
| `/verwaltung/arbeitstage` | `verwaltung/arbeitstage` | `arbeitstage.tsx` | Desktop 70–71 Urlaub | | | SQLite `abwesenheit`, CRUD |
| `/verwaltung/vorlagen` | `verwaltung/vorlagen` | `vorlagen-rezepte-atteste.tsx` | Desktop 74 Vorlagenliste | | | SQLite `dokument_vorlage` |
| `/verwaltung/vorlagen/editor` | `verwaltung/vorlagen/editor` | `vorlage-editor.tsx` | Desktop 80–81 neu | | | `?kind=rezept` / `attest` |
| `/verwaltung/vorlagen/editor/:id` | `verwaltung/vorlagen/editor` | `vorlage-editor.tsx` | Vorlage bearbeiten | | | gleiche RBAC-Route |
| `/bilanz/neu` | `bilanz/neu` | `bilanz-neu.tsx` | Desktop 88–93 Wizard | | | Schritte 1–4 mit Live-Zahlungen + Demo-Verträge |

## Global shell (not a single route)

| Concern | Code | Prototype |
|--------|------|-----------|
| Sidebar + top bar | `app/src/views/layouts/app-layout.tsx` | `shell.jsx`, `app.jsx`, `MeDoc.html` |
| Icons | `app/src/lib/icons.tsx` | `icons.jsx` |
| Tokens / motion | `app/src/index.css` | `MeDoc.html` |

## Status legend

- **Shipped** — route exists in `app/src/App.tsx` and has a page module.
- **Partial** — behaviour or layout intentionally thinner than wireframe (called out in notes).
- **Blocked** — needs backend or Figma decision.

When a row is fully aligned with a Figma frame, set **Parity notes** to `Aligned with <file.png> as of <date>`.
