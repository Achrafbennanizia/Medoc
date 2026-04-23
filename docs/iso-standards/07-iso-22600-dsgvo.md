# ISO 22600:2014 + DSGVO (EU 2016/679) – Zugriffskontrolle und Datenschutz

## Normsteckbrief – ISO 22600

| Merkmal | Beschreibung |
|---------|-------------|
| **Nummer** | ISO 22600:2014 (Teile 1-3) |
| **Titel** | Health informatics – Privilege management and access control |
| **Herausgeber** | ISO |
| **Erstveröffentlichung** | 2006, aktuelle Ausgabe: 2014 |
| **Anwendungsbereich** | Definiert Konzepte, Methoden und Technologien für Privilegienmanagement und Zugriffskontrolle in Gesundheitsinformationssystemen |
| **Relevanz für MeDoc** | **Relevant** – MeDoc implementiert RBAC für 4 Rollen mit Zugriff auf sensible Gesundheitsdaten |

### ISO 22600 – Struktur

| Teil | Titel | Inhalt |
|------|-------|--------|
| **Teil 1** | Überblick und Policy-Management | Konzepte, Terminologie, Richtlinienmanagement |
| **Teil 2** | Formale Modelle | Formale Modelle für Zugriffskontrolle (RBAC, ABAC, MAC) |
| **Teil 3** | Implementierungen | Technische Implementierungsaspekte |

### Kernanforderungen von ISO 22600 für MeDoc

#### Prinzip 1: Rollenbasierte Zugriffskontrolle (RBAC)
ISO 22600 unterstützt das RBAC-Modell als primäres Zugriffskontrollverfahren im Gesundheitswesen:

- **Rollen** werden basierend auf beruflichen Funktionen definiert
- **Berechtigungen** werden Rollen zugewiesen, nicht einzelnen Benutzern
- Das **Prinzip der minimalen Berechtigung** (Least Privilege) muss gelten
- Jeder Benutzer erhält nur die Rechte, die für seine berufliche Tätigkeit erforderlich sind

**MeDoc-Umsetzung:**

| Rolle | Berechtigungsumfang | Begründung |
|-------|---------------------|-----------|
| ARZT | Vollzugriff auf alle Bereiche | Praxisinhaber, medizinische + administrative Verantwortung |
| REZEPTION | Lesen/Schreiben: Termine, Patientenstammdaten, Zahlungen. Nur Lesen: medizinische Daten | Administrativer Bedarf, kein medizinischer Änderungsbedarf |
| STEUERBERATER | Nur Lesen: Finanzdaten (anonymisiert/aggregiert) | Steuerrechtlicher Bedarf, kein Zugang zu Patientendaten |
| PHARMABERATER | Nur Lesen: Produktkatalog | Lieferantenfunktion, kein Zugang zu Praxisdaten |

#### Prinzip 2: Kontextbasierte Zugriffsentscheidungen
ISO 22600 empfiehlt, Zugriffsentscheidungen kontextabhängig zu treffen:

- **Behandlungsbeziehung**: Arzt hat Zugriff nur auf Akten seiner eigenen Patienten (in kleiner Praxis: alle)
- **Zeitlicher Kontext**: Zugriff nur während der Arbeitszeit (optional)
- **Notfallzugriff**: Möglichkeit, in Notfällen erweiterte Rechte zu erhalten (muss protokolliert werden)

#### Prinzip 3: Trennung von Pflichten (Separation of Duties)
- Finanzielle Freigaben und medizinische Dokumentation sollten getrennt sein
- *MeDoc*: Arzt gibt Leistungen frei (FA-FIN-03), Rezeption dokumentiert Zahlungen (FA-FIN-02) – Vier-Augen-Prinzip

#### Prinzip 4: Auditierbarkeit
- Alle Zugriffsentscheidungen müssen nachvollziehbar sein
- *MeDoc*: NFA-SEC-04 (Audit-Log) protokolliert alle Aktionen mit User-ID und Zeitstempel

---

## DSGVO (EU-Datenschutz-Grundverordnung 2016/679)

### Relevanz für MeDoc

Die DSGVO ist **unmittelbar verpflichtend** für MeDoc, da das System:
- Personenbezogene Daten verarbeitet (Name, Geburtsdatum, Kontaktdaten → DSGVO Art. 4 Nr. 1)
- **Besondere Kategorien personenbezogener Daten** verarbeitet (Gesundheitsdaten → DSGVO Art. 9 Abs. 1)
- In einer Zahnarztpraxis in Deutschland eingesetzt wird (EU-Anwendungsbereich → DSGVO Art. 3)

### Zentrale DSGVO-Artikel und ihre Umsetzung in MeDoc

#### Art. 5 – Grundsätze der Datenverarbeitung

| Grundsatz | Beschreibung | MeDoc-Umsetzung |
|-----------|-------------|-----------------|
| **Rechtmäßigkeit** | Verarbeitung nur bei Rechtsgrundlage | Behandlungsvertrag (Art. 9 Abs. 2 lit. h), Einwilligung bei Anamnese |
| **Zweckbindung** | Daten nur für festgelegte Zwecke | Praxisverwaltung und Behandlungsdokumentation – kein Datensharing |
| **Datenminimierung** | Nur erforderliche Daten erheben | Pflichtfelder auf Minimum beschränkt, optionale Felder klar gekennzeichnet |
| **Richtigkeit** | Daten müssen sachlich korrekt sein | FA-AKTE-02 (Arzt-Validierung), FA-AKTE-03 (Versionierung) |
| **Speicherbegrenzung** | Nicht länger als nötig speichern | 10 Jahre Aufbewahrungspflicht (§10 MBO-Ä), danach Löschkonzept |
| **Integrität und Vertraulichkeit** | Angemessener Schutz der Daten | Verschlüsselung (SQLCipher), RBAC, Audit-Log, Backup |

#### Art. 9 – Verarbeitung besonderer Kategorien (Gesundheitsdaten)

Gesundheitsdaten dürfen nur verarbeitet werden, wenn eine der Ausnahmen des Art. 9 Abs. 2 greift:

- **Art. 9 Abs. 2 lit. h)**: Verarbeitung ist erforderlich für **Zwecke der Gesundheitsversorgung** auf der Grundlage des Unionsrechts oder nationalen Rechts → Behandlungsvertrag zwischen Arzt und Patient
- Zusätzliche Maßnahme: **Besonderer Schutz** durch technische und organisatorische Maßnahmen (Art. 9 Abs. 3)

**MeDoc-Maßnahmen:**
- Verschlüsselte Datenspeicherung (SQLCipher/AES-256)
- RBAC mit strikter Trennung (Steuerberater/Pharmaberater: kein Zugriff auf Gesundheitsdaten)
- Audit-Log aller Zugriffe
- Passwortgeschützter Login

#### Art. 17 – Recht auf Löschung („Recht auf Vergessenwerden")

| Aspekt | Regelung | MeDoc-Umsetzung |
|--------|---------|-----------------|
| Löschpflicht | Daten müssen auf Antrag gelöscht werden, sofern keine Aufbewahrungspflicht besteht | Löschfunktion für Patientenstammdaten (nach Ablauf der Aufbewahrungsfrist) |
| Aufbewahrungspflicht | Ärztliche Dokumentation: 10 Jahre (§630f Abs. 3 BGB) | Patientenakten können erst nach 10 Jahren gelöscht werden → System muss dies erzwingen |
| Ausnahme | Löschung ist nicht möglich während laufender Aufbewahrungspflicht | Löschsperre für Akten innerhalb der 10-Jahres-Frist |

#### Art. 25 – Datenschutz durch Technikgestaltung (Privacy by Design)

| Prinzip | MeDoc-Umsetzung |
|---------|-----------------|
| **Privacy by Design** | Datenschutz ist im System-Design verankert: RBAC, Verschlüsselung, minimale Datenerhebung |
| **Privacy by Default** | Standardeinstellungen maximieren den Datenschutz: minimale Berechtigungen, kein automatischer Export |

#### Art. 30 – Verzeichnis von Verarbeitungstätigkeiten

MeDoc verarbeitet folgende Datenkategorien:

| Datenkategorie | Betroffene | Rechtsgrundlage | Löschfrist |
|---------------|-----------|-----------------|------------|
| Patientenstammdaten | Patienten | Art. 9(2)(h) DSGVO | 10 Jahre nach letzter Behandlung |
| Gesundheitsdaten (Befunde, Diagnosen) | Patienten | Art. 9(2)(h) DSGVO | 10 Jahre nach letzter Behandlung |
| Anamnesedaten | Patienten | Art. 9(2)(h) DSGVO | 10 Jahre nach letzter Behandlung |
| Finanzdaten | Patienten, Praxis | Art. 6(1)(b) DSGVO | 10 Jahre (§147 AO) |
| Personaldaten | Mitarbeiter | Art. 6(1)(b) DSGVO | 3 Jahre nach Ausscheiden |
| Audit-Log-Daten | Benutzer | Art. 6(1)(f) DSGVO | 10 Jahre |

#### Art. 32 – Sicherheit der Verarbeitung

Der Verantwortliche muss **technische und organisatorische Maßnahmen** (TOM) implementieren:

| TOM-Kategorie | Maßnahme | MeDoc-Umsetzung |
|---------------|----------|-----------------|
| Pseudonymisierung | Nicht direkt anwendbar (Arzt muss Patient identifizieren) | Steuerberater-Ansicht: anonymisierte/aggregierte Daten |
| Verschlüsselung | Ruhende Daten verschlüsseln | SQLCipher (AES-256) |
| Vertraulichkeit | Zugriff nur für Berechtigte | RBAC, Passwort-Login, Session-Timeout |
| Integrität | Schutz vor unbefugter Änderung | Audit-Log, Versionierung, Validierungspflicht |
| Verfügbarkeit | Daten müssen verfügbar sein | Tägliches Backup, SQLite WAL, Offline-Fähigkeit |
| Belastbarkeit | Widerstandsfähigkeit gegen Störungen | Desktop-App (kein Netzwerk nötig), SQLite ACID |
| Wiederherstellbarkeit | Rasche Wiederherstellung nach Störung | Automatisches Backup mit dokumentiertem Wiederherstellungsprozess |

#### Art. 33/34 – Meldepflicht bei Datenschutzverletzungen

| Pflicht | Frist | MeDoc-Unterstützung |
|---------|-------|---------------------|
| Meldung an Aufsichtsbehörde | 72 Stunden | Audit-Log ermöglicht schnelle Feststellung des Vorfallsumfangs |
| Benachrichtigung Betroffener | Unverzüglich (bei hohem Risiko) | Audit-Log: Welche Daten betroffen, wann letzter Zugriff |

## Abgeleitete Anforderungen für MeDoc

| ID | Anforderung | Normbezug | Priorität |
|----|-------------|-----------|-----------|
| ISO-22600-01 | RBAC muss nach dem Prinzip der minimalen Berechtigung implementiert sein; jede Rolle erhält nur die für ihre Tätigkeit erforderlichen Rechte | ISO 22600, DSGVO Art. 25 | MUST |
| ISO-22600-02 | Finanzielle Freigabe (Arzt) und Zahlungsdokumentation (Rezeption) müssen als getrennte Prozesse implementiert sein (Separation of Duties) | ISO 22600 | MUST |
| ISO-22600-03 | Steuerberater dürfen keinen Zugriff auf identifizierbare Patientengesundheitsdaten erhalten; Finanzdaten müssen anonymisiert/aggregiert angezeigt werden | ISO 22600, DSGVO Art. 9 | MUST |
| DSGVO-01 | Patientendaten dürfen nur für den dokumentierten Zweck (Praxisverwaltung, Behandlungsdokumentation) verarbeitet werden (Zweckbindung) | DSGVO Art. 5(1)(b) | MUST |
| DSGVO-02 | Nur die für die Behandlung/Verwaltung erforderlichen Daten dürfen erhoben werden; Pflichtfelder auf Minimum beschränkt (Datenminimierung) | DSGVO Art. 5(1)(c) | MUST |
| DSGVO-03 | Die Datenbank muss mit AES-256 verschlüsselt sein; Passwörter müssen gehasht gespeichert werden (Integrität und Vertraulichkeit) | DSGVO Art. 5(1)(f), Art. 32 | MUST |
| DSGVO-04 | Patientenakten dürfen innerhalb der 10-jährigen Aufbewahrungspflicht (§630f Abs. 3 BGB) nicht gelöscht werden; danach muss eine Löschung möglich sein | DSGVO Art. 17, §630f BGB | MUST |
| DSGVO-05 | Privacy by Design: Datenschutzmaßnahmen (RBAC, Verschlüsselung, Datenminimierung) müssen im System-Design verankert sein, nicht nachträglich hinzugefügt | DSGVO Art. 25 | MUST |
| DSGVO-06 | Ein Verzeichnis der Verarbeitungstätigkeiten muss geführt werden (Dokumentation der verarbeiteten Datenkategorien, Rechtsgrundlagen, Löschfristen) | DSGVO Art. 30 | MUST |
| DSGVO-07 | Das Audit-Log muss bei einer Datenschutzverletzung die Feststellung des Vorfallsumfangs innerhalb von 72 Stunden ermöglichen | DSGVO Art. 33 | MUST |
| DSGVO-08 | Die Software muss den Export personenbezogener Daten in einem maschinenlesbaren Format ermöglichen (Recht auf Datenübertragbarkeit) | DSGVO Art. 20 | SHOULD |
