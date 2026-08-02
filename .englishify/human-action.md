# Human action list (Englishify Phase 3)

Generated from `.englishify/contract-ledger.md` PROPOSED/KEEP entries.
Do **not** execute these without a coordinated Rust + SQL migration plan (where flagged).

## Requires migration (Tier C)

- `dto-type.Zahnbefund` — migration: yes (requires coordinated Rust refactor + SQL migration — table `zahnbefund`)
- `dto-type.PraxisAufgabe` — migration: yes (table + serde field bundle)
- `dto-type.Behandlung` — migration: yes
- `dto-type.Termin` — migration: yes
- `dto-type.Zahlung` — migration: yes
- `dto-type.Bestellung` — migration: yes
- `dto-type.BilanzSnapshot` — migration: yes
- `dto-type.TagesabschlussProtokoll` — migration: yes
- `dto-type.Patientenakte` — migration: yes
- `dto-type.Anamnesebogen` — migration: yes
- `dto-type.Leistung` — migration: yes
- `dto-type.Produkt` — migration: yes
- `dto-type.Rezept` — migration: yes
- `dto-type.Personal` — migration: yes

## Coordinated code-only (PROPOSED, no SQL)

- `i18n-key-namespace.praxis` — no (catalog + all `t()`/`tp()` sites; ~160 keys)
- `i18n-key-namespace.termin` — no (~136 keys with segment)
- `i18n-key-namespace.termine` — no (~64 keys)
- `i18n-key-namespace.verwaltung` — no (~114 keys)
- `i18n-key-namespace.einstellungen` — no (~7 keys, e.g. `nav.einstellungen`)
- `i18n-key-namespace.zahlung` — no (~73 keys)
- `i18n-key-namespace.bestellung` — no (~46 + ~64 keys)
- `i18n-key-namespace.behandlung` — no (~36 + ~3 keys)
- `i18n-key-namespace.aufgaben` — no (~53 keys)
- `i18n-key-namespace.leistung` — no (~1 + ~31 keys)
- `i18n-key-namespace.bilanz` — no (~24 keys)
- `i18n-key-namespace.anamnese` — no (~23 keys)
- `i18n-key-namespace.atteste` — no (~23 keys)
- `i18n-key-namespace.rezeption` — no (~15 keys) — **if** only used as i18n path segment
- `i18n-key-namespace.patienten` — no (~9 keys)
- `i18n-key-namespace.rechnung` — no (~3 keys)
- `i18n-key-namespace.stammdaten` — no (~2 keys)
- `i18n-key-namespace.abwesenheit` — no (~1 key: `error.entity.abwesenheit`)
- `dto-type.DokumentTemplateUser` — no (confirm table name before execute)
- `module.konflikt` — no (Rust module rename + imports)
- `pdf.akte-export-labels` — no
- `dto-type.ExportDischargeMerkblattPdfArgs` — no (confirm serde consumers; unsure B/C → C)
- `command-name.* (bulk)` — no (but both-sides: `register.rs` + `tauri.service.ts` + all controllers)
- `ui.statistik-chart-labels` — no
- `ipc.AppError.Display-templates` — no
- `ui.native-menu-labels` — no

## KEEP (do not rename this pass)

- `enum-value.workflow-status-wires`
- `enum-value.rbac-role-wires`
- `ipc.AppError.NotFound-resource`
- `ui.default-device-display-name`
