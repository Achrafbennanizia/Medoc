# 1b. Traceability — WAAD-Quell-IDs → Pflichtenheft (FA / NFA) + Code-Evidenz

**Quelle:** `docs/requirements-engineering/01a-waad-anforderungen.md`
**Pflichtenheft (Master):** `docs/v-model/01-anforderungen/pflichtenheft.md`
**Stand:** 2026-04-25

Dieses Dokument bildet jede der **39 WAAD-Anforderungen** auf eine oder mehrere
verbindliche Pflichtenheft-IDs ab und vermerkt den heutigen Erfüllungsstatus
auf Basis von **Code-Evidenz** (Pfade in `app/`, `app/src-tauri/`).

## Status-Legende

| Status | Bedeutung |
|---|---|
| ✅ COVERED | Im Code implementiert + Pflichtenheft-Anforderung referenziert sie. |
| 🟡 PARTIAL | Ansatzweise implementiert oder dokumentiert; Akzeptanzkriterium nicht vollständig erfüllt. **Action** in `docs/coordination/actions.md`. |
| 🆕 NEW-PH | War bisher nicht explizit im Pflichtenheft; **mit dieser Intake-Welle** als neue FA-/NFA-ID ergänzt (siehe `pflichtenheft.md`). |
| ❌ GAP | Funktion fehlt in Code **und** Pflichtenheft-Anforderung; muss als Action geplant werden. |
| ⚪ ORG | Organisatorische / nicht-technische Anforderung (Schulung, Online-Trainings). Implementierung außerhalb der Software. |

---

## ID 1 — Patientenaufnahme & Termin (Rezeption)

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **1.1.1** Stammdaten-UI | FA-PAT-01, FA-PAT-02, NFA-USE-H05, NFA-DESIGN-04 | ✅ COVERED | `app/src/views/pages/patient-create.tsx`, `app/src/views/pages/patient-detail.tsx`, `app/src-tauri/src/commands/patient_commands.rs` | Pflichtfelder, Validierung & responsives Layout vorhanden. |
| **1.2.1** Termin CRUD + Konflikt + Kalender | FA-TERM-01, FA-TERM-02, FA-TERM-03, FA-TERM-12 | ✅ COVERED | `app/src/views/pages/termine.tsx`, `termin-create.tsx`, `app/src-tauri/src/commands/termin_commands.rs` (`check_conflicts`) | Tag/Woche/Monat-Ansicht; farbkodierte Termine. |
| **1.2.2** Notfall-Sofort-Termin | FA-TERM-04 | ✅ COVERED | `termin-create.tsx` Notfall-Variante; `domain/enums.rs` (`TerminArt::Notfall`) | „Heute"/„Jetzt"-Eingabe in < 3 Klicks. |
| **1.2.3** Langfrist-Planung + optionale Erinnerung | FA-TERM-05, FA-TERM-11 | 🟡 PARTIAL | Kalender unterstützt Monats-/Jahresnavigation; SMS/E-Mail-Reminder-Pipeline ist als `notifications.rs` gerüstet, aber **kein Versand-Connector aktiv**. | Reminder-Versand bleibt Nice-to-have-Action. |
| **1.2.4** Termin-Änderung → automatische Benachrichtigung + Vorschläge | FA-TERM-07, FA-TERM-15 | 🟡 PARTIAL | Bestätigungsdialog vorhanden (`patient-detail.tsx`, `termine.tsx`); automatische **Alternativ-Vorschläge** noch nicht generiert. | Vorschlags-Heuristik als nächste Iteration. |
| **1.3.1** Akte an Arzt weiterleiten + Mehrfach-Empfänger | **FA-AKTE-14 (NEU)** | 🆕 NEW-PH | Bisher implizit über Notiz-/Audit-Spur; expliziter „Akte weiterleiten"-Button + Empfängerliste fehlt. | Pflichtenheft-Erweiterung in dieser Welle: FA-AKTE-14. |
| **1.3.2** RBAC: Rezeption hat keinen Zugriff auf medizinische Inhalte | FA-AKTE-13, NFA-SEC-01, NFA-SEC-02 | ✅ COVERED | `app/src-tauri/src/application/rbac.rs` — `patient.read_medical` / `patient.write_medical` nur für `Role::Arzt`; `akte_commands.rs::get_akte` nullt Diagnose/Befunde für Nicht-Arzt-Rollen. | Granulare per-Aktenbereich-Konfiguration → siehe 2.1.4. |
| **1.3.3** Filterbare Termin-Übersicht für Arzt | FA-TERM-08 | ✅ COVERED | `app/src/views/pages/termine.tsx` (Datum/Patient/Status-Filter) | — |

## ID 2 — Rechte- und Zugriffskontrolle

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **2.1.1** Rezeption ohne Volldatenzugriff; Arzt vergibt selektiv | NFA-SEC-01, NFA-SEC-02, **FA-PERS-07 (NEU)** | 🟡 PARTIAL | RBAC trennt Rollen sauber (`rbac.rs`), aber per-Patient / per-Aktenbereich-Granularität ist **nicht** umgesetzt. | Neue FA-PERS-07 dokumentiert das Ziel; Implementierung als Action `A2`. |
| **2.1.2** Rezeption ohne med. Schreibzugriff | NFA-SEC-02 | ✅ COVERED | `rbac.rs` — alle `*.write_medical`-Aktionen nur für ARZT. | — |
| **2.1.3** Nur Arzt schreibt med. Inhalte | NFA-SEC-02 | ✅ COVERED | wie oben | — |
| **2.1.4** Standard: Akte für Rezeption sichtbar (read-only), Arzt kann deaktivieren | **FA-PERS-07 (NEU)** | 🆕 NEW-PH | Heute: Rezeption hat global lesenden Zugriff auf administrative Akte; per-Patient-Toggle fehlt. | Action `A2`. |
| **2.2.1** Validierungs-Interface für noch zu prüfende Akten | FA-AKTE-02, **FA-AKTE-15 (NEU)** | 🟡 PARTIAL | Status-Modell `IN_BEARBEITUNG → VALIDIERT` existiert (`patientenakte.status`); Validate-Button in `patient-detail.tsx`; **dedizierte Queue-Seite** „Zu validieren" fehlt. | FA-AKTE-15 dokumentiert die Queue-Seite. |
| **2.2.2** Akteneinträge erst nach Arzt-Validierung final | FA-AKTE-02, FA-AKTE-03, NFA-SEC-04 | 🟡 PARTIAL | `patient_commands::update_patient` erzwingt Forward-Status-Übergänge; `Untersuchung`/`Behandlung` werden direkt persistiert (kein „PENDING"-Zustand pro Eintrag). | Roadmap: Pending/Draft-Flag pro med. Eintrag. |
| **2.2.3** Optional: nur Arzt verwaltet med. Inhalte (Sicherheitspräferenz) | NFA-SEC-02, **FA-PERS-07 (NEU)** | 🆕 NEW-PH | Im Default-RBAC bereits so; Konfigurations-Toggle „Strict-Mode" fehlt. | Toggle in Einstellungen geplant. |
| **2.2.4** Zentrale Berechtigungs-Oberfläche für den Arzt | FA-PERS-02, **FA-PERS-07 (NEU)** | 🟡 PARTIAL | `personal.tsx` setzt Rolle pro Mitarbeiter; per-Resource-Berechtigungs-Matrix-UI fehlt. | Action `A2`. |
| **2.2.5** Interaktives Arzt-Dashboard | FA-STAT-01, FA-AKTE-13 | ✅ COVERED | `app/src/views/pages/dashboard.tsx`; rollenspezifische Widgets via `rbac.ts`. | — |

## ID 3 — Ärztliche Behandlung & Dokumentation

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **3.1.1** Strukturiertes UI für Diagnose / Behandlung / Verlauf | FA-DOK-01, FA-DOK-02, FA-AKTE-08 | ✅ COVERED | `app/src/views/components/UntersuchungComposer.tsx` (klinische Sektionen, `UntersuchungV1` JSON); Behandlungs-Composer in `patient-detail.tsx`. | — |
| **3.1.2** Diagnose / Atteste / Rezepte effizient + Vorlagen + 2D-Anatomie | FA-DOK-04, FA-REZ-01..05, FA-ATT-01..04, FA-ZAHN-01 | ✅ COVERED | `vorlage-editor.tsx`, `vorlagen-rezepte-atteste.tsx`, `rezepte.tsx`, `atteste.tsx`, `DentalChart.tsx` | Schnellzugriff auf Vorlagen vorhanden. |
| **3.1.3** Versionierte Nachträge mit Zeitstempel + Benutzer | FA-AKTE-03, NFA-SEC-04 | 🟡 PARTIAL | Audit-Log enthält UPDATE-Events mit user_id + timestamp (`akte_commands.rs`); **keine** UI-Diff-Ansicht („Version A vs. B") vorhanden. | Diff-View geplant. |
| **3.1.4** Anhänge mit Typ / Referenz / Tags | FA-AKTE-04, FA-DOK-06 | 🟡 PARTIAL | Scanner-Workflow existiert (`integration_commands.rs`, `system.controller.ts`); Tag-System für Bilder/PDFs noch nicht persistiert. | Tag-Feld in `dokument`-Tabelle nachziehen. |

## ID 4 — Patientenakte & Archivierung

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **4.1.1** Verwaltungsdaten-Eingabe (Versicherungsnr., Träger, Besonderheiten) | FA-PAT-01, FA-AKTE-12 | ✅ COVERED | `patient-create.tsx`, `patient-detail.tsx` Versicherungsblock; `patient_repo.rs`. | — |
| **4.1.2** Atteste/Rezepte/Dokumente automatisch archivieren | FA-AKTE-01, FA-REZ-05, FA-ATT-04 | ✅ COVERED | Rezepte/Atteste werden direkt mit `akte_id`/`patient_id` gespeichert. | — |
| **4.1.3** Physische Dokumente: Typ + ID + Suche | FA-AKTE-04, FA-AKTE-05, NFA-COMP-06 | ✅ COVERED | Scanner-Integration speichert Typ + Dateipfad; Suche über `list-params.ts`. | — |
| **4.1.4** Belegnummern (Quittungen, Rechnungen, Rezepte), optional Scan | FA-AKTE-05, FA-FIN-01 | ✅ COVERED | Rezept-Nummer (`R-{YYYY}-{seq}`), Behandlungs-Nummer (`B-{YYYY}-{seq}`); Zahlung mit `belegnummer`-Feld. | — |
| **4.2.1** Konsistente UI + Versionierung | FA-AKTE-03, NFA-DESIGN-01..05, NFA-MAINT-03 | ✅ COVERED | UI-Komponentenbibliothek (`app/src/views/components/ui/`); Audit-Log liefert Versionierung. | — |
| **4.2.2** Intelligente Suche (Auto-Vervollständigung, Phonemisch) | FA-PAT-05, NFA-USE-H05 | ✅ COVERED | `app/src/lib/string-suggest.ts` (Levenshtein + phonemische Ähnlichkeit), `patienten.tsx` Suchfeld. | — |

## ID 5 — Nachsorge & Kommunikation

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **5.1.1** Patientenmerkblatt am Behandlungsende | **FA-DOK-08 (NEU)** | 🆕 NEW-PH | Heute existiert PDF-Akten-Export, aber kein dedizierter „Discharge Summary"/Nachsorge-Beipackzettel. | Pflichtenheft-Erweiterung; Implementierung als Action `A3`. |
| **5.1.2** Reduzierte Komm. Rezeption ↔ Arzt durch Automatisierung | FA-AKTE-02, NFA-USE-UE02 | 🟡 PARTIAL | Validate-Workflow + Audit-Spur; explizite „digitale Weiterleitung" → siehe 1.3.1. | — |
| **5.2.1** Rezeption informiert Patient (basierend auf Arzt-Freigabe) | FA-REZ-04, FA-ATT-03, FA-AKTE-06 | ✅ COVERED | Rezept-/Attest-Druck + PDF; Akte-PDF (`export_akte_pdf`). | — |
| **5.2.2** Ticket-/Notiz-System für Rückfragen → Arzt | **FA-PERS-08 (NEU)** | 🆕 NEW-PH | Heute existiert nur eine globale Feedback-Seite (`feedback.tsx`); kein Patient/Akte-bezogenes Ticket. | Pflichtenheft-Erweiterung; Implementierung als Action `A4` (NICE TO HAVE). |
| **5.2.3** PDFs aus Akte erzeugen | FA-AKTE-06, NFA-COMP-02 | ✅ COVERED | `akte_commands::export_akte_pdf`, `pdf.rs::render_akte`. | — |

## ID 6 — Leistungen & Kostenmanagement

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **6.1.1** Bareinnahmen + Validierung + Tagesabschluss | FA-FIN-01, FA-FIN-02, FA-FIN-04 | ✅ COVERED | `zahlung_commands.rs`, `finanzen.tsx` (Tagesübersicht). | — |
| **6.1.2** Arzt gibt kostenpflichtige Leistungen frei | FA-FIN-03, **FA-LEIST-05 (NEU)** | 🟡 PARTIAL | RBAC trennt `finanzen.write` vs. `personal.write`; expliziter „freigegeben_von_arzt"-Flag pro Leistung/Buchung fehlt. | Pflichtenheft-Erweiterung FA-LEIST-05; Implementierung als Action `A5`. |
| **6.1.3** Strukturierte Erstattungsbelege (parametrisch filterbar) | FA-FIN-05 | ✅ COVERED | `finanzen.tsx` Filter (Datum/Betrag/Kategorie). | — |
| **6.1.4** Einkaufsübersicht (Artikel + Zustand) | FA-PROD-01..05 | ✅ COVERED | `produkte.tsx`, `bestellungen.tsx`. | — |
| **6.2.1** Übersicht Einnahmen/Ausgaben + Filter + Export | FA-FIN-04, FA-FIN-06, FA-FIN-09, FA-FIN-10 | ✅ COVERED | `bilanz.tsx`, `bilanz-neu.tsx`. | — |
| **6.2.2** Automatische Statistiken (Leistungen/Einnahmen/Kosten) | FA-FIN-08, FA-STAT-01..04 | ✅ COVERED | `statistik.tsx`, `dashboard.tsx`. | — |
| **6.2.3** PDF-Export für Steueranmeldung | FA-FIN-06, NFA-COMP-02 | ✅ COVERED | Bilanz-Export, Akten-Export (`pdf.rs`). | — |
| **6.2.4** Rezeption sieht Preisliste; Arzt bestätigt erbrachte Leistungen | FA-LEIST-03, **FA-LEIST-05 (NEU)** | 🟡 PARTIAL | Preisliste read-only für REZ vorhanden; digitale Bestätigung pro erbrachter Leistung → siehe 6.1.2. | — |

## ID 7 — Standardisierung, Zeitersparnis & Fehlervermeidung

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **7.1.1** Vordefinierte Attest-/Rezept-Vorlagen | FA-DOK-04, FA-REZ-02 | ✅ COVERED | `vorlage-editor.tsx`, `vorlagen-rezepte-atteste.tsx`. | — |
| **7.1.2** Optionslisten für Leistungen / Medikamente / Untersuchungen | FA-DOK-03, FA-LEIST-01, NFA-USE-H06 | ✅ COVERED | `medikamente.ts`, `untersuchung.ts`, `behandlungs-katalog.tsx`. | — |
| **7.1.3** Strukturierte Formulare + Plausibilität + Eingabehilfen | FA-PAT-01, NFA-USE-H05 | ✅ COVERED | `form-section.tsx`, `tag-input.tsx`, `time-slot-picker.tsx`, Validierungslogik in den Create-Pages. | — |
| **7.1.4** Parametrische Filter überall (Akte, Leistungen, Kosten) | FA-LEIST-04, FA-FIN-11, FA-PAT-03 | ✅ COVERED | `app/src/lib/list-params.ts`, `app/src-tauri/src/commands/list_params.rs`. | — |
| **7.2.1** Hilfetexte / Tooltips / Tutorials, Einarbeitung ≤ 2 Monate | NFA-USE-05, NFA-USE-H10, **NFA-USE-09 (NEU)** | 🟡 PARTIAL | `hilfe.tsx`, `app-help-dialogs.tsx`, `command-palette.tsx`; **kontextsensitive Tooltips pro Feld** noch nicht systematisch. | NFA-USE-09 fordert Tooltip-Coverage ≥ 80 % der interaktiven Felder. |
| **7.2.2** Online-Schulungen | — | ⚪ ORG | Außerhalb der Software (Hersteller-Service). | Hinweis im Benutzerhandbuch. |
| **7.2.3** Learning-by-Doing-Elemente | NFA-USE-H10, **NFA-USE-09 (NEU)** | 🟡 PARTIAL | `command-palette` und Help-Dialoge sind erste Schritte; geführter Onboarding-Wizard pro Rolle fehlt. | Action `A6`. |
| **7.3.1** Pflichtfelder, Autovervollständigung, Validierung — Auto-Vervollständigung deaktivierbar | NFA-USE-H05, **NFA-USE-10 (NEU)** | 🟡 PARTIAL | Validierung umfassend; Toggle „Auto-Vervollständigung deaktivieren" als Benutzerpräferenz fehlt. | NFA-USE-10 dokumentiert Toggle. |
| **7.3.2** Korrekturen durch Arzt | FA-AKTE-03, NFA-SEC-04 | ✅ COVERED | Audit-Log + Update-Berechtigung für ARZT. | — |
| **7.3.3** Markierung unvollständiger Einträge / Versionsvergleich | **FA-AKTE-16 (NEU)** | 🆕 NEW-PH | Heute keine systematische Vollständigkeits-Indikation; Pflicht: Durchführbarkeitsanalyse vorab. | Erst Spike, dann Implementierung — Action `A7`. |

## ID 8 — Design & UI

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **8.1.1** Klar / übersichtlich / funktional, gute Lesbarkeit | NFA-USE-01, NFA-USE-H08, NFA-DESIGN-01 | ✅ COVERED | Palenight-Design-System (`tailwind.config.js`, `index.css`); UI-Komponentenbibliothek. | — |
| **8.1.2** Strukturierte Darstellung — ähnliche Patienten unterscheidbar | FA-PAT-04, NFA-USE-H02 | ✅ COVERED | Patientenliste zeigt Geburtsdatum + Versicherungsnummer; Suchergebnisse hervorgehoben. | — |
| **8.1.3** Modernes, visuell strukturiertes Design | NFA-DESIGN-01..05 | ✅ COVERED | Glas-/Vibrancy-Effekte, tonale Elevation. | — |
| **8.1.4** Preisübersicht + Behandlungskatalog + flexible Suche | FA-LEIST-03, FA-LEIST-04 | ✅ COVERED | `leistungen.tsx`, `behandlungs-katalog.tsx`. | — |

## ID 9 — Systemtechnische Sonderfunktionen

| WAAD | Pflichtenheft | Status | Code-Evidenz | Bemerkung |
|---|---|---|---|---|
| **9.1** Tägliches Backup, verschlüsselt, mit Restore | NFA-SEC-05, NFA-UPD-03 | 🟡 PARTIAL | `app/src-tauri/src/infrastructure/backup.rs` + `ops_commands.rs::backup` vorhanden; **automatischer Tages-Scheduler** noch nicht aktiv. | Action `A8` — Scheduler + Restore-UI. |
| **9.2** Zentrales Dashboard für ärztliche Kernaufgaben | FA-STAT-01, FA-AKTE-13 | ✅ COVERED | `dashboard.tsx`. | — |
| **9.3** Cloud-Anbindung für Hochverfügbarkeit | NFA-SEC-06, NFA-NET-12 | ⚪ ORG / 🟡 PARTIAL | NICE-TO-HAVE; nicht implementiert (lokaler Standalone-/LAN-Modus ist Default). | Roadmap. |
| **9.4** Ladezeiten < 2 s, Stresstests | NFA-PERF-01, NFA-LOG-06 | 🟡 PARTIAL | Performance-Logging-Schwelle in `infrastructure/logging`; **automatisierter Stresstest** noch nicht eingerichtet. | Action `A9`. |
| **9.5** Statistik zu Krankheitsbildern / Verlaufsmustern + Export | FA-STAT-02, FA-STAT-04 | 🟡 PARTIAL | Diagnose-Dimension in `statistik.tsx` vorhanden; Verlaufsmuster-Charts noch nicht spezialisiert. | Action `A10`. |

---

## Zusammenfassung

| Status | Anzahl |
|---|---:|
| ✅ COVERED | 24 |
| 🟡 PARTIAL | 10 |
| 🆕 NEW-PH (mit dieser Welle ergänzt) | 4 |
| ❌ GAP | 0 |
| ⚪ ORG | 1 |
| **Summe** | **39** |

**Hinweis:** Die 4 mit `🆕 NEW-PH` markierten Funktionen sind nicht plötzlich
„unvollständig" — sie waren bisher nur **nicht eigenständig** im Pflichtenheft
katalogisiert. Mit dieser Intake-Welle (`Anforderungen-Ableitung der
Anforderungen.pdf`) erhalten sie eine **eigene Pflichtenheft-ID** und damit
einen eindeutigen Implementierungsauftrag (siehe `pflichtenheft.md` und
`docs/coordination/actions.md`).

## Neue Pflichtenheft-IDs (aus dieser Welle)

| Neue ID | Quelle (WAAD) | Inhalt |
|---|---|---|
| **FA-AKTE-14** | 1.3.1 | „Akte an Arzt weiterleiten" — Aktionsmenü mit Empfängerliste (Mehrfachauswahl), erzeugt Eintrag in der Validierungs-Queue. |
| **FA-AKTE-15** | 2.2.1 | Validierungs-Queue-Seite („Zu validieren") für Arzt: Liste aller Akten / Einträge mit Status `IN_BEARBEITUNG`, sortiert nach Wartezeit. |
| **FA-AKTE-16** | 7.3.3 | Vollständigkeits-Indikator: jede Akte zeigt fehlende Pflichteinträge (Anamnese, Versicherungsblock, etc.) mit Klick-zu-Springen-Link. |
| **FA-DOK-08** | 5.1.1 | Patienten-Nachsorge-Merkblatt (Discharge Summary) am Behandlungsende: Medikation + Kontrolltermin + Facharztüberweisung als druckbares PDF. |
| **FA-LEIST-05** | 6.1.2, 6.2.4 | „Arzt-Freigabe" pro abrechenbarer Leistung: Flag `freigegeben_von_arzt_id` + UI-Bestätigungsschritt vor Rechnungserstellung. |
| **FA-PERS-07** | 2.1.1, 2.1.4, 2.2.3, 2.2.4 | Granulare Berechtigungs-Oberfläche („Strict-Mode" / per-Patient-/per-Aktenbereich-Toggles, vom Arzt änderbar). |
| **FA-PERS-08** | 5.2.2 | Ticket-/Notiz-System: Rezeption legt eine an einen Arzt adressierte Notiz pro Patient/Akte an, mit Status `OFFEN/IN_BEARBEITUNG/ERLEDIGT`. |
| **NFA-USE-09** | 7.2.1, 7.2.3 | Tooltip-Coverage ≥ 80 % aller interaktiven Felder; geführter Onboarding-Wizard pro Rolle. |
| **NFA-USE-10** | 7.3.1 | Auto-Vervollständigung deaktivierbar pro Benutzer (Einstellungen → Eingabe). |

Diese IDs sind in `pflichtenheft.md` ergänzt und tragen jeweils einen Verweis auf die Quell-WAAD-ID im Akzeptanzkriterium.
