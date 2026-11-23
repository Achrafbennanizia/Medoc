# MeDoc-Fehlercode-Handbuch

> Generiert — nicht bearbeiten. `node scripts/generate-manuals.mjs` ausführen.

Jede Fehlermeldung zeigt einen Code wie MD-PAY-004. Suchen Sie ihn hier, um Ursache und Lösung zu sehen. Codes bleiben über Versionen gleich.

## Zugriffsrechte

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-042` | Sie können nur Ihre eigenen Termine ändern. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Allgemein

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-001` | Konflikt: … | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-002` | Die Daten konnten nicht gespeichert oder geladen werden (Referenz …). Bitte erneut versuchen; bleibt der Fehler, wenden Sie sich mit dieser Referenz an den Support. | Systemproblem · Erneuter Versuch kann helfen | Auf diesem Gerät oder dem Server ist ein unerwartetes technisches Problem aufgetreten. | Einmal erneut versuchen. Wiederholt es sich, Code und Referenz notieren und Support kontaktieren (Hilfe → Letzte Fehler → Kopieren). |
| `MD-APP-015` | Diese Funktion ist für diese Praxis deaktiviert (…). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
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
| `MD-APP-100` | LAN-Port … ist belegt (andere MeDoc-Instanz). Es wird kein zweiter LAN-Dienst gestartet. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-101` | LAN-Server läuft bereits. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-102` | MeDoc läuft bereits (Datenbank in Benutzung). Öffnen Sie das vorhandene Fenster statt einer zweiten Kopie. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-103` | Die Praxis hat bereits Konten. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-104` | … muss null oder größer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-129` | … must be hex _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-130` | cache name not allowed: … _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-105` | CSV header must contain at least 'name' and 'date_of_birth' _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-106` | CSV header: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-107` | Datenbank ist gesperrt — Passphrase zum Entsperren eingeben. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-109` | Invalid bind_addr/http_port combination. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-110` | Ungültige Kennung. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-111` | Invalid provider token (expected pm_ or tok_ prefix) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-112` | Keyring account already in use: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-113` | LAN config: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-114` | Name und gültige E-Mail sind erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-115` | Kein kompatibles Scanprogramm gefunden (z. B. simple-scan). Bitte installieren oder Dateien manuell in den Überwachungsordner legen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-116` | Kein Update verfügbar. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-131` | offline cache not allowed: … _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-117` | Pfad enthält keinen Dateinamen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-118` | Pfad liegt außerhalb des erlaubten Ordners. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-119` | Pfad darf „..“ nicht enthalten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-120` | Path: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-121` | Port muss größer als 0 sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-122` | Präfix muss 1–16 Buchstaben oder Ziffern haben. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-123` | Root path: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-124` | settingsJson: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-125` | System-Scanner wird auf dieser Plattform nicht unterstützt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-126` | The password must have at least … characters. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-127` | ui-prefs JSON: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APP-128` | Unbekanntes Nummernformat: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Termine

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APT-100` | Ein neuer Termin beginnt als Geplant oder Bestätigt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-101` | Behandler auf diesem Gerät nicht gefunden. Melden Sie sich mit einem lokalen Konto an oder warten Sie, bis die Konten vom Hauptgerät synchronisiert sind. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-102` | Kommentar darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-103` | Date range must be 0-… days _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-APT-104` | Dauer muss zwischen 5 und 720 Minuten liegen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-105` | Patient nicht gefunden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-106` | Grund für die Rückgabe an die Rezeption ist erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-107` | Kurznotiz oder Zahlungsverknüpfung erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APT-108` | Unknown task type: … (allowed: {}) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

## Anhänge

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-ATT-001` | Dokumenttyp darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-ATT-002` | Datei zu groß (max. 50 MB). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-ATT-003` | Dieser Dateityp wird nicht unterstützt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-ATT-004` | Bezeichnung darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Protokoll

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-AUD-100` | Protokollkette ist intakt — keine Bestätigung nötig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-AUD-101` | patient_id missing _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

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
| `MD-BAK-002` | Wiederhergestellte Datei ist keine gültige MeDoc-Datenbank. | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-003` | Datei ist keine gültige SQLite-Sicherung (keine Signatur, Header ungültig). | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-004` | Nur .db-Dateien können wiederhergestellt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-BAK-005` | Backup-Signatur ungültig — Wiederherstellung abgebrochen. | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-100` | audit json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-101` | audit missing: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-102` | ciphertext: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-103` | invalid nonce length _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-104` | invalid password verifier _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-105` | json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-106` | nonce: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-107` | salt: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-108` | vault json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-109` | vault missing: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-110` | verifier key: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-111` | verifier salt: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-BAK-112` | Falsches Passwort für das USB-Kit. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

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

## Kassenbuch

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-016` | Diese Kassenbewegung wurde bereits storniert. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-APP-017` | Bitte einen Betrag größer als 0 angeben. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-018` | Unbekannte Art der Kassenbewegung. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-019` | Gebuchte Kassenbuchungen können nicht geändert oder gelöscht werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-020` | Bitte einen Grund angeben. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-021` | Barausgaben brauchen eine Belegnummer (Belegprinzip). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Bescheinigungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-CRT-100` | date_from: YYYY-MM-DD _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CRT-101` | date_to must not be before date_from _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CRT-102` | date_to: YYYY-MM-DD _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CRT-103` | Dokument ist erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CRT-104` | „Gültig bis“ darf nicht vor „Gültig ab“ liegen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Patientenakte

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-CHT-001` | Nachricht darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-002` | Kein Arzt: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-003` | Mindestens einen Arzt auswählen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-004` | Ziel muss ein Arzt sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-005` | Unbekannter Arzt: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CHT-100` | Für diese Position wurde bereits gezahlt; erstellen Sie stattdessen eine Korrektur. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-CHT-101` | Invalid Base64 data. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CHT-102` | Ungültiger Patientenstatus-Filter. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Praxisverbund (Cluster)

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-CLU-001` | Passphrase erforderlich. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-CLU-100` | Dieses Gerät ist bereits gekoppelt. Widerrufen Sie es am Hauptgerät, bevor Sie es erneut koppeln. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-CLU-101` | Activation manifest version {} not supported _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-102` | admin endpoint kv: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-103` | Host und Port des Admin-Geräts erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-104` | Ciphertext: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-105` | Schlüssel des Praxisnetzes stimmt nicht mit dem veröffentlichten überein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-106` | Cluster full: maximum {} devices _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-107` | cluster_ca_pubkey length invalid _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-108` | cluster_ca_pubkey: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-109` | cluster_id length {} (expected 16) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-110` | cluster_id: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-111` | Bestätigungstext stimmt nicht überein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-112` | Entschlüsselung fehlgeschlagen (falsche Passphrase oder veränderte Datei). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-113` | deployment json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-114` | Gerät ist bereits eingerichtet (nur einmal möglich). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-115` | Geräteschlüssel stimmt nicht mit dem veröffentlichten überein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-116` | Device key signature verification failed _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-117` | device secret hex: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-118` | device secret utf8: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-119` | device_pubkey invalid: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-120` | device_pubkey length invalid _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-121` | device_pubkey must be 32 bytes _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-122` | device_pubkey: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-123` | handshake transcript base64: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-124` | Handshake transcript missing. The joining device must send a new join request, then accept it again. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-125` | join lan auth kv: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-126` | KDF salt: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-127` | Kein Zurücksetzen ausstehend. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-128` | Adresse des Hauptgeräts ungültig — bitte dem Netzwerk erneut beitreten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-129` | Manifest {} not readable: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-130` | Manifest JSON invalid: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-131` | MEDOC_CLUSTER_DEVICE_SECRET must be 64 hex chars _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-132` | No ADMIN seat available (max {}). Request again as MEMBER. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-133` | Kein Praxisnetz eingerichtet. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-134` | Kein Praxisnetz aktiviert. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-135` | Kein Hauptgerät gespeichert — bitte dem Netzwerk erneut beitreten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-136` | No MEMBER seat available (max {}) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-137` | Keine Benutzerkonten vom Hauptgerät erhalten — dort muss jemand angemeldet sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-138` | Nonce: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-139` | Praxisnetz erfordert eine aktive Lizenz (Inhaber) bzw. Lizenz/Einrichtung (Mitglied). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-140` | provisioning json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-141` | Provisioning-Settings: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-142` | Ersetzen: alter und neuer Fingerabdruck sind identisch. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-143` | Reset mode must be network_only or full_wipe. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-144` | Reset token invalid: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-145` | Reset token is for a different cluster _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-146` | Reset token signature invalid _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-147` | Reset token signed by an unknown cluster key _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-148` | SAS does not match _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-149` | SAS must be 4 digits _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-150` | Seat certificate decode: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-151` | Seat certificate JSON: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-152` | Seat certificate: expected prefix `…` _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-153` | Seat certificate: missing separator _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-154` | Session not ready for SAS _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-155` | sidecar json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-156` | Staff directory invalid: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-157` | Version des Mitarbeiterverzeichnisses wird nicht unterstützt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-158` | Das Hauptgerät hat diese Anfrage noch nicht angenommen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-159` | Hauptgerät nicht erreichbar. Starten Sie es und versuchen Sie es erneut. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-CLU-160` | Too many wrong SAS entries. Accept the request again on the main device. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-161` | Unexpected KDF algorithm _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-CLU-162` | Unexpected plaintext length {} (expected 160) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

## Tagesabschluss

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-DCL-001` | Dieser Tag ist bereits abgeschlossen. Für Änderungen eine Korrektur erfassen. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-DCL-002` | Ungültiger Betrag. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-003` | Ungültiges Datum. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-004` | Ungültige Stückelung oder Anzahl. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-005` | Für eine Korrektur ist eine Begründung erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-006` | Gezählter Betrag und Stückelung stimmen nicht überein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-007` | Für den Abschluss muss der Kassenbestand gezählt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-008` | Ein zukünftiger Tag kann nicht abgeschlossen werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-009` | Ein erfasster Tagesabschluss ist endgültig. Bitte eine Korrektur erfassen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-010` | Es gibt bereits einen Abschluss vom {…}. Frühere Tage können nicht mehr abgeschlossen werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-011` | Zu diesem Abschluss gibt es keinen Kassenbericht (älterer Eintrag). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-012` | Dieser Abschluss wurde bereits korrigiert. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-013` | Nur der letzte Abschluss kann korrigiert werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-014` | Der Kassenbericht entsteht beim Tagesabschluss. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-DCL-015` | Bei einer Differenz ist eine Begründung erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Hauptgerät und Replikate

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-043` | Dafür ist eine Verbindung zum Hauptgerät nötig. Melden Sie sich ab und wieder an, während das Hauptgerät erreichbar ist. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-044` | Das ist nur am Hauptgerät möglich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-045` | Das Hauptgerät ist nicht erreichbar. Prüfen Sie, ob es eingeschaltet und im selben Netzwerk ist. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-046` | Die Replikat-App tritt einer bestehenden Praxis bei; sie kann keine anlegen. Verwenden Sie die Haupt-App auf dem Hauptgerät. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |

## Gerätesitzungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-DEV-001` | Die aktuelle Sitzung kann hier nicht beendet werden — bitte abmelden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-DEV-002` | Die aktuelle Sitzung ist bereits vertrauenswürdig. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |

## Dokumente & PDFs

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-DOC-100` | layout must be a JSON object _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-DOC-101` | PDF-Layout: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-DOC-102` | Template JSON: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

## Dokumente & PDFs

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-022` | Betäubungsmittel müssen auf dem amtlichen BtM-Rezept verordnet werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-023` | Bitte einen Grund für die Stornierung angeben. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-024` | Kassenrezepte werden als E-Rezept über die Telematikinfrastruktur ausgestellt, nicht als PDF. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-025` | Ausgestellte Dokumente können nicht geändert oder gelöscht werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-026` | Offizielle Dokumente können nur auf dem Hauptgerät (MASTER) ausgestellt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-027` | Ein Sammeldokument darf nur Einträge einer Patientin bzw. eines Patienten enthalten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-028` | Dieses Dokument kann nicht storniert werden (bereits storniert oder keine Rechnung). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-029` | Praxisdaten unvollständig: Name und Anschrift der Praxis fehlen (Einstellungen → Praxis). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-030` | Eine Quittung kann nur für eine bezahlte Zahlung ausgestellt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-031` | Für diesen Dokumenttyp ist kein Nachdruck möglich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-032` | Unbekannte Ausfertigung. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-033` | Unbekannter Dokumenttyp. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-034` | Das Dokument enthält Zeichen, die im PDF nicht korrekt gedruckt werden können (z. B. arabische oder kyrillische Schrift). Bitte Schreibweise prüfen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Export

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-EXP-001` | Zielordner muss ein absoluter Pfad sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-EXP-004` | Der Zielordner liegt außerhalb des erlaubten Exportordners. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-EXP-002` | Ungültige Export-Daten (Base64). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-EXP-003` | Ungültiger Dateiname. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Deaktivierte Funktionen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-FEA-100` | Diese Funktion ist für diese Praxis deaktiviert (DICOM-Bildgebung). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-FEA-101` | Diese Funktion ist für diese Praxis deaktiviert (E-Rezept). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-FEA-102` | Diese Funktion ist für diese Praxis deaktiviert (GDT-Geräteschnittstelle). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-FEA-103` | Diese Funktion ist für diese Praxis deaktiviert (Scanner). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |

## Datenschutz (DSGVO)

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-035` | Löschung nicht zulässig: gesetzliche Aufbewahrungsfrist läuft bis {…} (§ 630f BGB, § 147 AO). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Lager & Bestellungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-INVT-100` | Artikel erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INVT-101` | Menge muss positiv sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INVT-102` | Bestand muss null oder größer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INVT-103` | Lieferant erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INVT-104` | Gesamtbetrag ungültig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INVT-105` | Unbekannter Status: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Rechnungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-INV-001` | „{…}“ ist bereits auf Rechnung {…}. Erst stornieren, dann neu abrechnen. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-INV-002` | Die Leistung gehört nicht zu dieser Patientin bzw. diesem Patienten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-003` | Stornorechnung ohne Bezug auf die ursprüngliche Rechnungsnummer. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-004` | Rechnungsdatum fehlt oder ist ungültig (JJJJ-MM-TT). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-005` | Nur Altbestände ohne Registernummer können importiert werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-006` | Pos. …: Betrag muss größer als 0 sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-007` | Pos. …: Betrag passt nicht zu Punktzahl × Punktwert × Faktor. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-008` | Pos. …: Analogberechnung nur für GOZ-Positionen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-009` | Pos. …: Stornopositionen müssen negativ sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-010` | Pos. …: Datum der Leistungserbringung fehlt (§ 10 Abs. 2 Nr. 1 GOZ). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-011` | Pos. …: Leistungsbeschreibung fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-012` | Pos. …: Faktor … über 3,5 nur mit Vereinbarung nach § 2 GOZ. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-013` | Pos. …: Faktor unter 1,0 ist unzulässig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-014` | Pos. …: Steigerungsfaktor fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-015` | Pos. …: Faktor … über 2,3 erfordert eine schriftliche Begründung. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-016` | Pos. …: Gebührennummer fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-017` | Pos. …: Punktzahl fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-018` | Pos. …: Auslage über 25,56 EUR – Beleg muss beigefügt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-019` | Die Rechnung enthält keine Positionen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-020` | „{…}“ ist noch nicht ärztlich zur Abrechnung freigegeben. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-INV-021` | Rechnungsnummer fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-022` | Name und Geburtsdatum der behandelten Person fehlen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-023` | Name und Anschrift der Praxis fehlen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-024` | Name und Anschrift des Rechnungsempfängers fehlen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-025` | Umsatzsteuerpflichtige Positionen: Steuernummer oder USt-IdNr. fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-026` | Der Text enthält Zeichen, die im PDF nicht darstellbar sind. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-027` | Hinweis auf die Steuerbefreiung fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-108` | Die ICE der Praxis fehlt. Eine marokkanische Rechnung muss sie zeigen — unter Einstellungen → Praxis → Abrechnungsdaten eintragen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-109` | Die Steuer-ID (IF) der Praxis fehlt. Eine marokkanische Rechnung muss sie zeigen — unter Einstellungen → Praxis → Abrechnungsdaten eintragen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-100` | Dokument ist bereits storniert. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-APP-108` | Datum muss im Format JJJJ-MM-TT sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-101` | id and patient_id are required _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-INV-102` | Ungültiges Intervall. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-103` | Bezeichnung erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-104` | Nachricht zu kurz (mind. 10 Zeichen). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-105` | Zeitraum erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-106` | Betreff zu kurz (mind. 3 Zeichen). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-INV-107` | Unbekannte Kategorie: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## LAN-Verbindung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-LAN-001` | LAN-Client: Befehl „…“ ist auf dem API-Server nicht verfügbar — Practice-Host-Desktop-App verwenden. | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-002` | LAN-Client-Konfiguration unvollständig (Basis-URL oder Token fehlt). | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-003` | LAN-Client-Konfiguration unvollständig (Basis-URL fehlt). | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-004` | LAN-HTTP …: … | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-LAN-100` | Unbekannter Einstellungsschlüssel: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LAN-101` | Unknown KV key: {} _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

## Lizenz

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-LIC-001` | Diese Lizenz wurde für einen anderen Computer ausgestellt. Fügen Sie den Schlüssel für diesen Computer ein, oder verbinden Sie diesen Computer mit dem Hauptgerät. | Aktion blockiert | Anmeldung oder Zwei-Faktor-Prüfung ist erforderlich oder fehlgeschlagen. | Erneut anmelden; bei Sperre die angezeigte Zeit abwarten oder Administration kontaktieren. |
| `MD-LIC-100` | Name der Administration zu kurz. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-101` | Administrator-Passwort erforderlich (mind. 8 Zeichen). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-102` | device_id empty _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-LIC-103` | Ungültige E-Mail-Adresse. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-104` | Lizenzcode fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-105` | Mitgliedsgeräte erst nach Beitritt zum Praxisnetz. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-106` | Name zu kurz. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-107` | Neues Konto erst nach Beitritt zu einer bestehenden Praxis. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-108` | Es gibt kein Benutzerkonto — bitte eine Administration anlegen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-109` | Passwort erforderlich (mind. 8 Zeichen). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-110` | Tarif muss BASIC, PRO oder ENTERPRISE sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-111` | Praxiseinrichtung ist bereits abgeschlossen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-112` | Praxiseinrichtung nur am lizenzierten Hauptgerät. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-113` | Registration failed (HTTP {}): {} _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-LIC-114` | Rolle muss Ärztin/Arzt oder Rezeption sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-115` | Überspringen nur am lizenzierten Hauptgerät erlaubt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-116` | Basis-URL des Herstellerportals fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-117` | Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-LIC-118` | URL des Herstellerportals ist leer. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-119` | URL des Herstellerportals hat keinen Host. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-120` | URL des Herstellerportals darf keine Zugangsdaten enthalten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-121` | URL des Herstellerportals muss https verwenden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-LIC-122` | Vendor portal: API key missing (configuration or MEDOC_COMPANY_API_KEY). _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-LIC-123` | Vendor portal: practice_slug (tenant id) is missing. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

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

## Benachrichtigungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-NTF-100` | Keine Empfänger für diese Benachrichtigung verfügbar. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-NTF-101` | Art und Titel der Benachrichtigung sind erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Gerätekopplung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-PAR-001` | Bestätigungscode abgelaufen. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAR-002` | Bestätigungscode falsch. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-003` | Geräte-ID leer. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-006` | Für dieses Gerät gibt es keine akzeptierte Kopplung. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-004` | PIN muss genau 6 Ziffern sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-005` | Replica-öffentlicher Schlüssel leer. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-100` | Für dieses Gerät ist bereits eine Kopplungsanfrage offen. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-PAR-101` | Die Kopplungsanfrage wartet bereits auf die PIN-Bestätigung. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-PAR-102` | pairing_request already decided (status={}) _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-PAR-103` | Die Kopplungsanfrage wartet nicht auf eine PIN-Bestätigung. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-PAR-104` | Activation token decode: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-105` | Activation token JSON: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-106` | Activation token version {} (expected 2) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-107` | Activation token: expected prefix `…` _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-108` | Activation token: invalid prefix _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-109` | Activation token: missing separator _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-110` | Cluster handshake missing; send a new join request from the replica. _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-111` | Master response incomplete (pubkey/deviceId missing) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAR-112` | Kein Bluetooth-Adapter gefunden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-113` | PIN-Bestätigung fehlgeschlagen (…): … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAR-114` | Zu viele PIN-Versuche — neue Kopplungsanfrage stellen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Zahlungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-PAY-001` | Betrag ungültig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-002` | Betrag muss größer als 0 sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-013` | Für diese Buchung ist bereits Geld eingegangen. Bitte stornieren statt löschen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-003` | Nur ausstehende oder teilbezahlte Zahlungen können gelöscht werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAY-004` | Bitte nur eine Verknüpfung: Behandlung oder Untersuchung. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-PAY-005` | Nur ausstehende oder teilbezahlte Zahlungen können bearbeitet werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAY-006` | Untersuchung nicht gefunden oder gehört nicht zu diesem Patienten. | Eingabe erforderlich | Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt. | Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen. |
| `MD-PAY-007` | Zahlbetrag übersteigt den zulässigen Rahmen für diese Untersuchung (max. … € inkl. dieser Buchung). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-008` | Zahlbetrag übersteigt den zulässigen Rahmen für diese Behandlung (max. … € inkl. dieser Buchung). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-009` | Zahlbetrag übersteigt den offenen Betrag für diese Untersuchung (max. … €, Summe bisher … €, Soll … €). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-010` | Zahlbetrag übersteigt den offenen Betrag für diese Behandlung (max. … €, Summe bisher … €, Soll … €). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-011` | Mit Leistungspreisbuchung ist ein positiver Zahlbetrag erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-014` | Der Zahlungsstatus ergibt sich aus den Beträgen. Manuell ist nur „Storniert“ möglich. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-PAY-012` | Behandlung nicht gefunden oder gehört nicht zu diesem Patienten. | Eingabe erforderlich | Das Element existiert nicht mehr oder wurde auf einem anderen Gerät entfernt. | Liste aktualisieren (Strg/⌘ R) und das Element erneut öffnen. |
| `MD-PAY-100` | Betrag muss positiv sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-101` | Stichtag muss im Format JJJJ-MM-TT sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-102` | Stichtag erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-103` | Ungültige Beträge. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-104` | Ungültiger gezählter Betrag. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-105` | Invalid metrics _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-PAY-106` | Ungültige Differenz. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PAY-107` | Unbekannte Währung. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Periodenbericht

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-036` | Ungültiger Zeitraum (höchstens zwei Jahre). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-037` | Zu diesem Bericht gibt es keine PDF in der Dokumentenablage. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-038` | Gespeichert werden können nur abgeschlossene Zeiträume. Die Vorschau ist jederzeit möglich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Praxisaufgaben

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-TSK-001` | Bitte geben Sie den zugewiesenen Arzt an. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-002` | Patient erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-003` | Ziel muss ein Arzt sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-004` | Ziel muss ein Rezeptions-Mitarbeiter sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-005` | Titel darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TSK-100` | Empfänger ist kein Mitarbeiterkonto auf diesem Gerät. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Rezepte

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-RXP-001` | Allergiewarnung: Der Patient ist allergisch gegen …, und dieses Rezept enthält …. Prüfen Sie die Anamnese, bevor Sie es ausstellen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-RXP-100` | Dieses Rezept wurde bereits korrigiert; bearbeiten Sie die neueste Version. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-RXP-101` | Ungültige KIM-Adresse. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-RXP-102` | Invalid KVNR format: {} _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-RXP-103` | Invalid PZN: {} _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-RXP-104` | LANR muss 9 Ziffern enthalten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-RXP-105` | Menge muss zwischen 1 und 99 liegen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Profil

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-PRF-001` | E-Mail darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PRF-002` | Name darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PRF-003` | Name zu lang (max. 120 Zeichen). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-PRF-004` | Keine Felder zum Aktualisieren übermittelt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Mahnungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-APP-039` | Eine Mahngebühr ist erst ab der 1. Mahnung zulässig. | Aktion blockiert | Ihre Rolle hat für diese Aktion keine Berechtigung. | Ärztin/Arzt oder Administration bitten, die Aktion auszuführen oder die Berechtigung zu erteilen. |
| `MD-APP-040` | Eine weitere Mahnstufe ist erst nach Ablauf der letzten Frist möglich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-APP-041` | Für diese Rechnung ist keine Mahnung möglich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Scanner

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-SCN-100` | Quelle hat keinen Dateinamen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Sicherheit & Verschlüsselung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-SEC-100` | Zwei-Faktor-Authentifizierung ist nicht aktiv. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-SEC-101` | Authenticator-Code erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SEC-102` | Notfallzugriff ist derzeit deaktiviert. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SEC-103` | Could not open database with SQLCipher (check passphrase). _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SEC-104` | Ungültiger Code — bitte erneut versuchen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SEC-105` | Invalid signature _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SEC-106` | Invalid signature length _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SEC-107` | Passwortrichtlinie: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SEC-108` | rekey: old key does not open the database _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SEC-109` | Signature missing _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SEC-110` | Signature not decodable: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SEC-111` | Zwei-Faktor-Authentifizierung ist derzeit deaktiviert. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Einstellungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-SET-100` | Gespeicherte Arbeitszeiten sind ungültig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SET-102` | The medication list is invalid _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SET-101` | Unbekannter Einstellungsschlüssel: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Einrichtung

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-SUP-100` | Passphrasen stimmen nicht überein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Personal

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-STF-001` | E-Mail bereits vergeben. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-STF-002` | Zwei-Faktor ist bereits aktiv. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-STF-003` | Ungültiger Code — bitte erneut versuchen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-100` | Zwei-Faktor-Authentifizierung ist bereits aktiv. | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-STF-101` | {} cannot exceed "{}" for this role _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-STF-102` | … kann dieser Rolle nicht erteilt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-103` | Zugriffsrechte werden am Hauptgerät verwaltet. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-104` | Aktion darf nicht leer sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-105` | Mindestens eine aktive Person muss das Recht zur Zugriffsverwaltung behalten. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-106` | Wirkung muss Erlauben oder Verweigern sein. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-107` | Dieses Zugriffsprofil ist für eine andere Rolle. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-108` | Dieses Konto hat noch Termine oder klinische Dokumente. Weisen Sie zuerst einen anderen Behandler zu und entfernen Sie dann das Konto. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-116` | This area cannot be limited to own records: … _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-109` | Unknown access area: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-STF-110` | Unknown access level: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-STF-111` | Unbekanntes Zugriffsprofil: … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-112` | Unbekannte Berechtigungsaktion. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-113` | Sie können Ihre eigenen Zugriffsrechte nicht ändern. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-STF-114` | You cannot grant more than your own access to {} _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-STF-115` | Sie können das angemeldete Konto nicht entfernen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Gerätesynchronisation

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-SYN-001` | Eine empfangene Änderung hat eine ungültige Signatur und wurde nicht übernommen. Die Daten wurden unterwegs verändert oder der Absender ist nicht echt. | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-002` | Änderungen kamen mit einem Schlüssel, den dieses Gerät für den Absender nicht kennt. Koppeln Sie das Gerät erneut. | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-003` | Dieses Gerät hat Änderungen ohne Signatur gesendet. Aktualisieren Sie es auf die aktuelle Version und synchronisieren Sie erneut. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-SYN-100` | Netzwerk-Port … ist bereits belegt (andere MeDoc-Instanz). | Eingabe erforderlich | Die Änderung kollidiert mit vorhandenen Daten (Duplikat oder gleichzeitige Bearbeitung). | Anderen Wert verwenden oder neu laden und Änderung erneut anwenden. |
| `MD-SYN-101` | blob hash mismatch _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-102` | cbor decode: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-103` | cipher frame length invalid _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-104` | cipher read timed out _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-105` | Praxisnetz hat … abgelehnt (…): … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-106` | Beitritt zum Praxisnetz abgelehnt (…): … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-107` | Das Praxisnetz darf nur private LAN-Adressen verwenden (abgelehnt: …). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-108` | Frame too large _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-109` | Frame too short _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-110` | handshake message too large _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-111` | handshake timed out _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-112` | Invalid frame length _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-113` | LAN-Zertifikats-Pin ist kein SHA-256-Fingerabdruck. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-114` | Main device not reachable — document numbers are issued by the main device (…) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-115` | Hauptgerät hat die Nummernvergabe abgelehnt (…): … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-116` | Master pubkey invalid: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-117` | Master pubkey length {} (expected 32) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-118` | Master pubkey not decodable: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-119` | master secret hex: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-120` | master secret utf8: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-121` | master_base_url missing _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-122` | master_base_url missing for mesh sync _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-123` | master_pubkey missing for mesh peer-list verification _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-124` | MEDOC_PAIRING_MASTER_SECRET must be 64 hex chars (32 bytes) _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-125` | mesh sync requires serverless_peer REPLICA _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-126` | Nachricht zu groß. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-127` | no known sync queue in the exchange request _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-128` | Kein Hauptgerät registriert. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-129` | peer … has no TLS pin _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-130` | Erneute Kopplung erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-131` | reconcile rows request exceeds … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-132` | Abgleich läuft nur auf einem Zweitgerät. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-133` | reconcile waits until the outbox is empty _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-134` | Anmeldung des Zweitgeräts: Fingerabdruck gehört nicht zu diesem Gerät. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-135` | Zweitgerät nicht gekoppelt — Kopplung abschließen. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-136` | Mitarbeiterverzeichnis abgelehnt (…): … | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-137` | sync app_kv: payload key does not match entity id _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-138` | sync entity_table not allow-listed: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-139` | Synchronisation: Absendergerät fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-140` | sync payload json: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-141` | sync payload must be a JSON object _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-142` | sync pull requires serverless_peer REPLICA _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-143` | sync push device_id mismatch _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-144` | sync push requires serverless_peer mode _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-145` | Senden an das Hauptgerät nur von einem Zweitgerät. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-146` | Zertifikats-Pin fehlt — unbestätigtes Zertifikat wird abgelehnt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-SYN-147` | sync.deployment.v1: … _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-148` | table … is not on a sync queue _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-149` | unknown sync op: {} _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-150` | wire frame overrun _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |
| `MD-SYN-151` | wire frame too large _(technische Prüfung, Anzeige auf Englisch)_ | Aktion blockiert | Eine Datei oder Signatur hat die Integritätsprüfung nicht bestanden. Es wurde nichts geändert. | Originale, unveränderte Datei verwenden. Nicht mit derselben Datei wiederholen. |

## Behandlungen

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-TRT-001` | Für einen Faktor über 3,5 ist eine Vereinbarung nach § 2 GOZ erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TRT-002` | Der Steigerungsfaktor muss zwischen 1,0 und 3,5 liegen (darüber nur mit Vereinbarung nach § 2 GOZ). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TRT-003` | Für einen Faktor über 2,3 ist eine schriftliche Begründung erforderlich (§ 10 Abs. 3 GOZ). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TRT-004` | Für GOZ/GOÄ-Leistungen sind Gebührennummer und Punktzahl erforderlich. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-TRT-005` | Ungültige Gebührenordnung (erlaubt: GOZ, GOÄ, Material, Labor, Sonstiges). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## App-Ansichten

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-UIX-500` | Eine Quittung kann nur für eine bezahlte Zahlung erstellt werden. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-501` | error catalog is missing … _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-502` | LAN-Client-Konfiguration unvollständig (Basis-URL fehlt). | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-UIX-503` | LAN-Client-Konfiguration unvollständig (Basis-URL oder Token fehlt). | Aktion blockiert · Erneuter Versuch kann helfen | Dieses Gerät erreicht den Praxis-Host bzw. LAN-Server nicht. | WLAN/LAN prüfen, sicherstellen, dass der Praxis-Host läuft, dann erneut versuchen. Einstellungen → Netzwerk zeigt die Verbindung. |
| `MD-UIX-505` | MeDoc repository root not found from … _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-506` | native-go-menu: missing label key for "…" _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-507` | native-go-menu: missing ROUTE_VISIBILITY for path "…" _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-514` | not loaded _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-508` | Pairing handle missing _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-509` | Pairing handle missing sessionId _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-510` | PDF fehlt. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-511` | Praxisstammdaten für Quittungen unvollständig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-512` | SAS digits missing from accept response _(technische Prüfung, Anzeige auf Englisch)_ | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |
| `MD-UIX-513` | Gespeicherte Arbeitszeiten sind ungültig. | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Arbeitszeit

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-WTM-001` | Keine offene Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-002` | Keine pausierte Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-003` | Keine laufende Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-004` | Es läuft bereits eine Arbeitszeit-Sitzung. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-005` | Sitzung ist nicht pausiert. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-006` | Sitzung ist nicht aktiv. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WTM-007` | Die Woche muss mit einem Kalenderdatum beginnen (JJJJ-MM-TT). | Eingabe erforderlich | Ein eingegebener Wert fehlt oder hat ein falsches Format. | Markiertes Feld korrigieren und erneut speichern. |

## Status-Workflow

| Code | Meldung | Schweregrad | Warum es auftritt | Was tun |
|---|---|---|---|---|
| `MD-WFL-001` | Akte ist bereits validiert oder archiviert. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-002` | Diese Akte ist archiviert (schreibgeschützt) und kann nicht geändert werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-003` | Akten-Status … kann nicht validiert werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-004` | Unbekannter Bestellstatus: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-005` | Status-Übergang …→… ist nicht erlaubt. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-010` | Unbekannter Status: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-006` | Aufgabe ist bereits geschlossen (VALIDIERT). | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-007` | Unbekannter Aufgaben-Status: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-008` | Nur erledigte Aufgaben können validiert oder zurückgegeben werden. | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
| `MD-WFL-009` | Unbekannter Ticket-Status: … | Eingabe erforderlich | Das Element hat einen Status, der diese Aktion nicht erlaubt. | Aktuellen Status prüfen (siehe Statusleitfaden) und einen erlaubten nächsten Schritt wählen. |
