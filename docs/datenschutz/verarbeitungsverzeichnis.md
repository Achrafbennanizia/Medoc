# Verzeichnis von Verarbeitungstätigkeiten (VVT)

**Standard-Bezug:** DSGVO Art. 30 (NFA-DOC-02)
**Stand:** 2026-04-19
**Verantwortlich:** MeDoc GmbH (Auftraggeber: Praxis als Verantwortliche/r)

> Hinweis: MeDoc als lokale Software speichert keine Daten zentral. Die Praxis
> ist „Verantwortliche/r" im Sinne der DSGVO; MeDoc GmbH ist Hersteller, kein
> Auftragsverarbeiter. Dieses VVT bildet die durch MeDoc unterstützten
> Verarbeitungen ab und dient der Praxis als Vorlage.

---

## 1. Allgemeine Angaben

| Feld | Inhalt |
|------|--------|
| Verantwortliche/r | <Praxisname>, <Anschrift> (von der Praxis auszufüllen) |
| Datenschutzbeauftragte/r | <Name, Kontakt> |
| Vertreter:in (falls EU-extern) | – |
| Erstellt am | 2026-04-19 |
| Letzte Änderung | 2026-04-19 |

---

## 2. Verarbeitungstätigkeiten

### 2.1 Patientenstammdaten und Behandlungsdokumentation

| Feld | Inhalt |
|------|--------|
| Bezeichnung | Verwaltung Patientenakten |
| Zweck | Erfüllung Behandlungsvertrag, Dokumentationspflicht §630f BGB |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b und c DSGVO; Art. 9 Abs. 2 lit. h DSGVO; §630f BGB |
| Datenkategorien | Name, Geburtsdatum, Geschlecht, Anschrift, Versicherungsnummer, Telefon, E-Mail, Diagnosen, Befunde, Behandlungen, Röntgenbilder, Anamnese |
| Betroffene | Patient:innen der Praxis |
| Empfänger | Behandelnde Ärzt:innen, ggf. Mit-/Weiterbehandelnde nach Einwilligung; Steuerberater (anonymisierte Finanzdaten) |
| Drittland-Übermittlung | Keine |
| Löschfristen | 30 Jahre (§630f Abs. 3 BGB; Sondervorschriften beachten) |
| TOM (Technisch-Organisatorisch) | RBAC, Audit-Log mit HMAC-Kette, Argon2-Passworthashes, lokale Datenhaltung, OS-Zugriffsrechte, tägliches Backup, Bildschirmsperre |

### 2.2 Termin- und Kalenderverwaltung

| Feld | Inhalt |
|------|--------|
| Zweck | Terminkoordination |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO |
| Datenkategorien | Name, Telefon/E-Mail, Termin-Anlass |
| Empfänger | Praxispersonal |
| Löschfristen | 3 Jahre nach Terminabsage / Behandlungsende |
| TOM | RBAC, Audit-Log |

### 2.3 Abrechnung und Zahlungen

| Feld | Inhalt |
|------|--------|
| Zweck | Honorarforderungen, Steuer- und Buchhaltungspflichten |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b und c DSGVO; §147 AO; HGB |
| Datenkategorien | Name, Anschrift, Leistungspositionen, Beträge, Zahlungsstatus |
| Empfänger | Patient:in, Steuerberatung, ggf. Inkasso (separate Vereinbarung) |
| Löschfristen | 10 Jahre (HGB/AO) |
| TOM | RBAC, PDF-Rechnungs-Export, Audit-Log |

### 2.4 Personal- und Benutzerkonten

| Feld | Inhalt |
|------|--------|
| Zweck | Anmeldung am System, Zugriffsdokumentation |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b und f DSGVO |
| Datenkategorien | Benutzername, Rolle, Passwort-Hash, letzter Login, Anmelde-Audit |
| Empfänger | Praxis-Administration |
| Löschfristen | Bis 6 Jahre nach Beendigung Beschäftigungsverhältnis |
| TOM | Argon2id-Hash, Brute-Force-Sperre, individuelle Konten, Passwort-Wechsel |

### 2.5 Audit-Logs (NFA-SEC-04)

| Feld | Inhalt |
|------|--------|
| Zweck | Manipulationssicherer Nachweis von Datenzugriffen und -änderungen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. c DSGVO; ISO 27799; §10 MBO-Ä |
| Datenkategorien | Benutzer-ID, Aktion, Entität, Zeitstempel, HMAC, Signatur |
| Empfänger | Praxisleitung, Datenschutzbeauftragte/r |
| Löschfristen | Klinische Logs 30 Jahre, Finanz-Logs 10 Jahre, Auth/Security 6 Jahre, System/Error 1 Jahr (siehe `infrastructure/retention.rs`) |
| TOM | HMAC-Kette + ed25519-Signatur, kein UI-Löschpfad |

### 2.6 Notfallzugriff (Break-Glass)

| Feld | Inhalt |
|------|--------|
| Zweck | Lebenswichtiger Zugriff außerhalb regulärer Berechtigung |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. d DSGVO (lebenswichtiges Interesse); Art. 9 Abs. 2 lit. c DSGVO |
| Datenkategorien | Auslöser:in, Begründung, Zeitfenster (15 min), aufgerufene Akten |
| Empfänger | Datenschutzbeauftragte/r (Pflichtbenachrichtigung) |
| Löschfristen | 30 Jahre (zusammen mit Audit-Log) |
| TOM | Zwei-Faktor-Begründung, Auto-Ablauf, Audit |

---

## 3. Allgemeine technische und organisatorische Maßnahmen (Art. 32 DSGVO)

| Bereich | Maßnahme |
|---------|----------|
| Vertraulichkeit | RBAC (4 Rollen), starke Passwörter, Argon2id-Hash, Bildschirmsperre, lokale Daten ohne Cloud |
| Integrität | HMAC-Audit-Kette, ed25519-Signatur, PRAGMA integrity_check beim Backup |
| Verfügbarkeit | Tägliches automatisches Backup, validiert; Restore-Anleitung |
| Belastbarkeit | Single-User-Praxis-Last bewältigt, Smoke-Test <2s |
| Wiederherstellbarkeit | Restore-Übung quartalsweise (siehe `wartungsplan.md`) |
| Verfahren zur Überprüfung | Audit-Chain-Verifikation, `verify_audit_chain`-Befehl |
| Pseudonymisierung | DSGVO-Löschanfrage pseudonymisiert Stammdaten unter Beibehaltung der klinischen ID |
| Verschlüsselung | OS-Festplattenverschlüsselung (BitLocker / FileVault / LUKS) **dringend empfohlen** |

---

## 4. Betroffenenrechte
- Art. 15 (Auskunft): `dsgvo_export_patient` liefert JSON-Export.
- Art. 16 (Berichtigung): UI-Pfade für Korrekturen.
- Art. 17 (Löschung): `dsgvo_request_erasure` pseudonymisiert; klinische Daten bleiben bis Aufbewahrungsfrist.
- Art. 18 (Einschränkung): Patientenstatus `READONLY`.
- Art. 20 (Datenübertragbarkeit): JSON-Export aus Auskunftsrecht.
- Art. 21 (Widerspruch): Manuelle Behandlung durch DSB.

## 5. Aktualisierungspflicht
Das VVT wird **mindestens jährlich** und bei jeder wesentlichen Änderung der
Verarbeitung aktualisiert.
