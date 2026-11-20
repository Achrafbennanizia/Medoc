# MeDoc-Fehlercode-Handbuch

> Generiert — nicht bearbeiten. `node scripts/generate-manuals.mjs` ausführen.

Jede Fehlermeldung zeigt einen Code wie MD-PAY-004. Suchen Sie ihn hier, um Ursache und Lösung zu sehen. Codes bleiben über Versionen gleich.

## Allgemein

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-001` | Konflikt: … | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-002` | Die Daten konnten nicht gespeichert oder geladen werden (Referenz …). Bitte erneut versuchen; bleibt der Fehler, wenden Sie sich mit dieser Referenz an den Support. | Systemproblem · Erneuter Versuch kann helfen | Auf diesem Gerät oder dem Server ist ein unerwartetes technisches Problem aufgetreten. | Einmal erneut versuchen. Wiederholt es sich, Code und Referenz notieren und Support kontaktieren (Hilfe → Letzte Fehler → Kopieren). |
| `MD-APP-003` | Zugriff verweigert. | Aktion blockiert | Ihre Rolle hat für diese Aktion keine Berechtigung. | Ärztin/Arzt oder Administration bitten, die Aktion auszuführen oder die Berechtigung zu erteilen. |
| `MD-APP-004` | Ein unerwarteter interner Fehler ist aufgetreten (Referenz …). | Systemproblem · Erneuter Versuch kann helfen | Auf diesem Gerät oder dem Server ist ein unerwartetes technisches Problem aufgetreten. | Einmal erneut versuchen. Wiederholt es sich, Code und Referenz notieren und Support kontaktieren (Hilfe → Letzte Fehler → Kopieren). |
| `MD-APP-005` | Der Praxisserver ist nicht erreichbar. Bitte Netzwerkverbindung prüfen. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-APP-006` | … nicht gefunden. | Eingabe erforderlich | Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt. | Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen. |
| `MD-APP-007` | Dieses Gerät ist offline. Änderungen können erst nach Wiederherstellung der Verbindung gesendet werden. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-APP-008` | Zu viele Fehlversuche — bitte … Sekunden warten. | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-APP-009` | Der Server hat zu lange nicht geantwortet. Bitte erneut versuchen. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-APP-010` | Zwei-Faktor-Einrichtung erforderlich. | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-APP-011` | Zwei-Faktor-Code erforderlich. | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-APP-012` | Nicht autorisiert. | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-APP-013` | Etwas ist schiefgelaufen. | Systemproblem · Erneuter Versuch kann helfen | Auf diesem Gerät oder dem Server ist ein unerwartetes technisches Problem aufgetreten. | Einmal erneut versuchen. Wiederholt es sich, Code und Referenz notieren und Support kontaktieren (Hilfe → Letzte Fehler → Kopieren). |
| `MD-APP-014` | … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Anhänge

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-ATT-001` | Dokumenttyp darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-ATT-002` | Datei zu groß (max. 50 MB). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-ATT-003` | Dieser Dateityp wird nicht unterstützt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-ATT-004` | Bezeichnung darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Anmeldung & Zwei-Faktor

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-AUTH-001` | Keine Geräte-Sitzungs-ID | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-AUTH-002` | Ungültiger Code — bitte erneut versuchen | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-AUTH-003` | Zwei-Faktor ist für diese Rolle optional — bitte nach Anmeldung einrichten | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-AUTH-004` | Bitte zuerst die Einrichtung starten | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |

## Sicherung & Wiederherstellung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-BAK-001` | Backup-Datei nicht gefunden. | Eingabe erforderlich | Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt. | Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen. |
| `MD-BAK-002` | Wiederhergestellte Datei ist keine gültige MeDoc-Datenbank. | Systemproblem | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-003` | Datei ist keine gültige SQLite-Sicherung (keine Signatur, Header ungültig). | Systemproblem | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-004` | Nur .db-Dateien können wiederhergestellt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-BAK-005` | Backup-Signatur ungültig — Wiederherstellung abgebrochen. | Systemproblem | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

## Abrechnungsfreigabe

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-BIL-001` | … ist noch nicht zur Abrechnung freigegeben. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |

## Ansichtsabsturz

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-BND-001` | Die Ansicht wurde unerwartet beendet. | Systemproblem · Erneuter Versuch kann helfen | Auf diesem Gerät oder dem Server ist ein unerwartetes technisches Problem aufgetreten. | Einmal erneut versuchen. Wiederholt es sich, Code und Referenz notieren und Support kontaktieren (Hilfe → Letzte Fehler → Kopieren). |

## Notfallzugriff

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-BRG-001` | Begründung muss mindestens 10 Zeichen lang sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Patientenakte

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-CHT-001` | Nachricht darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-002` | Kein Arzt: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-003` | Mindestens einen Arzt auswählen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-004` | Ziel muss ein Arzt sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-005` | Unbekannter Arzt: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Praxisverbund (Cluster)

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-CLU-001` | Passphrase erforderlich. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |

## Gerätesitzungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-DEV-001` | Die aktuelle Sitzung kann hier nicht beendet werden — bitte abmelden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-DEV-002` | Die aktuelle Sitzung ist bereits vertrauenswürdig. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |

## Export

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-EXP-001` | Zielordner muss absolut sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-EXP-002` | Ungültige Export-Daten (Base64). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-EXP-003` | Ungültiger Dateiname. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## LAN-Verbindung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-LAN-001` | LAN-Client: Befehl „…“ ist auf dem API-Server nicht verfügbar — Practice-Host-Desktop-App verwenden. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-002` | LAN-Client-Konfiguration unvollständig (Basis-URL oder Token fehlt). | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-003` | LAN-Client-Konfiguration unvollständig (Basis-URL fehlt). | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-004` | LAN-HTTP …: … | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |

## Stammdaten

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-MST-001` | Kategorie und Name erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-002` | Kontakt: Name erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-003` | Von- und Bis-Datum erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-004` | Ungültiger Kontakt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-005` | Ungültiges oder inaktives Produkt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-006` | Ungültiger Lieferant. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-007` | Lieferant, Kontakt und Produkt wählen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-008` | Lieferant: Name erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-009` | kind muss REZEPT oder ATTEST sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-010` | Titel erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-MST-011` | Typ darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Gerätekopplung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-PAR-001` | Bestätigungscode abgelaufen. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAR-002` | Bestätigungscode falsch. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-003` | Geräte-ID leer. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-004` | PIN muss genau 4 Ziffern sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-005` | Replica-öffentlicher Schlüssel leer. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Zahlungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-PAY-001` | Betrag ungültig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-002` | Betrag muss größer als 0 sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-003` | Nur ausstehende oder teilbezahlte Zahlungen können gelöscht werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAY-004` | Bitte nur eine Verknüpfung: Behandlung oder Untersuchung. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-PAY-005` | Nur ausstehende oder teilbezahlte Zahlungen können bearbeitet werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAY-006` | Untersuchung nicht gefunden oder gehört nicht zu diesem Patienten. | Eingabe erforderlich | Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt. | Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen. |
| `MD-PAY-007` | Zahlbetrag übersteigt den zulässigen Rahmen für diese Untersuchung (max. … € inkl. dieser Buchung). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-008` | Zahlbetrag übersteigt den zulässigen Rahmen für diese Behandlung (max. … € inkl. dieser Buchung). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-009` | Zahlbetrag übersteigt den offenen Betrag für diese Untersuchung (max. … €, Summe bisher … €, Soll … €). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-010` | Zahlbetrag übersteigt den offenen Betrag für diese Behandlung (max. … €, Summe bisher … €, Soll … €). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-011` | Mit Leistungspreisbuchung ist ein positiver Zahlbetrag erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-012` | Behandlung nicht gefunden oder gehört nicht zu diesem Patienten. | Eingabe erforderlich | Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt. | Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen. |

## Praxisaufgaben

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-TSK-001` | Bitte Ziel-Arzt (assigneeUserId) angeben. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-002` | Patient erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-003` | Ziel muss ein Arzt sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-004` | Ziel muss ein Rezeptions-Mitarbeiter sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-005` | Titel darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Profil

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-PRF-001` | E-Mail darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PRF-002` | Name darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PRF-003` | Name zu lang (max. 120 Zeichen). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PRF-004` | Keine Felder zum Aktualisieren übermittelt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Personal

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-STF-001` | E-Mail bereits vergeben. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-STF-002` | Zwei-Faktor ist bereits aktiv. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-STF-003` | Ungültiger Code — bitte erneut versuchen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Arbeitszeit

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-WTM-001` | Keine offene Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-002` | Keine pausierte Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-003` | Keine laufende Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-004` | Es läuft bereits eine Arbeitszeit-Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-005` | Sitzung ist nicht pausiert. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-006` | Sitzung ist nicht aktiv. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-007` | week_start: Format JJJJ-MM-TT | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Status-Workflow

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-WFL-001` | Akte ist bereits validiert oder archiviert. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-002` | Diese Akte ist archiviert (schreibgeschützt) und kann nicht geändert werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-003` | Akten-Status … kann nicht validiert werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-004` | Unbekannter Bestellstatus: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-005` | Status-Übergang …→… ist nicht erlaubt. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-006` | Aufgabe ist bereits geschlossen (VALIDIERT). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-007` | Unbekannter Aufgaben-Status: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-008` | Nur erledigte Aufgaben können validiert oder zurückgegeben werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-009` | Unbekannter Ticket-Status: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
