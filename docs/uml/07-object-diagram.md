# Objektdiagramm (Object Diagram) – MeDoc

## Beschreibung
Zeigt einen Snapshot der Systeminstanzen (Objekte) zu einem bestimmten Zeitpunkt – hier: Montag 10:15 Uhr, Patient Max Mustermann wird behandelt.

## Szenario: Praxis-Momentaufnahme

```mermaid
classDiagram
    direction LR

    class `dr_ahmed : Personal` {
        id = "p-001"
        name = "Dr. Ahmed R."
        email = "ahmed@praxis.de"
        rolle = ARZT
        fachrichtung = "Zahnmedizin"
        verfuegbar = true
    }

    class `aya : Personal` {
        id = "p-002"
        name = "Aya M."
        email = "aya@praxis.de"
        rolle = REZEPTION
        verfuegbar = true
    }

    class `max : Patient` {
        id = "pat-001"
        name = "Max Mustermann"
        geburtsdatum = 1985-03-15
        geschlecht = MAENNLICH
        versicherungsnummer = "A123456789"
        telefon = "+49 170 1234567"
        status = AKTIV
    }

    class `erika : Patient` {
        id = "pat-002"
        name = "Erika Muster"
        geburtsdatum = 1990-07-22
        geschlecht = WEIBLICH
        versicherungsnummer = "B987654321"
        status = AKTIV
    }

    class `max_akte : Patientenakte` {
        id = "akte-001"
        patient_id = "pat-001"
        status = IN_BEARBEITUNG
        diagnose = "Karies an Zahn 36"
        befunde = "Tiefe Fissurenkaries"
    }

    class `termin_0900 : Termin` {
        id = "t-001"
        datum = 2026-04-18
        uhrzeit = "09:00"
        art = UNTERSUCHUNG
        status = DURCHGEFUEHRT
        patient_id = "pat-001"
        arzt_id = "p-001"
    }

    class `termin_1000 : Termin` {
        id = "t-002"
        datum = 2026-04-18
        uhrzeit = "10:00"
        art = BEHANDLUNG
        status = BESTAETIGT
        beschwerden = "Zahnschmerzen rechts unten"
        patient_id = "pat-002"
        arzt_id = "p-001"
    }

    class `befund_36 : Zahnbefund` {
        id = "zb-001"
        akte_id = "akte-001"
        zahn_nummer = 36
        befund = "karioes"
        diagnose = "Tiefe Fissurenkaries"
        notizen = "Kompositfüllung geplant"
    }

    class `befund_37 : Zahnbefund` {
        id = "zb-002"
        akte_id = "akte-001"
        zahn_nummer = 37
        befund = "gefuellt"
        diagnose = null
        notizen = "Füllung von 2024, intakt"
    }

    class `untersuchung_1 : Untersuchung` {
        id = "u-001"
        akte_id = "akte-001"
        beschwerden = "Zahnschmerzen 36"
        ergebnisse = "Karies profunda"
        diagnose = "Tiefe Fissurenkaries Zahn 36"
    }

    class `zahlung_1 : Zahlung` {
        id = "z-001"
        patient_id = "pat-001"
        betrag = 80.00
        zahlungsart = KARTE
        status = BEZAHLT
        leistung_id = "l-001"
    }

    class `pzr : Leistung` {
        id = "l-001"
        name = "Professionelle Zahnreinigung"
        kategorie = "Prophylaxe"
        preis = 80.00
        aktiv = true
    }

    class `fuellung : Leistung` {
        id = "l-004"
        name = "Kompositfüllung"
        kategorie = "Konservierende"
        preis = 120.00
        aktiv = true
    }

    class `audit_1 : AuditLog` {
        id = "al-001"
        user_id = "p-001"
        action = "UPDATE"
        entity = "Zahnbefund"
        entity_id = "zb-001"
        details = "Befund karioes für Zahn 36"
        timestamp = 2026-04-18T09:45:00
    }

    class `anamnesebogen_max : Anamnesebogen` {
        id = "an-001"
        patient_id = "pat-001"
        unterschrieben = true
        antworten = ❴Herz: Nein, Medikamente: Nein, Allergien: Penicillin❵
    }

    %% Relationships
    `max : Patient` --> `max_akte : Patientenakte` : besitzt
    `max : Patient` --> `termin_0900 : Termin` : hat
    `max : Patient` --> `zahlung_1 : Zahlung` : zahlt
    `max : Patient` --> `anamnesebogen_max : Anamnesebogen` : hat
    `erika : Patient` --> `termin_1000 : Termin` : hat

    `dr_ahmed : Personal` --> `termin_0900 : Termin` : behandelt
    `dr_ahmed : Personal` --> `termin_1000 : Termin` : behandelt
    `dr_ahmed : Personal` --> `audit_1 : AuditLog` : erzeugt

    `max_akte : Patientenakte` --> `befund_36 : Zahnbefund` : enthält
    `max_akte : Patientenakte` --> `befund_37 : Zahnbefund` : enthält
    `max_akte : Patientenakte` --> `untersuchung_1 : Untersuchung` : enthält

    `zahlung_1 : Zahlung` --> `pzr : Leistung` : für
```

## Objektzustand zum Zeitpunkt 10:15 Uhr

| Objekt | Zustand | Beschreibung |
|--------|---------|-------------|
| `dr_ahmed` | Aktiv, behandelt `erika` | 09:00-Termin mit Max abgeschlossen, 10:00 Erika begonnen |
| `aya` | Aktiv, am Empfang | Verwaltet Termine und Zahlungen |
| `max` | AKTIV, Akte IN_BEARBEITUNG | Untersuchung durchgeführt, Karies Zahn 36 festgestellt |
| `erika` | AKTIV, im Behandlungszimmer | 10:00-Termin läuft, Zahnschmerzen rechts unten |
| `termin_0900` | DURCHGEFÜHRT | Max' Kontrolltermin beendet |
| `termin_1000` | BESTAETIGT → wird gerade durchgeführt | Erika wird behandelt |
| `befund_36` | karioes | Heute diagnostiziert, Füllung geplant |
| `befund_37` | gefuellt | Bestehende Füllung von 2024, intakt |
| `zahlung_1` | BEZAHLT | Max hat PZR (80€) per Karte bezahlt |
