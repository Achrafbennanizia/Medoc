# Mapping: ISO-Anforderungen → MeDoc-Anforderungen

## Zweck

Dieses Dokument stellt eine vollständige Nachverfolgbarkeit (Traceability) zwischen den ISO-Normen/DSGVO-Anforderungen und den bestehenden MeDoc-Anforderungen her. Es identifiziert auch **neue Anforderungen**, die sich aus der ISO-Analyse ergeben.

---

## 1. Vollständiges Mapping

### Legende
- ✅ **Abgedeckt**: Bestehende MeDoc-Anforderung erfüllt die ISO-Anforderung
- ⚠️ **Teilweise abgedeckt**: Bestehende Anforderung muss erweitert werden
- ❌ **Neu**: Keine bestehende Anforderung vorhanden → neue Anforderung erforderlich

---

### IEC 62304 – Software-Lebenszyklusprozesse

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-62304-01: Software-Entwicklungsplan | ✅ | V-Modell-Dokumentation (docs/v-model/) | Plan über V-Modell-Phasen 1-4 dokumentiert |
| ISO-62304-02: Formale Anforderungsdokumentation | ✅ | RE-Prozess (docs/requirements-engineering/) | 6 RE-Dokumente mit Traceability-Matrix |
| ISO-62304-03: Architektur-Dokumentation | ✅ | architecture-design.md, Architekturentwurf | Clean Architecture + MVC dokumentiert |
| ISO-62304-04: Unit-Implementierung und -Verifikation | ⚠️ | Rust-Tests (`app/src-tauri/tests/`, inline `#[test]`), Frontend-Smoke (`npm test`) | Erweiterung: Abdeckungsziele und Traceability FA→Test dokumentieren |
| ISO-62304-05: Systemtests | ⚠️ | Akzeptanzkriterien definiert (04-spezifikation.md) | Testdurchführung steht aus |
| ISO-62304-06: Formaler Freigabeprozess | ✅ | NFA-PROC-01; `docs/process/freigabeprozess.md` | Freigabeprozess dokumentiert; Umsetzung/Traceability im Projekt prüfen |
| ISO-62304-07: SOUP-Dokumentation | ✅ | NFA-PROC-02; `docs/iso-standards/09-soup-liste.md` | SOUP-Liste vorhanden; bei neuen Abhängigkeiten aktualisieren |
| ISO-62304-08: Konfigurationsmanagement (Git) | ✅ | Git-Repository vorhanden | Versionskontrolle aktiv |
| ISO-62304-09: Problemlösungsprozess | ✅ | NFA-PROC-03; `docs/process/bug-tracking.md` | Bug-Tracking dokumentiert |
| ISO-62304-10: Software-Wartungsplan | ✅ | NFA-PROC-04; `docs/process/wartungsplan.md` | Wartungsplan dokumentiert |

### ISO 14971 – Risikomanagement

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-14971-01: Risikoanalyse dokumentiert | ⚠️ | Risikobewertung in 05-durchfuehrbarkeit.md | Muss auf ISO 14971-Format erweitert werden → **docs/iso-standards/02-iso-14971.md enthält jetzt die vollständige Risikoanalyse** |
| ISO-14971-02: Hierarchie der Risikobeherrschung | ✅ | Design (Validierungspflicht), Schutz (RBAC), Info (Tooltips) | Hierarchie implizit umgesetzt |
| ISO-14971-03: Verifikation der Maßnahmen | ⚠️ | Akzeptanzkriterien definiert | Verifikation durch Tests noch ausstehend |
| ISO-14971-04: Risikomanagementbericht | ⚠️ | In 02-iso-14971.md begonnen | Formaler Bericht nach Testphase erforderlich |
| ISO-14971-05: Feedback aus Betrieb | ⚠️ | NFA-PROC-05; `docs/process/feedback-und-vigilanz.md`, `docs/post-market/` | Prozess skizziert; operative Evidenz (Tickets, Trends) nachziehen |

### IEC 82304-1 – Gesundheitssoftware-Sicherheit

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-82304-01: Bestimmungsgemäßer Gebrauch dokumentiert | ⚠️ | Pflichtenheft Kap. 1 | Muss erweitert werden: explizite Grenzen (was MeDoc NICHT kann) → Siehe 03-iec-82304.md |
| ISO-82304-02: Risikomanagement nach ISO 14971 | ⚠️ | Siehe ISO 14971-Mapping | Risikoanalyse erweitert in 02-iso-14971.md |
| ISO-82304-03: Dokumentierter Lebenszyklus | ✅ | V-Modell-Dokumentation | V-Modell-Phasen 1-4 dokumentiert |
| ISO-82304-04: Benutzerhandbuch | ⚠️ | NFA-DOC-01; `docs/benutzerhandbuch.md` | Handbuch vorhanden (Stand siehe Deckblatt); fortlaufend gegen Produkt synchronisieren |
| ISO-82304-05: Validierung vor Freigabe | ⚠️ | 06-validierung.md (Prototyp-Evaluation) | Systemvalidierung nach Implementierung noch ausstehend |
| ISO-82304-06: Nachmarktüberwachung | ⚠️ | NFA-PROC-06; `docs/post-market/` | PMS-Plan/CAPA dokumentiert; operative Nachweise ergänzen |
| ISO-82304-07: Update-Mechanismus | ⚠️ | Tauri unterstützt Auto-Updates | Muss konfiguriert und dokumentiert werden |

### ISO 27001 + ISO 27799 – Informationssicherheit

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-27001-01: RBAC nach Least Privilege | ✅ | NFA-SEC-01, NFA-SEC-02, RBAC-Matrix | Vollständig definiert |
| ISO-27001-02: Individuelle Benutzerkonten | ✅ | FA-PERS-01, FA-PERS-02 | Jeder Benutzer hat eigenes Konto |
| ISO-27001-03: Passwort-Hashing | ✅ | NFA-SEC-03 | Argon2id bevorzugt, bcrypt als Fallback — Implementierung in `app/src-tauri` prüfen |
| ISO-27001-04: Datenbank-Verschlüsselung (AES-256) | ⚠️ | SA-06 (verschlüsselte Speicherung) | SQLCipher muss aktiviert und getestet werden |
| ISO-27001-05: Protokollierung aller Zugriffe auf Patientendaten | ⚠️ | NFA-SEC-04 (Audit-Log aller Schreiboperationen) | **ERWEITERUNG**: Auch Lesezugriffe auf Patientendaten müssen protokolliert werden |
| ISO-27001-06: Manipulationssichere Audit-Logs | ⚠️ | NFA-SEC-04 | **ERWEITERUNG**: Audit-Logs dürfen keine Lösch-/Edit-Funktion haben |
| ISO-27001-07: 10 Jahre Audit-Log-Aufbewahrung | ✅ | NFA-SEC-07 (`docs/v-model/01-anforderungen/pflichtenheft.md` §4.1) | Anforderung spezifiziert; technische Aufbewahrung prüfen |
| ISO-27001-08: Verschlüsseltes Backup mit Wiederherstellungstest | ⚠️ | NFA-SEC-05 | **ERWEITERUNG**: Wiederherstellungsprozess muss dokumentiert und getestet werden |
| ISO-27001-09: Session-Timeout 30 Min. | ✅ | In Konfliktauflösung K2 definiert | Bereits spezifiziert |
| ISO-27001-10: Sicherheitsrichtlinien im Benutzerhandbuch | ⚠️ | `docs/benutzerhandbuch.md` §10 | Sicherheitshinweise beschrieben; bei Produktänderungen aktualisieren |

### ISO 25010 – Software-Qualitätsmodell

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-25010-01: Funktionale Vollständigkeit (Traceability) | ✅ | Traceability-Matrix (02-klassifizierung.md) | BA → FA → SA → NFA nachverfolgbar |
| ISO-25010-02: Funktionale Korrektheit (Validierung) | ✅ | FA-AKTE-02, FA-AKTE-03 | Arzt-Validierung + Versionierung |
| ISO-25010-03: Zeitverhalten (<2s) | ✅ | NFA-PERF-01 | Spezifiziert |
| ISO-25010-04: Interoperabilität (PDF/CSV-Export) | ✅ | FA-AKTE-06, NFA-INT-01, NFA-INT-02 | PDF-Export, Röntgen-Import, Drucker |
| ISO-25010-05: Benutzbarkeit (Nielsen ≥80%) | ✅ | NFA-USE-01 | Ziel definiert, aktuell 74% |
| ISO-25010-06: Barrierefreiheit (Textlabels bei Farbkodierung) | ⚠️ | NFA-USE-06 (`pflichtenheft.md` §4.2) | Anforderung MUST/SHOULD je nach Kontext spezifiziert; UI-Verifikation |
| ISO-25010-07: Offline-Verfügbarkeit | ✅ | SA-04 | Offline-Fähigkeit als Kernanforderung |
| ISO-25010-08: Fehlertoleranz (SQLite WAL, kein Datenverlust) | ✅ | SQLite WAL in Konfliktauflösung K1 | Spezifiziert |
| ISO-25010-09: Modulare Architektur | ✅ | Architecture-design.md | Clean Architecture + MVC |
| ISO-25010-10: Cross-Platform Installer | ✅ | Tauri (Windows, macOS, Linux) | Tauri-Installer-Mechanismus vorhanden |

### ISO 9241 – Usability und Interaktionsprinzipien

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-9241-01: Nutzungskontext-Analyse | ✅ | Stakeholder-Analyse, Persona-Analyse (01-sammeln.md) | Umfassend dokumentiert |
| ISO-9241-02: Evaluation mit Nutzern | ✅ | Heuristische Evaluation (06-validierung.md) | 3 Experten, Nielsen-Score 3.7/5 |
| ISO-9241-03: Max. 2 Klicks zur Hauptfunktion | ✅ | NFA-USE-02 | Spezifiziert |
| ISO-9241-04: Systemstatus sichtbar | ✅ | Statusanzeigen, Ladeindikatoren | In UI implementiert |
| ISO-9241-05: Konsistente UI, Fachterminologie | ✅ | NFA-USE-01, Deutsche Fachterminologie | FDI-Nomenklatur im Zahnschema |
| ISO-9241-06: Bestätigungsdialoge, Abbruch möglich | ✅ | NFA-USE-03 | Spezifiziert |
| ISO-9241-07: Fehlermeldungen mit Handlungsanweisung | ⚠️ | NFA-USE-04 | Verbesserungsbedarf erkannt (Usability-Problem #2) |
| ISO-9241-08: Usability-Messung (Effektivität, Effizienz, Zufriedenheit) | ⚠️ | Nielsen-Evaluation durchgeführt | Formale Nutzertests mit Messung noch ausstehend |

### ISO 22600 + DSGVO – Zugriffskontrolle und Datenschutz

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-22600-01: RBAC nach Least Privilege | ✅ | NFA-SEC-01, NFA-SEC-02 | Vollständig implementiert |
| ISO-22600-02: Separation of Duties | ✅ | FA-FIN-03 (Arzt-Freigabe), FA-FIN-02 (Rezeption-Dokumentation) | Vier-Augen-Prinzip |
| ISO-22600-03: Anonymisierte Finanzdaten für STB | ✅ | Konfliktauflösung K4 (03-priorisierung.md) | Aggregierte/anonymisierte Daten für STB |
| DSGVO-01: Zweckbindung | ✅ | Implizit durch Praxisverwaltungszweck | Sollte explizit dokumentiert werden |
| DSGVO-02: Datenminimierung | ⚠️ | Pflichtfelder definiert | **ERWEITERUNG**: Optionale vs. Pflichtfelder müssen in der UI klar markiert sein |
| DSGVO-03: Verschlüsselung + Passwort-Hashing | ✅ | NFA-SEC-03, NFA-SEC-08 | Verschlüsselung at rest (SQLCipher laut Pflichtenheft); Passwort-Hashing Argon2id/bcrypt |
| DSGVO-04: 10-Jahres-Aufbewahrung / Löschkonzept | ✅ | NFA-DATA-01 (`pflichtenheft.md` §4.13); Praxis-VVT `docs/datenschutz/verarbeitungsverzeichnis.md` | Fristenkonzept dokumentiert (Hinweis: §630f BGB / klinische Fristen im VVT/Benutzerhandbuch ggf. länger); Implementierung verifizieren |
| DSGVO-05: Privacy by Design | ✅ | RBAC, Verschlüsselung, Datenminimierung | Im Design verankert |
| DSGVO-06: Verarbeitungsverzeichnis | ✅ | NFA-DOC-02; `docs/datenschutz/verarbeitungsverzeichnis.md` | VVT-Vorlage vorhanden; durch die Praxis zu individualisieren |
| DSGVO-07: Audit-Log für Datenschutzvorfälle (72h) | ⚠️ | NFA-SEC-04 | Audit-Log vorhanden; Umfang muss erweitert werden (Lesezugriffe) |
| DSGVO-08: Datenexport (Datenübertragbarkeit) | ⚠️ | FA-AKTE-04 (PDF-Export) | **ERWEITERUNG**: Maschinenlesbares Format (JSON/CSV) zusätzlich zu PDF |

---

## 2. Neue Anforderungen aus der ISO-Analyse

> **Hinweis:** Die folgenden **NFA-**/**FA-**-IDs sind im **Pflichtenheft** (`docs/v-model/01-anforderungen/pflichtenheft.md`) als Soll-Anforderungen geführt. Abschnitt 2 dokumentiert die ursprüngliche ISO-Ableitung; Überschrift „NEU“ = *zur Normenabdeckung hinzugekommen*, nicht „fehlt im Pflichtenheft“.

### Prozess-Anforderungen (NFA-PROC)

| ID | Anforderung | Normbezug | Priorität |
|----|-------------|-----------|-----------|
| NFA-PROC-01 | Ein formaler Softwarefreigabeprozess muss definiert sein: Versionierung, Freigabekriterien, Freigabedokumentation | IEC 62304 Kap. 5.8 | MUST |
| NFA-PROC-02 | Eine SOUP-Liste muss alle Drittanbieter-Komponenten dokumentieren: Name, Version, Lizenz, Zweck, bekannte Risiken. Mindestens: React 19, Tauri v2, SQLite, sqlx, bcrypt, Zustand, React Router, Recharts, TailwindCSS | IEC 62304 Kap. 5.3, 8.1 | MUST |
| NFA-PROC-03 | Ein Problemlösungsprozess (Bug-Tracking) muss etabliert sein: Fehlerberichte, Priorisierung, Zuordnung, Verfolgung bis Lösung | IEC 62304 Kap. 9 | SHOULD |
| NFA-PROC-04 | Ein Software-Wartungsplan muss erstellt werden: Update-Zyklen, Sicherheitspatches, Kompatibilitätstests, Backup-Verifizierung | IEC 62304 Kap. 6 | SHOULD |
| NFA-PROC-05 | Ein Feedback-Prozess für den Praxisbetrieb muss definiert werden: Erfassung von Nutzerproblemen, Sicherheitsmeldungen, regelmäßige Überprüfung | ISO 14971 Kap. 10, IEC 82304-1 Kap. 7 | SHOULD |
| NFA-PROC-06 | Ein Nachmarktüberwachungsprozess muss definiert werden: Überwachung bekannter Sicherheitslücken in SOUP-Komponenten, zeitnahe Updates | IEC 82304-1 Kap. 7 | SHOULD |

### Dokumentations-Anforderungen (NFA-DOC)

| ID | Anforderung | Normbezug | Priorität |
|----|-------------|-----------|-----------|
| NFA-DOC-01 | Ein Benutzerhandbuch muss bereitgestellt werden mit: Installationsanleitung, Systemvoraussetzungen, Sicherheitshinweisen, Backup/Wiederherstellungsanleitung, bestimmungsgemäßem Gebrauch | IEC 82304-1 Kap. 5.4 | MUST |
| NFA-DOC-02 | Ein Verzeichnis der Verarbeitungstätigkeiten (VVT) muss als Dokument geführt werden: Datenkategorien, Rechtsgrundlagen, Empfänger, Löschfristen | DSGVO Art. 30 | MUST |

### Datenschutz-Anforderungen (NFA-DATA)

| ID | Anforderung | Normbezug | Priorität |
|----|-------------|-----------|-----------|
| NFA-DATA-01 | Patientenakten müssen eine automatische Löschsperre für die 10-jährige Aufbewahrungspflicht haben; nach Ablauf muss eine kontrollierte Löschung möglich sein | DSGVO Art. 17, §630f Abs. 3 BGB | MUST |

### Sicherheits-Anforderungen (NFA-SEC) – Erweiterungen

| ID | Anforderung | Normbezug | Priorität |
|----|-------------|-----------|-----------|
| NFA-SEC-07 | Audit-Logs müssen mindestens 10 Jahre aufbewahrt werden | ISO 27799, §10 MBO-Ä | MUST |

### Usability-Anforderungen (NFA-USE) – Erweiterungen

| ID | Anforderung | Normbezug | Priorität |
|----|-------------|-----------|-----------|
| NFA-USE-06 | Farbkodierungen (insb. Zahnschema) müssen zusätzlich Textlabels besitzen, um Barrierefreiheit zu gewährleisten | ISO 25010 – Barrierefreiheit | SHOULD |

### Nielsen-Heuristiken & Usability-Engineering (NFA-USE-H / NFA-USE-UE) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO 9241-110 Selbstbeschreibungsfähigkeit | ✅ | NFA-USE-H01 | H1: Systemstatus sichtbar (Toast, Spinner, Progress, Banner) |
| ISO 9241-110 Erwartungskonformität | ✅ | NFA-USE-H02 | H2: Zahnmedizinische Fachsprache; Praxis-Workflows; keine technischen Fehlermeldungen |
| ISO 9241-110 Steuerbarkeit | ✅ | NFA-USE-H03 | H3: Undo/Redo, Abbrechen, Zurück-Navigation, Migrations-Rollback |
| ISO 9241-110 Konsistenz | ✅ | NFA-USE-H04 | H4: Einheitliches Palenight-Design-Token-System über alle Module |
| ISO 9241-110 Fehlertoleranz | ✅ | NFA-USE-H05, NFA-USE-H09 | H5: Fehlervermeidung (Validierung, Dry-Run); H9: Fehlererkennung (strukturierte Meldungen) |
| ISO 9241-110 Individualisierbarkeit | ✅ | NFA-USE-H07 | H7: Tastaturkürzel, Dashboard-Widgets, Drag-and-Drop |
| ISO 9241-110 Erlernbarkeit | ✅ | NFA-USE-H06, NFA-USE-H10 | H6: Wiedererkennung (Icons+Labels, Recents); H10: Kontextsensitive Hilfe, Onboarding |
| ISO 25010 Ästhetik der Benutzerschnittstelle | ✅ | NFA-USE-H08 | H8: Minimalistisches Palenight-Design; progressive Offenlegung |
| ISO 9241-11 Effektivität | ✅ | NFA-USE-UE01 | Learnability: Einarbeitungszeit ≤ 2 Monate; rollenspezifische Startansichten |
| ISO 9241-11 Effizienz | ✅ | NFA-USE-UE02 | Efficiency: Max. 2 Klicks; Tastaturkürzel; Bulk-Aktionen |
| ISO 9241-110 Selbstbeschreibungsfähigkeit | ✅ | NFA-USE-UE03 | Memorability: Stabile Navigation; Recall-Test ≤ 30s nach 2 Wochen Pause |
| ISO 9241-110 Fehlertoleranz | ✅ | NFA-USE-UE04 | Errors: Fehlerrate < 5%; Bestätigungsdialoge; Undo; kein Datenverlust |
| ISO 9241-11 Zufriedenstellung | ✅ | NFA-USE-UE05 | Satisfaction: SUS-Score ≥ 72; Palenight-Ästhetik |
| ISO 9241-210 Nutzerzentrierte Gestaltung | ✅ | NFA-USE-UE06 | User-Centered Design: Figma-Prototyp → Evaluation → Test → Iteration |
| WCAG 2.1 Level AA / ISO 25010 Barrierefreiheit | ✅ | NFA-USE-UE07 | Accessibility: Kontrast ≥ 4.5:1; ARIA-Labels; Tastaturnavigation; axe-core CI |
| EN 62366-1:2015 Gebrauchstauglichkeit | ✅ | NFA-USE-UE06, NFA-EU-09 | Usability-Engineering-Akte; Usability-Studie mit ≥ 5 Personen pro Rolle |

### Erweiterungen bestehender Anforderungen

| Bestehende Anforderung | Erweiterung | Normbezug |
|------------------------|-------------|-----------|
| NFA-SEC-04 (Audit-Log) | **Auch Lesezugriffe** auf Patientendaten müssen protokolliert werden, nicht nur Schreibzugriffe | ISO 27799 |
| NFA-SEC-04 (Audit-Log) | Audit-Logs dürfen **keine Lösch- oder Editierfunktion** haben (Manipulationssicherheit) | ISO 27001 A.12.4 |
| NFA-SEC-05 (Backup) | **Wiederherstellungsprozess** muss dokumentiert und regelmäßig getestet werden | ISO 27001 A.12.3 |
| NFA-USE-04 (Fehlermeldungen) | Fehlermeldungen müssen **die Fehlerursache benennen und eine konkrete Handlungsanweisung** geben | ISO 9241-110 Prinzip 6 |
| FA-AKTE-04 / DSGVO-08 | Datenexport muss zusätzlich zum PDF auch in **maschinenlesbarem Format (JSON/CSV)** möglich sein | DSGVO Art. 20 |

### Netzwerk & Multi-Device (NFA-NET) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-25010 Kompatibilität (Interoperabilität) | ✅ | NFA-NET-01, NFA-NET-02 | TCP/HTTP-basierte Client-Server-Kommunikation im LAN |
| ISO-25010 Übertragbarkeit (Anpassbarkeit) | ✅ | NFA-NET-03 | Headless-Server-Modus (dedizierter Praxis-Server) |
| ISO-25010 Funktionale Eignung (Vollständigkeit) | ✅ | NFA-NET-04, NFA-NET-05 | Mobile Web-UI mit Feature-Parität für Rolle REZEPTION |
| ISO-27001 A.9 Zugriffskontrolle | ✅ | NFA-NET-06 | Authentifizierte Sitzungen (JWT) für alle Netzwerk-Clients |
| ISO-27001 A.10 Kryptographie | ✅ | NFA-NET-07 | TLS 1.3 im LAN **verpflichtend** im Netzwerk-Modus (Pflichtenheft §4.4); nicht „optional“ |
| ISO-9241-110 Selbstbeschreibungsfähigkeit | ✅ | NFA-NET-08 | Automatische Geräteerkennung (mDNS) oder manuelle IP |
| ISO-25010 Zuverlässigkeit (Fehlertoleranz) | ✅ | NFA-NET-09 | Reconnect bei Verbindungsverlust; Benutzerbenachrichtigung |
| DSGVO Art. 5 (Datenminimierung) | ✅ | NFA-NET-10 | Keine Patientendaten auf Client-Geräten gespeichert |
| ISO-27001 A.13 Kommunikationssicherheit | ✅ | NFA-NET-11 | Rate-Limiting + IP-Whitelist |
| ISO-25010 Zuverlässigkeit (Verfügbarkeit) | ✅ | NFA-NET-12 | Standalone-Modus ohne Netzwerk bleibt vollständig funktionsfähig |

### Lizenzierung & Abonnement (NFA-LIC / FA-LIC / FA-PAY) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-27001 A.10 Kryptographie | ✅ | NFA-LIC-02 | Kryptographisch signierte Lizenzschlüssel (Ed25519/RSA) |
| ISO-25010 Zuverlässigkeit (Verfügbarkeit) | ✅ | NFA-LIC-03, FA-LIC-04 | Non-blocking Lizenzprüfung (3s Timeout); 30-Tage Offline-Karenz |
| DSGVO Art. 20 (Datenübertragbarkeit) | ✅ | NFA-LIC-04, FA-LIC-06 | Datenexport auch im Read-Only-Modus möglich |
| PCI-DSS v4.0 Req. 3 (Schutz gespeicherter Kontodaten) | ✅ | NFA-LIC-05, FA-PAY-06 | Keine Zahlungsdaten lokal gespeichert; nur Provider-Token-ID |
| ISO-27001 A.13 Kommunikationssicherheit | ✅ | NFA-LIC-01, NFA-LIC-06 | HTTPS (TLS 1.3) für Lizenz-/Zahlungskommunikation; dokumentierte Endpunkte |
| IEC-82304-1 Post-Market Surveillance | ✅ | FA-LIC-01 bis FA-LIC-08 | Lizenzmodell ermöglicht Hersteller-Kontrolle über Versionsverteilung und Feature-Freigabe |
| ISO-25010 Funktionale Eignung (Angemessenheit) | ✅ | FA-LIC-03, FA-LIC-08 | 3 Abo-Stufen mit Feature-Gating; kein Datenverlust bei Downgrade |
| PCI-DSS v4.0 Req. 6 (Sichere Systeme) | ✅ | FA-PAY-07 | Zahlungsformular via Provider-Hosted-Fields / Redirect (kein PAN-Handling) |
| ISO-27001 A.12.4 Logging | ✅ | FA-PAY-05 | Zahlungsverlauf mit vollständiger Transaktionshistorie |

### Update-Infrastruktur (NFA-UPD) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| IEC-62304 §6.2 Software-Wartungsplan | ✅ | NFA-UPD-01, NFA-UPD-10 | Automatische Versionsprüfung + Semantic Versioning |
| IEC-82304-1 §8 Post-Market Surveillance | ✅ | NFA-UPD-08 | Erzwungene Sicherheitsupdates (mandatory Flag) |
| ISO-27001 A.12.6 Management technischer Schwachstellen | ✅ | NFA-UPD-02, NFA-UPD-08 | OTA-Verteilung von Sicherheitspatches; Pflicht-Updates |
| ISO-27001 A.10 Kryptographie | ✅ | NFA-UPD-09 | Code-signierte Update-Pakete (Ed25519); eingebetteter Public-Key |
| ISO-25010 Zuverlässigkeit (Wiederherstellbarkeit) | ✅ | NFA-UPD-03, NFA-UPD-06 | Automatisches DB-Backup vor Update; Rollback bei Fehler |
| ISO-25010 Wartbarkeit (Modifizierbarkeit) | ✅ | NFA-UPD-04, NFA-UPD-05 | Auto-Migration bei DB-Schema-Änderungen; User-Bestätigung vor Update |
| ISO-9241-110 Steuerbarkeit | ✅ | NFA-UPD-05, NFA-UPD-07 | Nutzer entscheidet über Zeitpunkt; Changelog-Anzeige vor/nach Update |
| ISO-25010 Funktionale Eignung (Vollständigkeit) | ✅ | NFA-UPD-10 | Semantic Versioning (MAJOR.MINOR.PATCH) mit klarer Versionierungsstrategie |

### Erweiterte Verschlüsselung (NFA-SEC-07 bis NFA-SEC-13) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO-27001 A.12.4 Logging & Monitoring | ✅ | NFA-SEC-07 | 10 Jahre Audit-Log-Aufbewahrung; manipulationssicher (HMAC) |
| ISO-27001 A.10.1 Kryptographische Maßnahmen | ✅ | NFA-SEC-08 | SQLCipher AES-256-CBC mandatory für gesamte DB (kein Klartext) |
| ISO-27001 A.13.1 Netzwerksicherheitsmanagement | ✅ | NFA-SEC-09 | TLS 1.3 mandatory im Netzwerk-Modus; kein HTTP-Fallback |
| ISO-27001 A.10.1 Schlüsselmanagement | ✅ | NFA-SEC-10 | Keine Klartextgeheimnisse im Code/Dateisystem; OS-Keychain (macOS Keychain / Windows DPAPI) |
| ISO-27001 A.10.2 Kryptographische Schlüsselverwaltung | ✅ | NFA-SEC-11 | PBKDF2/Argon2id für Schlüsselableitung; Schlüsselrotation |
| DSGVO Art. 32 (Sicherheit der Verarbeitung) | ✅ | NFA-SEC-12 | Verschlüsselte Exporte (AES-256-GCM mit Benutzerpasswort) |
| ISO-27799 Gesundheitsinformatik | ✅ | NFA-SEC-13 | Runtime-Memory-Security: zeroize nach Gebrauch; kein Klartext in Dumps/Swap |

### Datenmigration (FA-MIG) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| DSGVO Art. 20 (Recht auf Datenübertragbarkeit) | ✅ | FA-MIG-01, FA-MIG-02, FA-MIG-03 | Import aus gängigen Formaten (VDDS-transfer, BDT, CSV/JSON) ermöglicht Praxiswechsel |
| ISO-25010 Kompatibilität (Interoperabilität) | ✅ | FA-MIG-01, FA-MIG-04, FA-MIG-10 | Standardisierte Importschnittstellen für VDDS, BDT, DICOM |
| ISO-25010 Zuverlässigkeit (Wiederherstellbarkeit) | ✅ | FA-MIG-07, FA-MIG-08 | Dry-Run-Simulation und Rollback-Fähigkeit bei Migrationsfehlern |
| ISO-25010 Benutzbarkeit (Bedienbarkeit) | ✅ | FA-MIG-05, FA-MIG-06 | Geführter Migrations-Wizard mit Validierungsbericht |
| ISO-27001 A.12.3 Datensicherung | ✅ | FA-MIG-08 | Automatischer DB-Snapshot vor Migration für Rollback |
| IEC-62304 §5.5 Software-Integration | ✅ | FA-MIG-04, FA-MIG-10 | DICOM-Bildmigration + Quellsystem-spezifische Importprofile |

### Geräteanbindung & Bildgebung (FA-DEV / NFA-DEV) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| DICOM PS3.2 (Conformance) | ✅ | FA-DEV-01, NFA-DEV-01 | DICOM C-STORE SCP, C-FIND, Worklist; Conformance Statement dokumentiert |
| DICOM PS3.15 (Security Profiles) | ✅ | NFA-DEV-02 | TLS 1.3 für DICOM Port 2762; Audit-Log für DICOM-Verbindungen |
| ISO-25010 Kompatibilität (Interoperabilität) | ✅ | FA-DEV-02, FA-DEV-03, FA-DEV-04 | TWAIN/WIA, GDT v2.1+, VDDS-media v1.4 — Multi-Protokoll-Unterstützung |
| ISO-27799 (Verschlüsselung med. Bilder) | ✅ | FA-DEV-06, NFA-DEV-07 | AES-256 Encryption at Rest für alle med. Bilder; kein Klartext-DICOM |
| MDR Anhang I Kap. 17 (Software als Medizinprodukt) | ✅ | FA-DEV-08, NFA-DEV-01 | Geräte-Konfiguration und DICOM-Conformance-Dokumentation |
| ISO-25010 Benutzbarkeit (Bedienbarkeit) | ✅ | FA-DEV-07, FA-DEV-08 | Bildannotation und Geräte-Management-UI |
| IEC-82304-1 §5.4 (Begleitdokumentation) | ✅ | NFA-DEV-05 | Systemvoraussetzungen (Hardware-Mindestanforderungen) dokumentiert |
| ISO-25010 Kompatibilität (Koexistenz) | ✅ | NFA-DEV-03, NFA-DEV-06 | USB-Hotplug-Erkennung; RS-232-Legacy-Kompatibilität |

### EU-Regulatorische Compliance (NFA-EU) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| DSGVO (EU 2016/679) — Privacy by Design | ✅ | NFA-EU-01 | Art. 25 (Privacy by Design), Art. 30 (VVT), Art. 17 (Löschung), Art. 20 (Portabilität), Art. 35 (DSFA) |
| MDR (EU 2017/745) — Klassifizierung | ✅ | NFA-EU-02, NFA-EU-03 | Klassifizierung nach Anhang VIII Regel 11; CE-Kennzeichnung bei Klasse I |
| NIS2 (EU 2022/2555) — Sicherheit | ✅ | NFA-EU-04 | Gesundheitssektor = wesentlicher Sektor; Risikobewertung + 72h-Meldepflicht |
| eIDAS (EU 910/2014) — Elektronische Signaturen | ✅ | NFA-EU-05 | Fortgeschrittene/qualifizierte elektronische Signaturen (PAdES/XAdES) |
| EU AI Act (2024/1689) — Hochrisiko-KI | ⚠️ | NFA-EU-06 | Nur relevant bei KI-Integration; Transparenz + menschliche Aufsicht vorbereitet |
| EN ISO 13485:2016 — QMS | ✅ | NFA-EU-07 | Qualitätsmanagementsystem bei MDR-Klassifizierung |
| EN ISO 14971:2019 — Risikomanagement | ✅ | NFA-EU-08 | Risikomanagement-Akte mit Gefährdungsanalyse |
| EN 62366-1:2015 — Gebrauchstauglichkeit | ✅ | NFA-EU-09 | Usability-Engineering-Akte; Studie mit repräsentativen Nutzern |
| MDR Anhang I Kap. III 23.4 — Sprachliche Anforderungen | ✅ | NFA-EU-10 | Deutsche Lokalisierung mandatory; i18n-Architektur für EU-Sprachen |

### Logging & Observability (NFA-LOG) — NEU

| ISO-Anforderung | Status | MeDoc-Anforderung | Anmerkung |
|-----------------|:------:|-------------------|-----------|
| ISO 25010 — Wartbarkeit: Analysierbarkeit | ✅ | NFA-LOG-01 | Strukturiertes JSON-Format; maschinenlesbar; Log-Level konfigurierbar |
| ISO 27001 A.12.4 — Logging & Monitoring | ✅ | NFA-LOG-02, NFA-LOG-03 | Sicherheitslog (Auth-Events, Brute-Force) + Systemlog (Lifecycle) |
| DSGVO Art. 33 — 72h-Meldepflicht | ✅ | NFA-LOG-02 | Security-Logs als Nachweis für Incident-Timeline; Brute-Force-Erkennung |
| IEC 62304 §5.5 — Software-Integration | ✅ | NFA-LOG-03 | Systemlog: DB-Migrationen, Update-Installationen, Konfigurationsänderungen |
| DICOM PS3.15 — Security & System Profiles | ✅ | NFA-LOG-04 | Gerätelog: DICOM C-STORE/C-FIND/Worklist mit AE-Title, Dauer, Ergebnis |
| ISO 25010 — Zuverlässigkeit | ✅ | NFA-LOG-05 | Migrationslog: lückenlose Dokumentation aller Import-Operationen |
| ISO 25010 — Leistungseffizienz | ✅ | NFA-LOG-06 | Performance-Log: Schwellenwert-basierte Erfassung langsamer Operationen |
| DSGVO Art. 5 — Datenminimierung | ✅ | NFA-LOG-08 | Keine PII in Non-Audit-Logs; Sanitizer maskiert sensible Daten |
| ISO 27001 A.10 — Kryptographie | ✅ | NFA-LOG-08 | Tokens, Schlüssel, Passwörter in Logs maskiert |
| IEC 82304-1 §8 — Nachmarktüberwachung | ✅ | NFA-LOG-09 | Log-Export (ZIP) für Support-Anfragen; automatische Maskierung |
| ISO 25010 — Wartbarkeit: Modifizierbarkeit | ✅ | NFA-LOG-10 | Log-Level zur Laufzeit konfigurierbar ohne Neustart |

---

## 3. Zusammenfassung

### Statistik

Zählung bezieht sich auf **§1 Vollständiges Mapping** (Haupttabellen von IEC 62304 bis ISO 22600 / DSGVO, 62 Zeilen):

| Kategorie | Anzahl |
|-----------|--------|
| Zeilen gesamt | 62 |
| ✅ Abgedeckt | 37 (60 %) |
| ⚠️ Teilweise – Erweiterung oder Verifikation nötig | 25 (40 %) |
| ❌ Keine dokumentierte Anforderung (Status „Neu“) | 0 |

Erweiterte Zuordnungstabellen in **§2** (NFA-NET, NFA-LOG, NFA-UPD, …) beschreiben zusätzliche Rückführbarkeit; dort überwiegen ✅-Einträge gemäß Pflichtenheft.

### Bewertung

Das Anforderungswerk von MeDoc deckt bereits **überwiegend** die ISO-Anforderungen ab (konkrete %-Zahl ist veraltet — siehe Tabellen §1 mit aktuellem Status). Wesentliche **Nachweise** ergänzen den reinen Pflichtenheft-Text:

1. **Prozessdokumentation**: Freigabe, Bugs, Wartung, Feedback liegen unter `docs/process/`; Nachmarkt unter `docs/post-market/` — operative Evidenz (Reviews, Ticketexporte) kann ergänzt werden.
2. **Benutzerdokumentation**: `docs/benutzerhandbuch.md` und **VVT** `docs/datenschutz/verarbeitungsverzeichnis.md` existieren — fortlaufende Abstimmung mit Produktreleases nötig.
3. **Datenschutz-Lebenszyklus / NFA-DATA-01**: im Pflichtenheft §4.13 beschrieben; Umsetzung und Praxisfälle sind in Code/UI zu verifizieren (kein Dokumentationsersatz).
4. **Audit-Log-Erweiterung**: NFA-SEC-04 / Lesezugriffe weiterhin als **implementierungsrelevant** betrachten.

Die neuen **Netzwerk- und Multi-Device-Anforderungen** (NFA-NET-01 bis NFA-NET-12) sind vollständig auf ISO 25010 (Kompatibilität, Übertragbarkeit, Zuverlässigkeit), ISO 27001 (Zugriffskontrolle, Kryptographie, Kommunikationssicherheit), ISO 9241 (Selbstbeschreibungsfähigkeit) und DSGVO Art. 5 (Datenminimierung) rückführbar.

Die neuen **Lizenz-, Abonnement- und Update-Anforderungen** (NFA-LIC, FA-LIC, FA-PAY, NFA-UPD) sind vollständig auf ISO 27001, IEC 62304/82304-1, ISO 25010, PCI-DSS v4.0, ISO 9241-110 und DSGVO Art. 20 rückführbar.

Die neuen **Verschlüsselungsanforderungen** (NFA-SEC-07 bis NFA-SEC-13) sind vollständig auf ISO 27001 A.10/A.12/A.13 (Kryptographie, Logging, Netzwerk), ISO 27799 (Gesundheitsinformatik) und DSGVO Art. 32 (Sicherheit der Verarbeitung) rückführbar.

Die neuen **Datenmigrations-Anforderungen** (FA-MIG-01 bis FA-MIG-10) sind vollständig auf DSGVO Art. 20 (Datenübertragbarkeit), ISO 25010 (Kompatibilität, Zuverlässigkeit, Benutzbarkeit), ISO 27001 A.12.3 (Datensicherung) und IEC 62304 §5.5 (Integration) rückführbar.

Die neuen **Geräteanbindungs-Anforderungen** (FA-DEV, NFA-DEV) sind vollständig auf DICOM PS3.2/PS3.15, ISO 25010, ISO 27799, MDR Anhang I Kap. 17 und IEC 82304-1 §5.4 rückführbar.

Die neuen **EU-Regulatorischen Anforderungen** (NFA-EU-01 bis NFA-EU-10) sind vollständig auf DSGVO (EU 2016/679), MDR (EU 2017/745), NIS2 (EU 2022/2555), eIDAS (EU 910/2014), EU AI Act (2024/1689), EN ISO 13485/14971 und EN 62366-1 rückführbar.

Die neuen **Nielsen-Heuristiken** (NFA-USE-H01 bis NFA-USE-H10) und **Usability-Engineering-Prinzipien** (NFA-USE-UE01 bis NFA-USE-UE07) sind vollständig auf ISO 9241-110 (Interaktionsprinzipien: Selbstbeschreibungsfähigkeit, Erwartungskonformität, Steuerbarkeit, Fehlertoleranz, Individualisierbarkeit, Erlernbarkeit, Konsistenz), ISO 9241-11 (Effizienz, Effektivität, Zufriedenstellung), ISO 9241-210 (Nutzerzentrierte Gestaltung), ISO 25010 (Benutzbarkeit, Barrierefreiheit, Ästhetik), WCAG 2.1 Level AA und EN 62366-1:2015 (Usability-Engineering für Medizinprodukte) rückführbar.

Offene ⚠️-Positionen im **§1 Kernmapping** verlangen überwiegend **Test- und Implementierungsnachweise** (z. B. Unit-/Systemtests, SQLCipher-Nachweis, formale Nutzermessung), keine reinen Dokumentationslücken mehr.