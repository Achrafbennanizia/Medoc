# MeDoc – Benutzerhandbuch

**Version:** 0.1.0
**Stand:** 2026-04-19
**Zielgruppe:** Praxispersonal (Ärzt:innen, Rezeption, Steuerberatung, Pharmaberatung)
**Standard-Bezug:** IEC 62304 §5.7, IEC 82304-1 §5.4 (NFA-DOC-01)

---

## 1. Zweck und Anwendung

MeDoc ist ein **lokales Praxisverwaltungssystem (PVS)** für Zahnarztpraxen.
Es verwaltet Patientendaten, Termine, Behandlungen, Rezepte, Atteste,
Abrechnungen, Personal und gesetzlich vorgeschriebene Audit-Logs.

**Zweckbestimmung (gemäß MDR Artikel 2):**
MeDoc ist ein nicht-medizinisches Verwaltungswerkzeug. Es trifft keine
diagnostischen Entscheidungen und ist **kein** Medizinprodukt nach MDR.
Das System unterstützt lediglich die Dokumentation klinischer
Beobachtungen, die durch zugelassenes Fachpersonal erstellt werden.

---

## 2. Systemvoraussetzungen

| Element | Mindestanforderung | Empfohlen |
|---------|-------------------|-----------|
| Betriebssystem | Windows 10 / macOS 12 / Ubuntu 22.04 | Windows 11, macOS 14, Ubuntu 24.04 |
| RAM | 4 GB | 8 GB |
| Speicher | 500 MB Programm + 1 GB Daten | 5 GB Daten |
| Bildschirm | 1366×768 | 1920×1080 |
| Berechtigung | Lokales Benutzerkonto mit Schreibrechten auf `~/medoc-data/` | – |

Eine Internetverbindung ist für den **lokalen Kernbetrieb** nicht erforderlich; sämtliche Patientendaten bleiben standardmäßig **lokal**. Optionale Funktionen gemäß Produktpflichtenheft (z. B. Lizenzvalidierung, Update-Server, Zahlungsabwicklung für Abonnements oder LAN-Gast-Clients) können ein zeitweiliges Internet bzw. ein Praxis-LAN erfordern — siehe **`docs/v-model/01-anforderungen/pflichtenheft.md`** und **`docs/v-model/02-systementwurf/systementwurf.md`**.

---

## 3. Installation

### 3.1 Erstinstallation

1. **Installer ausführen** (`MeDoc-Setup-x.y.z.exe` / `.dmg` / `.AppImage`).
2. Bei der ersten Ausführung legt MeDoc das Datenverzeichnis
   `~/medoc-data/` an mit den Unterordnern:
   - `db/` – SQLite-Datenbank (verschlüsselt durch OS-Berechtigungen)
   - `logs/` – 7 Audit-Channels (siehe §7)
   - `backups/` – tägliche Backups (siehe §6)
3. Beim ersten Start wird ein **Initial-Admin** angelegt. Notieren Sie das
   Passwort sicher; es kann nicht wiederhergestellt werden.

### 3.2 Update

Updates werden manuell installiert (kein Auto-Update aus Sicherheitsgründen).
Die Datenbank wird automatisch migriert. Vor jedem Update wird ein Backup
erstellt.

### 3.3 Deinstallation

- Programm über das OS deinstallieren.
- **Wichtig:** `~/medoc-data/` enthält Patientendaten und wird **nicht**
  automatisch entfernt. Für DSGVO-konforme Löschung manuell entfernen
  (`shred` / Secure-Erase empfohlen).

---

## 4. Anmelden und Rollen

### 4.1 Anmeldung

1. MeDoc starten.
2. Benutzername und Passwort eingeben.
3. **Brute-Force-Schutz (NFA-SEC-03):** Schlagen **mehr als fünf** Anmeldeversuche
   mit demselben Benutzernamen (E-Mail) **innerhalb von 10 Minuten** fehl, wird die
   Anmeldung für **15 Minuten** gesperrt (der **sechste** fehlgeschlagene Versuch
   in diesem Fenster löst die Sperre aus).

### 4.2 Rollen und Berechtigungen

| Rolle | Funktionsumfang |
|-------|-----------------|
| **Arzt** | Vollzugriff auf Patientenakten, Diagnosen, Befunde, Rezepte, Atteste |
| **Rezeption** | Patienten-Stammdaten, Termine, Zahlungen (keine medizinischen Inhalte) |
| **Steuerberater** | Lesezugriff auf Abrechnungen und Rechnungen |
| **Pharmaberater** | Lesezugriff auf Produktkatalog (Navigation wie in der App) |

Die Rollenmatrix ist unter [`docs/rbac-matrix.md`](rbac-matrix.md) dokumentiert (Auszug aus dem Code).

### 4.3 Passwort ändern (FA-EINST-02)

Menü → **Einstellungen → Passwort**. Mindestens 8 Zeichen.
Das alte Passwort muss verifiziert werden. Vorgang wird auditiert.

### 4.4 Notfallzugriff (Break-Glass)

Bei akuten klinischen Notfällen kann ein Arzt einen **zeitlich begrenzten**
**erweiterten Zugriff** anfordern (Sidebar unten: Schaltfläche „Notfallzugriff"). Jede
Aktivierung wird mit Begründung im manipulationssicheren Audit-Log
festgehalten und an den Datenschutzbeauftragten gemeldet.

---

## 5. Tägliche Arbeitsabläufe

### 5.1 Patient anlegen
**Patienten → Neu**. Pflichtfelder: Name, Geburtsdatum, Geschlecht,
Versicherungsnummer (10-stellig).

### 5.2 Termin buchen
**Termine → Neu**. Konflikt-Erkennung läuft automatisch.

### 5.3 Behandlung dokumentieren
**Patienten → Patient öffnen → Behandlung hinzufügen** (Abschnitt Behandlungen). Erfassung von Art, Freitext, beteiligten Zähnen und Material; BEMA/ICD-Codierung wird im Alltag manuell bzw. aus Fachkatalogen ergänzt.

### 5.4 Rezept ausstellen (FA-REZ)
**Menü → Rezepte → Neu** (Patient im Formular auswählen). Nur Ärzt:innen. Felder: Medikament,
Wirkstoff, Dosierung, Dauer, Hinweise.

### 5.5 Attest ausstellen (FA-ATT)
**Menü → Atteste → Neu** (Patient auswählen). Nur Ärzt:innen. Gültigkeitszeitraum
(Von/Bis) wird validiert.

### 5.6 Rechnung erstellen
**Menü → Finanzen → Rechnung als PDF**. PDF-Erzeugung (FA-FIN-INVOICE) über
diesen Dialog (Empfänger, Positionen, Praxisdaten).

### 5.7 Patientenakte als PDF exportieren (FA-AKTE-04)
**Patienten → Patient öffnen → PDF exportieren** (Schaltfläche neben dem Namen). Erzeugt eine vollständige
PDF-Übersicht (Stammdaten, Diagnose, Befunde, Behandlungs-Historie).
Vorgang wird mit Verb `EXPORT_PDF` auditiert.

---

## 6. Backup und Wiederherstellung (NFA-SEC-05)

### 6.1 Automatisches Backup
MeDoc erstellt **alle 24 Stunden** ein vollständiges Datenbank-Backup
in `~/medoc-data/backups/`. Backups werden mit Zeitstempel benannt:
`medoc-backup-YYYY-MM-DD-HHMMSS.db`.

### 6.2 Manuelles Backup
**Menü → Betrieb & Datenmanagement (Ops) → Backup jetzt erstellen**.

### 6.3 Backup validieren
Jedes Backup wird automatisch über `backup::validate` auf Integrität
geprüft (PRAGMA integrity_check). Ergebnis im Audit-Log.

### 6.4 Wiederherstellung
1. MeDoc beenden.
2. Backup-Datei als aktive Datenbank zurückspielen (Zieldatei wie von der Installation verwendet — häufig `~/medoc-data/db/medoc.db`; in der produktnahen Spezifikation auch **`praxis.db`** genannt, siehe Pflichtenheft NFA-SEC-08).
3. MeDoc neu starten.

**Empfehlung:** Zusätzlich täglich ein verschlüsseltes Offsite-Backup
(z. B. verschlüsselte externe Festplatte, gemäß Praxis-Backup-Konzept).

---

## 7. Audit-Logs und Compliance

MeDoc führt **7 separate Audit-Channels** (NFA-LOG-01..07):

| Channel | Inhalt |
|---------|--------|
| `system` | Start/Stop, Konfiguration |
| `auth` | Login/Logout, Fehlversuche |
| `clinical` | Patientendaten-Zugriffe, Diagnosen |
| `billing` | Zahlungen, Rechnungen |
| `admin` | Personal-Mutationen |
| `security` | Break-Glass, RBAC-Verletzungen |
| `error` | Unbehandelte Ausnahmen |

Datenbank-Einträge in `audit_log` werden durch eine **HMAC-SHA256-Kette**
 gegen unbemerkte Änderungen geschützt (NFA-SEC-04). Lizenz-/Integritätsprüfungen
können zusätzlich **Ed25519** nutzen (`license`-Modul). Validierung der Audit-Kette über
**Menü → Logs → Audit-Kette prüfen** (die Compliance-Seite enthält zusätzlich VVT, DSFA und Log-Retention).

Logs werden gemäß Aufbewahrungsfristen rotiert
(`infrastructure/retention.rs`):
- Klinische Logs: **30 Jahre** (Patientenakten-Frist)
- Finanz-Logs: **10 Jahre** (HGB)
- Auth/Security: **6 Jahre**
- System/Error: **1 Jahr**

---

## 8. Datenschutz (DSGVO)

- **Recht auf Auskunft (Art. 15):** Menü → **Datenschutz → Auskunft exportieren** (Patient auswählen).
- **Recht auf Löschung (Art. 17):** Menü → **Datenschutz → Löschanfrage**. Hinweis: Klinische Daten unterliegen ärztlicher Aufbewahrungspflicht (30 Jahre § 630f BGB) und werden erst nach Fristablauf gelöscht.
- **Datenportabilität (Art. 20):** Auskunfts-Export erfolgt im JSON-Format.
- **Auftragsverarbeitung:** MeDoc verarbeitet keine Daten extern – kein AVV erforderlich.

---

## 9. Fehlerbehebung

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| „Anmeldung gesperrt" | 5 Fehlversuche | 15 Minuten warten oder Admin entsperrt das Konto |
| „Berechtigung fehlt" | Falsche Rolle | Admin kontaktieren |
| MeDoc startet nicht | DB-Datei beschädigt | Letztes Backup einspielen (§6.4) |
| Audit-Chain ungültig | Manipulationsversuch oder Disk-Korruption | IT-Verantwortlichen sofort informieren |
| PDF-Export schlägt fehl | Speicher voll oder Schreibrechte | Festplattenplatz prüfen |
| Backup wird nicht erstellt | Anwendung läuft <24 h am Stück | Manuelles Backup via Menü erstellen |

Detaillierte Fehler-IDs werden in `~/medoc-data/logs/error.log` protokolliert.

---

## 10. Sicherheitshinweise

- Nutzen Sie **starke Passwörter** (≥12 Zeichen, gemischt). Passwort-Manager empfohlen.
- Sperren Sie den Arbeitsplatz bei Verlassen (`Win+L` / `Cmd+Ctrl+Q`).
- Geben Sie Ihre Zugangsdaten **niemals** weiter.
- Melden Sie Sicherheitsvorfälle innerhalb 24 h an den Datenschutzbeauftragten und die zuständige Aufsichtsbehörde (DSGVO Art. 33).
- MeDoc darf **nicht** über öffentliche Netze (Internet) erreichbar sein.

---

## 11. Support und Kontakt

- **Fachlicher Support:** support@medoc.local
- **Datenschutzbeauftragter:** dsb@medoc.local
- **Notfall (Sicherheitsvorfall):** Telefon 24/7 unter +49-XXX-XXXXXXX

---

## 12. Lizenz und Versionshistorie

MeDoc ist proprietäre Software von MeDoc GmbH. Drittanbieter-Komponenten
sind in `docs/iso-standards/09-soup-liste.md` mit Lizenzen aufgeführt.

| Version | Datum | Wesentliche Änderungen |
|---------|-------|------------------------|
| 0.1.0 | 2026-04-19 | Initiale Auslieferung |
