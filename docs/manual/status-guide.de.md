# MeDoc-Statusleitfaden

> Generiert — nicht bearbeiten. `node scripts/generate-manuals.mjs` ausführen.

Jedes Element hat genau einen Status. Markierungen (z. B. „Verschoben“) sind Zusatzhinweise daneben und ersetzen nie den Status. Listen sind immer so sortiert: Handlungsbedarf → zu erledigen → in Arbeit → wartet auf Prüfung → erledigt → geschlossen.

## Termin

Beginnt als: **Geplant** · `appointment.status (config/enums.yaml · AppointmentStatus)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Geplant** (`PLANNED`) | Gebucht, noch nicht von Patient oder Praxis bestätigt. | Zu erledigen | Bestätigt, Abgeschlossen, Storniert, Nicht erschienen |
| **Bestätigt** (`CONFIRMED`) | Bestätigt; der Patient wird zur gebuchten Zeit erwartet. | In Arbeit | Abgeschlossen, Storniert, Nicht erschienen |
| **Abgeschlossen** (`COMPLETED`) | Der Besuch hat stattgefunden. Bereit für Dokumentation und Abrechnung. | Erledigt | Endgültig |
| **Nicht erschienen** (`NO_SHOW`) | Der Patient ist ohne Absage nicht erschienen. Endgültig. | Geschlossen | Endgültig |
| **Storniert** (`CANCELLED`) | Von Patient oder Praxis storniert. Der Termin ist wieder frei. Endgültig. | Geschlossen | Endgültig |

Markierungen (kein Status): Verschoben · Notfall

## Patient

Beginnt als: **Neu** · `patient.status (config/enums.yaml · PatientStatus)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Neu** (`NEW`) | Erstbesuch; Stammdaten noch nicht vollständig. | Zu erledigen | Aktiv, Validiert, Archiviert |
| **Aktiv** (`ACTIVE`) | Patient in laufender Behandlung. | In Arbeit | Validiert, Archiviert |
| **Validiert** (`VALIDATED`) | Stammdaten und Akte von ärztlicher Seite geprüft. | Erledigt | Aktiv, Archiviert |
| **Archiviert** (`READONLY`) | Archiviert: zur Aufbewahrung, schreibgeschützt. Endgültig. | Geschlossen | Endgültig |

## Patientenakte

Beginnt als: **Entwurf** · `patient_chart.status (config/enums.yaml · ChartStatus)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Entwurf** (`DRAFT`) | In Dokumentation; noch nicht zur Prüfung gesendet. | Zu erledigen | In Prüfung, Validiert, Abgelehnt |
| **In Prüfung** (`IN_PROGRESS`) | An Ärztin/Arzt gesendet, wartet in der Validierungsliste. | Wartet auf Prüfung | Validiert, Abgelehnt |
| **Abgelehnt** (`DECLINED`) | Von ärztlicher Seite zurückgewiesen; vor erneutem Senden korrigieren. | Handlungsbedarf | In Prüfung, Validiert |
| **Validiert** (`VALIDATED`) | Ärztlich freigegeben. Abrechnung kann freigegeben werden. | Erledigt | In Prüfung |
| **Archiviert** (`READONLY`) | Zur Aufbewahrung gesperrt; keine Änderungen mehr. Endgültig. | Geschlossen | Endgültig |

## Zahlung

Beginnt als: **Offen** · `payment.status (config/enums.yaml · PaymentStatus)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Offen** (`OUTSTANDING`) | Noch nichts bezahlt. | Zu erledigen | Teilweise bezahlt, Bezahlt, Storniert |
| **Teilweise bezahlt** (`PARTIALLY_PAID`) | Ein Teil ist bezahlt; der Rest ist offen. | In Arbeit | Bezahlt, Storniert |
| **Bezahlt** (`PAID`) | Vollständig bezahlt. Endgültig. | Erledigt | Endgültig |
| **Storniert** (`CANCELLED`) | Storniert; zählt nicht zum Umsatz. Endgültig. | Geschlossen | Endgültig |

## Bestellung

Beginnt als: **Offen** · `purchase_order.status (config/enums.yaml · OrderStatus)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Offen** (`OPEN`) | Angelegt, vom Lieferanten noch nicht versandt. | Zu erledigen | Unterwegs, Geliefert, Storniert |
| **Unterwegs** (`IN_TRANSIT`) | Versandt und unterwegs. | In Arbeit | Geliefert, Storniert |
| **Geliefert** (`DELIVERED`) | Erhalten und eingelagert. Endgültig. | Erledigt | Endgültig |
| **Storniert** (`CANCELLED`) | Bestellung zurückgezogen. Endgültig. | Geschlossen | Endgültig |

Markierungen (kein Status): Überfällig

## Praxisaufgabe

Beginnt als: **Offen** · `practice_task.status (workflow_transitions.rs · TASK_STATUSES)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Zurückgegeben** (`BACK`) | Vom Ersteller mit Begründung zurückgegeben; zuerst nacharbeiten. | Handlungsbedarf | Offen, In Bearbeitung |
| **Offen** (`OPEN`) | Wartet auf Beginn durch die zuständige Person. | Zu erledigen | In Bearbeitung |
| **In Bearbeitung** (`IN_PROGRESS`) | Die zuständige Person bearbeitet sie. | In Arbeit | Erledigt — wartet auf Prüfung, Offen |
| **Erledigt — wartet auf Prüfung** (`DONE_RECEPTION`) | Von der zuständigen Person erledigt; Ersteller validiert oder gibt zurück. | Wartet auf Prüfung | Validiert, Zurückgegeben |
| **Validiert** (`VALIDATED`) | Vom Ersteller geprüft und abgeschlossen. Endgültig. | Erledigt | Endgültig |

## Ticket

Beginnt als: **Offen** · `practice_ticket.status (workflow_transitions.rs)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Offen** (`OPEN`) | Neue Nachricht an Ärztin/Arzt. | Zu erledigen | In Bearbeitung, Erledigt |
| **In Bearbeitung** (`IN_PROGRESS`) | Wird bearbeitet. | In Arbeit | Erledigt, Offen |
| **Erledigt** (`DONE`) | Erledigt. Endgültig. | Erledigt | Endgültig |

## Rückmeldung

Beginnt als: **Offen** · `feedback.status (config/enums.yaml · FeedbackStatus)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Offen** (`OPEN`) | Eingereicht, noch nicht gesichtet. | Zu erledigen | In Bearbeitung, Erledigt |
| **In Bearbeitung** (`IN_PROGRESS`) | In Prüfung. | In Arbeit | Erledigt, Offen |
| **Erledigt** (`DONE`) | Bearbeitet. Endgültig. | Erledigt | Endgültig |

## Rezept

Beginnt als: **Entwurf** · `prescription.status`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Entwurf** (`DRAFT`) | Bearbeitbar; noch nicht ausgehändigt. | Zu erledigen | Ausgestellt |
| **Ausgestellt** (`ISSUED`) | Unterschrieben und ausgehändigt bzw. gesendet. Endgültig. | Erledigt | Endgültig |

## Vertrauensstatus Gerätesitzung

Beginnt als: **Ungeprüft** · `device_session.trust_status`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Verdächtig** (`SUSPECTED`) | Als verdächtig markiert; prüfen und bei Unbekanntheit beenden. | Handlungsbedarf | Vertrauenswürdig, Ungeprüft |
| **Ungeprüft** (`UNCHECKED`) | Neue Anmeldung von diesem Gerät; noch nicht geprüft. | Zu erledigen | Vertrauenswürdig, Verdächtig |
| **Vertrauenswürdig** (`TRUSTED`) | Als bekanntes Praxisgerät markiert. | Erledigt | Verdächtig |

## Gerätekopplung

Beginnt als: **Ausstehend** · `pairing_request.status (sync_tables.rs CHECK)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Ausstehend** (`PENDING`) | Anfrage eingegangen; wartet auf Freigabe am Host. | Zu erledigen | Angenommen, Abgelehnt |
| **Angenommen** (`ACCEPTED`) | Gerät ist gekoppelt und darf synchronisieren. | Erledigt | Widerrufen |
| **Abgelehnt** (`REJECTED`) | Anfrage abgelehnt. Endgültig. | Geschlossen | Endgültig |
| **Widerrufen** (`REVOKED`) | Zuvor gekoppeltes Gerät wurde entfernt. Endgültig. | Geschlossen | Endgültig |

Markierungen (kein Status): Code bestätigen

## Arbeitszeitsitzung

Beginnt als: **Läuft** · `work_time_session.status (rust_only.rs CHECK)`

| Status | Bedeutung | Phase | Kann wechseln zu |
|---|---|---|---|
| **Läuft** (`RUNNING`) | Zeit wird erfasst. | In Arbeit | Pausiert, Beendet |
| **Pausiert** (`PAUSED`) | Pause; Zeit zählt erst nach Fortsetzen. | Zu erledigen | Läuft, Beendet |
| **Beendet** (`ENDED`) | Sitzung beendet. Endgültig. | Geschlossen | Endgültig |
