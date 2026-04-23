# 4. Spezifikation der Anforderungen

**Traceability:** Verbindliche Anforderungs-IDs und vollständiger Umfang stehen im **Pflichtenheft** (`docs/v-model/01-anforderungen/pflichtenheft.md`). Dieses Kapitel ist eine **kompakte Ableitung** aus der Bachelorarbeit/Frühphase; Abweichungen bei gleichen **FA-\***-Kürzeln werden zugunsten des Pflichtenhefts aufgelöst.

**RBAC:** Die Matrix unten trennt **Stammdaten/administrativ** von **medizinischen Daten** konsistent mit **NFA-SEC-02** (siehe `docs/rbac-matrix.md`).

## 4.1 Benutzer- und Systemanforderungen

### Terminverwaltung

**BA**: „Als Rezeptionsmitarbeiterin will ich Termine schnell und konfliktfrei anlegen können."

| ID | Systemanforderung | Akzeptanzkriterium |
|----|------------------|--------------------|
| FA-TERM-01 | Kalender zeigt Tages-/Wochen-/Monatsansicht mit farbkodierten Terminen | Alle drei Ansichten rendern in <1s |
| FA-TERM-02 | Terminformular mit Pflichtfeldern: Patient, Arzt, Datum, Uhrzeit, Art | Validierung verhindert unvollständige Eingaben |
| FA-TERM-03 | System prüft bei Anlage/Änderung auf Überschneidung (Arzt+Zeit) | Fehlermeldung bei Konflikt, kein Speichern möglich |
| FA-TERM-04 | Termin durchläuft Status: ANGEFRAGT→BESTÄTIGT→DURCHGEFÜHRT→ABGESCHLOSSEN | Statusübergänge nur in definierter Reihenfolge |

### Patientenverwaltung

**BA**: „Als Rezeptionsmitarbeiterin will ich Patienten per Namenssuche in <3s finden."

| ID | Systemanforderung | Akzeptanzkriterium |
|----|------------------|--------------------|
| FA-PAT-01 | Patientenstammdaten: Name, Geburtsdatum, Geschlecht, VNR, Kontaktdaten | Alle Pflichtfelder validiert |
| FA-PAT-02 | Fuzzy-Suche über alle Patientennamen | Ergebnis bei 1000+ Patienten in <500ms |
| FA-PAT-03 | Patient-Status-Workflow: NEU→AKTIV→VALIDIERT→READONLY | Status nur durch berechtigte Rollen änderbar |
| FA-PAT-04 | Bei Neuanlage wird automatisch Patientenakte erstellt | Akte existiert sofort nach Speichern |

### Zahnschema

**BA**: „Als Zahnarzt will ich sofort sehen, welche Zähne behandelt werden müssen."

| ID | Systemanforderung | Akzeptanzkriterium |
|----|------------------|--------------------|
| FA-ZAHN-01 | Interaktive SVG-Darstellung aller 32 Zähne (FDI 11-48) | Alle Zähne klickbar, Ober-/Unterkiefer |
| FA-ZAHN-02 | 8 Befundfarben: Gesund(grün), Kariös(rot), Gefüllt(blau), Krone(lila), Brücke(gelb), Fehlend(grau), Implantat(cyan), Wurzelbehandlung(pink) | Farben sofort unterscheidbar |
| FA-ZAHN-03 | Befund, Diagnose, Notizen pro Zahn speichern/aktualisieren | Upsert-Logik (Anlage oder Update) |

### Finanzverwaltung

| ID | Systemanforderung | Akzeptanzkriterium |
|----|------------------|--------------------|
| FA-FIN-01 | Zahlung: Patient, Betrag, Art (Bar/Karte/Überweisung), opt. Leistung | Betrag >0, Zahlungsart Pflicht |
| FA-FIN-02 | Zahlungsstatus: OFFEN→BEZAHLT / STORNIERT | Statusänderung auditiert |
| FA-FIN-03 | Bilanz: Einnahmen vs. Ausgaben mit Saldo | Berechnung in Echtzeit |

### Rollenbasierte Zugriffskontrolle

| Ressource | ARZT | REZEPTION | STEUERBERATER | PHARMABERATER |
|-----------|------|-----------|---------------|---------------|
| Dashboard | CRUD | CR | R (nur Finanzen) | – |
| Termine | CRUD | CRUD | – | – |
| Patient – Stammdaten / administrative Daten | CRUD | CRUD | – | – |
| Patient – **medizinische** Akte (schreiben) | CRUD | – | – | – |
| Patient – medizinische Daten (lesen) | R | R | – | – |
| Akte validieren | U | – | – | – |
| Finanzen | CRUD | CR | R | – |
| Leistungen | CRUD | R | R | – |
| Produkte | CRUD | CR | – | R |
| Personal | CRUD | R | – | – |
| Audit-Log | R | – | – | – |
| Statistiken | R | R | R (Finanzen) | – |

## 4.2 Systemmodelle

Siehe UML-Diagramme unter `docs/uml/`:
- Klassendiagramm: Datenmodell und Beziehungen
- Use-Case-Diagramm: Akteure und Anwendungsfälle
- Sequenzdiagramm: Interaktionsabläufe
- Aktivitätsdiagramm: Geschäftsprozesse
- Komponentendiagramm: Systemmodule
- Verteilungsdiagramm: Deployment-Architektur
- Objektdiagramm: Systemzustand-Snapshot
