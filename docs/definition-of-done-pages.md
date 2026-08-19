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
| `/appointments` | `views/pages/appointments.tsx` | `appointments` | ✅ | — | Calendar filters |
| `/appointments/new` | `views/pages/appointment-create.tsx` | `appointments/new` | ✅ | — | Create + validation |
| `/patients` | `views/pages/patients.tsx` | `patients` | ✅ | — | Search + list |
| `/patients/new` | `views/pages/patient-create.tsx` | `patients/new` | ✅ | — | Zod + IPC |
| `/patients/:id` | `views/pages/patient-detail.tsx` | `patients/:id` | ✅ | — | Akte tabs |
| `/charts/to-validate` | `views/pages/charts-zu-validieren.tsx` | `charts/to-validate` | ✅ | — | PHYSICIAN validation queue + nav badge |
| `/tickets` | `views/pages/praxis-tickets.tsx` | `tickets` | ✅ | — | Praxis tickets (PHYSICIAN/RECEPTION) |
| `/patients/:id/prescription/neu` | `views/pages/prescription-create.tsx` | `patients/:id/prescription/neu` | ✅ | — | — |
| `/patients/:id/prescription/:rezeptId` | `views/pages/prescription-edit.tsx` | `patients/:id/prescription/:rezeptId` | ✅ | — | — |
| `/finance` | `views/pages/finance.tsx` | `finance` | ✅ | — | — |
| `/finance/new` | `views/pages/payment-create.tsx` | `finance/new` | ✅ | — | — |
| `/purchase-orders` | `views/pages/purchase-orders.tsx` | `purchase-orders` | ✅ | — | — |
| `/purchase-orders/new` | `views/pages/purchaseOrder-create.tsx` | `purchase-orders/new` | ✅ | — | — |
| `/purchase-orders/:id` | `views/pages/purchaseOrder-detail.tsx` | `purchase-orders/:id` | ✅ | — | — |
| `/balance-sheet` | `views/pages/balance-sheet.tsx` | `balance-sheet` | ✅ | — | — |
| `/balance-sheet/new` | `views/pages/balance-sheet-neu.tsx` | `balance-sheet/new` | ✅ | — | — |
| `/administration` | `views/pages/administration.tsx` | `administration` | ✅ | — | Hub links |
| `/administration/team` | `views/pages/administration-team.tsx` | `administration/team` | ✅ | — | — |
| `/administration/work-days` | `views/pages/arbeitstage.tsx` | `administration/work-days` | ✅ | — | — |
| `/administration/practice-planning` | `views/pages/praxisplanung.tsx` | `administration/practice-planning` | ✅ | — | — |
| `/administration/work-hours` | `views/pages/arbeitszeiten.tsx` | `administration/work-hours` | ✅ | — | — |
| `/administration/special-blocked-times` | `views/pages/sonder-sperrzeiten.tsx` | `administration/special-blocked-times` | ✅ | — | — |
| `/administration/practice-preferences` | `views/pages/praxis-praeferenzen.tsx` | `administration/practice-preferences` | ✅ | — | — |
| `/administration/templates` | `views/pages/vorlagen-prescriptions-certificates.tsx` | `administration/templates` | ✅ | — | — |
| `/administration/templates/editor` | `views/pages/vorlage-editor.tsx` | `administration/templates/editor` | ✅ | — | — |
| `/administration/templates/editor/:id` | `views/pages/vorlage-editor.tsx` | `administration/templates/editor` | ✅ | — | — |
| `/administration/treatment-catalog` | `views/pages/behandlungs-katalog.tsx` | `administration/treatment-catalog` | ✅ | — | — |
| `/administration/order-master` | `views/pages/bestellstamm-administration.tsx` | `administration/order-master` | ✅ | — | — |
| `/administration/finance-reports` | `views/pages/administration-finance-berichte.tsx` | `administration/finance-reports` | ✅ | — | — |
| `/administration/finance-reports/day-close` | `views/pages/tagesabschluss.tsx` | `administration/finance-reports/day-close` | ✅ | (d) form | Full page load |
| `/administration/finance-reports/invoice` | `views/pages/administration-finanz-werkzeuge.tsx` | `administration/finance-reports/invoice` | ✅ | — | PDF path |
| `/administration/inventory-and-ordering` | `views/pages/administration-lager-bestellwesen.tsx` | `administration/inventory-and-ordering` | ✅ | — | — |
| `/administration/contracts` | `views/pages/administration-vertraege.tsx` | `administration/contracts` | ✅ | — | — |
| `/administration/services-catalogs-templates` | `views/pages/administration-services-kataloge-vorlagen.tsx` | `administration/services-catalogs-templates` | ✅ | — | — |
| `/prescriptions` | `views/pages/prescriptions.tsx` | `prescriptions` | ✅ | — | — |
| `/certificates` | `views/pages/certificates.tsx` | `certificates` | ✅ | — | — |
| `/services` | `views/pages/services.tsx` | `services` | ✅ | — | — |
| `/products` | `views/pages/products.tsx` | `products` | ✅ | — | — |
| `/staff` | `views/pages/staff.tsx` | `staff` | ✅ | — | — |
| `/staff/work-plan` | `views/pages/staff-work_plan.tsx` | `staff/work-plan` | ✅ | — | a11y sample |
| `/statistics` | `views/pages/statistics.tsx` | `statistics` | ✅ | — | Heavy charts |
| `/audit` | `views/pages/audit.tsx` | `audit` | ✅ | — | — |
| `/privacy` | `views/pages/privacy.tsx` | `privacy` | ✅ | (e) DSGVO | Export + erase live |
| `/settings` | `views/pages/settings.tsx` | `settings` | ✅ | — | — |
| `/logs` | `views/pages/logging.tsx` | `logs` | ✅ | — | — |
| `/ops` | `views/pages/ops.tsx` | `ops` | ✅ | — | — |
| `/compliance` | `views/pages/compliance.tsx` | `compliance` | ✅ | — | — |
| `/hilfe` | redirect → `/settings?tab=hilfe` | `hilfe` | ✅ | — | — |
| `/feedback` | `views/pages/feedback.tsx` | `feedback` | ✅ | — | — |
| `/migration` | `views/pages/migration-wizard.tsx` | `migration` | ✅ | — | — |

**IPC-focused smoke (not full page render):**

| Flow | What is verified |
|------|------------------|
| **(b)** | `create_patient` → `get_chart` → `update_dental_finding` → `set_chart_section_validated` call order |
| **(c)** | `create_appointment` → `update_appointment` → `create_payment` → `update_payment_status` call order |

**SQLite cleanliness for DSGVO:** frontend smoke asserts `dsgvo_erase_patient` IPC + legacy browser key removal; database guarantees are covered by `app/src-tauri/tests/dsgvo_erasure_tests.rs`.

*End of DoD matrix.*
