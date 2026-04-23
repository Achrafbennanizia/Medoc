# 1. Sammeln der Anforderungen

## Methoden der Anforderungserhebung

### 1.1 Stakeholder-Analyse

| Stakeholder | Rolle | Einfluss | Interesse |
|------------|-------|----------|-----------|
| Zahnarzt (Dr.) | Primärnutzer | Hoch | Effiziente Patientenbehandlung, Dokumentation |
| Rezeptionsmitarbeiter/in | Primärnutzer | Hoch | Terminplanung, Patientenaufnahme |
| Steuerberater | Sekundärnutzer | Mittel | Finanzdaten, Rechnungen, Bilanz |
| Pharmaberater | Externer Nutzer | Niedrig | Produktkatalog, Bestellungen |
| Patient | Indirekter Stakeholder | Mittel | Datenschutz, korrekter Behandlungsverlauf |
| IT-Administrator | Betreiber | Mittel | Systemwartung, Updates, Backup |

### 1.2 Erhebungstechniken

1. **Dokumentenanalyse**: Bachelorarbeit (Bennani-Ziatni, SS 2025), Figma-Prototyp, Praxisdokumentation
2. **Persona-Analyse**: Dr. Markus Lehner (Zahnarzt), Anna Scholz (Rezeption)
3. **Szenario-Analyse**: Typische Tagesabläufe in einer Zahnarztpraxis
4. **Prototyp-Evaluation**: Heuristische Evaluation nach Nielsen (10 Heuristiken)

### 1.3 Gesammelte Rohforderungen

#### Terminverwaltung (FA-TERM)
- FA-TERM-01: Visuelle Kalenderansicht (Tages-/Wochen-/Monatsansicht)
- FA-TERM-02: Termine anlegen mit Typ (Untersuchung, Behandlung, Notfall)
- FA-TERM-03: Automatische Konflikterkennung bei Überschneidungen
- FA-TERM-04: Status-Workflow (Angefragt → Bestätigt → Durchgeführt → Abgeschlossen)
- FA-TERM-05: Notfallmodus für Akutpatienten
- FA-TERM-06: Blockierte Zeiten für Pausen/Abwesenheiten
- FA-TERM-07: Drag-and-Drop Terminverschiebung
- FA-TERM-08: Farbkodierung der Termine nach Behandlungsart (Untersuchung, Behandlung, Kontrolle, Notfall)
- FA-TERM-09: Zeitslot-Auswahl mit visueller Hervorhebung verfügbarer/belegter Zeiten
- FA-TERM-10: Terminformular mit Arztauswahl-Dropdown und Patientensuche (Autovervollständigung)
- FA-TERM-11: Bestätigungsdialog bei Terminänderung („Änderung bestätigen")
- FA-TERM-12: Erfolgsmeldung nach Speichern/Löschen eines Termins (Toast-Nachricht)

#### Patientenverwaltung (FA-PAT)
- FA-PAT-01: Stammdatenerfassung (Name, Geburtsdatum, Geschlecht, Versicherung)
- FA-PAT-02: Fuzzy-Suche über Patientennamen
- FA-PAT-03: Statusverwaltung (Neu → Aktiv → Validiert → Readonly)
- FA-PAT-04: Automatische Aktenerstellung bei Neuanlage
- FA-PAT-05: Patientenhistorie und Verlaufsübersicht
- FA-PAT-06: Adressdaten und Kontaktinformationen
- FA-PAT-07: Profilfoto/Avatar pro Patient in Liste und Detailansicht
- FA-PAT-08: Patientenliste mit farbkodierten Statusbadges und Drei-Punkte-Aktionsmenü pro Zeile
- FA-PAT-09: Sortierung der Patientenliste nach Name, Datum, Status (Spaltenköpfe klickbar)
- FA-PAT-10: Erfolgsmeldung nach Patientenanlage („Patientenakte wurde hinzugefügt")

#### Elektronische Patientenakte (FA-AKTE)
- FA-AKTE-01: Digitale Patientenakte mit Versionshistorie
- FA-AKTE-02: Befunde, Diagnosen und Behandlungsverlauf
- FA-AKTE-03: Validierungsqueue (Arzt-Freigabe erforderlich)
- FA-AKTE-04: PDF-Export der vollständigen Akte
- FA-AKTE-05: Status-Workflow (Neu → In Bearbeitung → Validiert → Readonly)
- FA-AKTE-06: Aktenverlauf/Timeline: Chronologische Anzeige aller Einträge (Untersuchungen, Behandlungen, Dokumente) innerhalb der Akte
- FA-AKTE-07: Tab-basierte Navigation innerhalb der Akte (Personaldaten, Anamnese, Zahnschema, Behandlungen, Dokumente, Finanzen)
- FA-AKTE-08: Medizinische Vorgeschichte: Frühere Diagnosen, chronische Erkrankungen, psychische Erkrankungen, Allergien/Unverträglichkeiten in strukturierten Feldern
- FA-AKTE-09: Medikamentenerfassung: Aktuelle Medikamente, Wirkstoff, Dosierung, Einnahmedauer
- FA-AKTE-10: Adressen- und Kontaktblock mit separatem Bereich für Versicherungsdaten (Kasse/Privat-Toggle, Versicherungsname, Nummer)
- FA-AKTE-11: Buttons „Akte validieren" und „Neue erstellen" direkt in der Aktenansicht (Arzt-Rolle)

#### Zahnschema (FA-ZAHN)
- FA-ZAHN-01: Interaktives 2D-Zahnschema nach FDI-Nomenklatur (32 Zähne)
- FA-ZAHN-02: Farbkodierte Befunddarstellung (Gesund, Kariös, Krone, etc.)
- FA-ZAHN-03: Befund pro Zahn erfassen und aktualisieren
- FA-ZAHN-04: Diagnose und Notizen pro Zahn
- FA-ZAHN-05: Behandlungstabelle unterhalb des Zahnschemas: Zahn-Nr., Befund, Diagnose, Behandlung, Datum, Status pro Eintrag
- FA-ZAHN-06: Formular unter Zahnschema mit Feldern: Typ (Dropdown), Beschreibung, Datum, Arzt, Behandlung, Material
- FA-ZAHN-07: Farbige Markierungen direkt auf einzelne Zahnflächen (Okklusal, Mesial, Distal, Bukkal, Lingual)

#### Ärztliche Dokumentation (FA-DOK)
- FA-DOK-01: Strukturierte Untersuchungserfassung (Beschwerden, Ergebnisse, Diagnose)
- FA-DOK-02: Behandlungsdokumentation (Art, Verlauf, Material, Erfolg)
- FA-DOK-03: Anamnesebogen mit Standardfragen
- FA-DOK-04: Dokumentenmanagement (Röntgen, Laborbefund, Rezept, Attest)
- FA-DOK-05: Bild-/Dokumentenupload mit Drag-and-Drop, Vorschau und Kategorisierung (Typ, Referenznummer, Tags)
- FA-DOK-06: Scanner-Integration: Anamnesebogen und Papierdokumente direkt scannen und der Akte zuordnen

#### Rezeptverwaltung (FA-REZ) — NEU
- FA-REZ-01: Rezeptformular: Patient, Medikament, Wirkstoff, Dosierung, Einnahmehäufigkeit, Dauer
- FA-REZ-02: Mehrere Medikamente pro Rezept hinzufügbar (dynamische Liste)
- FA-REZ-03: Rezept bearbeiten und löschen (mit Bestätigungsdialog)
- FA-REZ-04: Rezept drucken und als PDF exportieren
- FA-REZ-05: Rezeptliste mit Status und Filteroptionen innerhalb der Patientenakte

#### Attestverwaltung (FA-ATT) — NEU
- FA-ATT-01: Attestformular: Attesttyp, Patient, Freitextbereich, Gültigkeitsdauer, Datum
- FA-ATT-02: Attest bearbeiten und löschen (mit Bestätigungsdialog)
- FA-ATT-03: Attest drucken und als PDF exportieren
- FA-ATT-04: Attestliste mit Status und Filteroptionen innerhalb der Patientenakte

#### Finanzverwaltung (FA-FIN)
- FA-FIN-01: Zahlungserfassung (Bar, Karte, Überweisung)
- FA-FIN-02: Status-Tracking (Offen, Bezahlt, Storniert)
- FA-FIN-03: Bilanzübersicht (Einnahmen vs. Ausgaben)
- FA-FIN-04: Finanzdokumente und Berichte
- FA-FIN-05: Monatsweise Statistiken
- FA-FIN-06: Bilanz-CRUD: Neue Bilanz mit Zeitraum, Kategorien, Einzelpositionen (Einnahmen/Ausgaben) erstellen, bearbeiten, löschen
- FA-FIN-07: Bilanz-Detailansicht mit Zusammenfassung (Einnahmen, Ausgaben, Saldo) und Transaktionsliste
- FA-FIN-08: Zahlungsliste mit Statusfilter, Sortierung und Drei-Punkte-Aktionsmenü

#### Produkte & Bestellungen (FA-PROD)
- FA-PROD-01: Produktkatalog mit Lieferant, Hersteller, Preis
- FA-PROD-02: Bestandsverwaltung (Menge, Lieferstatus)
- FA-PROD-03: Bestellhistorie
- FA-PROD-04: Produktliste mit Raster-/Listenansicht und farbkodierten Statuskarten
- FA-PROD-05: Bestellformular mit Produktauswahl, Lieferant, Menge, Lieferdatum, Zahlungsstatus

#### Leistungskatalog (FA-LEIST)
- FA-LEIST-01: Leistungen mit Kategorie und Preis
- FA-LEIST-02: Aktiv/Inaktiv-Verwaltung
- FA-LEIST-03: Zuordnung zu Behandlungen und Zahlungen
- FA-LEIST-04: Leistungsliste mit Suche, Filter und Schnellaktionen (Bearbeiten, Löschen)

#### Personalverwaltung (FA-PERS)
- FA-PERS-01: Mitarbeiterdaten mit Rolle und Fachrichtung
- FA-PERS-02: Rollenbasierte Rechtevergabe (ARZT, REZEPTION, STEUERBERATER, PHARMABERATER)
- FA-PERS-03: Verfügbarkeitsstatus
- FA-PERS-04: Selbstlöschung verhindern
- FA-PERS-05: Personalakte: Detailansicht mit Personaldaten, Tätigkeitsbereich, Kontakt, Rolle, Verfügbarkeitsstatus, Fachrichtung
- FA-PERS-06: Personalliste mit Kachel-/Listenansicht, Suche und Statusfilter
- FA-PERS-07: Drei-Punkte-Aktionsmenü pro Mitarbeiter (Bearbeiten, Löschen, Details)

#### Authentifizierung (FA-AUTH) — NEU
- FA-AUTH-01: Login-Seite mit E-Mail und Passwort
- FA-AUTH-02: Logout-Button sichtbar auf jeder Seite (Header, oben rechts)
- FA-AUTH-03: Session-Verwaltung mit automatischem Timeout (30 Min. Inaktivität)
- FA-AUTH-04: Benutzerprofil im Header mit Avatar, Name und Rollenanzeige

#### Einstellungen (FA-EINST) — NEU
- FA-EINST-01: Einstellungsseite: Profildaten bearbeiten (Name, E-Mail, Profilbild)
- FA-EINST-02: Passwort ändern (altes Passwort, neues Passwort, Bestätigung)
- FA-EINST-03: Bestätigungsdialog bei Profileänderungen

#### Statistik & Reporting (FA-STAT)
- FA-STAT-01: Dashboard mit KPIs (Patienten, Termine, Offene Zahlungen)
- FA-STAT-02: Patienten-Statistik (Neue Patienten pro Monat)
- FA-STAT-03: Termin-Statistik (nach Terminart)
- FA-STAT-04: Finanz-Statistik (Einnahmen pro Monat)
- FA-STAT-05: Audit-Log (nur Ärzte)

### 1.4 Design-Philosophie (NFA-DESIGN)

Die visuelle Sprache kombiniert bewährte Design-Systeme zu einer eigenständigen Ästhetik:

- **macOS Spatial Model**: Fensterbasierte Aufteilung (Sidebar + Content), Vibrancy/Glass-Effekte
- **Palenight Color Warmth**: Lila-blaue Hintergründe (#292D3E), sanfte Pastelltöne, warme gedämpfte Akzente
- **Material Design 3 Elevation**: Tonale Oberflächenhierarchie (nicht schattenbasiert)
- **Fluent 2 Focus**: Aufgeräumte Layouts, 4px-Raster, klare visuelle Hierarchie

Das Design ist KEINE Kopie eines einzelnen Systems, sondern eine **Synthese**:

| Quelle | Was wir übernehmen |
|--------|--------------------|
| **Apple HIG** | Spatial Model, Vibrancy, native Toolbar-Höhe (48px), Sheet-Dialoge, System-Font-Priorität |
| **Material 3** | Tonale Elevation, dynamische Farbe aus Seed, Typografie-Rollen, Spring-basierte Animationen |
| **Fluent 2** | 4px-Raster, Spacing-Ramp, Fokusring-Pattern, Interaktionszustände (rest→hover→pressed→selected) |
| **Palenight** | Farbpalette (#292D3E bg, #A6ACCD fg, Pastellakzente), warme lila-blaue Ästhetik |

**Qualitätsziele für die Oberfläche:**
1. **Correct** — Null fehlerhafte Features, null Typfehler, null Abstürze
2. **Complete** — Jede Backend-Funktion hat eine funktionierende Frontend-UI
3. **Clean** — Jede Datei folgt SE-Prinzipien, null toter Code
4. **Beautiful** — Apple HIG Glass + Fluent 2 + Material Design 3 Designsprache
5. **Maintainable** — Konsistente Patterns, klare Erweiterungspunkte

### 1.5 Nicht-funktionale Anforderungen (Rohform)

- NFA-SEC: Sicherheit (RBAC, Verschlüsselung, Audit-Log, Backup)
- NFA-LOG: Logging & Observability (umfassendes Logging-System über Audit-Log hinaus)
- NFA-LOG-01: **Anwendungslog** — Strukturierte Logs (JSON) mit Log-Levels (ERROR, WARN, INFO, DEBUG, TRACE); gespeichert in `~/medoc-data/logs/app.log`; automatische Log-Rotation (max. 50 MB/Datei, 30 Tage Aufbewahrung); Rust `tracing` Crate im Backend, Console-Logger im Frontend
- NFA-LOG-02: **Sicherheitslog** — Separate Logdatei für sicherheitsrelevante Ereignisse: fehlgeschlagene Logins (mit IP-Adresse), Brute-Force-Erkennung (> 5 Fehlversuche → temporäre Sperre + Log), Session-Invalidierungen, Passwortwechsel, Lizenzvalidierungsergebnisse; gespeichert in `~/medoc-data/logs/security.log`
- NFA-LOG-03: **Systemlog** — Anwendungsstart/-stopp, Konfigurationsänderungen (Einstellungen), DB-Migrationen (Schema-Version), Update-Installation (Version + Ergebnis), Backup-Operationen (Beginn/Ende/Ergebnis); gespeichert in `~/medoc-data/logs/system.log`
- NFA-LOG-04: **Gerätelog** — Alle Geräte-Kommunikationen: DICOM-Verbindungen (C-STORE, C-FIND, Worklist), GDT-Dateiaustausch, TWAIN/WIA-Captures, USB-Hotplug-Events, Gerätefehler; gespeichert in `~/medoc-data/logs/device.log`
- NFA-LOG-05: **Migrationslog** — Import-Operationen: Quellsystem, Dateiname, Start/Ende, importierte/fehlerhafte Datensätze, Validierungsergebnisse, Rollback-Events; gespeichert in `~/medoc-data/logs/migration.log`
- NFA-LOG-06: **Performance-Log** — API-Antwortzeiten > 500ms loggen; langsame DB-Queries > 200ms; Speicherverbrauch; gleichzeitige Client-Verbindungen; gespeichert in `~/medoc-data/logs/perf.log`
- NFA-LOG-07: **Log-Schutz** — Alle Logs (außer Audit-Log, das HMAC-gesichert ist) müssen dateisystemseitig geschützt sein (nur App-Benutzer lesen/schreiben). Keine Patientendaten in Anwendungs-/System-/Performance-Logs (Datenminimierung). Sensitive Werte maskiert (Passwörter, Tokens → `***`)
- NFA-USE: Usability (Nielsen-Heuristiken ≥80%, max 2 Klicks, Bestätigungsdialoge)
- NFA-USE-07: Bestätigungsdialoge auch für Änderungen/Updates, nicht nur für destruktive Aktionen (Figma: „Änderung bestätigen")
- NFA-USE-08: Toast-/Banner-Nachrichten bei Erfolg/Fehler aller CRUD-Operationen (z. B. „Termin wurde gespeichert", „Akte wurde gelöscht")
- NFA-PERF: Performance (<2s Ladezeit, responsive ab 1259×1024, Netzwerklatenz <200ms im LAN)
- NFA-INT: Integration (Röntgensoftware, Scanner, Drucker)
- NFA-INT-03: Scanner-Workflow: Anamnesebogen via Scanner importieren und der Patientenakte zuordnen
- NFA-DATA: Datenschutz (DSGVO-Konformität, verschlüsselte Speicherung)

### 1.6 Netzwerk & Multi-Device-Anforderungen (Rohform)

Die Praxis arbeitet an mehreren Arbeitsplätzen: Der Arzt nutzt einen Desktop-PC, die Rezeption arbeitet an einem separaten Computer und muss zusätzlich über Smartphone oder Tablet auf das System zugreifen können. Daraus ergeben sich folgende Rohforderungen:

#### Netzwerk-Betrieb (NFA-NET)
- NFA-NET-01: Der Arzt-PC (oder ein dedizierter lokaler Praxis-Server) fungiert als **Host/Server** und stellt die Datenbank + API über TCP/HTTP im LAN bereit
- NFA-NET-02: Weitere Desktop-PCs (z. B. Rezeption) verbinden sich als **Clients** über das lokale Netzwerk mit dem Host und nutzen alle rollenbezogenen Funktionen
- NFA-NET-03: Optional kann ein **dedizierter Server** (Headless, ohne GUI) in der Praxis betrieben werden, unabhängig vom Arzt-PC
- NFA-NET-04: Die Datenbank verbleibt **ausschließlich auf dem Host** – keine lokale Datenspeicherung auf Clients (Datenschutz)
- NFA-NET-05: Bei Verbindungsverlust muss der Client den Benutzer informieren und automatisch reconnecten
- NFA-NET-06: Standalone-Betrieb auf einem einzelnen Rechner (ohne Netzwerk) muss weiterhin möglich sein

#### Mobiler Zugriff für Rezeption (NFA-NET-MOBIL)
- NFA-NET-MOBIL-01: Der Host stellt eine **responsive Web-Oberfläche** bereit, die über den Browser auf Smartphone/Tablet erreichbar ist
- NFA-NET-MOBIL-02: Die mobile Version deckt **alle Funktionen der Rolle REZEPTION** ab: Terminverwaltung, Patientenaufnahme, Patientenliste, Suche, Zahlungsdokumentation
- NFA-NET-MOBIL-03: Layout optimiert für **Touchscreen-Bedienung** (min. 44px Tap-Targets, vereinfachte Navigation)
- NFA-NET-MOBIL-04: Responsive Breakpoints: Desktop (≥1259px), Tablet (768px–1258px), Smartphone (375px–767px)

#### Netzwerk-Sicherheit (NFA-NET-SEC)
- NFA-NET-SEC-01: Jede Netzwerkverbindung erfordert **authentifizierte Sitzungen** (kein anonymer API-Zugriff)
- NFA-NET-SEC-02: **TLS-Verschlüsselung** (HTTPS) im LAN konfigurierbar
- NFA-NET-SEC-03: **IP-Whitelist** und Rate-Limiting konfigurierbar
- NFA-NET-SEC-04: Automatische Geräte-Erkennung im LAN (mDNS) oder manuelle IP-Konfiguration

### 1.7 Lizenzierung, Abonnement & Update-Anforderungen (Rohform)

MeDoc wird von einem Unternehmen (dem Hersteller) als **Software-as-a-Service (SaaS) mit lokaler Installation** vertrieben. Zahnarztpraxen erhalten Zugang über ein monatliches Abonnement. Daraus ergeben sich:

#### Geschäftsmodell
- Die Betreiberfirma (Hersteller) entwickelt, vertreibt und wartet MeDoc
- Praxen sind **Lizenznehmer** und zahlen ein monatliches Abonnement
- Ohne gültige Lizenz kann die Software nicht produktiv genutzt werden
- Die Daten der Praxis gehören der Praxis (DSGVO) und bleiben lokal

#### Lizenzierung (FA-LIC)
- FA-LIC-01: Beim ersten Start muss ein **Lizenzschlüssel** eingegeben oder online aktiviert werden
- FA-LIC-02: Es gibt verschiedene **Abo-Stufen** (z. B. Basis, Professional, Enterprise) mit unterschiedlichem Funktionsumfang
- FA-LIC-03: Die Lizenz muss **periodisch validiert** werden (z. B. einmal pro Monat bei Internet-Verfügbarkeit)
- FA-LIC-04: Bei Ablauf der Lizenz wechselt die App in einen **Read-Only-Modus** (Daten einsehen, aber nicht bearbeiten) — kein Datenverlust
- FA-LIC-05: Der Arzt/Admin kann den Lizenzstatus, das Ablaufdatum und die Abo-Stufe in den Einstellungen einsehen
- FA-LIC-06: Lizenzverlängerung/Wechsel der Abo-Stufe muss über ein **Self-Service-Portal** (Web) oder direkt in der App möglich sein
- FA-LIC-07: Die Anzahl gleichzeitig verbundener Geräte kann pro Abo-Stufe begrenzt sein (z. B. Basis: 2, Professional: 5, Enterprise: unbegrenzt)

#### Integriertes Zahlungssystem (FA-PAY)
- FA-PAY-01: Die App muss ein **integriertes Zahlungsmodul** zur Verwaltung des Abonnements bereitstellen
- FA-PAY-02: Unterstützte Zahlungsmethoden: **Kreditkarte, SEPA-Lastschrift, PayPal** (über einen Payment-Provider wie Stripe oder Mollie)
- FA-PAY-03: Rechnungen/Quittungen für das Abonnement müssen **automatisch generiert** und als PDF abrufbar sein
- FA-PAY-04: Bei fehlgeschlagener Zahlung muss eine **Karenzzeit** (z. B. 14 Tage) eingeräumt werden, bevor die Lizenz deaktiviert wird
- FA-PAY-05: Der Zahlungsverlauf (Abonnement-Historie, Rechnungen, Zahlungsstatus) muss in den Einstellungen einsehbar sein
- FA-PAY-06: Es dürfen **keine Kreditkartennummern oder Bankdaten lokal** gespeichert werden — alle Zahlungsdaten werden beim Payment-Provider tokenisiert

#### Update-Infrastruktur (NFA-UPD)
- NFA-UPD-01: Die App muss beim Start (und periodisch) auf **neue Versionen** beim Hersteller-Server prüfen
- NFA-UPD-02: Updates müssen **Over-The-Air (OTA)** heruntergeladen und installiert werden können (Tauri-Updater)
- NFA-UPD-03: Vor jedem Update wird automatisch ein **Backup der Datenbank** erstellt
- NFA-UPD-04: Die Datenbank muss **automatisch migriert** werden, wenn eine neue Version ein neues Schema erfordert
- NFA-UPD-05: Der Benutzer muss ein Update **bestätigen** können (kein stilles Zwangsupdate)
- NFA-UPD-06: Im Falle eines fehlgeschlagenen Updates muss ein **Rollback** auf die vorherige Version möglich sein
- NFA-UPD-07: Der Hersteller kann per **Changelog/Release-Notes** kommunizieren, was sich in der neuen Version geändert hat
- NFA-UPD-08: Kritische Sicherheitsupdates können als **erzwungene Updates** markiert werden (Nutzung erst nach Update möglich)

### 1.5 Regulatorische und normative Anforderungen (ISO/DSGVO)

Aus der Analyse relevanter ISO-Normen und der DSGVO ergeben sich zusätzliche Anforderungen für ein System, das sensible Gesundheitsdaten verarbeitet. Die vollständige Analyse befindet sich in `docs/iso-standards/`.

#### Anwendbare Normen

| Norm | Titel | Verbindlichkeit |
|------|-------|-----------------|
| IEC 62304:2006+AMD1:2015 | Medizingeräte-Software – Lebenszyklusprozesse | Best Practice |
| ISO 14971:2019 | Risikomanagement für Medizinprodukte | Best Practice |
| IEC 82304-1:2016 | Gesundheitssoftware – Produktsicherheit | Empfohlen |
| ISO/IEC 27001:2022 | Informationssicherheits-Managementsysteme | Empfohlen |
| ISO 27799:2016 | Informationssicherheit im Gesundheitswesen | Empfohlen |
| ISO/IEC 25010:2011 | Software-Qualitätsmodell (SQuaRE) | Empfohlen |
| ISO 9241-210:2019 | Menschzentrierte Gestaltung | Empfohlen |
| ISO 9241-110:2020 | Interaktionsprinzipien | Empfohlen |
| ISO 22600:2014 | Zugriffskontrolle im Gesundheitswesen | Empfohlen |
| DSGVO (EU 2016/679) | Datenschutz-Grundverordnung | **Verpflichtend** |

#### Neue Anforderungen aus der ISO-Analyse

**Prozess (NFA-PROC)**
- NFA-PROC-01: Formaler Softwarefreigabeprozess (IEC 62304)
- NFA-PROC-02: SOUP-Liste aller Drittanbieter-Komponenten (IEC 62304)
- NFA-PROC-03: Bug-Tracking-Prozess (IEC 62304)
- NFA-PROC-04: Software-Wartungsplan (IEC 62304)
- NFA-PROC-05: Feedback-Prozess aus dem Praxisbetrieb (ISO 14971)
- NFA-PROC-06: Nachmarktüberwachungsprozess (IEC 82304-1)

**Dokumentation (NFA-DOC)**
- NFA-DOC-01: Benutzerhandbuch (IEC 82304-1)
- NFA-DOC-02: Verzeichnis der Verarbeitungstätigkeiten (DSGVO Art. 30)

**Datenschutz (NFA-DATA)**
- NFA-DATA-01: 10-Jahres-Aufbewahrungspflicht mit Löschkonzept (DSGVO Art. 17, §630f BGB)

**Sicherheit – Erweiterungen**
- NFA-SEC-04 erweitert: Auch Lesezugriffe auf Patientendaten protokollieren (ISO 27799)
- NFA-SEC-04 erweitert: Audit-Logs manipulationssicher (ISO 27001)
- NFA-SEC-07: Audit-Logs mindestens 10 Jahre aufbewahren (ISO 27799)

**Usability – Erweiterungen**
- NFA-USE-06: Barrierefreiheit – Textlabels bei Farbkodierungen (ISO 25010)

### 1.9 Nielsen-Heuristiken & Usability-Engineering-Prinzipien (Rohform)

MeDoc muss die **10 Nielsen-Heuristiken** vollständig erfüllen und die **7 Usability-Engineering-Prinzipien** nach Shneiderman/Nielsen/ISO 9241 als messbare Qualitätsziele verankern.

#### 1.9.1 Die 10 Nielsen-Heuristiken

Jede Heuristik wird als formales Qualitätskriterium in das Pflichtenheft übernommen:

| # | Heuristik | MeDoc-Anforderung (Rohform) |
|---|-----------|---------------------------|
| H1 | **Sichtbarkeit des Systemstatus** | Lade-Spinner, Fortschrittsbalken, Toast-Meldungen bei jeder Aktion; Verbindungsstatus-Banner im Netzwerk-Modus; Migrations-Fortschrittsanzeige; DICOM-Übertragungsstatus |
| H2 | **Übereinstimmung zwischen System und realer Welt** | Zahnmedizinische Fachterminologie (FDI-Zahnschema, Befundkürzel, BEMA/GOZ-Nummern); vertraute Praxisworkflows; keine technischen Fehlermeldungen (Benutzersprache statt Stack-Traces) |
| H3 | **Benutzerkontrolle und Freiheit** | Undo/Redo für Texteingaben; Abbrechen-Button in jedem Dialog; Migrations-Rollback; Bestätigungsdialoge vor destruktiven Aktionen; „Zurück"-Navigation überall |
| H4 | **Konsistenz und Standards** | Einheitliche Palenight-Design-Tokens; konsistente Button-Platzierung (Primäraktion rechts); identische Tabellenstrukturen über alle Module; GDT/DICOM/VDDS-Standards einhalten |
| H5 | **Fehlervermeidung** | Pflichtfelder visuell markiert; Validierung vor Absenden; Bestätigungsdialoge vor Löschaktionen; Dry-Run für Migration; Auto-Save für Entwürfe; Plausibilitätsprüfung (z.B. Geburtsdatum nicht in der Zukunft) |
| H6 | **Wiedererkennung statt Erinnerung** | Sidebar-Navigation mit Labels + Icons; zuletzt geöffnete Patienten; Auto-Complete bei Patientensuche; kontextbezogene Aktionsbuttons; Tool-Tipps auf allen Icons |
| H7 | **Flexibilität und effiziente Nutzung** | Tastaturkürzel für Hauptaktionen (Strg+N neuer Termin, Strg+P Patientensuche); konfigurierbare Schnellzugänge im Dashboard; Drag-and-Drop im Kalender; Power-User-Shortcuts |
| H8 | **Ästhetisches und minimalistisches Design** | Palenight-Glasmorphismus-Designsystem; tonal elevation; nur relevante Informationen pro Ansicht; progressive Offenlegung (Details on Demand); keine überladenen Formulare |
| H9 | **Hilfe beim Erkennen, Diagnostizieren und Beheben von Fehlern** | Fehlermeldungen benennen Ursache + Handlungsanweisung (z.B. „E-Mail-Format ungültig — bitte prüfen Sie die Eingabe"); Feldmarkierung bei Validierungsfehler; Migrationsbericht mit Fehler-Detail |
| H10 | **Hilfe und Dokumentation** | Kontextsensitive Hilfe (Fragezeichen-Icon pro Bereich); eingebettete Tooltips; Onboarding-Wizard für Erstbenutzer; durchsuchbare Hilfe/FAQ; Link zum Benutzerhandbuch |

#### 1.9.2 Usability-Engineering-Prinzipien

Die folgenden 7 Prinzipien definieren messbare Usability-Ziele für MeDoc:

| Prinzip | Definition | MeDoc-Umsetzung (Rohform) |
|---------|-----------|--------------------------|
| **Learnability** (Erlernbarkeit) | Neue Benutzer müssen das System schnell produktiv nutzen können | Einarbeitungszeit ≤ 2 Monate (NFA-USE-05); Onboarding-Wizard; rollenspezifische Startansichten; konsistente Interaktionsmuster über alle Module |
| **Efficiency** (Effizienz) | Erfahrene Benutzer müssen Aufgaben schnell erledigen können | Max. 2 Klicks zu jeder Hauptfunktion (NFA-USE-02); Tastaturkürzel; Auto-Complete; Notfalltermin in < 3 Klicks; Bulk-Aktionen in Tabellen |
| **Memorability** (Einprägsamkeit) | Nach längerer Abwesenheit muss der Benutzer das System ohne erneute Schulung nutzen können | Konsistente Navigation; erkennbare Icons; stabile Menüstruktur zwischen Versionen; „zuletzt besucht"-Übersicht auf dem Dashboard |
| **Errors** (Fehlertoleranz) | Das System muss Benutzerfehler minimieren und Wiederherstellung ermöglichen | Bestätigungsdialoge (NFA-USE-03/07); Undo; Validierung vor Absenden; Pflichtfeld-Markierung; Rollback bei Migration (FA-MIG-08); kein Datenverlust durch Fehlbedienung |
| **Satisfaction** (Zufriedenheit) | Die Nutzung des Systems soll subjektiv angenehm sein | Palenight-Ästhetik; sanfte Animationen; positive Bestätigungsmeldungen; System Usability Scale (SUS) ≥ 72 (überdurchschnittlich); kein visueller „Noise" |
| **User-Centered Design** (Nutzerzentrierte Gestaltung) | Benutzer werden in den Designprozess einbezogen | Prototyp-Evaluation (Figma) vor Implementierung; heuristische Evaluation; Usability-Tests mit ≥ 5 Personen pro Rolle (NFA-EU-09); iterative Verbesserung nach Feedback; Stakeholder-Analyse der 4 Rollen |
| **Accessibility** (Barrierefreiheit) | Das System muss für Menschen mit Einschränkungen zugänglich sein | Textlabels bei Farbkodierungen (NFA-USE-06); Mindest-Kontrastrate 4.5:1 (WCAG 2.1 AA); Tastaturnavigation für alle interaktiven Elemente; Aria-Labels für Screen-Reader; Schriftgröße skalierbar |

#### EU-Regulatorische Compliance

MeDoc wird als Praxisverwaltungssoftware (PVS) im europäischen Gesundheitsmarkt vertrieben und muss allen relevanten EU-Verordnungen und -Richtlinien entsprechen:

**Verpflichtende EU-Verordnungen:**
- NFA-EU-01: **DSGVO (EU 2016/679)** — Datenschutz-Grundverordnung: bereits weitgehend adressiert (Art. 5, 17, 20, 25, 30, 32)
- NFA-EU-02: **MDR (EU 2017/745)** — Medical Device Regulation: MeDoc verarbeitet medizinische Befunddaten und steuert/empfängt Daten von Medizinprodukten (Röntgen, CBCT, intraorale Scanner). Softwareklassifizierung nach Regel 11 prüfen; ggf. als Klasse-I-Medizinprodukt registrieren.
- NFA-EU-03: **NIS2-Richtlinie (EU 2022/2555)** — Netzwerk- und Informationssicherheit: Gesundheitssektor gilt als „wesentlicher Sektor" → Pflicht zur Risikobewertung, Meldepflicht bei Sicherheitsvorfällen (72h), Lieferketten-Sicherheit
- NFA-EU-04: **eIDAS-Verordnung (EU 910/2014)** — Elektronische Identifizierung: Relevanz für digitale Signaturen auf Rezepten/Attesten und elektronische Authentifizierung
- NFA-EU-05: **EU AI Act (2024/1689)** — Falls KI-Funktionen integriert werden (z.B. Karies-Erkennung auf Röntgenbildern): Klassifizierung als Hochrisiko-KI im Gesundheitsbereich; Pflicht zu Transparenz, Erklärbarkeit und menschlicher Aufsicht
- NFA-EU-06: **CE-Kennzeichnung** — Wenn MeDoc als Medizinprodukt-Software eingestuft wird: Konformitätsbewertung, CE-Kennzeichnung und EU-Konformitätserklärung erforderlich

**Europäische Normen (harmonisiert):**
- NFA-EU-07: **EN ISO 13485:2016** — Qualitätsmanagementsystem für Medizinprodukte (wenn MDR-Klasse I oder höher)
- NFA-EU-08: **EN ISO 14971:2019** — Risikomanagement für Medizinprodukte
- NFA-EU-09: **EN 62366-1:2015** — Usability-Engineering für Medizinprodukte (Gebrauchstauglichkeit)
- NFA-EU-10: **EN IEC 62304:2006+A1:2015** — Software-Lebenszyklusprozesse (bereits referenziert)
- NFA-EU-11: **EN IEC 82304-1:2017** — Gesundheitssoftware — Produktsicherheit (bereits referenziert)

#### Datenmigration von bestehenden Praxissystemen

MeDoc muss den Import bestehender Praxisdaten aus gängigen Dental-PVS-Systemen unterstützen, um einen reibungslosen Systemwechsel für Zahnarztpraxen zu ermöglichen:

**Migrationsschnittstellen:**
- FA-MIG-01: **VDDS-transfer (v2.22)** — Import von Patientenstammdaten, Behandlungsdaten, Abrechnungsdaten und Termindaten über die VDDS-Transferschnittstelle (Standard des Verbands Deutscher Dental-Software Unternehmen)
- FA-MIG-02: **BDT (Behandlungsdatentransfer v3.0)** — Import vollständiger Patientenakten inkl. Anamnese, Diagnosen, Behandlungsverläufe und Gebührenziffern (KBV/QMS-Standard)
- FA-MIG-03: **CSV/JSON-Import** — Generischer Datenimport über strukturierte Dateien (für Systeme ohne standardisierte Exportschnittstelle)
- FA-MIG-04: **DICOM-Import** — Import bestehender Röntgenbilder und Bildserien (Panorama, Intraoral, CBCT) aus Fremd-PACS oder lokalen Bildarchiven
- FA-MIG-05: **Migrationsassistent** — Geführter Workflow für den Datenimport: Quellsystem auswählen → Datei laden → Vorschau/Validierung → Feldmapping → Import → Qualitätsbericht
- FA-MIG-06: **Datenvalidierung** — Importierte Daten werden auf Vollständigkeit, Konsistenz und Plausibilität geprüft; Fehler werden in einem Migrationsbericht dokumentiert
- FA-MIG-07: **Testlauf (Dry-Run)** — Migration kann zunächst als Testlauf ohne Datenbankänderung durchgeführt werden; Ergebnis wird in einem Vorschaubericht angezeigt
- FA-MIG-08: **Rollback** — Bei Fehlern in der Migration kann der gesamte Import rückgängig gemacht werden (Datenbankzustand vor Migration wiederherstellbar)
- FA-MIG-09: **Inkrementeller Import** — Möglichkeit, Daten schrittweise zu importieren (z.B. erst Patienten, dann Termine, dann Behandlungen), um den Migrationsprozess zu kontrollieren

**Unterstützte Quellsysteme (marktgängig in Deutschland/EU):**
- Dampsoft DS-Win / DS-Win-Plus
- CGM Z1 / Z1.PRO (CompuGroup Medical)
- Evident AERA
- Alphatech Alphaplus
- DATEXT ivoris
- Solutio Charly
- LinuDent
- Weitere Systeme über generischen CSV/BDT-Import

#### Kompatibilität mit dentalen Geräten

MeDoc muss mit den gängigen Gerätetypen in Zahnarztpraxen kompatibel sein. Die Geräteanbindung erfolgt über standardisierte Schnittstellen:

**1. Intraorale Röntgensensoren (Digital-Röntgen)**
- Hersteller: DEXIS (IXS, Ti2), Planmeca (ProSensor HD), Carestream (RVG 5200/6200), Sirona (XIOS XG), VDW (VISTEO), Vatech (EzSensor)
- Physische Schnittstelle: **USB 2.0/3.0** (Direktanschluss an Host-PC)
- Software-Schnittstelle: **TWAIN/WIA-Treiber** (Bilderfassung), **DICOM** (Bildübertragung/-speicherung)
- Bildformat: DICOM, JPEG, TIFF, PNG (12-16 Bit Graustufen)
- Infrastruktur: USB-Kabel (max. 5m), ggf. USB-Hub mit externer Stromversorgung

**2. Panorama-Röntgengeräte (OPG)**
- Hersteller: Planmeca (ProMax 2D), DEXIS (ORTHOPANTOMOGRAPH OP 3D), Sirona (ORTHOPHOS S/SL), Vatech (PaX-i3D), Carestream (CS 8100)
- Physische Schnittstelle: **Ethernet (RJ-45)** zum Praxis-LAN oder Direkt-PC
- Software-Schnittstelle: **DICOM** (Worklist, Store, Query/Retrieve), **GDT 2.1+** (Gerätedatentransfer)
- Netzwerk: Eigene IP im Praxis-LAN, DICOM-Port 104 oder 11112 (TCP)
- Infrastruktur: CAT-5e/6-Kabel, ggf. dedizierter Switch

**3. CBCT-Geräte (Digitale Volumentomographie / 3D)**
- Hersteller: Planmeca (ProMax 3D Mid/Plus), i-CAT (FLX V-Series), Sirona (ORTHOPHOS SL 3D), Vatech (Green CT2)
- Physische Schnittstelle: **Ethernet (RJ-45)** — Gigabit empfohlen (große 3D-Datensätze 100-500 MB)
- Software-Schnittstelle: **DICOM** (Store, Query/Retrieve), proprietäre Viewer-Software
- Netzwerk: Gigabit-Ethernet, ggf. eigenes VLAN für Imaging
- Bildformat: DICOM (3D-Volume), STL (für CAD/CAM-Weiterverarbeitung)

**4. Intraorale Scanner (IOS)**
- Hersteller: DEXIS (IS 3800W/3800), 3Shape (TRIOS 4/5), Medit (i700/i900), Align (iTero Element), Planmeca (Emerald S)
- Physische Schnittstelle: **USB 3.0** (kabelgebunden) oder **Wi-Fi** (kabellos, z.B. TRIOS 5, IS 3800W)
- Software-Schnittstelle: **Proprietäres SDK** (herstellerspezifisch), STL/PLY/OBJ-Export, einige DICOM
- Datenformate: STL, PLY, OBJ (3D-Meshes), DCM (DICOM Structured Report)
- Infrastruktur: USB-3.0-Port oder Wi-Fi-Accesspoint, ausreichend RAM (16 GB+) und GPU

**5. Intraorale Kameras**
- Hersteller: DEXIS (DEXcam 4HD), Acteon (SOPRO 617/717), Planmeca (Planmeca Intraoral Camera), Carestream (CS 1500)
- Physische Schnittstelle: **USB 2.0** (Plug-and-Play)
- Software-Schnittstelle: **TWAIN/WIA**, **VDDS-media (v1.4)**
- Bildformat: JPEG, BMP, PNG (Foto/Video)

**6. Dentaleinheiten (Behandlungsstühle)**
- Hersteller: Planmeca (Compact i5), KaVo (ESTETICA E80), Sirona (INTEGO), A-dec (500)
- Physische Schnittstelle: **RS-232 (seriell)** oder **Ethernet** (neuere Modelle)
- Software-Schnittstelle: Proprietäres Protokoll (Patientendatenübergabe, Programmvorwahl)
- Infrastruktur: Serielle Kabel (RS-232, max. 15m) oder Ethernet

**7. CAD/CAM-Systeme (Chairside-Fräseinheiten)**
- Hersteller: Sirona (CEREC Primemill), Planmeca (PlanMill 30S), Ivoclar (PrograMill)
- Physische Schnittstelle: **Ethernet** oder **USB 3.0**
- Software-Schnittstelle: STL-Import aus IOS, proprietäre CAD-Software
- Datenformate: STL, PLY, 3MF

**Zusammenfassung Schnittstellen-Matrix:**

| Gerätetyp | Physisch | Protokoll | Standard | Richtung |
|-----------|----------|-----------|----------|----------|
| Intraoral-Röntgen | USB 2.0/3.0 | TWAIN/WIA | DICOM | Gerät → MeDoc |
| Panorama-OPG | Ethernet | DICOM | GDT | Bidirektional |
| CBCT (3D) | Ethernet (Gigabit) | DICOM | DICOM | Gerät → MeDoc |
| Intraorale Scanner | USB 3.0 / Wi-Fi | SDK / STL | STL/PLY | Gerät → MeDoc |
| Intraorale Kamera | USB 2.0 | TWAIN/WIA | VDDS-media | Gerät → MeDoc |
| Dentaleinheit | RS-232 / Ethernet | Proprietär | GDT | Bidirektional |
| CAD/CAM | Ethernet / USB | STL-Import | STL/3MF | MeDoc → Gerät |

**Infrastruktur-Anforderungen für Geräteanbindung:**
- Mindestens 4× USB-3.0-Ports am Host-PC (Sensoren, Scanner, Kameras)
- Gigabit-Ethernet-Switch (mindestens 8 Ports) im Praxis-LAN
- CAT-6-Verkabelung für alle Ethernet-Geräte (OPG, CBCT, Dentaleinheiten)
- Optional: Dediziertes VLAN für Imaging-Geräte (DICOM-Netzwerk isoliert)
- Wi-Fi-Accesspoint (802.11ac/ax) für kabellose Scanner
- RS-232-zu-USB-Adapter für Legacy-Dentaleinheiten
- DICOM-Server/Mini-PACS auf dem Host oder dediziertem NAS für Bildarchivierung
