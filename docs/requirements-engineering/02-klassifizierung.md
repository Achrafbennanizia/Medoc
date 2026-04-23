# 2. Klassifizierung und Organisation der Anforderungen

## 2.1 Klassifizierungsschema

### Nach Anforderungstyp

| Typ | Abkürzung | Beschreibung | Anzahl |
|-----|-----------|-------------|--------|
| Funktionale Anforderung | FA | Systemverhalten und Funktionen | 76 |
| Nicht-funktionale Anforderung | NFA | Qualitätsmerkmale und Randbedingungen | 16 |
| Benutzeranforderung | BA | Erwartungen aus Nutzersicht | 10 |
| Systemanforderung | SA | Technische Realisierungsvorgaben | 8 |
| ISO/Regulatorische Anforderung | NFA-PROC, NFA-DOC, NFA-DATA | Anforderungen aus ISO-Normen und DSGVO | 9 |

### Nach Funktionsbereich

```
MeDoc
├── Klinischer Bereich
│   ├── FA-TERM (Terminverwaltung)         [12 Anforderungen]
│   ├── FA-PAT  (Patientenverwaltung)      [10 Anforderungen]
│   ├── FA-AKTE (Elektronische Akte)       [11 Anforderungen]
│   ├── FA-ZAHN (Zahnschema)              [7 Anforderungen]
│   ├── FA-DOK  (Dokumentation)           [6 Anforderungen]
│   ├── FA-REZ  (Rezeptverwaltung)        [5 Anforderungen] — NEU
│   └── FA-ATT  (Attestverwaltung)        [4 Anforderungen] — NEU
├── Administrativer Bereich
│   ├── FA-FIN  (Finanzen)                [8 Anforderungen]
│   ├── FA-PROD (Produkte)                [5 Anforderungen]
│   ├── FA-LEIST (Leistungen)             [4 Anforderungen]
│   └── FA-PERS (Personal)               [7 Anforderungen]
├── System & Zugang
│   ├── FA-AUTH  (Authentifizierung)      [4 Anforderungen] — NEU
│   └── FA-EINST (Einstellungen)          [3 Anforderungen] — NEU
├── Querschnitt
│   ├── FA-STAT (Statistik)               [5 Anforderungen]
│   └── NFA-*   (Nicht-funktional)        [16 Anforderungen]
└── Regulatorik & Normen (ISO/DSGVO)
    ├── NFA-PROC (Prozesse)               [6 Anforderungen]
    ├── NFA-DOC  (Dokumentation)           [2 Anforderungen]
    ├── NFA-DATA (Datenschutz-Lifecycle)   [1 Anforderung]
    └── NFA-SEC/USE (Erweiterungen)        [3 Erweiterungen]
```

## 2.2 Benutzeranforderungen (BA)

Aus Sicht der Personas abgeleitet:

| ID | Persona | Anforderung |
|----|---------|-------------|
| BA-01 | Dr. Lehner | „Ich will die Akte eines Patienten mit 2 Klicks öffnen können" |
| BA-02 | Dr. Lehner | „Ich brauche einen schnellen Überblick über den heutigen Terminplan" |
| BA-03 | Dr. Lehner | „Das Zahnschema muss sofort zeigen, welche Zähne betroffen sind" |
| BA-04 | Dr. Lehner | „Befunde sollen strukturiert und nachvollziehbar dokumentiert werden" |
| BA-05 | Anna Scholz | „Ich will Patienten über die Suche in unter 3 Sekunden finden" |
| BA-06 | Anna Scholz | „Neue Termine sollen keine Konflikte mit bestehenden haben" |
| BA-07 | Anna Scholz | „Zahlungen erfassen soll schnell und fehlerfrei funktionieren" |
| BA-08 | Steuerberater | „Ich brauche nur Zugang zu Finanzdaten, nicht zu Patientendaten" |
| BA-09 | Pharmaberater | „Produktkatalog einsehen und Bestände prüfen" |
| BA-10 | Patient | „Meine Daten müssen sicher und datenschutzkonform gespeichert werden" |

## 2.3 Systemanforderungen (SA)

| ID | Anforderung | Begründung |
|----|-------------|-----------|
| SA-01 | Desktop-Applikation als Hauptgerät | Praxiscomputer mit großem Bildschirm |
| SA-02 | Embedded Database (SQLite) | Kein externer Datenbankserver nötig |
| SA-03 | Rollenbasierte Zugriffskontrolle (4 Rollen) | Datenschutz, DSGVO |
| SA-04 | Offline-Fähigkeit | Praxis muss ohne Internet funktionieren |
| SA-05 | Audit-Trail für alle Schreiboperationen | Nachvollziehbarkeit |
| SA-06 | Verschlüsselte lokale Datenspeicherung | Patientendaten-Schutz |
| SA-07 | Automatisches Backup-System | Datensicherheit |
| SA-08 | Mindestauflösung 1259×1024 | Praxismonitore |

## 2.4 Traceability-Matrix (Auszug)

| BA | → FA | → SA | → NFA |
|----|------|------|-------|
| BA-01 | FA-PAT-02, FA-AKTE-01 | – | NFA-USE |
| BA-02 | FA-TERM-01, FA-STAT-01 | – | NFA-PERF |
| BA-03 | FA-ZAHN-01, FA-ZAHN-02 | SA-08 | NFA-USE |
| BA-05 | FA-PAT-02 | – | NFA-PERF |
| BA-06 | FA-TERM-03 | – | NFA-USE |
| BA-08 | FA-FIN-01..05 | SA-03 | NFA-SEC |
| BA-10 | – | SA-03, SA-06 | NFA-SEC, NFA-DATA |
