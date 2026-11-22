# MeDoc-Statusleitfaden

> Generiert — nicht bearbeiten. `node scripts/generate-manuals.mjs` ausführen.

Jedes Element hat genau einen Status. Markierungen (z. B. „Verschoben“) sind Zusatzhinweise daneben und ersetzen nie den Status. Listen sind immer so sortiert: Handlungsbedarf → zu erledigen → in Arbeit → wartet auf Prüfung → erledigt → geschlossen.

## Termin

Beginnt als: **Geplant** · `appointment.status · domain/status.rs AppointmentStatus`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Geplant** (`PLANNED`) | Gebucht, noch nicht bestätigt. Kann bearbeitet, per Ziehen verschoben, erinnert oder gelöscht werden. | Zu erledigen | Bestätigt, Abgeschlossen, Storniert, Nicht erschienen | Bearbeitbar, Löschbar, Verschiebbar, Erinnerungen |
| **Bestätigt** (`CONFIRMED`) | Patient wird erwartet. Kann noch verschoben werden; bei Ankunft auf „In Behandlung“ setzen. | Zu erledigen | In Behandlung, Abgeschlossen, Storniert, Nicht erschienen | Bearbeitbar, Verschiebbar, Erinnerungen |
| **In Behandlung** (`IN_PROGRESS`) | Patient wird gerade behandelt. Nicht mehr verschiebbar; mit „Abgeschlossen“ beenden. | In Arbeit | Abgeschlossen | Bearbeitbar |
| **Abgeschlossen** (`COMPLETED`) | Besuch hat stattgefunden. Im Kalender gesperrt; Leistungen können abgerechnet und gedruckt werden. | Erledigt | Endgültig | Abrechenbar, Druckbar |
| **Nicht erschienen** (`NO_SHOW`) | Patient kam nicht und sagte nicht ab. Platz ist frei; kann als Geplant wieder geöffnet werden. | Geschlossen | Geplant | Wiedereröffenbar |
| **Storniert** (`CANCELLED`) | Von Patient oder Praxis storniert. Platz ist frei; kann wieder geöffnet oder gelöscht werden. | Geschlossen | Geplant | Wiedereröffenbar, Löschbar |

Markierungen (kein Status): Verschoben · Notfall

## Patient

Beginnt als: **Neu** · `patient.status · domain/status.rs PatientStatus`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Neu** (`NEW`) | Erstbesuch; Stammdaten unvollständig. Bearbeitbar; kann noch gelöscht werden. | Zu erledigen | In Behandlung, Behandlung abgeschlossen, Geschlossen (schreibgeschützt), Archiviert | Bearbeitbar, Löschbar |
| **In Behandlung** (`ACTIVE`) | Patient in laufender Behandlung. Bearbeitbar; Leistungen abrechenbar. | In Arbeit | Behandlung abgeschlossen, Geschlossen (schreibgeschützt), Archiviert | Bearbeitbar, Abrechenbar |
| **Behandlung abgeschlossen** (`VALIDATED`) | Behandlung beendet und ärztlich geprüft. Weiter bearbeitbar und abrechenbar. | Erledigt | Geschlossen (schreibgeschützt), Archiviert | Bearbeitbar, Abrechenbar, Druckbar |
| **Geschlossen (schreibgeschützt)** (`READONLY`) | Akte zur Aufbewahrung gesperrt. Keine Änderungen; Dokumente weiter druckbar. | Geschlossen | Archiviert | Druckbar |
| **Archiviert** (`ARCHIVED`) | In allen Listen ausgeblendet („Archivierte anzeigen“). Kann wieder aktiviert werden. | Geschlossen | In Behandlung | Wiedereröffenbar, In Listen ausgeblendet |

## Patientenliste (Reiter)

Beginnt als: **Neue Patienten** · `Patients page tabs · patient_repo::filter_counts / patient-status-filter.ts` · _Wird von der App automatisch gesetzt_

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Neue Patienten** (`NEW_PATIENT`) | Patienten mit Status Neu. | Zu erledigen | In Behandlung | Gesperrt |
| **In Behandlung** (`IN_TREATMENT`) | Patienten im Status In Behandlung (laufende Versorgung). | In Arbeit | Behandlung abgeschlossen | Gesperrt |
| **Behandlung abgeschlossen** (`CLOSED`) | Patienten mit abgeschlossener oder geschlossener Behandlung. Jeder Patient steht in genau einem von Neu / In Behandlung / Abgeschlossen. | Erledigt | Endgültig | Gesperrt |
| **Rechnung offen** (`INVOICE_OPEN`) | Mindestens eine offene oder teilbezahlte Zahlung. Kann sich mit anderen Reitern überschneiden. | Handlungsbedarf | Endgültig | Gesperrt |
| **Akte offen** (`CHART_OPEN`) | Die Akte ist Entwurf, in Prüfung oder abgelehnt — Dokumentation noch nicht fertig. | Handlungsbedarf | Endgültig | Gesperrt |

## Patientenakte

Beginnt als: **Entwurf** · `patient_chart.status · workflow_transitions.rs (forward / validate / decline)`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Entwurf** (`DRAFT`) | In Dokumentation. Bearbeitbar; zur Prüfung an Ärztin/Arzt senden. | Zu erledigen | In Prüfung, Validiert, Abgelehnt | Bearbeitbar |
| **In Prüfung** (`IN_PROGRESS`) | Wartet in der Validierungsliste der Ärztin/des Arztes. | Wartet auf Prüfung | Validiert, Abgelehnt | Bearbeitbar |
| **Abgelehnt** (`DECLINED`) | Ärztlich zurückgewiesen mit Begründung. Korrigieren und erneut senden. | Handlungsbedarf | Entwurf, In Prüfung | Bearbeitbar |
| **Validiert** (`VALIDATED`) | Ärztlich freigegeben. Abrechnung kann freigegeben werden; Wiedereröffnen schickt es in die Prüfung. | Erledigt | In Prüfung | Abrechenbar, Druckbar |
| **Geschlossen (schreibgeschützt)** (`READONLY`) | Zur Aufbewahrung gesperrt. Druckbar, nicht änderbar. | Geschlossen | Endgültig | Druckbar |

## Behandlung

Beginnt als: **Geplant** · `treatment.treatment_status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Geplant** (`PLANNED`) | Behandlung geplant. Bearbeitbar, löschbar, terminierbar. | Zu erledigen | In Behandlung, Abgeschlossen, Storniert | Bearbeitbar, Löschbar, Verschiebbar |
| **In Behandlung** (`IN_PROGRESS`) | Behandlung begonnen (z. B. mehrere Sitzungen). Als Abgeschlossen oder Abgebrochen beenden. | In Arbeit | Abgeschlossen, Abgebrochen | Bearbeitbar |
| **Abgeschlossen** (`COMPLETED`) | Behandlung erledigt. Kann zur Abrechnung freigegeben und gedruckt werden. | Erledigt | Endgültig | Abrechenbar, Druckbar |
| **Abgebrochen** (`DISCONTINUED`) | Vor Abschluss beendet. Bisher erbrachte Leistung kann abgerechnet werden. | Geschlossen | Endgültig | Abrechenbar, Druckbar |
| **Storniert** (`CANCELLED`) | Wird nicht durchgeführt. Nicht abrechenbar. | Geschlossen | Endgültig | Gesperrt |

## Rezept

Beginnt als: **Ausgestellt** · `prescription.status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Entwurf** (`DRAFT`) | Noch nicht ausgestellt. Bearbeitbar und löschbar. | Zu erledigen | Ausgestellt | Bearbeitbar, Löschbar |
| **Ausgestellt** (`ISSUED`) | Unterschrieben und ausgehändigt. Bearbeiten erzeugt eine korrigierte neue Version; die alte wird Ersetzt. | Erledigt | Ersetzt | Bearbeitbar, Druckbar |
| **Ersetzt** (`REPLACED`) | Durch korrigierte Version ersetzt. In Listen ausgeblendet; bleibt für das Protokoll erhalten. | Geschlossen | Endgültig | In Listen ausgeblendet |

## Bescheinigung / ausgestelltes Dokument

Beginnt als: **Ausgestellt** · `issued_document.status (certificates, letters, invoices)`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Ausgestellt** (`ISSUED`) | Gültiges, nummeriertes Dokument. Nachdruck möglich; zur Korrektur stornieren. | Erledigt | Storniert | Druckbar |
| **Storniert** (`CANCELLED`) | Mit Stornobeleg storniert. Bleibt erhalten und druckbar. | Geschlossen | Endgültig | Druckbar |

## Arbeitsunfähigkeitsbescheinigung

Beginnt als: **Gültig** · `sick_leave_certificate.status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Gültig** (`ACTIVE`) | Arbeitsunfähigkeit läuft. Bearbeitbar und druckbar. | In Arbeit | Beendet | Bearbeitbar, Druckbar |
| **Beendet** (`ENDED`) | Zeitraum vorbei. Nur noch druckbar. | Geschlossen | Endgültig | Druckbar |

## Zahlung

Beginnt als: **Offen** · `payment.status · domain/status.rs PaymentStatus`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Offen** (`OUTSTANDING`) | Noch nichts bezahlt. Bearbeitbar, löschbar; Mahnung möglich. | Zu erledigen | Teilweise bezahlt, Bezahlt, Storniert | Bearbeitbar, Löschbar, Erinnerungen |
| **Teilweise bezahlt** (`PARTIALLY_PAID`) | Teil bezahlt; Rest offen. Status folgt automatisch den Buchungen. | In Arbeit | Bezahlt, Storniert | Bearbeitbar, Löschbar, Erinnerungen |
| **Bezahlt** (`PAID`) | Vollständig bezahlt. Gesperrt; Quittung druckbar. | Erledigt | Endgültig | Druckbar |
| **Storniert** (`CANCELLED`) | Storniert. Zählt nicht zu Umsatz oder Tagesabschluss. | Geschlossen | Endgültig | Gesperrt |

## Rechnung

Beginnt als: **Offen** · `receivables.rs status_row (derived from linked payments and due date)` · _Wird von der App automatisch gesetzt_

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Überfällig** (`OVERDUE`) | Fälligkeit überschritten mit Restbetrag. Mahnung kann erstellt werden. | Handlungsbedarf | Bezahlt, Storniert | Erinnerungen, Druckbar |
| **Keine Zahlung verknüpft** (`UNLINKED`) | Zahlungsstand nicht berechenbar: keine verknüpften Buchungen. | Handlungsbedarf | Endgültig | Druckbar |
| **Offen** (`OPEN`) | Ausgestellt, unbezahlt, noch nicht fällig. | Zu erledigen | Teilweise bezahlt, Bezahlt, Überfällig, Storniert | Druckbar |
| **Teilweise bezahlt** (`PARTIAL`) | Teilzahlungen eingegangen; Restbetrag offen. | In Arbeit | Bezahlt, Überfällig, Storniert | Druckbar |
| **Bezahlt** (`PAID`) | Verknüpfte Zahlungen decken den Gesamtbetrag. | Erledigt | Endgültig | Druckbar |
| **Storniert** (`CANCELLED`) | Rechnung durch Stornobeleg storniert. | Geschlossen | Endgültig | Druckbar |
| **Stornobeleg** (`CANCELLATION`) | Beleg, der eine andere Rechnung storniert. | Geschlossen | Endgültig | Druckbar |
| **Importiert** (`LEGACY`) | Aus älterer Version importiert; Zahlungsstand nicht verfolgt. | Geschlossen | Endgültig | Druckbar |

## Bestellung

Beginnt als: **Offen** · `purchase_order.status · workflow_transitions.rs`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Offen** (`OPEN`) | Bestellt, noch nicht versandt. Bearbeitbar und löschbar. | Zu erledigen | Unterwegs, Geliefert, Storniert | Bearbeitbar, Löschbar |
| **Unterwegs** (`IN_TRANSIT`) | Versandt. Bei Ankunft auf Geliefert setzen, um Bestand zu buchen. | In Arbeit | Geliefert, Storniert | Bearbeitbar |
| **Geliefert** (`DELIVERED`) | Erhalten und eingelagert. Gesperrt. | Erledigt | Endgültig | Druckbar |
| **Storniert** (`CANCELLED`) | Bestellung zurückgezogen. Gesperrt. | Geschlossen | Endgültig | Gesperrt |

Markierungen (kein Status): Überfällig

## Vertrag

Beginnt als: **Aktiv** · `Administration → Contracts (activation + start/end dates)`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Noch nicht begonnen** (`NOT_STARTED`) | Beginn liegt in der Zukunft. Noch keine Kosten. | Zu erledigen | Aktiv, Deaktiviert | Bearbeitbar, Löschbar |
| **Aktiv** (`ACTIVE`) | Läuft. Kosten werden je Zeitraum gezählt, bis er deaktiviert wird oder endet. | In Arbeit | Deaktiviert, Ausgelaufen | Bearbeitbar |
| **Deaktiviert** (`INACTIVE`) | Zum Deaktivierungsdatum beendet. Kosten nur bis dahin; reaktivierbar. | Geschlossen | Aktiv | Bearbeitbar, Wiedereröffenbar, Löschbar |
| **Ausgelaufen** (`EXPIRED`) | Enddatum überschritten. Keine weiteren Kosten. | Geschlossen | Aktiv | Bearbeitbar, Wiedereröffenbar |

## Produkt / Leistung

Beginnt als: **Aktiv** · `product.active / treatment_catalog.active`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Aktiv** (`ACTIVE`) | Auswählbar bei Buchung und Abrechnung. | In Arbeit | Inaktiv | Bearbeitbar, Abrechenbar |
| **Inaktiv** (`INACTIVE`) | Nicht mehr auswählbar; bestehende Buchungen behalten es. Reaktivierbar. | Geschlossen | Aktiv | Bearbeitbar, Wiedereröffenbar, In Listen ausgeblendet |

## Tagesabschluss

Beginnt als: **Abgeschlossen** · `day_close_protocol`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Abgeschlossen** (`FINAL`) | Kasse abgeglichen, Protokoll gespeichert. Korrekturen erzeugen eine neue Version. | Erledigt | Korrigiert | Druckbar |
| **Korrigiert** (`CORRECTED`) | Durch korrigiertes Protokoll ersetzt; bleibt für das Protokoll erhalten. | Geschlossen | Endgültig | Druckbar |

## Praxisaufgabe

Beginnt als: **Offen** · `practice_task.status · workflow_transitions.rs (verify + simple track)`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Zurückgegeben** (`BACK`) | Vom Ersteller mit Begründung zurückgegeben. Steht immer oben; nacharbeiten. | Handlungsbedarf | Offen, In Bearbeitung | Bearbeitbar |
| **Offen** (`OPEN`) | Wartet auf Beginn durch die zuständige Person. | Zu erledigen | In Bearbeitung, Gesehen | Bearbeitbar, Löschbar |
| **Gesehen** (`VIEWED`) | Einfacher Ablauf (Tickets, Termine): gesehen; nach Erledigung auf Erledigt setzen. | In Arbeit | Erledigt, Offen | Bearbeitbar |
| **In Bearbeitung** (`IN_PROGRESS`) | Die zuständige Person bearbeitet sie. | In Arbeit | Erledigt — wartet auf Prüfung, Offen | Bearbeitbar |
| **Erledigt — wartet auf Prüfung** (`DONE_RECEPTION`) | Erledigt; Ersteller validiert oder gibt zurück. | Wartet auf Prüfung | Validiert, Zurückgegeben | Gesperrt |
| **Validiert** (`VALIDATED`) | Vom Ersteller geprüft und abgeschlossen. Verlässt den Eingang. | Erledigt | Endgültig | Gesperrt |
| **Erledigt** (`DONE`) | Einfacher Ablauf beendet. Verlässt den Eingang. | Erledigt | Endgültig | Gesperrt |

## Ticket

Beginnt als: **Offen** · `practice_ticket.status (legacy tickets)`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Offen** (`OPEN`) | Neue Nachricht an Ärztin/Arzt. | Zu erledigen | In Bearbeitung, Erledigt | Bearbeitbar |
| **In Bearbeitung** (`IN_PROGRESS`) | Wird bearbeitet. | In Arbeit | Erledigt, Offen | Bearbeitbar |
| **Erledigt** (`DONE`) | Erledigt. | Erledigt | Endgültig | Gesperrt |

## Rückmeldung

Beginnt als: **Offen** · `feedback.status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Offen** (`OPEN`) | Eingereicht, noch nicht gesichtet. | Zu erledigen | In Bearbeitung, Erledigt | Bearbeitbar |
| **In Bearbeitung** (`IN_PROGRESS`) | In Prüfung. | In Arbeit | Erledigt, Offen | Bearbeitbar |
| **Erledigt** (`DONE`) | Bearbeitet. | Erledigt | Endgültig | Gesperrt |

## Vertrauensstatus Gerätesitzung

Beginnt als: **Ungeprüft** · `device_session trust flags`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Verdächtig** (`SUSPECTED`) | Als verdächtig markiert. Sie werden benachrichtigt; beenden, wenn unbekannt. | Handlungsbedarf | Vertrauenswürdig, Ungeprüft | Löschbar |
| **Ungeprüft** (`UNCHECKED`) | Neue Anmeldung, noch nicht geprüft. | Zu erledigen | Vertrauenswürdig, Verdächtig | Löschbar |
| **Vertrauenswürdig** (`TRUSTED`) | Bekanntes Praxisgerät. | Erledigt | Verdächtig | Löschbar |

## Geräteregistrierung

Beginnt als: **Ausstehend** · `provisioning_state.device_status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Ausstehend** (`PENDING`) | Gerät wird registriert; wartet auf Freigabe am Host. | Zu erledigen | Aktiv, Gesperrt | Gesperrt |
| **Aktiv** (`ACTIVE`) | Registriert und verbindungsberechtigt. | Erledigt | Widerrufen, Gesperrt | Gesperrt |
| **Gesperrt** (`BLOCKED`) | Vorübergehend gesperrt; entsperrbar. | Handlungsbedarf | Aktiv | Wiedereröffenbar |
| **Widerrufen** (`REVOKED`) | Dauerhaft entfernt. Muss neu gekoppelt werden. | Geschlossen | Endgültig | Gesperrt |

## Gerätekopplung

Beginnt als: **Ausstehend** · `pairing_request.status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Ausstehend** (`PENDING`) | Anfrage eingegangen; am Host annehmen oder ablehnen. | Zu erledigen | Angenommen, Abgelehnt | Gesperrt |
| **Angenommen** (`ACCEPTED`) | Gekoppelt; Gerät synchronisiert. | Erledigt | Widerrufen | Gesperrt |
| **Abgelehnt** (`REJECTED`) | Anfrage abgelehnt. | Geschlossen | Endgültig | Gesperrt |
| **Widerrufen** (`REVOKED`) | Zuvor gekoppeltes Gerät entfernt. | Geschlossen | Endgültig | Gesperrt |

Markierungen (kein Status): Code bestätigen

## Arbeitszeitsitzung

Beginnt als: **Läuft** · `work_time_session.status`

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Läuft** (`RUNNING`) | Zeit wird erfasst. | In Arbeit | Pausiert, Beendet | Bearbeitbar |
| **Pausiert** (`PAUSED`) | Pause; Zeit zählt nicht. | Zu erledigen | Läuft, Beendet | Bearbeitbar |
| **Beendet** (`ENDED`) | Sitzung beendet; Administration kann korrigieren. | Geschlossen | Endgültig | Bearbeitbar |

## Verbindung

Beginnt als: **Verbunden** · `Top bar connectivity + replica outbox (connectivity.controller.ts, sync-status-badge.tsx)` · _Wird von der App automatisch gesetzt_

| Status | Bedeutung | Phase | Kann wechseln zu | Die App erlaubt |
|---|---|---|---|---|
| **Offline** (`OFFLINE`) | Host nicht erreichbar. Änderungen warten auf die Verbindung. | Handlungsbedarf | Verbunden | Gesperrt |
| **Synchronisiert** (`SYNC_PENDING`) | Änderungen lokal gespeichert, werden an den Host gesendet. | In Arbeit | Verbunden, Offline | Gesperrt |
| **Verbunden** (`ONLINE`) | Änderungen werden sofort gespeichert und geteilt. | Erledigt | Synchronisiert, Offline | Gesperrt |
