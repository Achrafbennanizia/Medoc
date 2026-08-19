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
| `/appointments` | `appointments` | `appointments.tsx` | shell / calendar in `app.jsx` / `MeDoc.html` | | | |
| `/patients` | `patients` | `patients.tsx` | `view-patients.jsx` | | | |
| `/patients/new` | `patients/new` | `patient-create.tsx` | `view-patients.jsx` (if covered) | | | |
| `/patients/:id` | `patients/:id` | `patient-detail.tsx` | `view-patients.jsx`, `dental.jsx` → `DentalChart.tsx` | | | |
| `/finance` | `finance` | `finance.tsx` | `view-others.jsx` / `view-more.jsx` *(verify)* | | | |
| `/purchase-orders` | `purchase-orders` | `purchase-orders.tsx` | dashboard card / prototype orders *(verify)* | | | UI preview only until backend |
| `/balance-sheet` | `balance-sheet` | `balance-sheet.tsx` | *(verify in Figma)* | | | |
| `/prescriptions` | `prescriptions` | `prescriptions.tsx` | *(verify)* | | | |
| `/certificates` | `certificates` | `certificates.tsx` | *(verify)* | | | |
| `/services` | `services` | `services.tsx` | `dental.jsx` (catalog context) *(verify)* | | | |
| `/services/new` | `services/new` | `serviceItem-create.tsx` | *(verify)* | | | |
| `/products` | `products` | `products.tsx` | *(verify)* | | | |
| `/staff` | `staff` | `staff.tsx` | *(verify)* | | | |
| `/staff/new` | `staff/new` | `staff-create.tsx` | *(verify)* | | | |
| `/statistics` | `statistics` | `statistics.tsx` | *(verify)* | | | |
| `/audit` | `audit` | `audit.tsx` | *(verify)* | | | |
| `/privacy` | `privacy` | `privacy.tsx` | *(verify)* | | | |
| `/settings` | `settings` | `settings.tsx` | `MeDoc.html` / settings patterns | | | |
| `/logs` | `logs` | `logging.tsx` | *(verify)* | | | |
| `/ops` | `ops` | `ops.tsx` | `view-others.jsx` *(verify)* | | | Migration entry → `/migration` |
| `/compliance` | `compliance` | `compliance.tsx` | *(verify)* | | | Links to `/feedback`, `/hilfe` |
| `/hilfe` | `hilfe` | `hilfe.tsx` | `MeDoc.html` (`.help-panel`), `interactions.jsx` | | | |
| `/feedback` | `feedback` | `feedback.tsx` | process docs / vigilance *(no single JSX)* | | | Local-only submit until API |
| `/migration` | `migration` | `migration-wizard.tsx` | ops / wizard narrative | | | PHYSICIAN + `ops.migration` |
| `/administration` | `administration` | `administration.tsx` | admin hub | | | `staff.read` |
| `/administration/work-days` | `administration/work-days` | `arbeitstage.tsx` | Desktop 70–71 Urlaub | | | SQLite `abwesenheit`, CRUD |
| `/administration/templates` | `administration/templates` | `vorlagen-prescriptions-certificates.tsx` | Desktop 74 Vorlagenliste | | | SQLite `document_template` |
| `/administration/templates/editor` | `administration/templates/editor` | `vorlage-editor.tsx` | Desktop 80–81 neu | | | `?kind=prescription` / `certificate` |
| `/administration/templates/editor/:id` | `administration/templates/editor` | `vorlage-editor.tsx` | Vorlage bearbeiten | | | gleiche RBAC-Route |
| `/balance-sheet/new` | `balance-sheet/new` | `balance-sheet-neu.tsx` | Desktop 88–93 Wizard | | | Schritte 1–4 mit Live-Zahlungen + Demo-Verträge |

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
