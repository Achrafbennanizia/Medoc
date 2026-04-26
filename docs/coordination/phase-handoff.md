# Phase handoff (running state)

**Last phase label:** D20 — "Automation max" Workflow-Refactor: Modal→Page (Neue Zahlung), Patient-Detail-Header-Redesign + per-Sektion-Validierungs-Badges (LocalStorage-Persistenz), Two-Mode-Behandlung-Composer mit auto B-Nummer/Sitzung + einklappbarem "Nächsten Termin planen", Termin-create-Tipp-Pipeline, Rezept-Vorlagen Quick-Pick-Chips  
**Last closed:** 2026-04-26

## Verified (Statistiken — merged workspace, 2026-04-26)

- **`app/src/views/pages/statistik.tsx`**: Single left nav (`PANELS`: Überblick + Patienten/Behandlungen/Termine/Finanzen) with `activePanel` state; `role="tablist"` / `tabpanel` main area; no separate Übersicht/Detail split or scroll spy; fragment file removed after splice.
- **Commands:** `cd app && npm run lint && npm test && npm run build` — all **PASS** (2026-04-26).
- **UI (NOT OBSERVED in browser here):** Active nav uses `.statistik-nav__item--active` in `app/src/index.css` (light background + left accent bar; matches prior design reference).

## Verified (D20 session, 2026-04-26)

- **User-Direktive umgesetzt** (vollständige Liste der gemachten Änderungen siehe `actions.md` D20):
  1. **Keine Modals mehr für Datensatz-Erstellung**: `Neue Zahlung`-Dialog raus aus `finanzen.tsx`,
     ersetzt durch dedizierte Seite `app/src/views/pages/zahlung-create.tsx` an Route
     `/finanzen/neu`. RBAC-Eintrag `finanzen/neu → finanzen.write` in `app/src/lib/rbac.ts`.
  2. **`patient-detail.tsx` Header**: globale Top-Buttons `Löschen` / `Validieren` / `Bearbeiten`
     entfernt; pro-Sektion-Aktionen (`Stammdaten`, `Anamnese`, `Anlagen`,
     `Kundenleistungen & Abrechnung`) inline im jeweiligen `CardHeader`. `Akte löschen` nur noch
     im Stammdaten-Header. `+ Neue Zahlung` jetzt im Kundenleistungen-Header und navigiert nach
     `/finanzen/neu?patient_id=…&from=patient`.
  3. **Validierungs-Workflow** über `app/src/lib/akte-validation.ts` (LocalStorage-Schlüssel
     `medoc.akte.validation.v1.<patientId>`): pro Sektion Status `validatedAt` + optional `by`;
     Tab-Buttons tragen `tab-badge` (`!` wenn Daten da, aber unvalidiert; `✓` wenn validiert);
     Seitentitel zeigt Pending-Counter. **Bewusste Architektur-Entscheidung:** LocalStorage statt
     `app_kv` gewählt, weil das `app_kv`-Whitelist eine Backend-Migration verlangt hätte und der
     User explizit „workflow zuerst, ohne Qualitätsverlust" wollte → in `actions.md` als
     Folge-Migration-Kandidat vermerken (siehe „Must happen next" unten).
  4. **Behandlung-Composer-Refactor**: Zwei-Mode-Schalter `Neue Behandlung` /
     `Behandlung fortsetzen` ersetzt das alte einzeilige Formular. `BEHANDLUNGSNUMMER` und
     `SITZUNG` werden automatisch berechnet und nur noch read-only in der Card-Header-Zeile
     angezeigt (Mapping aus `B-{YYYY}-{seq}` aus D8 wiederverwendet). `STATUS`,
     `TERMIN ERFORDERLICH`, `NOTIZEN` in einklappbares `<details>`-Panel
     "Nächsten Termin planen (optional)" verschoben.
  5. **„Nächsten Termin planen"-Tipp-Pipeline**: `patient-detail.tsx` schreibt einen Freitext-Tipp
     unter `localStorage` Key `medoc.akte.tipp.v1.<patientId>`. `termin-create.tsx` zeigt diesen
     Tipp prominent oben mit Button „In Notizen übernehmen" (siehe Datei-Diff). Schließt die
     User-Forderung „nect to termin on the top".
  6. **Rezept-Vorlagen-Integration sichtbarer**: Rezept-Tab in `patient-detail.tsx` zeigt jetzt
     Quick-Pick-Chip-Reihe der vorhandenen `rezeptVorlagen` direkt im Tab, plus den Vorlage-Loader
     aus D13. Standalone-`rezepte.tsx` unverändert.
- **CSS**: neue Klassen `.akte-subnav button`, `.tab-badge.warn|.ok|.muted` in
  `app/src/index.css`.
- **Validation re-run (2026-04-26)**:
  - `cd app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` → exit 0 (2.3 s).
  - `cd app && ./node_modules/.bin/eslint src --max-warnings 0` → exit 0 (3.7 s) nach Fix der
    fehlenden `activeTab`-Dependency im Vorlage-Loader-`useEffect` in `patient-detail.tsx`.
  - `cd app && ./node_modules/.bin/vitest run` → 29 Tests / 4 Files, alle grün.
  - **Rust-Backend nicht über sandboxed `cargo check` verifizierbar** (libsqlite3-sys-bindgen
    OUT_DIR vom laufenden tauri-dev-Prozess belegt) — Ersatz-Evidenz: Terminal 1 zeigt
    `Compiling medoc … Finished dev profile [unoptimized + debuginfo] target(s) in 13.68s` und
    danach `event="DB_READY"` plus erfolgreiche Login-Events. Damit ist der aktuelle
    `audit_repo.rs`-Stand mit `map_err(AppError::Internal)?` empirisch als compilable bewiesen;
    die alte „Result<String,String>: Encode"-Fehlermeldung in der oberen Hälfte des Terminals ist
    eine vor-Fix-Snapshot-Zeile, kein gegenwärtiger Defekt.

## Remains unverified (D20)

- **Backend-Persistenz der Validierungsstatus**: aktuell LocalStorage-only. Heißt: Statuswechsel
  ist nicht audit-loggable, nicht roll-übergreifend sichtbar, nicht Backup-fähig. Folge-Aktion
  als „Open" in `actions.md` aufnehmen, sobald die `app_kv`-Whitelist erweitert oder eine
  dedizierte Tabelle `akte_section_validation` migriert wird.
- **Manuelle UX-Walkthroughs** der vier neuen Flows in der laufenden App **NICHT BEOBACHTET**:
  (a) `/finanzen/neu`-Seite, (b) Patient-Detail-Validierungs-Flow + Tab-Badges, (c)
  Behandlung-Two-Mode-Composer, (d) Termin-Create-Tipp-Card.
- **Rust-Tests** (`cargo test --no-default-features`) für diese Session nicht erneut ausgeführt
  (Sandbox-Beschränkung wie oben). Backend ist aber unverändert gegenüber D19 — kein neuer
  Defekt zu erwarten.

## Must happen next (D20 follow-ups, prepended)

1. **Manuelle UX-Walkthrough-Sitzung** der vier D20-Flows; explizit Tab-Badges (warn → ok)
   verifizieren, weil LocalStorage-Persistenz im Cross-Browser/Cross-Profil-Szenario brüchig ist.
2. **Backend-Persistenz für Validierungs-Status** entscheiden: entweder `app_kv`-Whitelist
   erweitern (Schlüssel-Pattern `akte.validation.<patientId>`) oder dedizierte Tabelle
   `akte_section_validation (akte_id, section, validated_at, validated_by)` migrieren. Sobald
   das steht, `akte-validation.ts` in einen Tauri-Backed-Adapter umstellen und Audit-Log-Eintrag
   pro `validateSection`/`revokeSectionValidation` schreiben — schließt teilweise die WAAD-NEW-PH
   `FA-AKTE-15` (Validierungs-Queue) Lücke aus `actions.md` A12.
3. **`Plan nächsten Termin`-Tipp** ebenfalls in das Backend heben (jetzt LocalStorage-only) —
   gehört konzeptionell zur internen Rezeption-↔-Arzt-Kommunikation und damit zu
   `FA-PERS-08` / Action `A4`.
4. **Sandboxed `cargo check`** wieder ans Laufen bringen: tauri-dev terminiert temporär oder
   getrennten target-dir per `CARGO_TARGET_DIR=…/sandbox-target` für Validation-Runs benutzen.

## Verified (since last handoff)

- **WAAD-PDF formally adopted:** the user-supplied PDF („Anforderungen – Ableitung der

## Verified (since last handoff)

- **WAAD-PDF formally adopted:** the user-supplied PDF („Anforderungen – Ableitung der
  Anforderungen") was copied into the repo at
  `docs/requirements-engineering/source/anforderungen-ableitung-waad.pdf` and transcribed verbatim
  (39 IDs across 9 categories) into `docs/requirements-engineering/01a-waad-anforderungen.md`. A
  full traceability matrix `docs/requirements-engineering/01b-traceability-waad.md` maps every
  WAAD-ID to the corresponding `FA-*`/`NFA-*` IDs in `pflichtenheft.md`, marks each row as
  `COVERED` / `PARTIAL` / `NEW-PH` / `ORG`, and cites code evidence (file + `rg` query) for the
  COVERED/PARTIAL rows.
- **`pflichtenheft.md` extended (9 new IDs)**: `FA-AKTE-14` (Akte-an-Arzt-Weiterleitung),
  `FA-AKTE-15` (Validierungs-Queue-Page für ARZT), `FA-AKTE-16` (Akten-Vollständigkeits-Indikator),
  `FA-DOK-08` (Patient-Discharge-Summary PDF), `FA-LEIST-05` (Arzt-Freigabe pro abrechenbarer
  Leistung), `FA-PERS-07` (granulare Permission-Overrides pro Personal), `FA-PERS-08` (internes
  Ticket-/Notiz-System Rezeption→Arzt), `NFA-USE-09` (per-route Onboarding-Walkthrough),
  `NFA-USE-10` (konfigurierbares Autocomplete-Vokabular). WAAD-Quellen-Referenz wurde am Anfang
  des Pflichtenhefts ergänzt.
- **`02-klassifizierung.md` aktualisiert:** FA-Zähler 76 → 83, NFA-Zähler 16 → 18, betroffene
  Funktionsbereich-Counts (`FA-AKTE`, `FA-DOK`, `FA-LEIST`, `FA-PERS`, `NFA-*`) angepasst und mit
  WAAD-ID-Quellen kommentiert. `00-uebersicht.md` listet die zwei neuen Dokumente in der
  Strukturtabelle. `01-sammeln.md` referenziert das WAAD-PDF explizit als Erhebungsquelle.
- **`06-validierung.md` ergänzt:** neue Sektion §6.3a „WAAD-Erfüllungs-Matrix (Code-Evidenz)" mit
  pro-Kategorie-Status (✅/🟡/🔴/⚪) und Cross-Reference auf die Trace-Matrix.
- **Code-Evidenz-Audit für jede WAAD-ID** durchgeführt und in
  `docs/coordination/validation.md` ("WAAD intake — code-evidence audit") protokolliert.
  Kernbefunde:
  - ✅ RBAC + Audit-Read-Logging + Backup/Restore + Akten-Status `VALIDIERT` existieren bereits
    (`rbac.rs`, `audit_repo.rs`, `akte_commands.rs`, `backup.rs`, `connection.rs`).
  - 🟡 Hilfe/Tooltip-Layer und String-Suggest-Vokabular existieren als Bausteine, aber nicht in
    der von WAAD geforderten kompletten Form.
  - 🔴 Permission-Overrides, „Akte an Arzt"-Aktion, Rezeption→Arzt-Ticketsystem,
    Discharge-Summary-PDF, Arzt-Freigabe-Flag und Akten-Vollständigkeits-Indikator existieren
    bisher gar nicht — sie wurden als neue Pflichtenheft-IDs spezifiziert und als Aktionen
    `A2`–`A13` in `actions.md` eingetragen (IDs A2..A10 entsprechen 1:1 den Action-Verweisen
    in `01b-traceability-waad.md`; A11..A13 ergänzen FA-AKTE-14/15 und NFA-USE-10, die
    in der Trace-Matrix nicht namentlich an Action-IDs gebunden waren).
- **Backend enum (de)serialization fixed:** every domain enum now carries `#[serde(rename_all = "UPPERCASE")]` (`app/src-tauri/src/domain/enums.rs`). Previously, frontend `create_*`/`update_*` calls passing uppercase strings (`KONTROLLE`, `MAENNLICH`, `BEZAHLT`, …) silently failed to deserialize into PascalCase Rust variants — neither new appointments nor new patients/personal/zahlungen could be created reliably.
- **Dental mini-bar popover never escapes the viewport:** popover is now portaled to `document.body` via `createPortal` so that ancestors with `transform`/animations (notably `.animate-fade-in` keyframes which keep `transform: translateY(0)` after the run, turning the parent into the containing block for `position: fixed`) cannot anchor it inside the page card. Layout maths (clamp left/right, prefer-below-then-above, min/max width) live in `popLayout` (`app/src/views/components/DentalMiniBar.tsx`).
- **Untersuchung composer** redesigned around clinical sections (Hauptbeschwerde, Extraoral, Intraoral, Zahnbefund, Parodontal, Funktion, Bildgebung, Diagnose & Plan) with structured `UntersuchungV1` JSON serialized into the existing `untersuchung.ergebnisse` text column. Past examinations render a structured detail view via `parseUntersuchungV1` (`app/src/views/components/UntersuchungComposer.tsx`, `app/src/views/pages/patient-detail.tsx`).
- **Behandlung composer:** auto-generates `B-{YYYY}-{seq}` numbers and computes the next `Sitzung` automatically when a B.Nummer is present (`app/src/views/pages/patient-detail.tsx`).
- **Input validation hardening** for `Patient` and `Personal` create flows: future-date guard on `geburtsdatum`, format guards for `versicherungsnummer`, `email`, `telefon`, mandatory `Personal` password ≥ 8 chars (`app/src/views/pages/patient-create.tsx`, `app/src/views/pages/personal-create.tsx`).
- **Seed-data FK regression fixed:** demo-density patients (`seed-pat-006/007/008`) and their Akten now seed BEFORE downstream `INSERT OR IGNORE`s reference them. Previously `tests/db_migrations_tests.rs` panicked on a fresh in-memory pool with `FOREIGN KEY constraint failed`; the dsgvo erasure assertion was sharpened to count `WHERE akte_id = 'akte-dsgvo-1'` (`app/src-tauri/src/infrastructure/database/connection.rs`, `app/src-tauri/tests/dsgvo_erasure_tests.rs`).
- **Validation re-run (2026-04-25, this session):**
  - `cd app && npx tsc --noEmit` → exit 0
  - `cd app && npm test -- --run` → 19 passed (3 files)
  - `cd app/src-tauri && cargo check --no-default-features` → exit 0
  - `cd app/src-tauri && cargo test --no-default-features` → all suites pass (5 + 4 + 8 + 1 + 0 tests across files)
- **Neues Rezept now accepts a combo of medications** with the same cascading add-row pattern used in the template editor (`vorlage-editor`) and the new Behandlung composer:
  - New shared module `app/src/lib/medikamente.ts` exports `MEDIKAMENT_SUGGESTIONS`, `findSuggestion(label)`, `RezeptLine`, and `emptyRezeptLine()`.
  - The per-patient dialog in `app/src/views/pages/patient-detail.tsx` and the standalone page dialog in `app/src/views/pages/rezepte.tsx` both now offer: a draft row (`Medikament` autocomplete via `<datalist>`, `Wirkstoff`, `Dosierung`, `Dauer`, per-line `Hinweise`), a `+ Hinzufügen` button to push the row into a `Zeilen ({n})` list, an optional shared `Allgemeine Hinweise` block applied to every line, and a primary action that submits N `createRezept` calls in sequence (the dynamic label reflects the count: e.g. `3 Rezepte erstellen`).
  - On the global page, when more than one Rezept is created in one go a `printCombo` helper opens a single print sheet titled `Kombinationsrezept (N)` with all lines on one form (HTML escaping centralised, deduplicated print template).
  - Template editor (`vorlage-editor.tsx`) reuses `MEDIKAMENT_SUGGESTIONS` so the dropdown there stays consistent with the per-patient autocomplete.
  - `CardHeader` got an optional `subtitle` prop (used by the migration wizard) — fixed a pre-existing tsc error and made the type-check zero-error.

- **Wireframe-parity “Now” bucket landed (4 fixes, single review-sized change set):**
  - **Vorlage loader inside Rezept dialogs** (closes WF 32/34 gap — saved Vorlagen were invisible during issuance). Both `app/src/views/pages/patient-detail.tsx` and `app/src/views/pages/rezepte.tsx` now lazy-load `kind === "REZEPT"` Vorlagen on dialog open and expose a `Vorlage übernehmen (optional)` Select. Picking a Vorlage appends its parsed lines to the cascading list. New helpers `vorlageItemsToLines(items)` + `parseRezeptVorlagePayload(payload)` in `app/src/lib/medikamente.ts` (filling missing `wirkstoff`/`dosierung` from `findSuggestion`).
  - **Patient-create**: Medikation & Allergien `<details>` block now opens by default (compliance — needed before first treatment); summary text flips to "einklappen" (`app/src/views/pages/patient-create.tsx`).
  - **Termin Bearbeiten**: replaced the *“in Kürze verfügbar”* toast in `termine.tsx` with `goNeuerTermin({ id })` navigation. `termin-create.tsx` now supports `?id=<termin_id>` edit mode: prefills via `getTermin`, splits Beschwerden tags, recovers `Dauer:` from notes, skips localStorage draft logic, busy-key set excludes the termin being edited, page heading + button label flip (`Termin bearbeiten` / `Änderungen speichern`), submit calls `updateTermin` instead of `createTermin`. **Mitteilen** toast now references the patient name instead of a generic placeholder.
  - **Vorlage-Editor Attest Krankheiten**: replaced the 5-option `Select` with a free-text `Input` + `<datalist>` of dental-relevant suggestions (acute pulpitis, parodontitis, post-extraction wound healing, ortho treatment, plus the existing 5). Constant renamed `KRANKHEITEN_SUGGESTIONS`.

- **Validation re-run (this session):**
  - `cd app && npx tsc --noEmit` → exit 0
  - `cd app && npm test --silent` → 19 passed (3 files)
  - `cd app && npm run build` → vite build OK, all chunks emit
  - `cd app/src-tauri && cargo check --offline` → exit 0 (no Rust changes)

- **Bestellungen end-to-end overhaul (D17, this session):** the orders surface graduated from a thin
  CRUD list to a real procurement workflow:
  - **Backend:** `Bestellung` entity gets two persisted columns: `bestellnummer` (auto-generated as
    `B-YYYY-MM-NNNN` per month at `create()`-time when blank) and `pharmaberater` (sales rep / contact —
    closes the WF 45 parity gap). Idempotent `ALTER TABLE` migration handles older installs; new
    indexes on `bestellnummer` and `lieferant` keep search snappy. New `update_bestellung` Tauri
    command + repo `update()` use a patch DTO with `Option<Option<String>>` for nullable fields, so
    edits no longer have to round-trip status only.
    Files: `app/src-tauri/src/domain/entities/bestellung.rs`,
    `app/src-tauri/src/infrastructure/database/bestellung_repo.rs`,
    `app/src-tauri/src/infrastructure/database/connection.rs`,
    `app/src-tauri/src/commands/bestellung_commands.rs`, `app/src-tauri/src/lib.rs`.
  - **Frontend controller:** `bestellung.controller.ts` exports `updateBestellung()`; types and Zod
    schema (`UpdateBestellungSchema` + `CreateBestellungSchema` extended) carry the new optional
    fields.
  - **Page (`app/src/views/pages/bestellungen.tsx`)** rewritten around five additions:
    1. **Toolbar** — full-text search (Lieferant / Artikel / Bestellnr. / Pharmaberater /
       Bemerkung), 5-state status segment + clickable "Überfällig" KPI tile (when
       `erwartet_am < today` and not GELIEFERT/STORNIERT), sortable by ETA / supplier / artikel /
       status, "Filter zurücksetzen" shortcut.
    2. **Edit + Detail dialogs** — full record edit (calls `updateBestellung`), and a read-only
       detail dialog reachable via the monospace order-number cell. Status pill in detail mirrors
       overdue badge.
    3. **Inline status flow** — the three status buttons collapsed into a single
       `Status ändern…` `<select>` driven by a `STATUS_TRANSITIONS` map (no more dead-end states or
       backwards transitions).
    4. **Bulk operations** — checkbox column + "alle sichtbaren auswählen" header + sticky
       action bar that drives bulk status update and bulk delete (with `ConfirmDialog`). Loop is
       per-id with success/failure counters fed into the toast.
    5. **Reorder + Lager-Restock + CSV-Export** — `↻ Nachbestellen` clones an existing line into
       the create dialog, "🔁 Lager nachbestellen" opens a modal listing every active product at or
       below `mindestbestand` (joined from `listProdukte`), pre-selects all, and creates one OFFEN
       order per chosen item with a sensible default quantity (`max(min*2 − bestand, min)`).
       CSV-Export emits a UTF-8 BOM `text/csv` of the currently filtered rows.
    Lieferant/Artikel/Pharma inputs use shared `<datalist>`s seeded from history + product names,
    so common entries autocomplete after the first use.
  - **`EmptyState`** got an optional `action: { label, onClick }`, so the orders empty + no-match
    states are self-actionable.
  - **Validation:** `cargo check` (PASS), `cargo test --tests` (5 binaries / all green),
    `npx tsc --noEmit` (PASS), `npm test --silent` (29 / 29), `npm run build` (PASS — `bestellungen`
    chunk ≈ 24 kB / 7 kB gzipped). All recorded in `docs/coordination/validation.md`.

- **Statistik-Seite vollständig (D18, this session):** der vom User gewünschte WF-39–42-Look ist
  jetzt 1:1 implementiert — keine "leeren KPI-Karten" mehr.
  - **Backend:** neuer Tauri-Befehl `get_statistik_overview` (`statistik_commands.rs`,
    registriert in `lib.rs`). Aggregiert über die letzten 6/12 Monate eine `StatistikOverview`-
    Struktur mit fünf Domänen: Patienten (`neu_pro_monat`, `kumuliert_pro_monat`, `altersgruppen`,
    `geschlechter`, `patient_status`), Behandlungen (`nach_kategorie`, `pro_monat`,
    `medikamente_top`), Termine (`pro_monat`, `status`, `art`), Finanzen (`einnahmen_pro_monat`,
    `umsatz_nach_zahlungsart`, `einnahmen_aktueller_monat`) und Bestellungen
    (`nach_status`, `pro_monat`, `produkte_niedrig`). Helfer `last_n_months`, `align_months`,
    `altersgruppe`, `group_label_value` füllen Monate auch dann auf, wenn die Quell-Tabelle
    Lücken hat (sonst springt die Achse). Wichtige Compile-Korrektur: `chrono::Datelike` wurde
    importiert, sonst sind `year()`/`month()`/`day()` private (`cargo check` PASS nach Fix).
  - **Seed-Daten:** `connection.rs` legt 14 historische `bestellung`-Zeilen an (Status / Lieferant /
    Pharmaberater / Erwartet/Geliefert-am / `created_at` über mehrere Monate verteilt) und
    rückdatiert `created_at` für Patienten/`zahlung`/`termin`/`behandlung`-Seeds, damit alle
    Charts realistische Zeitreihen darstellen.
  - **Frontend:** `models/types.ts` und `controllers/statistik.controller.ts` exportieren
    `MonthBucket` / `LabelValue` / `StatistikOverview` + `getStatistikOverview()`.
    `views/pages/statistik.tsx` komplett neu mit `recharts`-Wrappern (`MonthBar`, `MonthLine`,
    `PiePanel`, `CategoryBar`, `ChartCard`), Sticky-Sidebar (`Patienten` / `Behandlungen` /
    `Termine & Organisation` / `Finanzen & Bestellstatistiken`), 6/12-Monats-Schalter und
    CSV-Export für alle Reihen.
  - **Validation:** `cargo check --no-default-features` PASS, `cargo test --no-default-features`
    PASS, `tsc --noEmit` PASS, `npm run lint` PASS, `vitest` 29/29 — alles in
    `docs/coordination/validation.md` protokolliert.

- **Bestellungen wieder Nielsen-konform (D19, this session):** der vom User explizit gemeldete
  Bruch ("no way to view edit/change or got back, no clear workflow or view, missmatch design
  philosophie") ist behoben.
  - **Hauptseite (`bestellungen.tsx`)** wieder minimalistisch wie `produkte.tsx`: nur Suche +
    Status-`Select` in der Toolbar, klare Tabellenspalten (Bestellnr / Lieferant / Artikel / Menge /
    Erwartet / Status / Aktionen). Bestellnummer ist jetzt ein klickbarer Link in den Akzent-Ton,
    der die Detailansicht öffnet (Heuristik #6 *recognition not recall*). Aktions-Spalte zeigt
    `Anzeigen` (immer) + `Löschen` (nur mit `finanzen.write`). Beim Anlegen wird direkt zur
    Detailansicht navigiert (Heuristik #1 *visibility of system status*).
  - **Neue Detail-Route `/bestellungen/:id` (`bestellung-detail.tsx`)** liefert genau die
    fehlenden Bausteine: deutlich sichtbarer **Zurück**-Button mit Chevron-Icon (Heuristik #3
    *user control & freedom*), Status-Badge im Header (überfällig wird rot), `Bearbeiten`/
    `Löschen`-Aktionen rechts oben, separater **Status-Workflow-Strip** mit vier Status-Buttons
    (aktiver Status hervorgehoben, alle anderen klickbar — keine Sackgassen mehr), Inline-
    Bearbeitungsmodus (Felder werden zu `Input`/`Textarea`, `Speichern`/`Abbrechen` ersetzen die
    Action-Knöpfe), zwei-Spalten-Layout für Bestelldaten und Metadaten/Verlauf, kollabiert auf
    Mobile auf eine Spalte. Löschen mit `ConfirmDialog`.
  - **Routing/RBAC:** neue Lazy-Route in `App.tsx` und `bestellungen/:id` → `finanzen.read` in
    `lib/rbac.ts::ROUTE_VISIBILITY`.
  - **Validation:** `tsc --noEmit` PASS, `npm run lint` PASS (`--max-warnings 0`), Vitest 29/29,
    `cargo check` PASS, `cargo test` PASS. `ReadLints` über alle berührten Dateien sauber.

## Verified (prior handoff, retained for context)

- `Neuer Termin` now uses a real typeahead dropdown for patient selection instead of an always-open inline list (`app/src/views/pages/termin-create.tsx`).
- Added “In Akten suchen” round-trip: from `Neuer Termin` -> `Patientenakten` -> selected `Akte` -> `Termin`, while preserving prior form state via local draft storage + `draft` query flow (`app/src/views/pages/termin-create.tsx`, `app/src/views/pages/patienten.tsx`, `app/src/views/pages/patient-detail.tsx`).
- `Sonder-Sperrzeiten` now supports `Typ` = `FULL_DAY` or `CUSTOM`; `CUSTOM` supports cascading multiple blocked periods per same day via `+ Zeitraum` (`app/src/views/pages/sonder-sperrzeiten.tsx`).
- `Arbeitszeiten` now supports cascading multiple working periods per weekday (e.g. morning + evening block) with add/remove controls (`app/src/views/pages/arbeitszeiten.tsx`).
- Praxis planning core model migrated to segment/period-based scheduling with legacy compatibility for existing stored data (`app/src/lib/praxis-planning.ts`).
- Validation re-run: `cd app && npm run build` passed on 2026-04-25 (also logged in `docs/coordination/validation.md`).
- **Termin draft gaps closed:** adding `draft` to the URL now preserves existing query params (e.g. `patient_id`); localStorage draft is not written until after one-time restore, avoiding wiping the draft on first paint (`app/src/views/pages/termin-create.tsx`). Patient dropdown closes on outside click / Escape via `useDismissibleLayer`.
- **Dental mini popover:** horizontal clamp uses actual popover width; vertical `maxHeight` + scroll for short viewports (`app/src/views/components/DentalMiniBar.tsx`, `app/src/index.css`).
- **Akte Untersuchung/Behandlung:** primary actions disabled while a composer is open; clearer label; Untersuchung save wrapped in try/catch (`app/src/views/pages/patient-detail.tsx`).
- **UI / wireframes:** `docs/ui/wireframe-route-map.md` lists every app route ↔ React page ↔ prototype hint; drop PNGs under `docs/ui/figma-exports/` and fill the Figma column when frames are exported.
- Repository layout unchanged in principle; **`app/`** = desktop, **`src/`** = Next reference; CI includes **`next-web`** (`.github/workflows/ci.yml`).
- **VVT** generator text distinguishes **current** SQLite (no SQLCipher) vs **planned** SQLCipher (`app/src-tauri/src/infrastructure/vvt.rs`).
- **Tauri CSP:** separate production `csp` and `devCsp` for Vite port 1420 (`app/src-tauri/tauri.conf.json`).
- **Validation:** `npm run lint`, `npm test`, `npm run build` in **`app/`** passed; **`cargo test --tests`** in **`app/src-tauri`** passed (`docs/coordination/validation.md`). Next **`src/`** build passed in same maintenance window.

## Remains unverified

- Round-trip behavior is code-verified but full manual UX walkthrough in running app is **NOT OBSERVED** in this session.
- NFA-SEC-08 **implementation** (SQLCipher or alternative) — still absent in `connection.rs` (**C1b**).
- Full FA-* traceability; UI/a11y runtime (**NOT OBSERVED**).
- Long-term **`src/`** vs **`app/`** product story (**UNVERIFIED**).
- **WAAD NEW-PH IDs** (`FA-AKTE-14/15/16`, `FA-DOK-08`, `FA-LEIST-05`, `FA-PERS-07/08`,
  `NFA-USE-09/10`) — specification only; **NO CODE** yet (verified by ripgrep in
  `validation.md` §"WAAD intake — code-evidence audit"). Implementation tracked as A2–A10.
- 5-Client-Last-Test (WAAD 9.4 → `NFA-PERF-04`): **NOT RUN** — kein Multi-Client-Harness vorhanden.

## Project understanding — what changed

- Scheduling model can now express split-day availability and split-day closures without duplicating day rows; legacy closure/day-plan payloads are normalized at read-time in `readPraxisArbeitszeitenConfig()`.
- **C1a, C2, C3, C4** closed per `docs/coordination/contradictions.md` (VVT honesty, architecture alignment, CI for Next, CSP).
- Open: **implementation** of at-rest DB encryption (**C1b**).
- **Requirements baseline expanded by WAAD intake**: the Pflichtenheft is now provably traceable
  to a single, version-controlled source PDF (`source/anforderungen-ableitung-waad.pdf`). Previous
  76 FA / 16 NFA grew to 83 FA / 18 NFA; the deltas are exclusively WAAD-derived and explicitly
  cited in `01b-traceability-waad.md`.
- The "honest gap list" between spec and implementation is now **explicit, machine-greppable, and
  triaged** (see `validation.md` "WAAD intake — code-evidence audit" + `actions.md` A2–A10).

## Must happen next

1. **Implement WAAD NEW-PH IDs in priority order** (per `actions.md`):
   - **High-impact, low-risk first:** `A6` (`NFA-USE-09` Onboarding-Wizard pro Rolle) und
     `A13` (`NFA-USE-10` konfigurierbares Autocomplete) — rein additiv, keine Migration.
   - **Compliance-kritisch danach:** `A2` (`FA-PERS-07` Permission-Overrides) und
     `A5` (`FA-LEIST-05` Arzt-Freigabe pro Leistung) — beide brauchen kleine Migrationen +
     RBAC-Test-Erweiterungen, schalten aber korrekten Zugriff / korrekte Abrechnung frei.
   - **Workflow-Features danach:** `A11`/`A12` (`FA-AKTE-14`/`FA-AKTE-15` Akte-Weiterleitung +
     Validierungs-Queue), `A4` (`FA-PERS-08` Ticket-System), `A7` (`FA-AKTE-16`
     Vollständigkeits-Indikator), `A3` (`FA-DOK-08` Discharge Summary).
   - **Infrastruktur-Tasks:** `A8` (Backup-Scheduler), `A9` (Stresstest), `A10` (Statistik-Charts).
2. **Manual UX walkthrough** of the new flows: Termin **Bearbeiten** (right-click → Bearbeiten on a day pill → form opens prefilled → save → returns to Termine), Vorlage in Rezept dialog (create a Rezept-Vorlage in Verwaltung → open Neues Rezept on a patient → pick the Vorlage from the new Select → confirm lines append → save), Patient-create with Medikation/Allergien now visible by default, Vorlage-Editor Attest with free-text Krankheiten.
2. Wireframe-parity **Next** bucket (½–1 day):
   - Two-select Behandlungstyp in `termin-create.tsx` (Kategorie → Leistung from `listBehandlungsKatalog()`).
   - Per-section validation banner in `patient-create.tsx` via `FormSection`.
   - “Nächster Termin in 2 Wochen” suggestion pill in `termin-create.tsx` based on patient’s last termin.
   - Wire `Mitteilen` action to a real channel (email/SMS via `integration.controller.ts`) or remove it.
3. Wireframe-parity **Later** bucket (multi-day): real `Vertrag` table/repo/controller (replace `DEMO_VERTRAEGE` in `bilanz-neu.tsx`); fuller Einnahmen filters. (Bestellungen domain now satisfied — see D17.)
4. When scheduled: **implement NFA-SEC-08** at-rest encryption and re-validate migrations + backups.
5. Document or decide **desktop vs Next** positioning for contributors.
6. Continue FA coverage / UX / a11y passes as separate workstreams.
7. **Figma:** export key frames to `docs/ui/figma-exports/` and complete the **Figma frame** / **PNG** columns in `docs/ui/wireframe-route-map.md` so remaining layout gaps can be implemented screen-by-screen.

## Continuity tokens (for search / agents)

- **Active branch / PR / ticket IDs:** _(not captured this session)_  
- **Blockers:** NFA-SEC-08 implementation scheduling (**C1b**)  
- **Files under active edit:** `docs/coordination/*`
