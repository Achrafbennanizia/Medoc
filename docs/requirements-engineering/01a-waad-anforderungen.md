# 1a. WAAD-Anforderungen — Ableitung aus Stakeholder-Analyse

**Quelle:** `docs/requirements-engineering/source/anforderungen-ableitung-waad.pdf`
(„Anforderungen-Ableitung der Anforderungen", PDF-Export der WAAD-Knoten-Tabelle —
4 Seiten, 9 Hauptkategorien, 39 Einzelanforderungen)

**Zweck:** Dieses Kapitel hält die in der Bachelorarbeit / Frühphase erhobenen
Roh-Anforderungen **wortgetreu** mit ihren ursprünglichen WAAD-Knoten-IDs
(„Quell-IDs") fest. Es ergänzt die freie Aufzählung in `01-sammeln.md` um die
strukturierte, klassifizierte und priorisierte Originalfassung.

Die Übersetzung in normierte Pflichtenheft-Anforderungen (FA-* / NFA-*) und der
vollständige Implementierungsstatus stehen in
`01b-traceability-waad.md` und im
`docs/v-model/01-anforderungen/pflichtenheft.md`.

**Klassifikationsskala (MoSCoW + ISO 25010):**

| Kürzel | Bedeutung |
|---|---|
| MUST | Pflicht; ohne diese Funktion ist das System nicht abnahmefähig. |
| SHOULD | Soll; wichtig, aber Workaround temporär möglich. |
| NICE TO HAVE | Optional; Mehrwert, kein Blocker. |
| Funktional | Verhalten / sichtbare Funktion. |
| Nicht-Funktional | Qualitätsmerkmal (Sicherheit, Usability, Performance, Verfügbarkeit, Zuverlässigkeit). |

---

## ID 1 — Patientenaufnahme & Terminmanagement (Rezeption)

### ID 1.1 Stammdatenerfassung

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **1.1.1** | Das System MUSS ein klar strukturiertes, responsives Interface bereitstellen, das eine schnelle, fehlerarme Erfassung von Stammdaten (Name, Geburtsdatum, Versicherung etc.) ermöglicht. Pflichtfelder müssen visuell hervorgehoben und validiert sein. | MUST · Funktional | Basisfunktion für Patientenaufnahme; Reduktion von Eingabefehlern. | — |

### ID 1.2 Terminverwaltung & Erstkontakt-Organisation

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **1.2.1** | Das System MUSS Funktionen zum Anlegen, Verschieben und Löschen von Terminen bieten, inkl. Konfliktprüfung und visuellem Kalender. Termine müssen farblich unterscheidbar sein (z. B. Art der Behandlung). | MUST · Funktional | Zentrale Funktion im Patientenkontakt, Voraussetzung für Praxisorganisation. | — |
| **1.2.2** | Das System MUSS die Möglichkeit bieten, Sofort- oder Notfalltermine („Heute"/„Jetzt") mit Priorisierung direkt einzugeben. Diese Termine müssen klar gekennzeichnet sein. | MUST · Funktional | Wichtig bei spontanen Patientenkontakten oder medizinischen Notfällen. | — |
| **1.2.3** | Das System SOLL ermöglichen, Termine über längere Zeiträume hinweg zu planen (z. B. in der nächsten Woche oder Monat). | SHOULD · Funktional | Entlastung bei nicht-akuten Fällen, bessere langfristige Planung. | Eine Erinnerungsfunktion (z. B. SMS/E-Mail) SOLL optional verfügbar sein. |
| **1.2.4** | Bei Terminänderungen MUSS das System automatisch eine Benachrichtigung generieren und neue Vorschläge anbieten. | MUST · Funktional | Vermeidung von Missverständnissen und Terminausfällen. | DARF optional an Patientenkommunikation (E-Mail / SMS) angebunden sein. |

### ID 1.3 Rollenlogik (Rezeption)

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **1.3.1** | Das System SOLL eine strukturierte Weiterleitungsfunktion zur ärztlichen Akte anbieten, inkl. Auswahloptionen in Listenform (z. B. „Akte an Arzt weiterleiten"). | SHOULD · Funktional | Klare und fehlerarme Kommunikation zwischen Rezeption und Arzt. | Form (Dropdown / Liste) flexibel; Mehrfachauswahl für Empfänger:innen SOLLTE möglich sein. |
| **1.3.2** | Das System MUSS eine rollenbasierte Zugriffskontrolle implementieren, bei der die Rezeption standardmäßig keinen Zugriff auf medizinische Inhalte hat. Zugriffsrechte müssen vom Arzt individuell vergeben werden können. | MUST · Nicht-Funktional (Sicherheit) | Datenschutz & klare Zuständigkeiten. | — |
| **1.3.3** | Das System SOLL dem Arzt eine vollständige, filterbare Übersicht aller Termine bereitstellen. | SHOULD · Funktional | Transparenz im Praxisablauf, bessere Organisation. | Filterbar z. B. nach Tag, Patient, Raum. |

---

## ID 2 — Rechte- und Zugriffskontrolle

### ID 2.1 Zugriffsverwaltung

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **2.1.1** | Das System MUSS eine Benutzerhierarchie implementieren, in der die Rolle „Rezeption" standardmäßig keinen Zugriff auf vollständige Patientendaten hat. Nur der Arzt darf explizit und gezielt Lesezugriff auf bestimmte Aktenbereiche gewähren oder entziehen. | MUST · Nicht-Funktional (Sicherheit) | Schutz sensibler Daten, klare Rollentrennung. | Rechte SOLLEN vom Arzt individuell konfigurierbar sein — differenziert nach Akteninhalt oder Patientengruppe. |
| **2.1.2** | Die Rezeption darf keine medizinischen Informationen eingeben oder bearbeiten. Das System MUSS dies durch rollenbasierte Schreibrechte technisch absichern. | MUST · Nicht-Funktional (Sicherheit) | Vermeidung fachlicher Fehler, rechtliche Absicherung. | Einschränkung der Schreibrechte SOLL durch den Arzt für ausgewählte Kontexte einstellbar sein. |
| **2.1.3** | Nur der Arzt darf medizinische Inhalte wie Diagnosen, Behandlungen oder Verläufe erstellen und verändern. Das System MUSS dies rollenbasiert absichern. | MUST · Nicht-Funktional (Sicherheit) | Sicherstellung der medizinischen Verantwortung. | Funktion SOLL parametrierbar sein (z. B. für bestimmte Patienten oder Datentypen). |
| **2.1.4** | Im Standardzustand SOLL die Sichtbarkeit von Akten für die Rezeption aktiviert sein (nur lesend), es sei denn, der Arzt deaktiviert dies ausdrücklich. | SHOULD · Nicht-Funktional (Sicherheit) | Effizienz im Ablauf bei gleichzeitiger Kontrolle durch den Arzt. | Funktion SOLL parametrierbar sein. |

### ID 2.2 Rollenlogik (Arzt-Workflow)

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **2.2.1** | Das System MUSS ein Interface zur Validierung von Akten anzeigen, in dem alle noch zu prüfenden Einträge für den Arzt sichtbar sind (z. B. zur täglichen Kontrolle). | MUST · Funktional | Fehlerkontrolle und rechtssichere Dokumentation. | — |
| **2.2.2** | Alle Akteneinträge MÜSSEN durch den Arzt validiert und erst danach in der Datenbank final gespeichert werden. | MUST · Funktional | Medizinische und rechtliche Verantwortung liegt beim Arzt. | Implizit: Eintrag besitzt einen „Pending"-Zustand bis zur Validierung. |
| **2.2.3** | Das System SOLL optional ermöglichen, dass ausschließlich der Arzt medizinische Inhalte verwalten soll, einschließlich Ergänzungen und Änderungen (Sicherheitspräferenz). | SHOULD · Nicht-Funktional (Sicherheit) | Erhöhte Kontrolle und Datensicherheit. | Ein zentrales Interface zur Rechtevergabe MUSS technisch realisiert sein. |
| **2.2.4** | Der Arzt MUSS über eine zentrale Oberfläche individuelle Berechtigungen an andere Rollen vergeben oder entziehen können. | MUST · Funktional | Transparente Rollensteuerung und Verantwortungsklarheit. | — |
| **2.2.5** | Das System SOLL ein interaktives Dashboard für Ärzte bereitstellen, das Überblick über Termine, Befunde, Dokumentationen und Freigaben bietet. | SHOULD · Funktional | Erhöht Effizienz und minimiert Navigationsaufwand in stressigen Situationen. | Funktionen „Daten ergänzen" / „Daten ändern" SOLLEN auf Berechtigungen basieren. |

---

## ID 3 — Ärztliche Behandlung & Dokumentation (Arzt)

### ID 3.1 Diagnose, Behandlung, Verlauf

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **3.1.1** | Das System MUSS ein klares, intuitives Interface zur strukturierten Erfassung medizinischer Informationen bieten. Dazu zählen Diagnose, Behandlungsschritte, Verlauf und ärztliche Anweisungen. | MUST · Funktional | Vollständige und nachvollziehbare medizinische Dokumentation. | Eingabemaske MUSS Eingabehilfen (Auswahlfelder, Validierung) enthalten. |
| **3.1.2** | Das System SOLL ermöglichen, Diagnosen, Atteste und Rezepte effizient zu erstellen und direkt in der Patientenakte zu speichern. | SHOULD · Funktional | Zeitersparnis, Standardisierung, Reduktion von Fehlern. | Optional: Schnellzugriff auf häufig genutzte Vorlagen + visuelles Modell (z. B. 2D-Anatomie). |
| **3.1.3** | Das System MUSS erlauben, medizinische Einträge nachträglich zu ergänzen oder zu aktualisieren. | MUST · Funktional | Sichert Transparenz und Nachvollziehbarkeit in der Patientenakte. | Versioniert speichern; Änderungen mit Zeitstempel + Benutzerkennung dokumentieren. |
| **3.1.4** | Das System MUSS ermöglichen, medizinische Anhänge (z. B. Röntgenbilder, Laborberichte, externe PDFs) mit Dokumenttyp, Referenznummer und optionalen Tags in strukturierter Form zu speichern. | MUST · Funktional | Vollständige Dokumentation medizinischer Daten mit schneller Wiederauffindbarkeit. | — |

---

## ID 4 — Patientenakte & Archivierung

### ID 4.1 Vollständigkeit

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **4.1.1** | Das System MUSS ein Eingabefeld für zusätzliche Verwaltungsdaten bieten (Versicherungsnummer, Zugehörigkeit zu Versicherungsträgern, Besonderheiten). Die Informationen MÜSSEN sicher in der Akte gespeichert werden. | MUST · Funktional | Vollständige, nachvollziehbare Patientendaten für Abrechnung und Nachverfolgung. | — |
| **4.1.2** | Das System SOLL es ermöglichen, Atteste, Rezepte und zusätzliche Dokumente zu erstellen und automatisch in der Patientenakte zu archivieren. | SHOULD · Funktional | Reduktion von Papierdokumenten, effizientere Nachvollziehbarkeit. | — |
| **4.1.3** | Für physische Dokumente MUSS das System die Möglichkeit bieten, Dokumenttyp und eindeutige ID zu erfassen und zu speichern. Ein Such-/Filtermechanismus muss die Wiederauffindbarkeit unterstützen. | MUST · Funktional | Strukturierte Archivierung externer Dokumente, schnelles Wiederfinden. | Übergangslösung für papierbasierte Praxen — erleichtert Umstieg auf digitale Archivierung. |
| **4.1.4** | Das System MUSS Belegnummern (z. B. von Quittungen, Rechnungen, Rezepten) in der Patientenakte erfassen und zuordnen können, optional auch als Scan. | MUST · Funktional | Erleichtert Kostenerstattung, Abrechnung und Kontrolle. | Für Einrichtungen mit Papierbelegen — erleichtert Einstieg in digitale Belegverfolgung. |

### ID 4.2 Ordnung medizinischer Daten

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **4.2.1** | Das System SOLL eine verständliche, konsistente Benutzeroberfläche für die Eingabe und Anzeige medizinischer Daten bieten. Alle Informationen SOLLEN jederzeit nachvollziehbar und versioniert sein. | SHOULD · Funktional | Effizientes Arbeiten und Fehlervermeidung durch Klarheit. | — |
| **4.2.2** | Das System MUSS über eine intelligente Suchfunktion verfügen, die auch bei Namensähnlichkeiten oder Teilsuchen zuverlässige Ergebnisse liefert. | MUST · Funktional | Fehlerminimierung bei Auswahl ähnlicher Patientendatensätze. | Z. B. Auto-Vervollständigung, phonemische Ähnlichkeit. |

---

## ID 5 — Nachsorge & Kommunikation (Rezeption & Arzt)

### ID 5.1 Weitergabe wichtiger Infos

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **5.1.1** | Das System DARF ermöglichen, dass ärztlich relevante Informationen zur Weiterbehandlung (z. B. Medikation, Kontrolltermin, Facharztüberweisung) am Ende der Behandlung für Patient:innen zusammengefasst und übergeben werden können. | NICE TO HAVE · Funktional | Sichert Behandlungserfolg durch klare Weitergabe wichtiger Informationen. | „Discharge Summary"/Patientenmerkblatt am Behandlungsende. |
| **5.1.2** | Die Kommunikation zwischen Rezeption und Arzt DARF auf ein funktional erforderliches Minimum reduziert werden können (z. B. durch automatisierte Freigaben, Hinweise oder digitale Weiterleitungen). | NICE TO HAVE · Nicht-Funktional (Effizienz) | Reduziert Zeitaufwand und Fehlerpotenzial durch ständige Rückfragen. | — |

### ID 5.2 Patientenkommunikation

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **5.2.1** | Die Rezeption MUSS Patient:innen über verordnete Medikamente, Kontrolltermine oder Folgeschritte informieren können, basierend auf vom Arzt freigegebenen Informationen. | MUST · Funktional | Unterstützt Patientencompliance und sichert Nachsorge. | System SOLL durch strukturierte Filter / Entscheidungslogik Vorschläge machen, wann Anliegen weitergeleitet werden müssen. |
| **5.2.2** | Rückfragen DARF über ein Ticket- oder Notizsystem dokumentiert und automatisch der verantwortlichen ärztlichen Person zugeordnet werden. | NICE TO HAVE · Funktional | Sichert Kommunikation und Nachvollziehbarkeit im Behandlungsverlauf. | — |
| **5.2.3** | Das System MUSS es ermöglichen, Ausdrucke oder digitale Dokumente (z. B. PDFs) direkt aus der Patientenakte zu generieren und für Patient:innen bereitzustellen. | MUST · Funktional | Vollständige Informationsweitergabe für Patient:innen. | — |

---

## ID 6 — Leistungen & Kostenmanagement (Rezeption & Arzt)

### ID 6.1 Finanzverwaltung & Dokumentation

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **6.1.1** | Die Rezeption MUSS sämtliche Einnahmen dokumentieren können (bar). Das System MUSS Eingabehilfen, Validierung (z. B. Betragsfelder) und Tagesabschlussübersichten bieten. | MUST · Funktional | Grundlage für Kassensturz, Buchhaltung und Steuerabwicklung. | — |
| **6.1.2** | Kostenpflichtige Leistungen MÜSSEN im System vom Arzt freigegeben werden, bevor sie verrechnet oder dokumentiert werden dürfen. Beträge DÜRFEN vorher definiert sein, um den Freigabeprozess zu automatisieren. | MUST · Funktional | Medizinisch-inhaltliche Kontrolle über abrechenbare Leistungen. | — |
| **6.1.3** | Das System SOLL eine Funktion zur strukturierten Verwaltung von Erstattungsbelegen bieten. Belege müssen parametrisch filterbar sein und zugeordnet werden können. | SHOULD · Funktional | Erleichtert Verwaltung, Kontrolle und Rückverfolgung von Ausgaben. | Filter z. B. nach Datum, Betrag, Kategorie. |
| **6.1.4** | Das System SOLL eine Einkaufsübersicht bereitstellen, die alle Artikel und deren Zustände auflistet. | SHOULD · Funktional | Ermöglicht Bestandskontrolle, Nachbestellung und Rückverfolgbarkeit. | Z. B. Menge, Lagerort, Lieferdatum. |

### ID 6.2 Kontrolle

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **6.2.1** | Das System MUSS eine Übersicht über sämtliche Ausgaben, Einnahmen, Gewinne und Verluste bieten. Diese Übersicht SOLL nach Zeiträumen filterbar und exportierbar sein. | MUST · Funktional | Transparenz und Kontrolle für Praxisführung und Steuerberatung. | — |
| **6.2.2** | Das System MUSS automatisch Statistiken über Leistungen, Einnahmen, Kosten und Erstattungen generieren können. | MUST · Funktional | Erleichtert wirtschaftliche Analyse, Abrechnung, Planung. | Z. B. Balkendiagramm nach Monat, pro Arzt oder pro Leistung. |
| **6.2.3** | Das System MUSS Ausdrucke oder PDF-Exporte aller Umsätze für die Steueranmeldung bereitstellen. | MUST · Funktional | Pflicht für Steuerprüfung, Buchhaltung und Archiv. | — |
| **6.2.4** | Die Rezeption DARF Zugriff auf aktuelle Preislisten haben; der Arzt MUSS die jeweils erbrachten Leistungen digital bestätigen. | NICE TO HAVE · Funktional | Fehlerreduktion und klare Verantwortlichkeit bei der Abrechnung. | — |

---

## ID 7 — Standardisierung, Zeitersparnis & Fehlervermeidung

### ID 7.1 Effizienz, Vorlagen, UI-Hilfen

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **7.1.1** | Das System SOLL vordefinierte Attest- und Rezeptvorlagen bereitstellen, die individuell angepasst und schnell ausgewählt werden können. | SHOULD · Funktional | Reduziert Dokumentationsaufwand und verhindert Wiederholfehler. | — |
| **7.1.2** | Das System MUSS Optionslisten für Leistungen, Medikamente und Untersuchungen bereithalten, die kontextabhängig angezeigt und gefiltert werden können. | MUST · Funktional | Vermeidet Eingabefehler, beschleunigt Auswahlprozesse. | — |
| **7.1.3** | Das System SOLL strukturierte Formulare mit Pflichtfeldern, Plausibilitätsprüfungen und Eingabehilfen nutzen, um den Schreibaufwand zu minimieren. | SHOULD · Funktional | Reduziert Zeitaufwand und Fehlerquote in der täglichen Praxis. | Bei medizinischer Dateneingabe standardisierte Textbausteine + Auswahlhilfen vorschlagen. |
| **7.1.4** | Das System MUSS eine parametrische Filterfunktion zur schnellen Suche nach Informationen in der Akte, Leistungen oder Kostenübersicht enthalten. | MUST · Funktional | Verbessert Navigation und reduziert Suchzeit. | — |

### ID 7.2 Schulung & Einstieg

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **7.2.1** | Die Einarbeitungszeit in das System DARF bei maximal 1–2 Monaten liegen, inkl. schrittweiser Übergabe von Funktionen. Hilfetexte, Tooltips und Tutorials SOLLTEN integriert sein. | NICE TO HAVE · Nicht-Funktional (Usability) | Schneller Einstieg, weniger Schulungsaufwand für neues Personal. | — |
| **7.2.2** | Online-Schulungen DÜRFEN angeboten werden, da zeitlich flexible Formate notwendig sind. | NICE TO HAVE · Nicht-Funktional (Usability) | Berücksichtigung zeitlicher Belastung im Praxisalltag. | — |
| **7.2.3** | Das System DÜRFEN durch „Learning-by-Doing"-Elemente vor Ort erlernbar sein. | NICE TO HAVE · Nicht-Funktional (Usability) | Praktischer Wissenserwerb im Anwendungskontext. | Z. B. schrittweise Einblendung relevanter Funktionen. |

### ID 7.3 Fehleranfälligkeit, Korrekturmöglichkeiten

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **7.3.1** | Das System MUSS die Fehleranfälligkeit der Dateneingabe verringern, z. B. durch Pflichtfelder, Autovervollständigung und Validierungsregeln. Besonders im Bereich der Rezeption liegt die Fehlerquote aktuell bei ca. 10 %. | MUST · Nicht-Funktional (Zuverlässigkeit) | Minimierung typischer Eingabefehler bei hoher Belastung. | Autovervollständigung MUSS deaktivierbar sein und sich ausschließlich auf eine vorbereitete, validierte Namensliste stützen; Deaktivierung benutzerindividuell konfigurierbar. |
| **7.3.2** | Das System SOLL Korrekturen durch den Arzt ermöglichen. | SHOULD · Funktional | Korrektursicherheit durch medizinisches Fachpersonal. | Z. B. über Bearbeitungsprotokoll oder Änderungsverlauf. |
| **7.3.3** | Das System DARF eine Funktion zur Fehlersuche enthalten, etwa durch Markierung unvollständiger Einträge oder Versionsvergleiche, da Fehler sonst unbemerkt bleiben können. | NICE TO HAVE · Funktional | Steigerung der Datenqualität durch nachvollziehbare Kontrolle. | Für das Fehlersuch-Subsystem MUSS eine Durchführbarkeitsanalyse erfolgen (Komplexität, Performance, Integration). |

---

## ID 8 — Design & UI-Wünsche

### ID 8.1 Benutzeroberfläche & Navigation

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **8.1.1** | Das Design MUSS klar, übersichtlich und funktional sein. Optische Gestaltung ist zweitrangig; entscheidend sind einfache Navigation und gute Lesbarkeit, auch bei langen Arbeitstagen. | MUST · Nicht-Funktional (Usability) | Effektive und fehlerfreie Nutzung im stressigen Praxisalltag. | — |
| **8.1.2** | Die Benutzeroberfläche MUSS eine strukturierte Darstellung bieten, in der sich ähnlich klingende Patienten oder Daten gut unterscheiden lassen. | MUST · Nicht-Funktional (Usability) | Fehlervermeidung bei der Auswahl von Patienten mit ähnlichen Namen. | Z. B. Hervorhebungen oder zusätzliche Attribute wie Geburtsdatum. |
| **8.1.3** | Das System DARF ein modernes, visuell klar strukturiertes Design besitzen, um die Orientierung zu erleichtern. | SHOULD · Nicht-Funktional (UI) | Fördert schnelle Einarbeitung und Akzeptanz bei digital unerfahrenen Nutzer:innen. | Inspiriert von vertrauten Plattformen (z. B. Instagram). |
| **8.1.4** | Die Oberfläche DARF eine zentrale Preisübersicht, einen Behandlungskatalog und eine flexible Suchfunktion bieten, die nach Bezeichnung, Kategorie oder Preis filterbar ist. | NICE TO HAVE · Funktional | Schneller Zugriff auf entscheidungsrelevante Informationen während der Behandlung. | Finales UI-Design SOLL auf Basis von Gebrauchstauglichkeitskriterien und Nutzerfeedback iterativ festgelegt werden. |

---

## ID 9 — Systemtechnische Sonderfunktionen

| Quell-ID | Anforderung | Klassifikation | Begründung | Bemerkung |
|---|---|---|---|---|
| **9.1** | Das System MUSS täglich automatisch eine Sicherungskopie aller Daten erstellen — lokal, extern und optional cloudbasiert. Die Backups MÜSSEN verschlüsselt sein und eine Wiederherstellungsfunktion bieten. | MUST · Nicht-Funktional (Sicherheit) | Datensicherheit bei Systemausfall oder Hardwaredefekt. | Speicherverbrauch und -verwaltung müssen skalierbar und überprüfbar bleiben. |
| **9.2** | Das System MUSS eine zentrale, einheitliche Benutzeroberfläche („Dashboard") für alle ärztlichen Kernaufgaben bereitstellen (Akteneinsicht, Freigaben, Dokumentation, Kommunikation, Statistik). | MUST · Funktional | Erhöht Übersichtlichkeit, reduziert Klickpfade und Fehler. | — |
| **9.3** | Das System DARF eine Cloud-Anbindung unterstützen, um bei lokalen Ausfällen weiterarbeiten zu können. Die Cloud-Speicherung MUSS DSGVO-konform erfolgen. | NICE TO HAVE · Nicht-Funktional (Verfügbarkeit) | Betriebssicherheit bei Hardwareausfällen, Mobilität. | — |
| **9.4** | Das System DARF keine spürbaren Verzögerungen bei der Bedienung verursachen. Ladezeiten MÜSSEN < 2 Sekunden betragen, sonst wird die Nutzung als ineffizient bewertet. | NICE TO HAVE · Nicht-Funktional (Performance) | Schnelle Reaktionszeiten sichern Akzeptanz und Effizienz. | Systemladezeiten SOLLEN regelmäßig per Stresstest geprüft und dokumentiert werden. |
| **9.5** | Das System SOLL eine Statistikübersicht zu Krankheitsbildern, Verlaufsmustern und Behandlungsergebnissen enthalten, optional mit Exportmöglichkeit für Auswertungen. | SHOULD · Funktional | Unterstützt Praxissteuerung, Forschung und Qualitätskontrolle. | — |

---

## Zusammenfassung der WAAD-Verteilung

| Hauptkategorie | Anforderungen | MUST | SHOULD | NICE TO HAVE |
|---|---:|---:|---:|---:|
| 1 — Patientenaufnahme & Termin (Rezeption) | 8 | 5 | 3 | 0 |
| 2 — Rechte- und Zugriffskontrolle | 9 | 6 | 3 | 0 |
| 3 — Ärztliche Behandlung & Dokumentation | 4 | 3 | 1 | 0 |
| 4 — Patientenakte & Archivierung | 6 | 4 | 2 | 0 |
| 5 — Nachsorge & Kommunikation | 5 | 2 | 0 | 3 |
| 6 — Leistungen & Kostenmanagement | 8 | 5 | 2 | 1 |
| 7 — Standardisierung & Fehlervermeidung | 10 | 3 | 2 | 5 |
| 8 — Design & UI | 4 | 2 | 1 | 1 |
| 9 — Systemtechnische Sonderfunktionen | 5 | 2 | 1 | 2 |
| **Summe** | **39** | **27** | **15** | **12** |

> Hinweis: Quell-IDs 2.1.4 und 2.2.3 sind als Doppel-Anforderungen formuliert
> (Sicherheit + Konfigurierbarkeit) und tragen daher zwei MoSCoW-Aspekte; sie
> werden hier einmal gezählt und in der Traceability-Matrix auf zwei
> Pflichtenheft-IDs aufgeteilt.

## Querverweise

- **Roh-Liste (frei formuliert):** `01-sammeln.md` §1.3
- **Klassifikation & Strukturierung:** `02-klassifizierung.md`
- **Priorisierung (MoSCoW):** `03-priorisierung.md`
- **Spezifikation (FA-* / NFA-*):** `04-spezifikation.md`
- **Verbindliches Pflichtenheft (Master):** `../v-model/01-anforderungen/pflichtenheft.md`
- **Traceability WAAD → FA/NFA:** `01b-traceability-waad.md`
- **Fulfillment-Status (Code-Evidenz):** `06-validierung.md`
