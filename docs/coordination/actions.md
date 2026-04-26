# Action ledger

**Last updated:** 2026-04-26

## Now (this session / immediate)

> **Action-ID-Konvention für WAAD-Wave:** A2..A10 sind genau so vergeben, wie sie in
> `docs/requirements-engineering/01b-traceability-waad.md` zitiert werden. Bitte beim Querverweisen
> aus dem Traceability-Dokument diese IDs unverändert verwenden.

| ID | Action | Blocked by | Status |
| -- | ------ | ---------- | ------ |
| A1 | Implement NFA-SEC-08 at-rest DB encryption when prioritized | Product/engineering | Open |
| A2 | Implement WAAD-derived `FA-PERS-07` (granulare Permission-Overrides): Tabelle `personal_permission_override`, `rbac::allowed_for_user`, Settings-UI | RBAC-Test-Erweiterung | Open |
| A3 | Implement WAAD-derived `FA-DOK-08` (Patient-Discharge-Summary): druckbares Nachsorge-Merkblatt-PDF; Reuse PDF pipeline aus `export_akte_pdf` | — | Open |
| A4 | Implement WAAD-derived `FA-PERS-08` (Internes Ticket-/Notiz-System Rezeption→Arzt): Domain-Entität + Dashboard-Badge + Audit-Log on read (NICE TO HAVE) | A2 (visibility scoping nutzt Overrides) | Open |
| A5 | Implement WAAD-derived `FA-LEIST-05` (Arzt-Freigabe pro Leistung): `freigegeben_von_arzt_id`/`freigegeben_am` in `leistung`; Rechnungs-Workflow lehnt ohne Freigabe ab | Migration + Backfill-Plan für Legacy-`leistung`-Zeilen | Open |
| A6 | Implement WAAD-derived `NFA-USE-09` (geführter Onboarding-Wizard pro Rolle + per-Route Tooltip-Coverage ≥ 80 %), aufbauend auf `app/src/views/components/app-help-dialogs.tsx` + `app_kv` | — | Open |
| A7 | Implement WAAD-derived `FA-AKTE-16` (Akten-Vollständigkeits-Indikator): zuerst Durchführbarkeits-Spike, dann Heuristik in `app/src/lib/akte-completeness.ts` | Vorab-Spike | Open |
| A8 | Implement WAAD 9.1: automatischer Tages-Backup-Scheduler + Restore-UI über `backup.rs`/`ops_commands.rs` | OS-Scheduler-Strategie (Tauri Plugin / Cron) | Open |
| A9 | Implement WAAD 9.4 / `NFA-PERF-04`: automatisierter Stresstest (5 parallele Tauri-Clients) + Performance-Logging-Auswertung | Multi-Client-Test-Harness | Open |
| A10 | Implement WAAD 9.5: Verlaufsmuster-/Krankheitsbilder-Charts mit Export in `statistik.tsx` (über `FA-STAT-02/04`) | — | Open |
| A11 | Implement WAAD-derived `FA-AKTE-14` (Akte-an-Arzt-Weiterleitungs-Aktion): Aktionsmenü + Backend-Command + Audit-Log-Eintrag; erzeugt Eintrag in der Validierungs-Queue (A12) | Produkt-Bestätigung der Empfänger-Multi-Select-Regel | Open |
| A12 | Implement WAAD-derived `FA-AKTE-15` (Validierungs-Queue-Seite „Zu validieren" für ARZT): Liste + Sidebar-Badge + ARZT-only-Route | A11 (gemeinsames Datenmodell für Pending-Einträge) | Open |
| A13 | Implement WAAD-derived `NFA-USE-10` (konfigurierbares Autocomplete + Toggle „Auto-Vervollständigung deaktivieren") in `app/src/lib/string-suggest.ts` + `app_kv` | A6 Styling-Alignment | Open |

## Next (queued)

| ID | Action | Dependency | Priority |
| -- | ------ | ---------- | -------- |
| N1 | Clarify product positioning: desktop `app/` vs Next `src/` in README or architecture | Stakeholder | Medium |
| N2 | Optional: `tauri build` smoke on CI or release pipeline | CI time budget | Low |
| N3 | Re-verify ARZT-Freigabe (`FA-LEIST-05`) end-to-end after A5 — Rechnungs-Workflow lehnt ungekoppelte Leistungen ab | A5 | Medium |

## Done (recent; keep short)

| ID | Outcome | Date |
| -- | ------- | ---- |
| D1 | VVT `common_tech`: honest SQLite vs SQLCipher wording | 2026-04-19 |
| D2 | `tauri.conf.json`: `csp` + `devCsp` (removed invalid host wildcards) | 2026-04-19 |
| D3 | Ledgers + validation evidence updated | 2026-04-19 |
| D4 | Implemented Termin draft-preserving Akte round-trip and cascading period scheduling in Arbeitszeiten/Sonder-Sperrzeiten | 2026-04-25 |
| D5 | Backend domain enums all carry `#[serde(rename_all = "UPPERCASE")]` — fixes silent create/update failures for Termin, Patient, Personal, Zahlung, Auditor, Akte (`app/src-tauri/src/domain/enums.rs`) | 2026-04-25 |
| D6 | Dental mini-bar popover portaled to `document.body` so transformed ancestors (`.animate-fade-in`) cannot clip it inside the page card | 2026-04-25 |
| D7 | Untersuchung composer (clinical sections + structured `UntersuchungV1` JSON) wired into Akte; previous Untersuchungen render parsed detail view | 2026-04-25 |
| D8 | Behandlung composer auto-generates `B-{YYYY}-{seq}` numbers and computes next `Sitzung` automatically when a B.Nummer is present | 2026-04-25 |
| D9 | Patient/Personal create flows: format & range validation for `geburtsdatum`, `versicherungsnummer`, `email`, `telefon`, `passwort` (≥ 8) | 2026-04-25 |
| D10 | Seed-data ordering fixed (FK regression in `tests/db_migrations_tests.rs`) and DSGVO test scoped to test akte | 2026-04-25 |
| D11 | "Neues Rezept" supports cascading combo of medications: shared draft + add-row pattern in `rezepte.tsx` and `patient-detail.tsx`, datalist-backed med suggestions, auto-print as Kombinationsrezept when n>1 (`app/src/lib/medikamente.ts`, `app/src/views/pages/rezepte.tsx`, `app/src/views/pages/patient-detail.tsx`); template editor unified onto same suggestion list | 2026-04-25 |
| D12 | `CardHeader` accepts optional `subtitle` (used by migration wizard); cleared a pre-existing tsc regression so frontend `tsc --noEmit` is now zero-error | 2026-04-25 |
| D13 | WAAD-Anforderungen aus PDF formal aufgenommen: `docs/requirements-engineering/source/anforderungen-ableitung-waad.pdf` + `01a-waad-anforderungen.md` (verbatim) + `01b-traceability-waad.md` (Mapping + Code-Evidenz); 9 neue FA/NFA-IDs in Pflichtenheft (`FA-AKTE-14/15/16`, `FA-DOK-08`, `FA-LEIST-05`, `FA-PERS-07/08`, `NFA-USE-09/10`); Counts in `02-klassifizierung.md` aktualisiert; Erfüllungs-Matrix in `06-validierung.md` (§6.3a) ergänzt | 2026-04-25 |
| D13 | Vorlage selector wired into both Rezept dialogs (`patient-detail.tsx`, `rezepte.tsx`) — closes the gap WF 32/34 (templates created in `vorlage-editor` were invisible during issuance). New helpers `vorlageItemsToLines` + `parseRezeptVorlagePayload` in `app/src/lib/medikamente.ts` | 2026-04-25 |
| D14 | Patient-create: Medikation & Allergien `<details>` opens by default (compliance — needed before first treatment), summary now reads "einklappen" | 2026-04-25 |
| D15 | Termine: `Bearbeiten` action navigates to `/termine/neu?id=<id>` instead of toasting "in Kürze". `termin-create.tsx` now supports edit mode via `?id=<termin_id>` (prefill via `getTermin`, save via `updateTermin`, busy-key excludes self, page title + button label flip). `Mitteilen` toast now mentions the patient name. | 2026-04-25 |
| D16 | Vorlage-Editor Attest: `Krankheiten` is now free-text `Input` with datalist suggestions (replaces 5-option Select). Suggestion list extended with dental-relevant entries. | 2026-04-25 |
| D17 | Bestellungen end-to-end overhaul: backend `Bestellung` gains `bestellnummer` (auto `B-YYYY-MM-NNNN`) + `pharmaberater` (WF 45 parity), idempotent ALTER TABLE migration + supplier/bestellnummer indexes, new `update_bestellung` command/repo with patch DTO. Page now ships search, status segment + "Überfällig" KPI tile (clickable filters), sortable columns, lieferant/artikel/pharma datalists (autocompleted from history + `produkt`), inline status-transition dropdown (no more 3 buttons + dead-end states), edit dialog, detail dialog, **Nachbestellen** clone action, bulk select + bulk status / bulk delete bar, **CSV export** (UTF-8 BOM), **Lager nachbestellen** modal that batch-creates orders for products at/below `mindestbestand`. `EmptyState` got an optional `action` so the empty + no-match states are actionable. (`bestellungen.tsx`, `bestellung_repo.rs`, `bestellung_commands.rs`, `domain/entities/bestellung.rs`, `connection.rs`, `bestellung.controller.ts`, `schemas.ts`, `empty-state.tsx`) | 2026-04-25 |
| D18 | Statistik-Seite (vollständige WF 39–42-Parität): Neuer Tauri-Befehl `get_statistik_overview` aggregiert Patienten/Behandlungen/Termine/Finanzen/Bestellungen über die letzten 6/12 Monate (`statistik_commands.rs`, `lib.rs`); Frontend-Seite (`statistik.tsx`) reuses recharts mit `MonthBar`/`MonthLine`/`PiePanel`/`CategoryBar`-Wrappern, sticky Sektions-Sidebar (Patienten / Behandlungen / Termine / Finanzen+Bestellungen), 6-Monats-/12-Monats-Schalter, CSV-Export. Datenbank-Seeding (`connection.rs`) bekommt 14 historische Bestellungen plus rückdatierte `created_at` für Patienten/Zahlungen/Termine/Behandlungen, damit die Charts realistische Zeitreihen zeigen. `MonthBucket`/`LabelValue`/`StatistikOverview` in `models/types.ts` + `statistik.controller.ts` ergänzt. Kompiliert (`cargo check`), `tsc --noEmit` clean, `npm run lint` clean, `vitest` 29/29, `cargo test` ok. | 2026-04-25 |
| D19 | Bestellungen-Seite Re-Design auf Nielsen-Heuristiken: Hauptseite wieder minimalistisch wie `produkte.tsx` (Suche + Status-Filter, klickbare Bestellnummer öffnet Detailansicht; Anzeigen-/Löschen-Button in Aktionsspalte). Neue Detail-Route `/bestellungen/:id` (`bestellung-detail.tsx`) mit deutlichem **Zurück**-Button, Status-Workflow-Strip (vier-Status-Pills, aktiver Status hervorgehoben), Bearbeiten/Speichern-Modus inline, separater Karten-Layout für Bestelldaten + Metadaten/Verlauf, Löschen-Bestätigung. Route in `App.tsx` und `rbac.ts` (`bestellungen/:id` → `finanzen.read`) registriert. | 2026-04-25 |
| D20 | Workflow-Refactor "Automation max" (User-Direktive 2026-04-26): (1) **Modal → Page**: `Neue Zahlung` aus `finanzen.tsx` entfernt und durch dedizierte Seite `zahlung-create.tsx` an `/finanzen/neu` ersetzt; Route in `App.tsx`, RBAC-Eintrag `finanzen/neu → finanzen.write` in `rbac.ts`. (2) **`patient-detail.tsx` Header-Refactor**: Top-Buttons `Löschen`/`Validieren`/`Bearbeiten` entfernt; pro-Sektion-Buttons (Stammdaten/Anamnese/Anlagen/Zahlungen) plus inline `Akte löschen` nur in Stammdaten und `+ Neue Zahlung` in Kundenleistungen-Sektion; Tab-Buttons tragen jetzt eine `tab-badge` (`!`/`✓`/Zahl) gespeist aus `app/src/lib/akte-validation.ts` (LocalStorage-basierte Validierungsstati pro Patient × Sektion); pending-count-Badge im Seitentitel. (3) **Behandlung-Composer**: Zwei-Mode-Schalter (`Neue Behandlung` / `Behandlung fortsetzen`) ersetzt das alte Formular; `BEHANDLUNGSNUMMER` und `SITZUNG` werden automatisch berechnet/angezeigt (read-only); `STATUS` / `TERMIN ERFORDERLICH` / `NOTIZEN` in einklappbares `<details>` "Nächsten Termin planen (optional)" verschoben. (4) **Termin-Tipp-Pipeline**: `patient-detail.tsx` schreibt bei `Plan nächsten Termin` einen freien Text nach `localStorage` (`medoc.akte.tipp.v1.<patientId>`); `termin-create.tsx` zeigt diesen Tipp prominent oben mit "In Notizen übernehmen"-Button. (5) **Rezept-Vorlagen-Integration**: Quick-Pick-Chip-Reihe für `rezeptVorlagen` direkt im Rezept-Tab + Standalone `rezepte.tsx`. (6) **CSS**: neue `.tab-badge.warn|.ok|.muted`-Styles in `index.css`. Validation: `tsc --noEmit` clean, `eslint --max-warnings 0` clean (nach Fix der fehlenden `activeTab`-Dependency im Vorlage-Loader-Effekt), `vitest run` 29/29 grün. Backend unverändert; live `tauri dev` (Terminal 1) zeigt `Finished dev profile in 13.68s` + `DB_READY`, d. h. der Rust-Stand kompiliert. | 2026-04-26 |
