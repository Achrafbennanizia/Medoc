# 3. Priorisierung der Anforderungen und Konfliktauflösung

## 3.1 Priorisierungsmethode: MoSCoW

### Must Have (M) – Pflichtanforderungen
Ohne diese Anforderungen ist das System nicht einsatzfähig.

| ID | Anforderung | Begründung |
|----|-------------|-----------|
| FA-TERM-01 | Kalenderansicht | Kernfunktion der Praxis |
| FA-TERM-02 | Termine anlegen | Grundlegende Arbeitsabläufe |
| FA-TERM-03 | Konflikterkennung | Vermeidung von Doppelbuchungen |
| FA-PAT-01 | Stammdatenerfassung | Patientenverwaltung = Kernprozess |
| FA-PAT-02 | Patientensuche | Effizienz im Praxisalltag |
| FA-AKTE-01 | Digitale Patientenakte | Ersetzt Papierakte |
| FA-AKTE-02 | Befunde und Diagnosen | Medizinische Dokumentationspflicht |
| FA-ZAHN-01 | Interaktives Zahnschema | Kernwerkzeug für Zahnärzte |
| FA-ZAHN-02 | Farbkodierte Befunde | Visuelle Schnellerfassung |
| FA-DOK-01 | Untersuchungserfassung | Ärztliche Dokumentationspflicht |
| FA-DOK-02 | Behandlungsdokumentation | Ärztliche Dokumentationspflicht |
| FA-FIN-01 | Zahlungserfassung | Wirtschaftlicher Betrieb |
| FA-PERS-02 | RBAC | Datenschutz-Pflicht |
| NFA-SEC | Sicherheitsanforderungen | DSGVO-Pflicht |
| SA-01 | Desktop-Applikation | Haupteinsatzgerät |

### Should Have (S) – Wichtige Anforderungen
Hohes Nutzenbedürfnis, aber System funktioniert ohne.

| ID | Anforderung |
|----|-------------|
| FA-TERM-04 | Status-Workflow |
| FA-PAT-03 | Statusverwaltung |
| FA-PAT-04 | Auto-Aktenerstellung |
| FA-AKTE-03 | Validierungsqueue |
| FA-ZAHN-03 | Befund pro Zahn |
| FA-DOK-03 | Anamnesebogen |
| FA-FIN-02 | Zahlungsstatus-Tracking |
| FA-FIN-03 | Bilanzübersicht |
| FA-LEIST-01 | Leistungskatalog |
| FA-PERS-01 | Mitarbeiterdaten |
| FA-STAT-01 | Dashboard |
| NFA-USE | Usability-Anforderungen |
| NFA-PERF | Performance-Anforderungen |

### Could Have (C) – Optionale Anforderungen

| ID | Anforderung |
|----|-------------|
| FA-TERM-05 | Notfallmodus |
| FA-TERM-06 | Blockierte Zeiten |
| FA-TERM-07 | Drag-and-Drop |
| FA-AKTE-04 | PDF-Export |
| FA-DOK-04 | Dokumentenmanagement |
| FA-FIN-04 | Finanzdokumente |
| FA-FIN-05 | Monatsstatistiken |
| FA-PROD-01..03 | Produktverwaltung |
| FA-STAT-02..05 | Erweiterte Statistiken |
| NFA-INT | Integrationsanforderungen |

### Won't Have (W) – Nicht im Scope

| Anforderung | Begründung |
|-------------|-----------|
| Online-Terminbuchung durch Patienten | Kein Patientenportal vorgesehen |
| Mobile App | Desktop ist Hauptgerät |
| Mehrsprachigkeit | Nur Deutsch (Praxisumfeld) |
| KI-gestützte Diagnosevorschläge | Außerhalb des Scopes |
| Cloud-Synchronisation | Offline-Desktop-First |

## 3.2 Identifizierte Konflikte und Auflösung

### Konflikt 1: Offline vs. Mehrbenutzerbetrieb
- **Anforderung A**: SA-04 (Offline-Fähigkeit)
- **Anforderung B**: Mehrere Nutzer gleichzeitig (implizit)
- **Konflikt**: SQLite hat eingeschränkte gleichzeitige Schreibzugriffe
- **Auflösung**: SQLite WAL-Modus aktivieren → ermöglicht paralleles Lesen + serielles Schreiben. Für eine kleine Praxis (3-5 gleichzeitige Nutzer) ausreichend. Bei Bedarf: Upgrade auf lokalen PostgreSQL-Server.

### Konflikt 2: Usability vs. Sicherheit
- **Anforderung A**: NFA-USE (max 2 Klicks, schneller Zugriff)
- **Anforderung B**: NFA-SEC (RBAC, Bestätigungsdialoge)
- **Konflikt**: Sicherheitsdialoge erhöhen die Klickanzahl
- **Auflösung**: Bestätigungsdialoge nur bei destruktiven Aktionen (Löschen, Stornieren). Leseoperationen ohne Zwischenschritte. Session-Timeout 30 Min.

### Konflikt 3: Performance vs. Audit-Trail
- **Anforderung A**: NFA-PERF (<2s Ladezeit)
- **Anforderung B**: SA-05 (Audit-Trail für alle Schreiboperationen)
- **Konflikt**: Audit-Logging verlangsamt Schreiboperationen
- **Auflösung**: Asynchrones Audit-Logging in separatem Thread. Write-ahead in SQLite WAL. Audit-Daten werden nach 12 Monaten archiviert.

### Konflikt 4: Datenschutz vs. Steuerberater-Zugriff
- **Anforderung A**: NFA-DATA (Patientendaten-Schutz)
- **Anforderung B**: FA-FIN (Steuerberater braucht Finanzdaten)
- **Konflikt**: Finanzdaten referenzieren Patientennamen
- **Auflösung**: Steuerberater-Ansicht zeigt nur aggregierte Daten oder anonymisierte Patientenreferenzen. Kein Zugriff auf medizinische Daten.

## 3.3 Priorisierungsmatrix (Aufwand vs. Nutzen)

```
Nutzen ▲
  Hoch │  FA-TERM-01  FA-PAT-01   FA-AKTE-01   FA-ZAHN-01
       │  FA-TERM-03  FA-PAT-02   FA-DOK-01    RBAC
       │──────────────────────────────────────────────────
 Mittel│  FA-TERM-04  FA-FIN-03   FA-STAT-01   FA-LEIST-01
       │  FA-DOK-03   FA-AKTE-03  FA-PAT-04
       │──────────────────────────────────────────────────
Niedrig│  FA-TERM-07  FA-AKTE-04  FA-PROD-01   FA-FIN-04
       │  FA-STAT-05  NFA-INT
       └──────────────────────────────────────────────────►
         Niedrig         Mittel          Hoch        Aufwand
```
