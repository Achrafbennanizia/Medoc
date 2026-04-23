# Sequenzdiagramm (Sequence Diagram) – MeDoc

## Beschreibung
Zeigt die zeitliche Reihenfolge der Interaktionen zwischen Objekten/Komponenten für die wichtigsten Szenarien.

## Szenario 1: Benutzer-Anmeldung (Login)

```mermaid
sequenceDiagram
    actor Benutzer
    participant View as LoginView
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as SQLite
    participant Audit as AuditService

    Benutzer->>View: E-Mail + Passwort eingeben
    View->>Controller: login(email, passwort)
    Controller->>Service: authenticate(email, passwort)
    Service->>DB: SELECT * FROM personal WHERE email = ?
    DB-->>Service: Personal | None

    alt Benutzer nicht gefunden
        Service-->>Controller: Err("Ungültige Anmeldedaten")
        Controller-->>View: Fehlermeldung anzeigen
        View-->>Benutzer: "Ungültige E-Mail oder Passwort"
    else Benutzer gefunden
        Service->>Service: bcrypt::verify(passwort, hash)
        alt Passwort falsch
            Service-->>Controller: Err("Ungültige Anmeldedaten")
            Controller-->>View: Fehlermeldung anzeigen
        else Passwort korrekt
            Service->>Service: JWT-Token generieren (id, rolle)
            Service->>Audit: log(user_id, LOGIN, "Personal", details)
            Audit->>DB: INSERT INTO audit_log (...)
            Service-->>Controller: Ok(token, user)
            Controller-->>View: Dashboard navigieren
            View-->>Benutzer: Dashboard anzeigen
        end
    end
```

## Szenario 2: Termin anlegen mit Konflikterkennung

```mermaid
sequenceDiagram
    actor Rezeption
    participant View as TerminView
    participant Controller as TerminController
    participant Service as TerminService
    participant DB as SQLite
    participant Audit as AuditService

    Rezeption->>View: "Neuer Termin" klicken
    View->>View: Formular anzeigen (Patient, Arzt, Datum, Uhrzeit, Art)
    Rezeption->>View: Formulardaten eingeben + Absenden

    View->>Controller: create_termin(data)
    Controller->>Controller: validate(data) mit Zod/Schema

    alt Validierung fehlgeschlagen
        Controller-->>View: Validierungsfehler anzeigen
    else Validierung OK
        Controller->>Service: create_termin(validated_data)
        Service->>DB: SELECT * FROM termin WHERE arzt_id = ? AND datum = ? AND uhrzeit = ?
        DB-->>Service: Vec<Termin>

        alt Konflikt erkannt
            Service-->>Controller: Err("Terminkonflikt: Arzt hat bereits einen Termin")
            Controller-->>View: Fehlermeldung
            View-->>Rezeption: Konfliktwarnung mit Details
        else Kein Konflikt
            Service->>DB: INSERT INTO termin (...)
            DB-->>Service: Ok(termin)
            Service->>Audit: log(user_id, CREATE, "Termin", termin_id)
            Audit->>DB: INSERT INTO audit_log (...)
            Service-->>Controller: Ok(termin)
            Controller-->>View: Erfolgsmeldung + Liste aktualisieren
            View-->>Rezeption: "Termin erfolgreich angelegt"
        end
    end
```

## Szenario 3: Zahnbefund aktualisieren

```mermaid
sequenceDiagram
    actor Arzt
    participant View as ZahnschemaView
    participant Controller as ZahnschemaController
    participant Service as BehandlungService
    participant DB as SQLite

    Arzt->>View: Zahnschema öffnen (Patient-ID)
    View->>Controller: load_zahnschema(akte_id)
    Controller->>DB: SELECT * FROM zahnbefund WHERE akte_id = ?
    DB-->>Controller: Vec<Zahnbefund>
    Controller-->>View: Zahnschema mit Befunden rendern

    Arzt->>View: Zahn 36 anklicken
    View->>View: Detail-Panel öffnen (aktueller Befund)

    Arzt->>View: Befund = "karioes", Diagnose eingeben
    Arzt->>View: "Speichern" klicken

    View->>Controller: update_zahnbefund(akte_id, 36, data)
    Controller->>Service: upsert_zahnbefund(data)
    Service->>DB: INSERT OR REPLACE INTO zahnbefund (akte_id, zahn_nummer, ...) VALUES (...)
    DB-->>Service: Ok(zahnbefund)
    Service-->>Controller: Ok(zahnbefund)
    Controller-->>View: Zahn 36 rot einfärben + Erfolgsmeldung
    View-->>Arzt: "Zahn 36 aktualisiert"
```

## Szenario 4: Zahlung erfassen und Leistung zuordnen

```mermaid
sequenceDiagram
    actor Rezeption
    participant View as ZahlungView
    participant Controller as ZahlungController
    participant Service as ZahlungService
    participant DB as SQLite

    Rezeption->>View: "Neue Zahlung" klicken
    View->>Controller: load_form_data()
    Controller->>DB: SELECT id, name FROM patient ORDER BY name
    Controller->>DB: SELECT id, name, preis FROM leistung WHERE aktiv = true
    DB-->>Controller: patienten, leistungen
    Controller-->>View: Formular mit Dropdowns

    Rezeption->>View: Patient wählen
    Rezeption->>View: Leistung "Professionelle Zahnreinigung" wählen
    View->>View: Betrag automatisch auf 80.00€ setzen
    Rezeption->>View: Zahlungsart = "KARTE", Absenden

    View->>Controller: create_zahlung(data)
    Controller->>Service: create_zahlung(validated_data)
    Service->>DB: INSERT INTO zahlung (patient_id, betrag, zahlungsart, status='OFFEN', leistung_id)
    DB-->>Service: Ok(zahlung)
    Service-->>Controller: Ok(zahlung)
    Controller-->>View: Erfolgsmeldung + Tabelle aktualisieren
    View-->>Rezeption: "Zahlung erfasst: 80.00€"
```

## Szenario 5: Patientenakte validieren

```mermaid
sequenceDiagram
    actor Arzt
    participant View as AkteView
    participant Controller as AkteController
    participant Service as AkteService
    participant DB as SQLite
    participant Audit as AuditService

    Arzt->>View: Patientenakte öffnen
    View->>Controller: load_akte(patient_id)
    Controller->>DB: SELECT akte + untersuchungen + behandlungen + zahnbefunde
    DB-->>Controller: akte_mit_details
    Controller-->>View: Akte anzeigen (Status: IN_BEARBEITUNG)

    Arzt->>View: Alle Befunde prüfen
    Arzt->>View: "Akte validieren" klicken

    View->>View: Bestätigungsdialog: "Akte endgültig freigeben?"
    Arzt->>View: "Ja, validieren" bestätigen

    View->>Controller: validate_akte(akte_id)
    Controller->>Service: validate_akte(akte_id, arzt_id)
    Service->>DB: UPDATE patientenakte SET status='VALIDIERT', validiert_von=?, validiert_am=NOW()
    DB-->>Service: Ok
    Service->>Audit: log(arzt_id, UPDATE, "Patientenakte", akte_id, "Status→VALIDIERT")
    Audit->>DB: INSERT INTO audit_log (...)
    Service-->>Controller: Ok
    Controller-->>View: "Akte validiert" + Status-Badge aktualisieren
    View-->>Arzt: Akte nun im VALIDIERT-Status
```
