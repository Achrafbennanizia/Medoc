# 6. Anforderungsvalidierung

## 6.1 Validierungstechniken

### Review-Checkliste

Jede Anforderung wird gegen folgende Kriterien geprüft:

| Kriterium | Beschreibung | Prüfmethode |
|-----------|-------------|-------------|
| **Vollständigkeit** | Alle Stakeholder-Bedürfnisse abgedeckt? | Traceability-Matrix BA→FA→SA |
| **Konsistenz** | Keine widersprüchlichen Anforderungen? | Konfliktanalyse (siehe Kap. 3.2) |
| **Eindeutigkeit** | Jede Anforderung hat genau eine Interpretation? | Peer Review |
| **Testbarkeit** | Akzeptanzkriterien definiert und messbar? | Testfall-Ableitung |
| **Realisierbarkeit** | Technisch und wirtschaftlich umsetzbar? | Durchführbarkeitsstudie |
| **Nachvollziehbarkeit** | Jede Anforderung hat Ursprung und Begründung? | Traceability-Matrix |

### Validierungsergebnisse

| Anforderungsgruppe | Vollständig | Konsistent | Eindeutig | Testbar | Realisierbar |
|---------------------|:-:|:-:|:-:|:-:|:-:|
| FA-TERM (Termine) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-PAT (Patienten) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-AKTE (Akten) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-ZAHN (Zahnschema) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-DOK (Dokumentation) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-FIN (Finanzen) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-PROD (Produkte) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-LEIST (Leistungen) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FA-PERS (Personal) | ✅ | ⚠️ K2 | ✅ | ✅ | ✅ |
| FA-STAT (Statistik) | ✅ | ✅ | ✅ | ✅ | ✅ |
| NFA-SEC (Sicherheit) | ✅ | ⚠️ K2 | ✅ | ✅ | ✅ |
| NFA-USE (Usability) | ✅ | ⚠️ K2 | ✅ | ✅ | ✅ |
| NFA-PERF (Performance) | ✅ | ⚠️ K3 | ✅ | ✅ | ✅ |

**Legende:** K2 = Konflikt 2 (Usability vs. Sicherheit, aufgelöst), K3 = Konflikt 3 (Performance vs. Audit, aufgelöst)

## 6.2 Prototyp-Validierung

### Heuristische Evaluation (Nielsen, 10 Heuristiken)

Durchgeführt am Figma-Prototyp mit 3 Experten:

| Heuristik | Score (1-5) | Befund |
|-----------|:-----------:|--------|
| H1: Sichtbarkeit des Systemstatus | 4 | Statusanzeigen vorhanden, Ladeindikatoren |
| H2: Übereinstimmung System/reale Welt | 5 | Deutsche Fachterminologie, Praxis-Workflow |
| H3: Benutzerkontrolle und Freiheit | 3 | Abbrechen/Zurück vorhanden, Undo fehlt |
| H4: Konsistenz und Standards | 4 | Einheitliche UI-Elemente, konsistente Navigation |
| H5: Fehlervermeidung | 3 | Validierung vorhanden, Warnung bei Konflikten |
| H6: Wiedererkennung statt Erinnerung | 5 | Sidebar-Navigation, visuelle Farbkodierung |
| H7: Flexibilität und Effizienz | 4 | Keyboard-Shortcuts geplant, Schnellaktionen |
| H8: Ästhetik und minimales Design | 4 | Clean UI, keine Überladung |
| H9: Fehlererkennung und -behebung | 3 | Fehlermeldungen vorhanden, Handlungsanweisungen fehlen |
| H10: Hilfe und Dokumentation | 2 | Inline-Hilfe geplant, noch nicht umgesetzt |

**Durchschnitt: 3.7/5 (74%)** → Ziel: ≥80% → Verbesserungspotenzial bei H3, H5, H9, H10

### Identifizierte Usability-Probleme (Top 5)

| Prio | Problem | Lösung |
|:----:|---------|--------|
| 1 | Keine Undo-Funktion bei Formularen | Bestätigungsdialog vor destruktiven Aktionen |
| 2 | Fehlermeldungen ohne konkrete Handlungsanweisung | Fehlertexte mit „Was tun?"-Hinweis |
| 3 | Zahnschema-Legende nicht sofort sichtbar | Legende immer sichtbar über dem Chart |
| 4 | Kein Tooltip bei Zahlen im Dashboard | Hover-Tooltips mit Details |
| 5 | Kein visueller Unterschied zwischen Pflicht- und optionalen Feldern | Pflichtfelder mit * markieren |

## 6.3 Anforderungsspezifikation (Final)

Nach Abschluss der Validierung sind alle Anforderungen:
- ✅ Vollständig gegenüber Stakeholder-Bedürfnissen
- ✅ Konsistent (4 Konflikte identifiziert und aufgelöst)
- ✅ Eindeutig formuliert mit Akzeptanzkriterien
- ✅ Testbar (Testfälle ableitbar)
- ✅ Realisierbar (Durchführbarkeitsstudie positiv)
- ✅ Priorisiert nach MoSCoW (15 Must, 13 Should, 11 Could, 5 Won't)

**Freigabe:** Die Anforderungsspezifikation ist validiert und freigegeben für die Entwurfsphase.

## 6.3a WAAD-Erfüllungs-Matrix (Code-Evidenz)

Die folgende Matrix zeigt den Erfüllungsgrad jeder im WAAD-PDF erhobenen Roh-Anforderung
(`docs/requirements-engineering/source/anforderungen-ableitung-waad.pdf`) gegen den **aktuellen
Code-Stand**. Die vollständige Trace-Matrix mit Datei-/Zeilennachweisen liegt in
[`01b-traceability-waad.md`](./01b-traceability-waad.md).

**Status-Legende:**
- ✅ **VERIFIED** — Code, Akzeptanzkriterium und manueller Smoke-Test belegen die Umsetzung.
- 🟡 **PARTIAL** — Kerncode existiert, aber nicht alle Akzeptanzkriterien sind erfüllt oder
  end-to-end-getestet.
- 🔴 **PENDING** — Kein bzw. unzureichender Code, Aufnahme in Pflichtenheft als neue `FA-*`/`NFA-*` ID erfolgt.
- ⚪ **ORG** — Organisatorisch / nicht im Tool umzusetzen (z. B. Schulungen, vertragliche Pflichten).

| Kategorie (WAAD) | WAAD-IDs | Mapped FA/NFA | Status | Bemerkung / Nachweis |
|---|---|---|---|---|
| 1 Patientenaufnahme | 1.1.1, 1.1.2, 1.2.1, 1.5 | FA-PAT-01 … 10, FA-AUTH-01..04, NFA-USE-09 | ✅ / 🟡 (1.5 Walkthrough) | Stammdaten, RBAC-Login bestehen; Onboarding-Layer als `NFA-USE-09` neu spezifiziert |
| 1 Patientenaufnahme (Zugriff/Notiz) | 1.2.2, 1.3.1, 1.4 | FA-PERS-07, FA-AKTE-14, FA-PERS-08 | 🔴 PENDING | Berechtigungs-Override, „Akte an Arzt"-Aktion, Ticket-System neu in Pflichtenheft aufgenommen |
| 2 Akten-Validierung | 2.1.1, 2.1.2, 2.2.1 | FA-AKTE-12/13/15, FA-AUDIT-01 | 🟡 PARTIAL | Status `VALIDIERT` und Audit-Read-Logging existieren (`audit_repo.rs`, `akte_commands.rs`); explizite Queue-Seite (`FA-AKTE-15`) fehlt noch |
| 3 Medizinische Dokumentation | 3.1, 3.2, 3.3, 3.4 | FA-AKTE-01..09, FA-ZAHN-01..07, FA-DOK-01..06 | ✅ VERIFIED | Anamnese, Zahnschema, Behandlungs-Erfassung implementiert (`patient-detail.tsx`, `DentalChart.tsx`, `UntersuchungComposer.tsx`) |
| 4 Termine | 4.1, 4.2, 4.3 | FA-TERM-01..16 | ✅ VERIFIED | Konfliktprüfung, Notfall, Erinnerung (Pipeline `notifications.rs`) |
| 5 Discharge / Nachsorge | 5.1.1 | FA-DOK-08 | 🔴 PENDING | Patienten-Merkblatt-Generator als neue Pflichtenheft-ID |
| 6 Kostenverwaltung | 6.1.1, 6.1.2, 6.2.1..4 | FA-FIN-01..08, FA-LEIST-01..05 | 🟡 PARTIAL | Zahlungserfassung & Bilanz vorhanden; Arzt-Freigabe-Flag (`FA-LEIST-05`) noch nicht im Datenmodell |
| 7 UI/UX | 7.1, 7.2, 7.3.1..3, 7.4 | NFA-USE-01..10, FA-AKTE-16 | 🟡 PARTIAL | Palenight-Design + Toast-System + i18n vorhanden; Onboarding & Vollständigkeits-Indikator als neue IDs ergänzt |
| 8 IT-Sicherheit | 8.1, 8.2, 8.3, 8.4 | NFA-SEC-01..09, NFA-DATA-01 | 🟡 PARTIAL | RBAC + Audit-Trail + Backup vorhanden; SQLCipher-Verschlüsselung weiterhin offen (siehe `contradictions.md` C1b) |
| 9 Performance / Plattform | 9.1, 9.2, 9.3, 9.4, 9.5 | NFA-PERF-01..06, SA-01..08 | ✅ VERIFIED (Spezifikation), 🟡 (Last-Test) | Tauri+SQLite-WAL erfüllt Architektur-Vorgaben; Last-Test mit 5 Clients steht aus |

> **Cross-Reference:** Jeder Eintrag verweist auf die ausführliche Trace-Zeile in
> [`01b-traceability-waad.md`](./01b-traceability-waad.md). Pflichtenheft-Quelle ist
> [`../v-model/01-anforderungen/pflichtenheft.md`](../v-model/01-anforderungen/pflichtenheft.md).

## 6.4 ISO-Normen-Validierung

### Verifikation der Normenreferenzen

Alle referenzierten ISO-Normen und ihre Zuordnung zu MeDoc-Anforderungen wurden auf Korrektheit geprüft:

| Norm | Vollständiger Titel | Ausgabe | Geprüft | Anmerkung |
|------|---------------------|---------|:-------:|-----------|
| IEC 62304 | Medical device software – Software life cycle processes | 2006+AMD1:2015 | ✅ | Sicherheitsklassen (A/B/C) und Prozessanforderungen korrekt zugeordnet |
| ISO 14971 | Medical devices – Application of risk management to medical devices | 2019 (3. Ausgabe) | ✅ | Risikomatrix und Hierarchie der Risikobeherrschung korrekt dargestellt |
| IEC 82304-1 | Health software – Part 1: General requirements for product safety | 2016 | ✅ | Abgrenzung zu IEC 62304 (Produkt- vs. Prozessnorm) korrekt |
| ISO/IEC 27001 | Information security, cybersecurity and privacy protection – ISMS – Requirements | 2022 | ✅ | Annex A Maßnahmen korrekt referenziert |
| ISO 27799 | Health informatics – Information security management in health using ISO/IEC 27002 | 2016 | ✅ | Gesundheitsspezifische Erweiterungen (Lesezugriff-Protokollierung) korrekt |
| ISO/IEC 25010 | Systems and software Quality Requirements and Evaluation (SQuaRE) | 2011 | ✅ | 8 Qualitätshauptmerkmale und 31 Untermerkmale korrekt zugeordnet |
| ISO 9241-210 | Human-centred design for interactive systems | 2019 | ✅ | 6 Grundsätze und Gestaltungsprozess korrekt dargestellt |
| ISO 9241-110 | Interaction principles | 2020 | ✅ | 7 Interaktionsprinzipien korrekt beschrieben |
| ISO 9241-11 | Usability: Definitions and concepts | 2018 | ✅ | Effektivität/Effizienz/Zufriedenheit korrekt |
| ISO 22600 | Privilege management and access control | 2014 (Teile 1-3) | ✅ | RBAC-Modell und Separation of Duties korrekt |
| DSGVO | Datenschutz-Grundverordnung | EU 2016/679 | ✅ | Art. 5, 9, 17, 20, 25, 30, 32, 33/34 korrekt referenziert |

### Transparenzhinweise

1. **Medizinprodukt-Einstufung**: MeDoc wird voraussichtlich NICHT als Medizinprodukt gemäß EU MDR 2017/745 eingestuft, da es primär ein Praxisverwaltungssystem ist. Dennoch werden IEC 62304, ISO 14971 und IEC 82304-1 als Best Practice angewendet, da das System Gesundheitsdaten verarbeitet.

2. **§630f Abs. 3 BGB**: Die 10-jährige Aufbewahrungspflicht für ärztliche Dokumentation ergibt sich aus dem deutschen Bürgerlichen Gesetzbuch und der Musterberufsordnung für Ärzte (§10 MBO-Ä), nicht direkt aus einer ISO-Norm. Diese gesetzliche Pflicht beeinflusst jedoch die Umsetzung der DSGVO Art. 17 (Recht auf Löschung).

3. **ISO 27799 als Redirect**: ISO 27799 ist Teil der ISO/IEC 27000-Familie und wendet ISO/IEC 27002 spezifisch auf das Gesundheitswesen an. Die Anforderung zur Protokollierung von Lesezugriffen auf Patientendaten ist eine gesundheitsspezifische Verschärfung gegenüber dem allgemeinen ISO 27001-Standard.

4. **SOUP-Risikobewertung**: Die in IEC 62304 geforderte SOUP-Dokumentation bezieht sich auf „Software of Unknown Pedigree/Provenance" – d.h. alle Drittanbieter-Bibliotheken und Open-Source-Komponenten. Die aufgelisteten Komponenten (React, Tauri, SQLite etc.) sind etablierte Open-Source-Projekte mit aktivem Sicherheitsmanagement.
