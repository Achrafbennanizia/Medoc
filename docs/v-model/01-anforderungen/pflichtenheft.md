# Phase 1: Anforderungsanalyse (Pflichtenheft)

## 1. Einleitung

### 1.1 Zweck
Dieses Pflichtenheft beschreibt alle funktionalen und nicht-funktionalen Anforderungen
an das Praxismanagementsystem **MeDoc** für Zahnarztpraxen. Es basiert auf der
Bachelorarbeit von Bennani Ziatni Achraf (HS Koblenz, 2025) und dient als verbindliche
Grundlage für die Implementierung im V-Modell.

### 1.2 Geltungsbereich
Das System adressiert kleine bis mittlere Zahnarztpraxen mit 1–3 Ärzten,
1–2 Rezeptionist:innen und externen Partnern (Steuerberater, Pharmaberater).
MeDoc wird von einem Unternehmen (Hersteller) als kommerzielle Desktop-Software
mit **monatlichem Abonnement** vertrieben. Die Praxisdaten verbleiben lokal
(DSGVO-konform), die Lizenzvalidierung und Zahlungsabwicklung erfolgen über
zentrale Hersteller-Server.

### 1.3 Referenzen
- ISO 9241-210:2019 (Nutzerzentrierte Gestaltung)
- ISO 9241-110:2020 (Interaktionsprinzipien)
- ISO 9241-11:2018 (Usability)
- IEC 62304:2006+AMD1:2015 (Medizingeräte-Software – Lebenszyklusprozesse)
- ISO 14971:2019 (Risikomanagement für Medizinprodukte)
- IEC 82304-1:2016 (Gesundheitssoftware – Produktsicherheit)
- ISO/IEC 27001:2022 (Informationssicherheits-Managementsysteme)
- ISO 27799:2016 (Informationssicherheit im Gesundheitswesen)
- ISO/IEC 25010:2011 (Software-Qualitätsmodell SQuaRE)
- ISO 22600:2014 (Zugriffskontrolle im Gesundheitswesen)
- DSGVO / EU 2016/679 (Datenschutz-Grundverordnung)
- Nielsen, J. (1993) — 10 Usability-Heuristiken
- Bachelorarbeit Bennani Ziatni Achraf, HS Koblenz, SS 2025
- Vollständige ISO-Analyse: `docs/iso-standards/`

---

## 2. Benutzerrollen

| Rolle | Kürzel | Typ | Beschreibung |
|-------|--------|-----|-------------|
| Arzt/Administrator | ARZT | Primär | Praxisinhaber, medizinische + administrative Verantwortung |
| Rezeptionist:in | REZ | Primär | Patientenaufnahme, Terminvergabe, Zahlungsdokumentation |
| Steuerberater:in | STB | Sekundär | Zugriff auf Finanzdokumente, Jahresabschluss |
| Pharmaberater:in | PHB | Tertiär | Produktkataloge, Bestellabwicklung |

---

## 3. Funktionale Anforderungen

### 3.1 Terminverwaltung (FA-TERM)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-TERM-01 | Termine anlegen, bearbeiten, verschieben, löschen mit Konfliktprüfung | MUST | Doppelbuchung wird verhindert und Warnung angezeigt |
| FA-TERM-02 | Visueller Kalender mit Tag/Woche/Monat/Jahr-Ansicht | MUST | Alle Ansichten sind wechselbar; Termine farblich nach Typ kodiert |
| FA-TERM-03 | Terminstatus-Lebenszyklus: angefragt → bestätigt → durchgeführt → abgeschlossen / storniert | MUST | Statusübergänge sind nur in definierter Reihenfolge möglich |
| FA-TERM-04 | Notfall-Terminmodus mit Sofort-Eingabe und Prioritätsflag | MUST | Notfalltermin in < 3 Klicks erstellbar |
| FA-TERM-05 | Langfristige Terminplanung (Wochen/Monate voraus) | SHOULD | Kalender navigierbar über Monate/Jahre |
| FA-TERM-06 | Arzt kann Tage/Zeiten blockieren (Nichtverfügbarkeit) | MUST | Rezeption kann keine Termine auf blockierten Slots vergeben |
| FA-TERM-07 | Benachrichtigung bei Terminänderung mit Alternativvorschlägen | MUST | Systemmeldung wird automatisch generiert |
| FA-TERM-08 | Filterbare Terminübersicht für Arzt | SHOULD | Filter nach Datum, Patient, Typ, Status |
| FA-TERM-09 | Termin mit Patientenakte verknüpft | MUST | Klick auf Termin öffnet zugehörige Akte |
| FA-TERM-10 | Patientensuche im Kalender | MUST | Suchfeld mit Autovervollständigung |
| FA-TERM-11 | SMS/E-Mail Terminerinnerung | SHOULD | Optional aktivierbar pro Patient |
| FA-TERM-12 | Farbkodierung der Termine nach Behandlungsart (Untersuchung, Behandlung, Kontrolle, Notfall) mit farbigen Balken im Formular | MUST | Jeder Termintyp hat eine eindeutige Farbe, sichtbar in Kalender und Formular |
| FA-TERM-13 | Zeitslot-Auswahl im Terminformular mit visueller Hervorhebung (verfügbar/belegt) | MUST | Belegte Zeitslots ausgegraut; verfügbare klickbar |
| FA-TERM-14 | Arztauswahl-Dropdown und Patientensuche mit Autovervollständigung im Terminformular | MUST | Dropdown zeigt alle verfügbaren Ärzte; Patientenname-Suche liefert Vorschläge ab 2 Zeichen |
| FA-TERM-15 | Bestätigungsdialog bei Terminänderung („Änderung bestätigen") und Löschung | MUST | Ändern und Löschen erfordern jeweils explizite Bestätigung |
| FA-TERM-16 | Erfolgsmeldung nach Speichern/Löschen eines Termins (Toast-Nachricht) | MUST | „Termin wurde gespeichert" / „Termin wurde gelöscht" als visuelles Feedback |

### 3.2 Patientenverwaltung (FA-PAT)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-PAT-01 | Stammdatenerfassung: Name, Geburtsdatum, Geschlecht, Versicherungsnr., Kontaktdaten | MUST | Pflichtfelder validiert, visuelle Hervorhebung |
| FA-PAT-02 | Neue Patientenakte anlegen | MUST | Vollständige Akte mit persönl. + Versicherungsdaten erstellbar |
| FA-PAT-03 | Patientenliste mit Suche, Sortierung, Filter | MUST | Tabelle mit mindestens 5 Spalten, sortier-/filterbar |
| FA-PAT-04 | Unterscheidung bei ähnlichen Namen (Geburtsdatum, Foto, Geschlecht) | MUST | Bei Namensähnlichkeit werden Zusatzattribute angezeigt |
| FA-PAT-05 | Intelligente Suche mit Autovervollständigung und phonemischer Ähnlichkeit | MUST | Teilsuche und Fuzzy-Matching liefern Ergebnisse |
| FA-PAT-06 | Digitaler Anamnesebogen mit Pflichtfeldern und Unterschrift | MUST | Standardisierte Fragen, ja/nein-Unterschrift |
| FA-PAT-07 | Patientenstatus: neu, aktiv, validiert, read-only | SHOULD | Statusanzeige in Liste und Detailansicht |
| FA-PAT-08 | Profilfoto/Avatar pro Patient in Listen- und Detailansicht | SHOULD | Platzhalter-Avatar wenn kein Foto vorhanden |
| FA-PAT-09 | Farbkodierte Statusbadges und Drei-Punkte-Aktionsmenü pro Zeile in Patientenliste | MUST | Aktionsmenü mit Bearbeiten, Löschen, Details-Optionen |
| FA-PAT-10 | Spaltenköpfe der Patientenliste klickbar zum Sortieren (Name, Datum, Status) | MUST | Auf-/Absteigend pro Spalte sortierbar |
| FA-PAT-11 | Erfolgsmeldung nach Patientenanlage/Löschung (Toast-Nachricht) | MUST | „Patientenakte wurde hinzugefügt" / „Akte wurde gelöscht" |

### 3.3 Patientenakte (FA-AKTE)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-AKTE-01 | Vollständige ePA: Personaldaten, Anamnese, Behandlungen, Diagnosen, Befunde, Röntgenbilder, Rezepte, Atteste, Zahlungen, Notizen | MUST | Alle Datenkategorien in der Akte vorhanden |
| FA-AKTE-02 | Arzt kann Akten validieren/verifizieren | MUST | Validierungs-Queue sichtbar; nur Arzt kann freigeben |
| FA-AKTE-03 | Versionierung aller Einträge mit Zeitstempel + Benutzer-ID | MUST | Änderungshistorie einsehbar |
| FA-AKTE-04 | Medizinische Anhänge: Röntgenbilder, Laborbefunde, PDFs mit Dokumenttyp/Referenznr./Tags | MUST | Upload + Zuordnung + Filtersuche |
| FA-AKTE-05 | Belegnummern in Akte speichern | MUST | Belegnr. verknüpft mit Patient und Leistung |
| FA-AKTE-06 | PDF-Generierung für Rezepte, Atteste, Quittungen | MUST | PDF direkt aus Akte generierbar und druckbar |
| FA-AKTE-07 | Aktenzustände: neu, in Bearbeitung, validiert, read-only | SHOULD | Farbliche Markierung der Zustände |
| FA-AKTE-08 | Aktenverlauf/Timeline: Chronologische Anzeige aller Einträge (Untersuchungen, Behandlungen, Dokumente, Zahlungen) innerhalb der Akte | MUST | Zeitstrahl-Darstellung mit Filter nach Eintragstyp |
| FA-AKTE-09 | Tab-basierte Navigation innerhalb der Akte (Personaldaten, Anamnese, Zahnschema, Behandlungen, Dokumente, Finanzen) | MUST | Tabs sichtbar und wechselbar; aktiver Tab hervorgehoben |
| FA-AKTE-10 | Medizinische Vorgeschichte: Frühere Diagnosen, chronische Erkrankungen, psychische Erkrankungen, Allergien/Unverträglichkeiten in strukturierten Feldern | MUST | Strukturierte Eingabe und Anzeige pro Kategorie |
| FA-AKTE-11 | Medikamentenerfassung: Aktuelle Medikamente mit Wirkstoff, Dosierung, Einnahmedauer | MUST | Liste aller Medikamente editier-/löschbar |
| FA-AKTE-12 | Versicherungsdaten-Block: Kassenart (Gesetzlich/Privat-Toggle), Versicherungsname, Versicherungsnummer | MUST | Toggle-Auswahl für Kassenart; Pflichtfelder validiert |
| FA-AKTE-13 | Buttons „Akte validieren" und „Neue erstellen" direkt in Aktenansicht (nur Arzt-Rolle) | MUST | Nur für Rolle ARZT sichtbar; Aktion mit Bestätigung |

### 3.4 Zahnschema (FA-ZAHN)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-ZAHN-01 | Interaktives 2D-Zahnschema (Ober-/Unterkiefer) mit Nummerierung | MUST | Alle Zähne klickbar |
| FA-ZAHN-02 | Klick auf Zahn → Befund/Diagnose/Behandlung eintragen | MUST | Eingabeformular öffnet sich pro Zahn |
| FA-ZAHN-03 | Visuelle Indikatoren für bestehende Zustände | SHOULD | Farbkodierung pro Zahn |
| FA-ZAHN-04 | Integration in Patientenakte | MUST | Zahnschema als Tab/Abschnitt in Akte |
| FA-ZAHN-05 | Behandlungstabelle unterhalb des Zahnschemas: Zahn-Nr., Befund, Diagnose, Behandlung, Datum, Status pro Eintrag | MUST | Tabelle sortier- und filterbar; alle Behandlungen chronologisch |
| FA-ZAHN-06 | Formular unter Zahnschema: Typ (Dropdown), Beschreibung, Datum, Arzt, Behandlung, Material | MUST | Pflichtfelder validiert; Dropdown-Werte vordefiniert |
| FA-ZAHN-07 | Farbige Markierungen auf einzelnen Zahnflächen (Okklusal, Mesial, Distal, Bukkal, Lingual) | SHOULD | Mindestens 5 Flächen pro Zahn individuell markierbar |

### 3.5 Ärztliche Dokumentation (FA-DOK)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-DOK-01 | Eingabe Untersuchung: Beschwerden, Ergebnisse, Diagnose, Bildmaterial | MUST | Strukturierte Eingabefelder + Freitext |
| FA-DOK-02 | Eingabe Behandlung: Behandlungsart, Verlauf, Materialien, Erfolg/Abbruch | MUST | Strukturierte Eingabefelder + Freitext |
| FA-DOK-03 | Optionslisten für Leistungen, Medikamente, Untersuchungen | MUST | Kontextabhängig, filterbar |
| FA-DOK-04 | Vorlagen für Atteste und Rezepte (anpassbar) | SHOULD | Vorlagen auswähl-/bearbeitbar |
| FA-DOK-05 | Nachträgliche Ergänzung/Aktualisierung von Einträgen | MUST | Änderung mit Versionierung gespeichert |
| FA-DOK-06 | Bild-/Dokumentenupload mit Drag-and-Drop, Bildvorschau und Kategorisierung (Typ, Referenznummer, Tags) | MUST | Drag-and-Drop-Upload funktioniert; Vorschau für Bilder sichtbar |
| FA-DOK-07 | Scanner-Integration: Anamnesebogen und Papierdokumente scannen und der Akte zuordnen | MUST | Scan-Button startet Scanner; gescanntes Dokument erscheint in Akte |

### 3.6 Finanzverwaltung (FA-FIN)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-FIN-01 | Zahlungsdokumentation: Betrag, Zahlungsart, Zeitpunkt, Status | MUST | CRUD für Zahlungen; Status: bezahlt/offen/storniert |
| FA-FIN-02 | Rezeption dokumentiert alle Bareinnahmen | MUST | Tagesabschluss-Übersicht verfügbar |
| FA-FIN-03 | Arzt gibt abrechenbare Leistungen frei | MUST | Leistung erst nach Freigabe verrechenbar |
| FA-FIN-04 | Finanzübersicht: Einnahmen, Ausgaben, Gewinne, Verluste | MUST | Dashboard mit Zeitraum-Filterung |
| FA-FIN-05 | Erstattungsbelege verwalten (parametrisch filterbar) | SHOULD | Filter nach Datum, Betrag, Kategorie |
| FA-FIN-06 | PDF/Druck-Export für Steueranmeldung | MUST | Export-Button generiert PDF |
| FA-FIN-07 | Bilanz erstellen und verwalten | MUST | Einnahmen vs. Ausgaben; Zeitraum wählbar |
| FA-FIN-08 | Automatische Statistiken (Leistungen, Einnahmen, Kosten) | MUST | Balkendiagramme nach Monat/Leistung |
| FA-FIN-09 | Bilanz-CRUD: Neue Bilanz erstellen mit Zeitraum, Kategorien, Einzelpositionen (Einnahmen/Ausgaben) | MUST | Formular mit Datumsbereich, Kategorien, Einzelposten; Validierung der Pflichtfelder |
| FA-FIN-10 | Bilanz-Detailansicht mit Zusammenfassung (Gesamteinnahmen, Gesamtausgaben, Saldo), Transaktionsliste und Diagramm | MUST | Saldo berechnet sich automatisch; Diagramm zeigt Einnahmen vs. Ausgaben |
| FA-FIN-11 | Zahlungsliste mit Statusfilter, Sortierung und Drei-Punkte-Aktionsmenü (Bearbeiten, Löschen) | MUST | Filter-/Sortierfunktionen auf Zahlungsliste vorhanden |

### 3.7 Produkte & Bestellungen (FA-PROD)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-PROD-01 | Produktkatalog: Lieferant, Menge, Lieferstatus, Hersteller | MUST | CRUD für Produkte |
| FA-PROD-02 | Bestellungen anlegen/bearbeiten/löschen | MUST | Bestellung mit Bestätigungsdialog |
| FA-PROD-03 | Bestellstatus und Zahlungsstatus verfolgen | SHOULD | Status sichtbar in Liste |
| FA-PROD-04 | Pharmaberater-Profil verwalten | MUST | Name, Firma, Kontakt, Verfügbarkeit |
| FA-PROD-05 | Produktliste mit Raster-/Listenansicht und farbkodierten Statuskarten | SHOULD | Umschaltbare Ansicht; Statusfarben pro Produkt |
| FA-PROD-06 | Bestellformular mit Produktauswahl, Lieferant, Menge, Lieferdatum, Zahlungsstatus | MUST | Vollständiges Formular mit Pflichtfeldvalidierung |

### 3.8 Leistungskatalog (FA-LEIST)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-LEIST-01 | Leistungen verwalten mit Name, Kategorie, Preis | MUST | CRUD für Leistungen |
| FA-LEIST-02 | Leistungen mit Behandlungen in Akte verknüpfen | MUST | Zuordnung bei Dokumentation |
| FA-LEIST-03 | Preisliste für Rezeption einsehbar | SHOULD | Read-only Ansicht für Rolle REZ |
| FA-LEIST-04 | Leistungsliste mit Suche, Filter und Schnellaktionen (Bearbeiten, Löschen via Aktionsmenü) | MUST | Suche + Filter auf Liste vorhanden; Aktionsmenü pro Zeile |

### 3.9 Personalverwaltung (FA-PERS)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-PERS-01 | Personal-Akten: Name, Tätigkeitsbereich, Rolle, E-Mail, Telefon, Verfügbarkeit | MUST | CRUD für Personal |
| FA-PERS-02 | Rollen und Berechtigungen pro Mitarbeiter zuweisen | MUST | Zuordnung über Admin-Interface |
| FA-PERS-03 | Personalakte-Detailansicht mit Personaldaten, Tätigkeitsbereich, Kontakt, Rolle, Verfügbarkeitsstatus, Fachrichtung | MUST | Alle Felder anzeig- und editierbar |
| FA-PERS-04 | Personalliste mit Kachel-/Listenansicht, Suchfeld und Statusfilter | MUST | Ansicht umschaltbar; Suche + Filter vorhanden |
| FA-PERS-05 | Drei-Punkte-Aktionsmenü pro Mitarbeiter (Bearbeiten, Löschen, Details) | MUST | Menü öffnet sich bei Klick; alle Aktionen erreichbar |
| FA-PERS-06 | Selbstlöschung des eigenen Kontos verhindern | MUST | Löschoption für eigenes Konto deaktiviert |

### 3.10 Statistik & Reporting (FA-STAT)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-STAT-01 | Dashboard mit Balken-/Kreis-/Liniendiagrammen | MUST | Mindestens 3 Diagrammtypen |
| FA-STAT-02 | Krankheitsverteilung | SHOULD | Diagramm + Tabelle |
| FA-STAT-03 | Gewinnanalyse (Tag/Monat/Jahr) | MUST | Zeitfilter wählbar |
| FA-STAT-04 | Patientenstatistiken (Demografie, Besuche) | SHOULD | Filterbarer Report |
| FA-STAT-05 | Export als PDF | SHOULD | Export-Button verfügbar |

### 3.11 Rezeptverwaltung (FA-REZ) — NEU (Figma)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-REZ-01 | Rezeptformular: Patient, Medikament, Wirkstoff, Dosierung, Einnahmehäufigkeit, Dauer | MUST | Pflichtfelder validiert; Patient per Autovervollständigung auswählbar |
| FA-REZ-02 | Mehrere Medikamente pro Rezept (dynamische Liste mit Hinzufügen/Entfernen) | MUST | Medikamentenliste dynamisch erweiterbar |
| FA-REZ-03 | Rezept bearbeiten und löschen (mit Bestätigungsdialog) | MUST | „Änderung bestätigen" und „Löschen bestätigen" Dialoge |
| FA-REZ-04 | Rezept drucken und als PDF exportieren | MUST | Druck- und PDF-Button in Rezeptansicht |
| FA-REZ-05 | Rezeptliste mit Status und Filteroptionen innerhalb der Patientenakte | MUST | Filter nach Datum, Status; Liste innerhalb Akte sichtbar |

### 3.12 Attestverwaltung (FA-ATT) — NEU (Figma)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-ATT-01 | Attestformular: Attesttyp (Dropdown), Patient, Freitextbereich, Gültigkeitsdauer, Datum | MUST | Pflichtfelder validiert; Freitext min. 500 Zeichen |
| FA-ATT-02 | Attest bearbeiten und löschen (mit Bestätigungsdialog) | MUST | „Änderung bestätigen" und „Löschen bestätigen" Dialoge |
| FA-ATT-03 | Attest drucken und als PDF exportieren | MUST | Druck- und PDF-Button in Attestansicht |
| FA-ATT-04 | Attestliste mit Status und Filteroptionen innerhalb der Patientenakte | MUST | Filter nach Datum, Typ, Status |

### 3.13 Authentifizierung (FA-AUTH) — NEU (Figma)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-AUTH-01 | Login-Seite mit E-Mail und Passwort | MUST | Login-Formular mit Validierung; Fehlermeldung bei ungültigen Daten |
| FA-AUTH-02 | Logout-Button sichtbar auf jeder Seite (Header, oben rechts) | MUST | Roter Logout-Button; Klick beendet Session und leitet zu Login |
| FA-AUTH-03 | Session-Verwaltung mit automatischem Timeout (30 Min. Inaktivität) | MUST | Nach 30 Min. ohne Aktion wird Nutzer zur Login-Seite weitergeleitet |
| FA-AUTH-04 | Benutzerprofil im Header: Avatar, Name und Rollenanzeige | MUST | Profildaten des angemeldeten Nutzers sichtbar auf jeder Seite |

### 3.14 Einstellungen (FA-EINST) — NEU (Figma)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-EINST-01 | Einstellungsseite: Profildaten bearbeiten (Name, E-Mail, Profilbild) | MUST | Formular mit Vorausfüllung aktueller Daten; Speichern mit Bestätigung |
| FA-EINST-02 | Passwort ändern (altes Passwort, neues Passwort, Bestätigung) | MUST | Altes Passwort korrekt geprüft; neues Passwort mit Wiederholung bestätigt |
| FA-EINST-03 | Bestätigungsdialog bei Profileänderungen | MUST | „Änderung bestätigen" Dialog vor Speichern |

### 3.15 Lizenzierung & Abonnement (FA-LIC)

MeDoc wird von einem Unternehmen (Hersteller) als kommerzielle Software mit **monatlichem Abonnement** vertrieben. Zahnarztpraxen sind Lizenznehmer. Die Praxisdaten verbleiben lokal (DSGVO-konform), die Lizenzvalidierung erfolgt über einen zentralen Lizenzserver des Herstellers.

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-LIC-01 | Beim ersten Start muss ein **Lizenzschlüssel** eingegeben oder online aktiviert werden | MUST | Ohne gültigen Schlüssel kann die App nicht produktiv gestartet werden; Aktivierungs-Dialog beim Erststart |
| FA-LIC-02 | Es gibt mindestens **drei Abo-Stufen** mit unterschiedlichem Funktionsumfang: **Basis** (1 Arzt, 2 Geräte), **Professional** (2 Ärzte, 5 Geräte, Statistik-Modul), **Enterprise** (3+ Ärzte, unbegrenzte Geräte, API-Zugriff für STB/PHB) | MUST | Funktionsumfang wird durch Lizenz-Tier gesteuert; gesperrte Module zeigen Upgrade-Hinweis |
| FA-LIC-03 | Die Lizenz wird **periodisch validiert**: bei jedem App-Start und einmal pro Monat bei Internet-Verfügbarkeit. Offline-Karenzzeit: 30 Tage. | MUST | Nach 30 Tagen ohne erfolgreiche Validierung → Read-Only-Modus |
| FA-LIC-04 | Bei Ablauf oder Kündigung des Abonnements wechselt die App in einen **Read-Only-Modus**: bestehende Daten einsehen und exportieren (PDF/CSV), aber keine neuen Einträge erstellen | MUST | Alle Schreiboperationen deaktiviert; Hinweis-Banner „Lizenz abgelaufen"; Datenexport bleibt möglich |
| FA-LIC-05 | Der Arzt/Admin kann in den Einstellungen den **Lizenzstatus** einsehen: Abo-Stufe, Ablaufdatum, Geräte-Kontingent (belegt/verfügbar), Lizenzschlüssel (maskiert) | MUST | Lizenz-Tab in Einstellungen mit allen Informationen; Aktualisierung per Klick |
| FA-LIC-06 | **Lizenzverlängerung und Abo-Stufenwechsel** (Upgrade/Downgrade) muss über ein Self-Service-Portal (Web) oder direkt in der App möglich sein | SHOULD | Link zum Portal in Einstellungen; nach Wechsel wird neuer Funktionsumfang beim nächsten Validierungs-Check aktiv |
| FA-LIC-07 | Die Anzahl **gleichzeitig verbundener Geräte** wird durch die Abo-Stufe begrenzt und beim Lizenzserver geprüft | MUST | Bei Überschreitung wird die Verbindung des neuesten Geräts mit Hinweis abgelehnt |
| FA-LIC-08 | Beim Lizenz-Downgrade dürfen **keine bestehenden Daten gelöscht** werden; Module, die im niedrigeren Tier nicht enthalten sind, werden Read-Only | MUST | Kein Datenverlust bei Downgrade; betroffene Module im Menü ausgegraut mit „Upgrade"-Badge |

### 3.16 Integriertes Abonnement-Zahlungssystem (FA-PAY)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-PAY-01 | Die App muss ein **integriertes Zahlungsmodul** für die Verwaltung des Abonnements bereitstellen (in Einstellungen → Abonnement) | MUST | Zahlungsseite erreichbar; aktueller Plan und Zahlungsstatus sichtbar |
| FA-PAY-02 | Unterstützte Zahlungsmethoden: **Kreditkarte** (Visa, Mastercard), **SEPA-Lastschrift**, **PayPal**. Die Zahlungsabwicklung erfolgt über einen PCI-DSS-konformen Payment-Provider (z. B. Stripe, Mollie) | MUST | Mindestens 2 Zahlungsmethoden auswählbar; Zahlungsformular vom Provider (gehostete Felder / Redirect) |
| FA-PAY-03 | Rechnungen/Quittungen für das Abonnement werden **automatisch generiert** und als PDF im Zahlungsverlauf abrufbar | MUST | Nach jeder erfolgreichen Zahlung: PDF-Rechnung verfügbar; Download-Button in Zahlungshistorie |
| FA-PAY-04 | Bei fehlgeschlagener Zahlung wird eine **Karenzzeit von 14 Tagen** eingeräumt. Innerhalb der Karenzzeit: volle Funktion + Warnbanner. Nach Ablauf: Read-Only-Modus. | MUST | Tag 1–14: Banner „Zahlung fehlgeschlagen – bitte aktualisieren"; Tag 15+: Read-Only-Modus |
| FA-PAY-05 | **Zahlungsverlauf**: Alle Abonnement-Transaktionen (Datum, Betrag, Status, Rechnung) sind in den Einstellungen einsehbar | MUST | Sortierte Liste mit Download-Links für Rechnungs-PDFs |
| FA-PAY-06 | Es werden **keine Kreditkartennummern, IBANs oder Bankdaten lokal** gespeichert. Alle sensiblen Zahlungsdaten verbleiben beim Payment-Provider (Tokenisierung). | MUST | Lokale DB enthält nur Token-Referenzen und Rechnungsmetadaten; kein PAN/IBAN in praxis.db |
| FA-PAY-07 | Die Zahlungsseite muss über eine **eingebettete WebView** (Tauri) oder einen **externen Browser-Link** den PCI-konformen Zahlungsfluss des Providers nutzen | MUST | Zahlungsformular wird vom Provider gerendert (nicht selbst implementiert); PCI-DSS-Compliance des Providers nachweisbar |

### 3.17 Datenmigration von Fremdsystemen (FA-MIG)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-MIG-01 | Import über **VDDS-transfer (v2.22)**: Patientenstammdaten, Behandlungsdaten, Abrechnungsdaten und Termine aus VDDS-kompatiblen Dental-PVS-Systemen | MUST | VDDS-transfer-Datei wird eingelesen; Patientenanzahl und Importstatus in Zusammenfassung angezeigt |
| FA-MIG-02 | Import über **BDT (Behandlungsdatentransfer v3.0)**: Vollständige Patientenakten inkl. Anamnese, Diagnosen, Behandlungsverläufe und Gebührenziffern (KBV/QMS-Standard) | MUST | BDT-Datei wird geparst; Pflichtfelder korrekt zugeordnet; optionale Felder bestmöglich übernommen |
| FA-MIG-03 | **Generischer CSV/JSON-Import** für Systeme ohne standardisierte Exportschnittstelle: konfigurierbare Feldmapping-Oberfläche | MUST | CSV/JSON-Dateien importierbar; Feldmapping per Drag-and-Drop oder Dropdown konfigurierbar |
| FA-MIG-04 | **DICOM-Bildimport**: Import bestehender Röntgenbilder (Panorama, Intraoral, CBCT) als DICOM-Dateien aus Fremd-PACS oder lokalen Bildordnern; Verknüpfung mit Patientenakten | MUST | DICOM-Dateien werden geladen; Patient-ID wird aus DICOM-Metadaten extrahiert und dem MeDoc-Patienten zugeordnet |
| FA-MIG-05 | **Migrationsassistent** (geführter Workflow): Quellsystem auswählen → Datei laden → Vorschau/Validierung → Feldmapping → Import → Qualitätsbericht | MUST | Wizard mit ≤ 6 Schritten; Fortschrittsanzeige; abschließender Bericht |
| FA-MIG-06 | **Datenvalidierung**: Importierte Daten werden auf Vollständigkeit, Konsistenz und Plausibilität geprüft. Fehler und Warnungen in einem strukturierten Migrationsbericht | MUST | Bericht zeigt: Anzahl importiert/übersprungen/fehlerhaft; je Fehler: Datensatz-ID, Feldname, Ursache |
| FA-MIG-07 | **Testlauf (Dry-Run)**: Migration ohne Datenbankänderung simulieren; Vorschaubericht mit erwartetem Ergebnis | SHOULD | „Testlauf"-Button im Migrationsassistenten; Vorschau zeigt was importiert würde; DB bleibt unverändert |
| FA-MIG-08 | **Rollback**: Bei Fehlern kann der gesamte Import rückgängig gemacht werden (Datenbankzustand vor Migration wiederhergestellt) | MUST | Vor Import wird automatisch Datenbank-Snapshot erstellt; „Rückgängig"-Button in Migrationsergebnis |
| FA-MIG-09 | **Inkrementeller Import**: Daten schrittweise importieren (z.B. erst Patienten, dann Termine, dann Behandlungen) | SHOULD | Auswahl der Datenkategorien im Migrationsassistenten; Reihenfolge und Umfang konfigurierbar |
| FA-MIG-10 | **Unterstützte Quellsysteme**: Dampsoft DS-Win, CGM Z1/Z1.PRO, Evident AERA, DATEXT ivoris, Solutio Charly, LinuDent, Alphatech Alphaplus und weitere über generischen CSV/BDT-Import | SHOULD | Mindestens Dampsoft DS-Win und CGM Z1 als vorkonfigurierte Profile; weitere über generischen Import |

### 3.18 Geräteanbindung & Bildgebung (FA-DEV)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| FA-DEV-01 | **DICOM-Integration**: MeDoc muss als DICOM-Client (SCU) Röntgenbilder von DICOM-fähigen Geräten empfangen (C-STORE), abfragen (C-FIND/C-GET) und speichern können | MUST | DICOM-Worklist-Abfrage, C-STORE SCP für Bildempfang, Bilder korrekt dem Patienten zugeordnet |
| FA-DEV-02 | **TWAIN/WIA-Integration**: MeDoc muss Bilder von Intraoralröntgen-Sensoren und -Kameras über die TWAIN- oder WIA-Schnittstelle erfassen (Windows). Auf macOS: ImageKit-basierter Bildimport oder Datei-Upload. | MUST | Geräteauswahldialog, Bildvorschau, automatische Zuordnung zur offenen Patientenakte |
| FA-DEV-03 | **GDT-Schnittstelle (Gerätedatentransfer v2.1+)**: Bidirektionaler Datenaustausch mit medizinischen Geräten (Panorama-OPG, Dentaleinheiten) über GDT-IN/OUT-Dateien | SHOULD | Patientenstammdaten werden per GDT an das Gerät übergeben; Untersuchungsergebnis wird per GDT zurückgelesen und in der Akte angezeigt |
| FA-DEV-04 | **VDDS-media (v1.4)**: Bildaustausch mit Geräten und externen Programmen über die VDDS-media-Schnittstelle (Standard des VDDS e.V.) | SHOULD | Bilder von Kameras und Scannern werden über VDDS-media in die Patientenakte importiert |
| FA-DEV-05 | **Intraorale Scanner**: Import von 3D-Scans im STL/PLY/OBJ-Format. Anzeige als 3D-Vorschau in der Patientenakte. Export für CAD/CAM-Weiterverarbeitung. | SHOULD | STL-Datei importierbar; 3D-Vorschau (WebGL) in der Akte angezeigt; Export-Button für Labore/CAD-CAM |
| FA-DEV-06 | **Bildarchivierung (Mini-PACS)**: Alle empfangenen Bilder (DICOM, JPEG, TIFF, STL) werden verschlüsselt (AES-256) im lokalen Bildarchiv gespeichert, organisiert nach Patient und Datum | MUST | Bildordner-Struktur auf Host-PC; Dateien verschlüsselt; Suche nach Patient/Datum/Typ in der Akte |
| FA-DEV-07 | **Bildannotation**: Ärzte können Röntgenbilder und Fotos mit Anmerkungen versehen (Text, Pfeile, Markierungen). Annotationen werden versioniert und dem Audit-Log hinzugefügt. | SHOULD | Annotation-Tools in Bildanzeige; Annotationen werden gespeichert und sind reproduzierbar |
| FA-DEV-08 | **Geräte-Konfigurationsoberfläche**: In Einstellungen → Geräte können verbundene Geräte registriert, konfiguriert und getestet werden (IP-Adresse, Port, DICOM-AE-Title, Gerätetyp) | MUST | Geräteliste mit Status (verbunden/getrennt); Testverbindung-Button; Konfiguration persistent |

---

## 4. Nicht-Funktionale Anforderungen

### 4.0 Design-Philosophie (NFA-DESIGN)

Die visuelle Sprache ist eine Synthese aus bewährten Design-Systemen:

| Quelle | Was wir übernehmen |
|--------|--------------------|
| **Apple HIG** | Spatial Model (Sidebar + Content), Vibrancy/Glass-Effekte, native Toolbar-Höhe (48px), Sheet-Dialoge, System-Font-Priorität |
| **Material 3** | Tonale Elevation (nicht schattenbasiert), dynamische Farbe aus Seed, Typografie-Rollen, Spring-basierte Animationen |
| **Fluent 2** | 4px-Raster, Spacing-Ramp (4/8/12/16/20/24/32/40/48), Fokusring-Pattern (2px solid, 2px offset), Interaktionszustände (rest→hover→pressed→selected) |
| **Palenight** | Farbpalette (#292D3E bg, #A6ACCD fg, Pastellakzente #C792EA, #82AAFF, #89DDFF, #C3E88D, #FFCB6B, #FF5370), warme lila-blaue Ästhetik |

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| NFA-DESIGN-01 | Palenight-Farbschema als durchgängiges Dark Theme | MUST | Alle Oberflächen nutzen #292D3E-Basis; kein hartes Schwarz/Weiß |
| NFA-DESIGN-02 | Glass/Vibrancy-Effekte für Sidebar und Dialoge (backdrop-blur) | MUST | Sidebar und Modals zeigen Blur-Through-Effekt |
| NFA-DESIGN-03 | Tonale Elevation: höhere Oberflächen = hellere Hintergründe (keine Drop-Shadows) | MUST | Karten, Modals, Dropdowns durch Farbhelligkeit unterscheidbar |
| NFA-DESIGN-04 | 4px-Raster für alle Abstände und Größen (Fluent 2) | MUST | Kein Spacing-Wert außerhalb der 4px-Ramp |
| NFA-DESIGN-05 | Spring-basierte Animationen für Übergänge und Zustandswechsel | SHOULD | Smooth Transitions bei Hover, Dialog-Open, Page-Switch |

### 4.1 Sicherheit (NFA-SEC)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| NFA-SEC-01 | Rollenbasierte Zugriffskontrolle (RBAC) | MUST | 4 Rollen mit definierten Rechten |
| NFA-SEC-02 | Rezeption: kein Schreibzugriff auf medizinische Daten | MUST | Technisch durch Middleware/DB-Policies enforced |
| NFA-SEC-03 | Passwortgeschützter Login mit **Argon2id-Hashing** (bevorzugt) oder bcrypt als Fallback | MUST | Passwörter werden **niemals im Klartext** gespeichert; min. 8 Zeichen; Salt pro Benutzer |
| NFA-SEC-04 | Audit-Log aller Systemaktionen (einschließlich **Lesezugriffe** auf Patientendaten) | MUST | Jede Aktion mit User-ID + Zeitstempel + IP protokolliert; Audit-Logs sind **append-only und manipulationssicher** (keine Lösch-/Editfunktion); HMAC-Integritätsprüfung |
| NFA-SEC-05 | Tägliches automatisches Backup (**AES-256-GCM verschlüsselt**) | MUST | Backup-Dateien werden vor dem Schreiben verschlüsselt; Wiederherstellungsprozess muss dokumentiert und regelmäßig getestet werden |
| NFA-SEC-06 | DSGVO-konforme Cloud-Speicherung (optional) | NICE TO HAVE | Opt-in Konfiguration; auch Cloud-Backups müssen AES-256-GCM verschlüsselt sein |
| NFA-SEC-07 | Audit-Logs müssen mindestens **10 Jahre** aufbewahrt werden | MUST | Automatische Archivierung; verschlüsselte Langzeitspeicherung |
| NFA-SEC-08 | **Vollständige Datenbankverschlüsselung** (Encryption at Rest): Die gesamte Datenbank `praxis.db` muss mit **SQLCipher (AES-256-CBC)** verschlüsselt sein. Keine Patientendaten, Finanzdaten oder personenbezogene Daten dürfen jemals im Klartext auf der Festplatte liegen. | MUST | SQLCipher ist **standardmäßig aktiviert** (nicht optional); DB-Datei ist ohne Schlüssel nicht lesbar; `PRAGMA cipher_version` bestätigt aktive Verschlüsselung |
| NFA-SEC-09 | **Transportverschlüsselung** (Encryption in Transit): Jede Netzwerkkommunikation zwischen Client und Host muss über **TLS 1.3 (HTTPS)** verschlüsselt sein. Im Standalone-Modus kommuniziert die App ausschließlich über Tauri-IPC (prozessintern). | MUST | Kein unverschlüsselter HTTP-Verkehr im Netzwerk-Modus; TLS-Zertifikat wird beim ersten Start automatisch generiert (selbstsigniert) oder manuell konfiguriert |
| NFA-SEC-10 | **Keine Klartext-Speicherung sensibler Daten**: Passwörter (Argon2id), Lizenzschlüssel (Ed25519-Signatur), JWT-Secrets, DB-Masterkey — alle kryptographischen Geheimnisse müssen sicher gespeichert werden (OS-Keychain oder verschlüsselte Konfigurationsdatei) | MUST | Keine Geheimnisse im Klartext in Konfigurationsdateien, Logs oder Quellcode; Secrets-Audit bei jedem Release |
| NFA-SEC-11 | **Schlüsselmanagement** (Key Management): DB-Masterkey wird aus benutzerdefinierten oder maschinengebundenen Parametern abgeleitet (PBKDF2/Argon2); Schlüsselrotation muss möglich sein, ohne Datenverlust | MUST | Schlüsselwechsel über Einstellungen → Re-Encryption der DB; alter Schlüssel wird nach Migration sicher gelöscht (Zeroize) |
| NFA-SEC-12 | **Verschlüsselte Exporte**: Alle Datenexporte (PDF, CSV, JSON) mit sensiblen Patienten- oder Finanzdaten müssen optional mit einem **Benutzer-Passwort verschlüsselt** exportiert werden können (AES-256) | SHOULD | Export-Dialog bietet Option „Verschlüsselt exportieren" mit Passwort-Eingabe; verschlüsselte Dateien nur mit korrektem Passwort lesbar |
| NFA-SEC-13 | **Speichersicherheit zur Laufzeit**: Sensible Daten (Passwörter, Schlüssel, entschlüsselte Patientendaten) müssen nach Gebrauch im Arbeitsspeicher **überschrieben** werden (Zeroize/SecureString) | MUST | Rust `zeroize` Crate für alle sicherheitskritischen Typen; kein Klartext in Core-Dumps oder Swap |

### 4.1b Logging & Observability (NFA-LOG)

MeDoc implementiert ein umfassendes Logging-System, das über den bestehenden Audit-Log (NFA-SEC-04) hinaus alle Schichten des Systems abdeckt. Logs sind essenziell für Fehlerbehebung, Sicherheitsanalyse, Performance-Optimierung und Nachmarktüberwachung (IEC 82304-1).

#### Logdateien-Übersicht

| Logdatei | Pfad | Inhalt | Rotation | Aufbewahrung |
|----------|------|--------|----------|-------------|
| Audit-Log | `praxis.db` (Tabelle `audit_log`) | Benutzeraktionen, Datenzugriffe (NFA-SEC-04) | – (DB) | 10 Jahre (NFA-SEC-07) |
| Anwendungslog | `~/medoc-data/logs/app.log` | Fehler, Warnungen, Info, Debug | 50 MB/Datei, max. 10 Dateien | 30 Tage |
| Sicherheitslog | `~/medoc-data/logs/security.log` | Auth-Events, fehlgeschlagene Logins, Sperren | 20 MB/Datei, max. 10 Dateien | 90 Tage |
| Systemlog | `~/medoc-data/logs/system.log` | Start/Stopp, Config, Migrationen, Updates | 20 MB/Datei, max. 10 Dateien | 90 Tage |
| Gerätelog | `~/medoc-data/logs/device.log` | DICOM, GDT, TWAIN, USB-Events | 50 MB/Datei, max. 10 Dateien | 30 Tage |
| Migrationslog | `~/medoc-data/logs/migration.log` | Import-Operationen, Validierung, Rollback | Unbegrenzt pro Job | Permanent |
| Performance-Log | `~/medoc-data/logs/perf.log` | Langsame Requests, DB-Queries, Ressourcen | 20 MB/Datei, max. 5 Dateien | 7 Tage |

#### Formale Anforderungen

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| NFA-LOG-01 | **Strukturiertes Anwendungslog**: Alle Backend-Ereignisse werden im JSON-Format geloggt mit den Feldern `timestamp` (ISO 8601), `level` (ERROR/WARN/INFO/DEBUG/TRACE), `module`, `message`, `correlation_id`. Implementierung über Rust `tracing` Crate + `tracing-subscriber` (JSON-Layer + Datei-Appender). | MUST | Log-Einträge sind maschinenlesbar (JSON-parsebar); Log-Level zur Laufzeit konfigurierbar über Einstellungen → System |
| NFA-LOG-02 | **Sicherheitslog**: Separate Logdatei für sicherheitsrelevante Ereignisse: fehlgeschlagene Login-Versuche (mit IP-Adresse, ohne Passwort), Brute-Force-Erkennung (> 5 Fehlversuche in 10 Min. → temporäre Sperre 15 Min. + Log-Eintrag), Session-Invalidierungen, Passwortwechsel, Lizenzvalidierungsergebnisse | MUST | Fehlgeschlagene Logins erscheinen in `security.log` mit IP und Zeitstempel; bei 6. Fehlversuch: Sperre aktiv + Log-Eintrag `BRUTE_FORCE_LOCKOUT` |
| NFA-LOG-03 | **Systemlog**: Anwendungsstart/-stopp (mit Version + OS-Info), Konfigurationsänderungen (wer, was, wann), DB-Schema-Migrationen (von/nach Version), Update-Installationen (Version + Ergebnis), Backup-Operationen (Start/Ende/Erfolg/Fehler/Dateigröße) | MUST | Jeder App-Start erzeugt Eintrag mit Version, OS, DB-Schema-Version; jede Einstellungsänderung geloggt |
| NFA-LOG-04 | **Gerätelog**: Alle Geräte-Kommunikationen: DICOM C-STORE/C-FIND/Worklist (Ergebnis, Dauer, Bildanzahl), GDT-Dateiaustausch (Richtung, Dateiname, Satzart), TWAIN/WIA-Captures (Gerät, Ergebnis), USB-Hotplug-Events (Gerät erkannt/entfernt), Gerätefehler (Timeout, Verbindungsabbruch) | MUST | DICOM-Import erzeugt Eintrag mit AE-Title, Bildanzahl, Dauer; Gerätefehler werden mit Fehlercode und Retry-Status geloggt |
| NFA-LOG-05 | **Migrationslog**: Jede Import-Operation: Quellsystem, Importformat, Dateiname, Start-/Endzeitpunkt, importierte/übersprungene/fehlerhafte Datensätze, Validierungsergebnisse (Fehler + Warnungen), Dry-Run-Ergebnisse, Rollback-Events (Grund, Snapshot-ID) | MUST | Migrationsbericht (PDF) referenziert Log-Einträge; jeder fehlerhafte Datensatz einzeln geloggt mit Ursache |
| NFA-LOG-06 | **Performance-Log**: API-Antwortzeiten > 500 ms, DB-Queries > 200 ms, Speicherverbrauch bei Start und stündlich, Anzahl gleichzeitiger Client-Verbindungen. Log-Level konfigurierbar (Schwellenwerte in Einstellungen → System). | SHOULD | Langsame Requests erscheinen in `perf.log` mit Endpoint, Dauer, User-ID; Dashboard „System-Health" zeigt Top-10 langsame Endpoints |
| NFA-LOG-07 | **Log-Rotation**: Alle dateibasierten Logs werden automatisch rotiert (Größe + Alter). Maximaler Gesamtspeicher für Logs ≤ 1 GB. Älteste Dateien werden automatisch gelöscht. | MUST | Logs wachsen nicht unbegrenzt; Gesamtgröße `~/medoc-data/logs/` bleibt unter 1 GB |
| NFA-LOG-08 | **Log-Schutz & Datenminimierung**: Keine Patientendaten (Name, Geburtsdatum, Befunde) in Anwendungs-/System-/Performance-Logs (nur IDs). Passwörter, Tokens, Schlüssel werden maskiert (`***`). Log-Dateien sind nur für den App-Benutzer lesbar (Dateiberechtigungen 600). | MUST | Grep über alle `.log`-Dateien findet keine Klarnamen, Passwörter oder Tokens; Dateiberechtigungen korrekt gesetzt |
| NFA-LOG-09 | **Log-Export**: Benutzer kann alle Logs als ZIP-Archiv exportieren (Einstellungen → System → Logs exportieren) für Support-Anfragen. Export enthält die letzten 7 Tage aller Logs (außer Audit-Log). Automatische Maskierung sensibler Daten vor Export. | SHOULD | Export-Button erzeugt ZIP mit allen `.log`-Dateien der letzten 7 Tage; sensible Daten maskiert |
| NFA-LOG-10 | **Log-Level-Konfiguration**: Das Log-Level (ERROR/WARN/INFO/DEBUG/TRACE) muss zur Laufzeit konfigurierbar sein, ohne Neustart der Anwendung. Standard: INFO im Produktivbetrieb. | MUST | Dropdown in Einstellungen → System → Log-Level; Änderung wirkt sofort; kein Neustart erforderlich |

### 4.2 Usability & Usability-Engineering (NFA-USE)

MeDoc muss die **10 Nielsen-Heuristiken** als formale Qualitätskriterien erfüllen und die **7 Usability-Engineering-Prinzipien** (Learnability, Efficiency, Memorability, Errors, Satisfaction, User-Centered Design, Accessibility) als messbare Qualitätsziele verankern.

#### 4.2.1 Nielsen-Heuristiken (NFA-USE-H)

| ID | Heuristik | Anforderung | Priorität | Akzeptanzkriterium |
|----|-----------|------------|-----------|-------------------|
| NFA-USE-H01 | **H1: Sichtbarkeit des Systemstatus** | Das System informiert den Benutzer jederzeit über den aktuellen Zustand: Lade-Spinner bei Wartezeiten > 300ms, Fortschrittsbalken bei Langläufern (Migration, DICOM-Import), Verbindungsstatus-Banner, Toast-Meldungen nach jeder Aktion | MUST | Kein „stiller" Übergang; jede Zustandsänderung wird visuell kommuniziert |
| NFA-USE-H02 | **H2: Übereinstimmung System ↔ reale Welt** | Zahnmedizinische Fachsprache verwenden (FDI-Zahnschema, BEMA/GOZ-Nummern, Befundkürzel); Praxis-Workflows abbilden (nicht technische Workflows); Fehlermeldungen in Benutzersprache (keine Stack-Traces, Fehlercodes oder Datenbankbegriffe) | MUST | Fachpersonal versteht alle Labels, Menüs und Meldungen ohne IT-Vorkenntnisse |
| NFA-USE-H03 | **H3: Benutzerkontrolle und Freiheit** | Undo/Redo für Texteingaben; „Abbrechen"-Button in jedem Dialogformular; „Zurück"-Navigation auf allen Seiten; Migrations-Rollback (FA-MIG-08); Bestätigungsdialoge vor destruktiven Aktionen | MUST | Jede Aktion ist umkehrbar oder erfordert explizite Bestätigung |
| NFA-USE-H04 | **H4: Konsistenz und Standards** | Einheitliche Palenight-Design-Tokens über alle Module; konsistente Button-Platzierung (Primäraktion rechts, Abbrechen links); identische Tabellenstrukturen; identische Formularanordnung; Plattformkonventionen respektieren (⌘ auf macOS, Strg auf Windows) | MUST | Kein Modul weicht visuell oder interaktiv vom Design-System ab |
| NFA-USE-H05 | **H5: Fehlervermeidung** | Pflichtfelder visuell markiert (\*); Inline-Validierung vor Absenden; Autocomplete für bekannte Werte (Patientenname, PLZ); Plausibilitätsprüfung (Geburtsdatum nicht in Zukunft, FDI-Nummern 11–48); Dry-Run für Migration; Auto-Save für Entwürfe | MUST | Mindestens 80% aller Eingabefehler werden vor dem Absenden erkannt |
| NFA-USE-H06 | **H6: Wiedererkennung statt Erinnerung** | Sidebar-Navigation mit Labels + Icons; „Zuletzt geöffnet"-Liste (letzte 10 Patienten/Termine); Auto-Complete in Suchfeldern; kontextbezogene Aktionsbuttons; Tooltips auf allen Icon-Buttons | MUST | Kein Menüpunkt erfordert Auswendiglernen; Wiedereinstieg nach Pause < 30s |
| NFA-USE-H07 | **H7: Flexibilität und effiziente Nutzung** | Tastaturkürzel für Hauptaktionen (⌘/Strg+N: Neuer Termin, ⌘/Strg+P: Patientensuche, ⌘/Strg+S: Speichern); konfigurierbare Dashboard-Widgets; Drag-and-Drop im Kalender; Bulk-Aktionen in Tabellen; Power-User-Shortcuts dokumentiert | SHOULD | Erfahrene Benutzer sparen ≥ 30% Zeit gegenüber reiner Maus-Navigation |
| NFA-USE-H08 | **H8: Ästhetisches und minimalistisches Design** | Palenight-Glasmorphismus; tonal elevation; nur relevante Informationen pro Ansicht; progressive Offenlegung (Details on Demand); keine überladenen Formulare; max. 7 ± 2 Elemente pro Gruppe (Millersche Zahl) | MUST | Heuristische Evaluation bestätigt: kein visueller Noise; Informationsdichte angemessen |
| NFA-USE-H09 | **H9: Fehlererkennung und -behebung** | Fehlermeldungen benennen: (1) Was ist passiert, (2) Warum, (3) Was der Benutzer tun kann. Feldmarkierung (roter Rahmen + Text) bei Validierungsfehler. Migrationsbericht mit Fehler-Detail (Datensatz-ID, Feldname, Ursache) | MUST | Jede Fehlermeldung enthält eine konkrete Handlungsanweisung |
| NFA-USE-H10 | **H10: Hilfe und Dokumentation** | Kontextsensitive Hilfe (Fragezeichen-Icon pro Seite/Bereich); eingebettete Tooltips; Onboarding-Wizard für Erstbenutzer (rollenspezifisch); durchsuchbare Hilfe/FAQ innerhalb der App; Link zum Benutzerhandbuch | SHOULD | Benutzer findet Hilfe zum aktuellen Kontext in ≤ 2 Klicks |

**Gesamtziel:** Nielsen-Heuristik-Konformitäts-Score ≥ **80%** (gemessen durch heuristische Evaluation mit ≥ 3 unabhängigen Evaluatoren).

#### 4.2.2 Usability-Engineering-Prinzipien (NFA-USE-UE)

| ID | Prinzip | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|---------|------------|-----------|-------------------|-----------| 
| NFA-USE-UE01 | **Learnability** (Erlernbarkeit) | Neue Benutzer müssen das System innerhalb der Einarbeitungszeit produktiv nutzen können. Rollenspezifische Startansichten, Onboarding-Wizard, konsistente Interaktionsmuster über alle Module. | MUST | Einarbeitungszeit ≤ 2 Monate (ARZT: inkl. Zahnschema, Befundung; REZEPTION: inkl. Termine, Patienten). Gemessen durch Usability-Test mit Neulingen. | ISO 9241-110 Erlernbarkeit |
| NFA-USE-UE02 | **Efficiency** (Effizienz) | Erfahrene Benutzer müssen Routineaufgaben schnell erledigen können. Max. 2 Klicks zu jeder Hauptfunktion; Tastaturkürzel; Auto-Complete; Notfalltermin in < 3 Klicks; Bulk-Aktionen. | MUST | Aufgabenerledigungszeit für Standardworkflows (Termin buchen, Patient anlegen, Befund dokumentieren) sinkt um ≥ 20% nach 4 Wochen Nutzung | ISO 9241-11 Effizienz |
| NFA-USE-UE03 | **Memorability** (Einprägsamkeit) | Nach ≥ 2 Wochen Abwesenheit muss der Benutzer das System ohne erneute Schulung bedienen können. Stabile Menüstruktur, erkennbare Icons, konsistente Navigation. | SHOULD | Recall-Test: Benutzer nach 2 Wochen Pause findet Hauptfunktionen in ≤ 30s ohne Hilfe | ISO 9241-110 Selbstbeschreibungsfähigkeit |
| NFA-USE-UE04 | **Errors** (Fehlertoleranz) | Das System muss Benutzerfehler minimieren und Wiederherstellung ermöglichen. Bestätigungsdialoge, Undo, Validierung, Pflichtfeld-Markierung, Rollback. | MUST | Fehlerrate < 5% bei Standardaufgaben; kein Datenverlust durch Fehlbedienung; alle destruktiven Aktionen reversibel | ISO 9241-110 Fehlertoleranz |
| NFA-USE-UE05 | **Satisfaction** (Zufriedenheit) | Die Nutzung soll subjektiv angenehm sein. Palenight-Ästhetik, sanfte Animationen, positive Bestätigungsmeldungen, kein visueller Noise. | MUST | System Usability Scale (SUS) Score ≥ 72 (überdurchschnittlich); gemessen durch Post-Test-Fragebogen mit ≥ 10 Testpersonen | ISO 9241-11 Zufriedenstellung |
| NFA-USE-UE06 | **User-Centered Design** (Nutzerzentrierte Gestaltung) | Benutzer werden in den Designprozess einbezogen. Prototyp-Evaluation (Figma) vor Implementierung; heuristische Evaluation nach Nielsen; Usability-Tests pro Release mit ≥ 5 Personen pro Rolle; iterative Verbesserung nach Feedback. | MUST | Mindestens 1 Usability-Test-Zyklus pro Major-Release; dokumentierte Findings + Maßnahmen | ISO 9241-210 Nutzerzentrierte Gestaltung |
| NFA-USE-UE07 | **Accessibility** (Barrierefreiheit) | Das System muss für Menschen mit Einschränkungen zugänglich sein: Mindest-Kontrastrate 4.5:1 (WCAG 2.1 AA), Tastaturnavigation für alle interaktiven Elemente, ARIA-Labels für Screen-Reader, skalierbare Schriftgröße (100%–200%), Textlabels bei Farbkodierungen | MUST | WCAG 2.1 Level AA Compliance; automatisierter Accessibility-Audit (z.B. axe-core) zeigt 0 kritische Verstöße | WCAG 2.1, ISO 25010 Barrierefreiheit |

#### 4.2.3 Bestehende Usability-Anforderungen (NFA-USE)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| NFA-USE-01 | Klare, strukturierte, übersichtliche UI | MUST | Nielsen-Heuristik-Konformität ≥ 80% |
| NFA-USE-02 | Sidebar-Navigation mit allen Hauptbereichen | MUST | Max. 2 Klicks zu jeder Hauptfunktion |
| NFA-USE-03 | Bestätigungsdialoge für alle destruktiven Aktionen | MUST | Löschen/Stornieren erfordert explizite Bestätigung |
| NFA-USE-04 | Kontextbezogene Erfolgs-/Fehlermeldungen | MUST | Jede Aktion zeigt Feedback |
| NFA-USE-05 | Einarbeitungszeit ≤ 2 Monate | NICE TO HAVE | Tooltips + Tutorials integriert |
| NFA-USE-06 | Farbkodierungen müssen zusätzlich Textlabels besitzen (Barrierefreiheit) | SHOULD | Jeder farbkodierte Zustand hat ein sichtbares Textlabel oder Tooltip |
| NFA-USE-07 | Bestätigungsdialoge auch für Änderungen/Updates („Änderung bestätigen") — nicht nur für destruktive Aktionen | MUST | Jede Bearbeitungsaktion zeigt Bestätigungsdialog vor Speichern |
| NFA-USE-08 | Toast-/Banner-Nachrichten nach jeder CRUD-Operation (Erfolg/Fehler) | MUST | z. B. „Termin wurde gespeichert", „Akte wurde gelöscht" als visuelles Feedback |

### 4.3 Performance (NFA-PERF)

| ID | Anforderung | Priorität | Akzeptanzkriterium |
|----|------------|-----------|-------------------|
| NFA-PERF-01 | Ladezeit < 2 Sekunden pro Aktion im lokalen Betrieb | MUST | Gemessen via Performance-Tests auf Referenzhardware |
| NFA-PERF-02 | Responsive Layout: Desktop-first (1259×1024 Basis) mit adaptierbarem Layout für Tablet (768px) und Smartphone (375px) | MUST | Kein Layout-Bruch auf Desktop-Standardbildschirmen; auf Tablet/Smartphone alle Rezeptionsfunktionen bedienbar |
| NFA-PERF-03 | Netzwerklatenz im LAN < 200 ms für alle API-Aufrufe | MUST | Round-Trip-Messung Client→Server→Client im 100 Mbit/s LAN |
| NFA-PERF-04 | System muss mindestens 5 gleichzeitig verbundene Clients performant bedienen (1 Arzt-Desktop + 2 Rezeption-Desktop + 2 Rezeption-Mobil) | MUST | Keine spürbare Verlangsamung bei 5 parallelen Sitzungen |
| NFA-PERF-05 | SQLite WAL-Modus für parallele Lese-/Schreibzugriffe im Multi-Client-Betrieb | MUST | Kein Write-Lock bei gleichzeitigen Lesezugriffen |

### 4.4 Netzwerk & Multi-Device (NFA-NET)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-NET-01 | Das Hauptsystem (Arzt-PC oder dedizierter Praxis-Server) muss als **TCP/HTTP-Host** fungieren und einen API-Server im lokalen Netzwerk (LAN) bereitstellen | MUST | Server startet automatisch mit der Anwendung; andere Clients im LAN können sich verbinden | ISO 25010 – Kompatibilität (Interoperabilität) |
| NFA-NET-02 | Client-Geräte (Rezeption-Desktop) müssen sich per TCP/IP-Verbindung zum Host verbinden und alle für ihre Rolle freigegebenen Funktionen nutzen können | MUST | Rezeption-PC verbindet sich über konfigurierbare IP:Port und kann Termine/Patienten/Zahlungen verwalten | ISO 25010 – Kompatibilität (Interoperabilität) |
| NFA-NET-03 | Das System muss auch als **dedizierter lokaler Server** (Headless-Modus) in der Praxis betrieben werden können, ohne dass ein Arzt-Desktop aktiv sein muss | SHOULD | Server-Binary startet ohne GUI; Clients verbinden sich; Datenbank bleibt konsistent | ISO 25010 – Übertragbarkeit (Anpassbarkeit) |
| NFA-NET-04 | Die Rezeption muss die Anwendung über einen **Webbrowser auf Smartphone oder Tablet** nutzen können. Der Host stellt dafür eine responsive Web-Oberfläche bereit. | MUST | Über `http://<host-ip>:<port>` erreichbar; alle Rezeptionsfunktionen auf 375px–768px bedienbar | ISO 9241-110 – Aufgabenangemessenheit |
| NFA-NET-05 | Die mobile/Tablet-Web-Oberfläche muss **alle Funktionen der Rolle REZEPTION** vollständig abdecken: Terminverwaltung, Patientenaufnahme, Zahlungsdokumentation, Patientenliste, Suche | MUST | Feature-Parität mit Desktop-Rezeptionsansicht; kein Funktionsverlust auf mobilen Geräten | ISO 25010 – Funktionale Eignung (Vollständigkeit) |
| NFA-NET-06 | Die Verbindung zwischen Client und Host muss über **authentifizierte Sitzungen** gesichert sein. Kein anonymer Zugriff auf den API-Server. | MUST | Login erforderlich; JWT- oder Session-Token-basierte Authentifizierung für jede API-Anfrage | ISO 27001 – A.9 Zugriffskontrolle, ISO 27799 |
| NFA-NET-07 | Die Kommunikation zwischen Client und Host **muss** im LAN über **TLS 1.3-verschlüsselte Verbindungen** (HTTPS) erfolgen. TLS ist im Netzwerk-Modus **standardmäßig aktiviert und nicht deaktivierbar**. | MUST | TLS-Zertifikat (selbstsigniert beim Erststart oder CA-konfiguriert); HTTPS ist Pflicht; kein Fallback auf HTTP | ISO 27001 – A.10 Kryptographie, ISO 27799 |
| NFA-NET-08 | Der Host muss eine **automatische Geräte-Erkennung** im LAN bereitstellen (mDNS/Bonjour oder konfigurierbare IP-Adresse) | SHOULD | Client findet Host automatisch oder über manuelle IP-Eingabe | ISO 9241-110 – Selbstbeschreibungsfähigkeit |
| NFA-NET-09 | Bei Verbindungsverlust zwischen Client und Host muss der Client den Benutzer sofort informieren und bei Wiederherstellung der Verbindung automatisch reconnecten | MUST | Visueller Hinweis „Verbindung unterbrochen"; automatischer Reconnect-Versuch alle 5 Sekunden | ISO 25010 – Zuverlässigkeit (Fehlertoleranz) |
| NFA-NET-10 | Die Datenbank verbleibt **ausschließlich auf dem Host**. Clients speichern keine Patientendaten lokal. | MUST | Kein SQLite-File auf Client-Geräten; alle Daten über API abgerufen | DSGVO Art. 5 (Datenminimierung), ISO 27799 |
| NFA-NET-11 | Der API-Server muss eine **Rate-Limiting**- und **IP-Whitelist**-Funktion unterstützen, um unbefugten Zugriff im Netzwerk zu verhindern | SHOULD | Konfigurierbare Whitelist für erlaubte Client-IPs; Rate-Limit pro Client | ISO 27001 – A.13 Kommunikationssicherheit |
| NFA-NET-12 | Das System muss im **Standalone-Modus** (ohne Netzwerk) vollständig auf einem einzelnen Rechner lauffähig bleiben | MUST | Einzelrechner-Betrieb ohne Netzwerkkonfiguration möglich; alle Funktionen verfügbar | ISO 25010 – Zuverlässigkeit (Verfügbarkeit) |

### 4.5 Zuverlässigkeit (NFA-REL)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-REL-01 | Das System muss **offline vollständig funktionsfähig** sein (kein Internet erforderlich) | MUST | Alle Kernfunktionen ohne Internetverbindung nutzbar | ISO 25010 – Zuverlässigkeit (Verfügbarkeit) |
| NFA-REL-02 | Bei Systemabsturz dürfen **keine Daten verloren gehen**; SQLite WAL-Modus muss ACID-Transaktionen gewährleisten | MUST | Nach Absturz und Neustart sind alle vor dem Absturz gespeicherten Daten vorhanden | ISO 25010 – Zuverlässigkeit (Fehlertoleranz) |
| NFA-REL-03 | Das Rust-Backend muss **Speichersicherheit** durch den Rust-Ownership-Compiler gewährleisten (kein `unsafe` ohne dokumentierte Begründung) | MUST | Kein undefiniertes Verhalten; keine Speicherlecks im Normalbetrieb | IEC 82304-1 – Produktsicherheit |
| NFA-REL-04 | Der Host-Server muss einen **Graceful Shutdown** durchführen: offene Transaktionen abschließen, verbundene Clients benachrichtigen | MUST | Kein Datenverlust beim Herunterfahren; Clients erhalten Shutdown-Nachricht | ISO 25010 – Zuverlässigkeit (Wiederherstellbarkeit) |
| NFA-REL-05 | Automatische **Datenbankintegritätsprüfung** beim Systemstart (PRAGMA integrity_check) | SHOULD | Beim Start wird die DB geprüft; bei Korruption Warnung + Backup-Wiederherstellungsoption | ISO 25010 – Zuverlässigkeit (Reife) |

### 4.6 Wartbarkeit (NFA-MAINT)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-MAINT-01 | **Modulare Schichtenarchitektur**: Präsentation, API, Geschäftslogik, Datenzugriff und Persistenz sind klar getrennt | MUST | Änderungen in einer Schicht erfordern keine Änderungen in anderen Schichten | ISO 25010 – Wartbarkeit (Modularität) |
| NFA-MAINT-02 | **Clean Architecture** im Rust-Backend: Domain → Application → Infrastructure mit Dependency Inversion | MUST | Domänenlogik hat keine Abhängigkeiten zu Framework oder DB-Details | ISO 25010 – Wartbarkeit (Modifizierbarkeit) |
| NFA-MAINT-03 | Wiederverwendbare **UI-Komponentenbibliothek** (Button, Input, Dialog, Toast, Card, Badge, EmptyState) | MUST | Alle UI-Elemente aus der Komponentenbibliothek zusammengesetzt; keine Inline-Styles | ISO 25010 – Wartbarkeit (Wiederverwendbarkeit) |
| NFA-MAINT-04 | **Strenge Typisierung**: TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`) im Frontend; Rust-Compiler-Warnungen als Fehler | MUST | `tsc --noEmit` und `cargo check` ohne Fehler oder Warnungen | ISO 25010 – Wartbarkeit (Analysierbarkeit) |
| NFA-MAINT-05 | **Strukturierte Fehlerbehandlung**: Rust `Result<T, E>` mit thiserror; Frontend mit toast-basiertem Error-Feedback | MUST | Kein `unwrap()` in Production-Code; alle Fehler dem Benutzer verständlich angezeigt | IEC 82304-1 – Produktsicherheit |
| NFA-MAINT-06 | **Automatisiertes Datenbankschema**: Migrationen und Seed-Daten als SQL-Dateien versioniert | MUST | Datenbank-Setup und -Migration reproduzierbar aus Quellcode | IEC 62304 – Konfigurationsmanagement |

### 4.7 Übertragbarkeit (NFA-PORT)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-PORT-01 | Die Desktop-Anwendung muss als **Cross-Platform-Installer** für macOS, Windows und Linux bereitgestellt werden | MUST | Tauri-Installer (DMG/MSI/AppImage) für alle drei Plattformen erzeugbar | ISO 25010 – Übertragbarkeit (Installierbarkeit) |
| NFA-PORT-02 | Die Web-Oberfläche (für mobile Clients) muss in **allen modernen Browsern** funktionieren: Chrome, Safari, Firefox, Edge (jeweils letzte 2 Major-Versionen) | MUST | Keine funktionalen Einschränkungen in den genannten Browsern | ISO 25010 – Übertragbarkeit (Anpassbarkeit) |
| NFA-PORT-03 | Keine Abhängigkeit von externen Cloud-Diensten oder Internetverbindung für den **klinischen Kernbetrieb** (Patienten, Termine, Behandlungen). Internetverbindung wird nur für Lizenzvalidierung (monatlich), Updates und Abonnement-Zahlung benötigt. | MUST | Alle klinischen Funktionen offline nutzbar; Lizenz-Offline-Karenz 30 Tage | ISO 25010 – Übertragbarkeit (Austauschbarkeit) |
| NFA-PORT-04 | Die Installation darf **keine externe Datenbank-Installation** erfordern (SQLite eingebettet) | MUST | Ein-Klick-Installation; Datenbank wird automatisch erstellt | ISO 25010 – Übertragbarkeit (Installierbarkeit) |

### 4.8 Kompatibilität (NFA-COMP)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-COMP-01 | Die Desktop-Anwendung muss als **eigenständiger Prozess** betrieben werden können, ohne andere installierte Software zu beeinträchtigen | MUST | Kein Portkonflikt im Standalone-Modus; keine systemweiten Abhängigkeiten | ISO 25010 – Kompatibilität (Koexistenz) |
| NFA-COMP-02 | **PDF-Export** für Finanzdaten, Rezepte, Atteste und Patientenakten | MUST | PDF-Dateien korrekt generiert und druckbar | ISO 25010 – Kompatibilität (Interoperabilität) |
| NFA-COMP-03 | **CSV/JSON-Export** für Datenübertragbarkeit (DSGVO Art. 20 Recht auf Datenübertragbarkeit) | MUST | Patientendaten als maschinenlesbares Format exportierbar | DSGVO Art. 20 |
| NFA-COMP-04 | Schnittstelle für **Röntgen-Software / Scanner** (Bildimport) | MUST | Bildimport über Datei-Upload oder Scanner-Integration möglich | ISO 25010 – Kompatibilität (Interoperabilität) |
| NFA-COMP-05 | **Drucker-Integration** über System-Druckdialog und PDF-Generierung | MUST | Druckfunktion aus System heraus nutzbar | ISO 25010 – Kompatibilität (Interoperabilität) |
| NFA-COMP-06 | Scanner-Workflow: Papierdokumente (Anamnesebogen) scannen und automatisch der Patientenakte zuordnen | MUST | Scan-Status-Meldung sichtbar; Dokument erscheint in Akte | ISO 25010 – Kompatibilität (Interoperabilität) |

### 4.9 Update-Infrastruktur (NFA-UPD)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-UPD-01 | Die App muss beim Start und periodisch (alle 24h) auf **neue Versionen** beim Hersteller-Update-Server prüfen | MUST | Prüfung erfolgt via HTTPS gegen den Hersteller-Endpunkt; bei neuer Version: Hinweis-Banner im UI | IEC 62304 Kap. 6 (Wartung), IEC 82304-1 Kap. 7 |
| NFA-UPD-02 | Updates müssen **Over-The-Air (OTA)** heruntergeladen und installiert werden können, ohne dass der Benutzer manuell eine neue Installationsdatei herunterladen muss | MUST | Tauri-Updater-Mechanismus konfiguriert; Download + Installation aus der App heraus | ISO 25010 – Wartbarkeit (Modifizierbarkeit) |
| NFA-UPD-03 | Vor jedem Update wird automatisch ein **vollständiges Backup der Datenbank** erstellt | MUST | Backup-Datei mit Zeitstempel vorhanden; bei Update-Fehler: Wiederherstellung möglich | ISO 27001 A.12.3 (Datensicherung) |
| NFA-UPD-04 | Die Datenbank muss bei Versionswechsel **automatisch migriert** werden (Schema-Migrationen, Seed-Daten) | MUST | Migrationen laufen beim ersten Start nach Update; DB-Schema-Version wird geprüft und aktualisiert | IEC 62304 Kap. 5.5 (Software-Einheitsimplementierung) |
| NFA-UPD-05 | Der Benutzer muss ein Update **explizit bestätigen** können. Normaler-Updates: „Jetzt aktualisieren" oder „Später erinnern". | MUST | Bestätigungsdialog mit Changelog/Release-Notes; Update wird nicht ohne Nutzerinteraktion gestartet | ISO 9241-110 – Steuerbarkeit |
| NFA-UPD-06 | Bei fehlgeschlagenem Update muss ein **automatischer Rollback** auf die vorherige Version und das vorherige DB-Backup erfolgen | MUST | App startet nach fehlgeschlagenem Update in der alten Version; Fehlerbericht wird generiert | ISO 25010 – Zuverlässigkeit (Wiederherstellbarkeit) |
| NFA-UPD-07 | **Release-Notes / Changelog** werden mit jedem Update ausgeliefert und dem Benutzer nach dem Update angezeigt (Dialog „Was ist neu?") | SHOULD | Changelog enthält: Versionsnummer, Datum, Zusammenfassung der Änderungen, Sicherheitshinweise | IEC 82304-1 Kap. 5.4 (Begleitdokumente) |
| NFA-UPD-08 | Kritische Sicherheitsupdates können vom Hersteller als **erzwungene Updates** markiert werden. Die App zeigt einen nicht-übergehbaren Dialog und blockiert die Nutzung bis zum Update. | SHOULD | Bei erzwungenem Update: „Sicherheitsupdate erforderlich – bitte jetzt aktualisieren"; keine Weiterarbeit ohne Update | IEC 82304-1 Kap. 7 (Nachmarktüberwachung) |
| NFA-UPD-09 | Der Update-Kanal muss über **digitale Signaturen** (Code-Signing) abgesichert sein, um manipulierte Updates zu verhindern | MUST | Tauri-Updater verifiziert die Signatur des Update-Pakets; bei ungültiger Signatur: Abbruch + Warnung | ISO 27001 A.14.2 (Sichere Entwicklung) |
| NFA-UPD-10 | **Versionsverwaltung** nach Semantic Versioning (MAJOR.MINOR.PATCH). Die aktuelle Versionsnummer ist im UI sichtbar (Einstellungen → Über) | MUST | Versionsnummer entspricht SemVer; in Einstellungen und im About-Dialog angezeigt | IEC 62304 Kap. 5.8 (Freigabe) |

### 4.10 Lizenz- & Abonnement-Infrastruktur (NFA-LIC)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-LIC-01 | Die Lizenzvalidierung muss über eine **HTTPS-verschlüsselte Verbindung** zum Hersteller-Lizenzserver erfolgen | MUST | Keine Klartextübertragung von Lizenzschlüsseln; TLS 1.3 | ISO 27001 A.10 (Kryptographie) |
| NFA-LIC-02 | Der Lizenzschlüssel muss **kryptographisch signiert** sein (z. B. RSA/Ed25519), um Fälschung zu verhindern. Offline-Validierung über Public-Key-Verifikation. | MUST | Manipulation des Lizenzschlüssels wird erkannt und abgelehnt | ISO 27001 A.14.2 (Sichere Entwicklung) |
| NFA-LIC-03 | Die Lizenzprüfung darf den **Normalbetrieb nicht blockieren** (max. 3s Timeout; bei Timeout: Offline-Karenzzeit beginnt) | MUST | Lizenzbprüfung asynchron; Timeout wird abgefangen; App funktioniert weiter innerhalb der Offline-Karenz | ISO 25010 – Leistungseffizienz (Zeitverhalten) |
| NFA-LIC-04 | Im Read-Only-Modus (abgelaufene Lizenz) müssen **Datenexporte** (PDF, CSV, JSON) weiterhin möglich sein, damit die Praxis auf ihre Daten zugreifen kann | MUST | Export-Funktionen funktionieren auch ohne aktive Lizenz; Praxisdaten sind niemals gesperrt | DSGVO Art. 20 (Datenübertragbarkeit) |
| NFA-LIC-05 | **Zahlungsdaten** (Kreditkarte, IBAN) dürfen **nicht lokal gespeichert** werden. Nur tokenisierte Referenzen des Payment-Providers werden in der lokalen DB abgelegt. | MUST | Kein PAN, IBAN oder CVV in praxis.db; nur Provider-Token-IDs | PCI-DSS, DSGVO Art. 5 (Datenminimierung) |
| NFA-LIC-06 | Die Kommunikation mit dem Hersteller-Server (Lizenz + Update + Payment) muss auf **dedizierte, dokumentierte Endpunkte** beschränkt sein; keine Telemetrie oder Tracking ohne explizite Zustimmung | MUST | Whitelist der kontaktierten Endpunkte im Benutzerhandbuch dokumentiert; keine versteckte Datenübertragung | DSGVO Art. 5 (Zweckbindung), ISO 27001 A.13 |

### 4.11 EU-Regulatorische Compliance (NFA-EU)

MeDoc wird im europäischen Gesundheitsmarkt vertrieben und muss allen relevanten EU-Verordnungen entsprechen. MeDoc verarbeitet besonders schützenswerte Gesundheitsdaten (DSGVO Art. 9 Abs. 2 lit. h) und steuert/empfängt Daten von Medizinprodukten.

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-EU-01 | Vollständige **DSGVO-Compliance** (EU 2016/679): Privacy by Design (Art. 25), Verarbeitungsverzeichnis (Art. 30), Recht auf Löschung (Art. 17), Datenübertragbarkeit (Art. 20), Datenschutz-Folgenabschätzung (Art. 35) für Gesundheitsdaten | MUST | DSFA-Dokument erstellt; VVT vollständig; Lösch- und Exportfunktionen implementiert | DSGVO (EU 2016/679) |
| NFA-EU-02 | **MDR-Konformitätsprüfung** (EU 2017/745): MeDoc verarbeitet medizinische Befunddaten und interagiert mit Medizinprodukten. Klassifizierung nach Anhang VIII Regel 11 durchführen; ggf. als Klasse-I-Medizinprodukt (Software) bei zuständiger Behörde registrieren. | MUST | Klassifizierungsdokument erstellt; bei Klasse I: EU-Konformitätserklärung, technische Dokumentation, UDI-Registrierung | MDR (EU 2017/745) |
| NFA-EU-03 | **CE-Kennzeichnung**: Falls MeDoc als Medizinprodukt-Software eingestuft wird → Konformitätsbewertung nach MDR Anhang IX, EU-Konformitätserklärung, CE-Kennzeichnung auf Software und Verpackung | MUST (bei Klassifizierung) | CE-Kennzeichnung sichtbar in About-Dialog und Installationsmedium; Konformitätserklärung abrufbar | MDR (EU 2017/745) Art. 20 |
| NFA-EU-04 | **NIS2-Richtlinie** (EU 2022/2555): Gesundheitssektor = „wesentlicher Sektor". Pflicht zur Risikobewertung, Sicherheitsvorfallmeldung (72h an nationale Behörde), Lieferketten-Sicherheitsbewertung | SHOULD | Risikobewertungsdokument erstellt; Incident-Response-Plan mit 72h-Meldefrist definiert; SOUP-CVE-Monitoring aktiv | NIS2 (EU 2022/2555) |
| NFA-EU-05 | **eIDAS-Konformität** (EU 910/2014): Digitale Signaturen auf Rezepten und Attesten müssen den Anforderungen für fortgeschrittene/qualifizierte elektronische Signaturen entsprechen, sobald diese Funktion aktiviert wird | SHOULD | Signatur-Modul unterstützt qualifizierte Zertifikate; Signaturformat: PAdES (PDF) oder XAdES (XML) | eIDAS (EU 910/2014) |
| NFA-EU-06 | **EU AI Act** (2024/1689): Falls KI-basierte Funktionen integriert werden (z.B. Karies-Erkennung, automatische Befundung), gelten diese als **Hochrisiko-KI** im Gesundheitsbereich. Pflicht: Transparenz, Erklärbarkeit, menschliche Aufsicht, Risikomanagement-System | NICE TO HAVE | Bei KI-Integration: Risikomanagement-Dokumentation, Transparenzhinweis im UI, menschliche Bestätigung vor Übernahme von KI-Befunden | EU AI Act (2024/1689) |
| NFA-EU-07 | **EN ISO 13485:2016** QMS: Wenn MeDoc als Medizinprodukt klassifiziert wird → Qualitätsmanagementsystem nach EN ISO 13485 einrichten und aufrechterhalten | MUST (bei Klassifizierung) | QMS-Dokumentation vorhanden; interne Audits geplant; Korrekturmaßnahmen-Prozess definiert | EN ISO 13485:2016 |
| NFA-EU-08 | **EN ISO 14971:2019** Risikomanagement: Risikomanagement-Akte für MeDoc führen (Gefährdungsanalyse, Risikobewertung, Risikominderung, Restrisiko-Akzeptanz) | MUST | Risikomanagement-Akte erstellt; alle identifizierten Risiken bewertet und mitigiert | EN ISO 14971:2019 |
| NFA-EU-09 | **EN 62366-1:2015** Gebrauchstauglichkeit: Usability-Engineering-Akte führen; Gebrauchstauglichkeitsstudie mit repräsentativen Nutzern (Zahnarzt, Rezeption) durchführen | SHOULD | Usability-Studie mit ≥ 5 Testpersonen pro Rolle; dokumentierte Ergebnisse und Maßnahmen | EN 62366-1:2015 |
| NFA-EU-10 | Die Anwendung muss in **deutscher Sprache** verfügbar sein (UI, Fehlermeldungen, Dokumentation). Weitere EU-Sprachen (Englisch, Französisch) als zukünftige Erweiterung vorsehen (i18n-Architektur). | MUST | Deutsche Lokalisierung vollständig; i18n-Framework eingerichtet (Texte in Sprachdateien, nicht hardcoded) | MDR Anhang I Kap. III 23.4 |

### 4.12 Geräteanbindung & Infrastruktur (NFA-DEV)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-DEV-01 | **DICOM-Conformance Statement**: MeDoc muss ein DICOM-Konformitätserklärung veröffentlichen, die unterstützte SOP-Klassen (Storage, Worklist, Query/Retrieve), Transfer-Syntaxen und Netzwerk-Parameter dokumentiert | MUST | Conformance Statement als PDF im Benutzerhandbuch; listet alle unterstützten DICOM-Services | DICOM PS3.2, MDR Anhang I |
| NFA-DEV-02 | **DICOM-Netzwerksicherheit**: DICOM-Kommunikation muss über TLS 1.3 verschlüsselt werden können (DICOM Port 2762). Im LAN: Konfigurierbar zwischen Port 104 (Standard) und 2762 (TLS). | MUST | TLS für DICOM konfigurierbar; selbstsigniertes oder CA-Zertifikat; Audit-Log für DICOM-Verbindungen | ISO 27001 A.10, DICOM PS3.15 |
| NFA-DEV-03 | **Geräte-Hotplug**: USB-Geräte (Sensoren, Kameras, Scanner) müssen ohne Neustart der Anwendung erkannt werden. Plug-and-Play-Unterstützung über OS-Treiber-Events. | SHOULD | Gerät wird innerhalb von 5s nach Anschluss in der Geräteliste angezeigt; Testbild kann sofort aufgenommen werden | ISO 25010 – Kompatibilität |
| NFA-DEV-04 | **Bildkompression**: Empfangene DICOM-Bilder können in JPEG 2000 (verlustfrei) oder JPEG (verlustbehaftet, konfigurierbar) komprimiert werden, um Speicherplatz zu sparen. Originalbilder bleiben optional erhalten. | SHOULD | Kompressionseinstellung in Einstellungen → Bildgebung; Kompressionsrate und Qualitätsstufe wählbar | DICOM PS3.5 |
| NFA-DEV-05 | **Mindest-Infrastruktur am Host-PC**: ≥ 4 USB-3.0-Ports, Gigabit-Ethernet, ≥ 16 GB RAM, ≥ 256 GB SSD. Diese Anforderungen müssen in der Installationsanleitung dokumentiert sein. | MUST | Systemvoraussetzungen im Benutzerhandbuch und beim Installationsprozess geprüft | IEC 82304-1 Kap. 5.4 |
| NFA-DEV-06 | **RS-232-Kompatibilität**: Für Legacy-Dentaleinheiten mit serieller Schnittstelle muss die Anbindung über USB-zu-RS-232-Adapter unterstützt werden | SHOULD | Serieller Port in Geräte-Einstellungen konfigurierbar (COM-Port/Baudrate); Datenempfang getestet | ISO 25010 – Kompatibilität |
| NFA-DEV-07 | **Bildarchiv-Verschlüsselung**: Alle lokal gespeicherten medizinischen Bilder müssen mit AES-256 verschlüsselt sein (Encryption at Rest). Kein Klartext-DICOM auf der Festplatte. | MUST | Bilddateien sind ohne DB-Masterkey nicht lesbar; verschlüsselter Container oder Dateiverschlüsselung | ISO 27799, NFA-SEC-08 |

### 4.13 Regulatorische Prozess- & Dokumentationsanforderungen

Die folgenden Anforderungen ergeben sich aus der Analyse relevanter ISO-Normen und der DSGVO. MeDoc verarbeitet besonders schützenswerte Gesundheitsdaten (DSGVO Art. 9) und muss daher erhöhte Anforderungen an Sicherheit, Datenschutz und Qualität erfüllen. Die vollständige Normenanalyse befindet sich in `docs/iso-standards/`.

#### 4.13.1 Prozessanforderungen (NFA-PROC)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-PROC-01 | Formaler Softwarefreigabeprozess: Versionierung, Freigabekriterien, Freigabedokumentation | MUST | Jede Version hat dokumentierte Freigabe mit Versionsnummer und Änderungshistorie | IEC 62304 Kap. 5.8 |
| NFA-PROC-02 | SOUP-Liste: Alle Drittanbieter-Komponenten mit Name, Version, Lizenz, Zweck, bekannten Risiken dokumentieren | MUST | Liste enthält mindestens: React 19, Tauri v2, SQLite, sqlx, bcrypt, Zustand, React Router, Recharts, TailwindCSS | IEC 62304 Kap. 5.3, 8.1 |
| NFA-PROC-03 | Bug-Tracking-Prozess: Fehlerberichte, Priorisierung, Zuordnung, Verfolgung bis Lösung | SHOULD | Issue-Tracker (z.B. GitHub Issues) eingerichtet und dokumentiert | IEC 62304 Kap. 9 |
| NFA-PROC-04 | Software-Wartungsplan: Update-Zyklen, Sicherheitspatches, Kompatibilitätstests | SHOULD | Wartungsplan-Dokument erstellt und gepflegt | IEC 62304 Kap. 6 |
| NFA-PROC-05 | Feedback-Prozess: Erfassung von Nutzerproblemen und Sicherheitsmeldungen aus dem Praxisbetrieb | SHOULD | Feedback-Kanal definiert; regelmäßige Auswertung dokumentiert | ISO 14971 Kap. 10 |
| NFA-PROC-06 | Nachmarktüberwachung: Überwachung bekannter Sicherheitslücken in SOUP-Komponenten, zeitnahe Updates | SHOULD | Prozess für CVE-Monitoring der verwendeten Bibliotheken definiert | IEC 82304-1 Kap. 7 |

#### 4.13.2 Dokumentationsanforderungen (NFA-DOC)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-DOC-01 | Benutzerhandbuch mit Installationsanleitung, Systemvoraussetzungen, Sicherheitshinweisen, Backup-/Wiederherstellungsanleitung und bestimmungsgemäßem Gebrauch | MUST | Handbuch vorhanden und aktuell; alle Kapitel vollständig | IEC 82304-1 Kap. 5.4 |
| NFA-DOC-02 | Verzeichnis der Verarbeitungstätigkeiten (VVT) gemäß DSGVO Art. 30: Datenkategorien, Rechtsgrundlagen, Empfänger, Löschfristen | MUST | VVT-Dokument vorhanden mit allen Datenkategorien (Patienten-, Gesundheits-, Finanz-, Personal-, Audit-Daten) | DSGVO Art. 30 |

#### 4.13.3 Datenschutz-Lebenszyklus (NFA-DATA)

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-DATA-01 | Patientenakten unterliegen einer automatischen Löschsperre für die gesetzliche 10-jährige Aufbewahrungspflicht. Nach Ablauf muss eine kontrollierte Löschung möglich sein. | MUST | Löschversuch innerhalb der Frist wird abgelehnt mit Hinweis; nach Ablauf: Löschfunktion verfügbar | DSGVO Art. 17, §630f Abs. 3 BGB |

#### 4.13.4 Erweiterte Sicherheitsanforderungen

| ID | Anforderung | Priorität | Akzeptanzkriterium | Normbezug |
|----|------------|-----------|-------------------|-----------| 
| NFA-SEC-04+ | Audit-Log erweitert: Auch Lesezugriffe auf Patientendaten müssen protokolliert werden (nicht nur Schreibzugriffe) | MUST | Bei jedem Öffnen einer Patientenakte wird ein Log-Eintrag erzeugt | ISO 27799 |
| NFA-SEC-04++ | Audit-Logs müssen manipulationssicher sein: Keine Lösch- oder Editierfunktion für Log-Einträge | MUST | Kein API-Endpunkt oder UI-Element zum Löschen/Bearbeiten von Logs | ISO 27001 A.12.4 |
| NFA-SEC-07 | Audit-Logs müssen mindestens 10 Jahre aufbewahrt werden | MUST | Archivierungsstrategie dokumentiert; alte Logs nicht automatisch gelöscht | ISO 27799, §10 MBO-Ä |

---

## 5. Datenmodell (Entitäten)

| Entität | Schlüsselattribute |
|---------|-------------------|
| Patient | name, geburtsdatum, geschlecht, versicherungsnummer, kontaktdaten, profilbild |
| Termin | datum, uhrzeit, art, status, patientId, arztId, farbkodierung |
| Patientenakte | patientenId, behandlungsverlauf, diagnose, befunde, notizen |
| Untersuchung | beschwerden, ergebnisse, diagnose, bildmaterial, akteId |
| Behandlung | behandlungsart, verlauf, materialien, erfolg, abbruchgrund, akteId |
| Anamnesebogen | fragen, antworten, unterschrieben, patientId |
| Zahlung | betrag, zahlungsart, zeitpunkt, status, patientId |
| Leistung | name, kategorie, preis |
| Personal | name, taetigkeitsbereich, rolle, email, telefon, verfuegbarkeit, fachrichtung |
| Produkt | name, lieferant, menge, lieferstatus, hersteller |
| Finanzdokument | typ, eingaben, ausgaben, zeitraum |
| Steuerberater | firmenname, personenname, email, telefon, verfuegbarkeit |
| Rezept | patientId, arztId, medikamente[], ausstellungsdatum, status |
| RezeptMedikament | medikament, wirkstoff, dosierung, haeufigkeit, dauer |
| Attest | patientId, arztId, attesttyp, freitext, gueltigkeitsdauer, datum, status |
| Bilanz | name, zeitraumVon, zeitraumBis, kategorien, einnahmen, ausgaben, saldo |
| Einstellungen | userId, profilbild, email, passwortHash |
| Pharmaberater | firmenname, personenname, taetigkeitsbereich, email, telefon |
| **Lizenz** | **lizenzschluessel, abo_stufe (BASIS/PROFESSIONAL/ENTERPRISE), ablaufdatum, max_geraete, aktiviert_am, letzte_validierung, status (AKTIV/KARENZ/ABGELAUFEN/READONL)** |
| **AbonnementZahlung** | **lizenzId, provider_token, betrag, waehrung, zahlungsart, status (BEZAHLT/FEHLGESCHLAGEN/AUSSTEHEND), rechnungs_pdf_url, datum** |
| **AppVersion** | **version (SemVer), installiert_am, vorherige_version, update_kanal, signatur_gueltig** |
| **MigrationJob** | **quellsystem, importformat (VDDS/BDT/CSV/JSON/DICOM), status (GEPLANT/LAUFEND/ABGESCHLOSSEN/FEHLER), gestartet_am, beendet_am, datensaetze_importiert, datensaetze_fehlerhaft, bericht_pdf_url, snapshot_id** |
| **MedizinischesBild** | **patientId, geraet_id, bildtyp (INTRAORAL/OPG/CBCT/FOTO/SCAN3D), dateiformat (DICOM/JPEG/TIFF/STL), aufnahmedatum, dicom_study_uid, dicom_series_uid, dateipfad_verschluesselt, kompression, annotationen[]** |
| **Geraet** | **name, geraetetyp (ROENTGEN_INTRAORAL/OPG/CBCT/IOS/KAMERA/DENTALEINHEIT/CADCAM), hersteller, modell, schnittstelle (USB/ETHERNET/RS232/WIFI), protokoll (DICOM/TWAIN/GDT/VDDS_MEDIA/PROPRIETAER), ip_adresse, port, ae_title, com_port, baudrate, status (VERBUNDEN/GETRENNT/KONFIGURIERT)** |

---

## 6. Abnahmekriterien (→ Phase 9: Abnahmetest)

Für jede funktionale Anforderung (FA-*) existiert ein korrespondierendes
Akzeptanzkriterium. Der Abnahmetest gilt als bestanden, wenn:

1. Alle MUST-Anforderungen erfüllt sind
2. Mindestens 80% der SHOULD-Anforderungen erfüllt sind
3. Die Benutzeroberfläche den Nielsen-Heuristiken entspricht (Score ≥ 80%, gemessen durch heuristische Evaluation mit ≥ 3 Evaluatoren)
4. Die Primär-Personas (Anna Scholz / Dr. Markus Lehner) ihre Kernaufgaben
   in < 5 Klicks erledigen können
5. Kein kritischer Sicherheits- oder Datenverlust-Bug existiert
6. Lizenzaktivierung und -validierung funktionieren online und offline (Karenz)
7. Abonnement-Zahlungsfluss über Payment-Provider erfolgreich durchlaufen
8. OTA-Update-Mechanismus inkl. Backup, Migration und Rollback getestet
9. Datenmigration aus mindestens 2 Quellsystemen (VDDS-transfer, BDT) mit Dry-Run, Validierung und Rollback erfolgreich getestet
10. DICOM-Bildempfang und -speicherung von Panorama-OPG und Intraoral-Sensor funktioniert; Bilder korrekt dem Patienten zugeordnet
11. Geräte-Konfiguration in Einstellungen → Geräte für mindestens 3 Gerätetypen (Sensor, OPG, Kamera) getestet
12. EU-Regulatorische Dokumentation (MDR-Klassifizierung, DSFA, Risikomanagement-Akte) vorhanden und vollständig
13. System Usability Scale (SUS) Score ≥ 72 (gemessen mit ≥ 10 Testpersonen)
14. WCAG 2.1 Level AA Compliance: automatisierter Accessibility-Audit zeigt 0 kritische Verstöße
15. Usability-Test mit ≥ 5 Personen pro Rolle (ARZT, REZEPTION) dokumentiert; kritische Findings behoben
