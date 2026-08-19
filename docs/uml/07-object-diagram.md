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
        role = PHYSICIAN
        specialty = "Zahnmedizin"
        available = true
    }

    class `aya : Personal` {
        id = "p-002"
        name = "Aya M."
        email = "aya@praxis.de"
        role = RECEPTION
        available = true
    }

    class `max : Patient` {
        id = "pat-001"
        name = "Max Mustermann"
        date_of_birth = 1985-03-15
        sex = MALE
        insurance_number = "A123456789"
        phone = "+49 170 1234567"
        status = ACTIVE
    }

    class `erika : Patient` {
        id = "pat-002"
        name = "Erika Muster"
        date_of_birth = 1990-07-22
        sex = FEMALE
        insurance_number = "B987654321"
        status = ACTIVE
    }

    class `max_akte : Patientenakte` {
        id = "akte-001"
        patient_id = "pat-001"
        status = IN_PROGRESS
        diagnosis = "Karies an Zahn 36"
        findings = "Tiefe Fissurenkaries"
    }

    class `termin_0900 : Termin` {
        id = "t-001"
        date = 2026-04-18
        time = "09:00"
        kind = EXAMINATION
        status = COMPLETED
        patient_id = "pat-001"
        physician_id = "p-001"
    }

    class `termin_1000 : Termin` {
        id = "t-002"
        date = 2026-04-18
        time = "10:00"
        kind = TREATMENT
        status = CONFIRMED
        chief_complaint = "Zahnschmerzen rechts unten"
        patient_id = "pat-002"
        physician_id = "p-001"
    }

    class `befund_36 : Zahnbefund` {
        id = "zb-001"
        chart_id = "akte-001"
        tooth_number = 36
        finding = "karioes"
        diagnosis = "Tiefe Fissurenkaries"
        notes = "Kompositfüllung geplant"
    }

    class `befund_37 : Zahnbefund` {
        id = "zb-002"
        chart_id = "akte-001"
        tooth_number = 37
        finding = "gefuellt"
        diagnosis = null
        notes = "Füllung von 2024, intakt"
    }

    class `untersuchung_1 : Untersuchung` {
        id = "u-001"
        chart_id = "akte-001"
        chief_complaint = "Zahnschmerzen 36"
        results = "Karies profunda"
        diagnosis = "Tiefe Fissurenkaries Zahn 36"
    }

    class `zahlung_1 : Zahlung` {
        id = "z-001"
        patient_id = "pat-001"
        amount = 80.00
        payment_method = CARD
        status = PAID
        service_item_id = "l-001"
    }

    class `pzr : Leistung` {
        id = "l-001"
        name = "Professionelle Zahnreinigung"
        category = "Prophylaxe"
        price = 80.00
        active = true
    }

    class `fuellung : Leistung` {
        id = "l-004"
        name = "Kompositfüllung"
        category = "Konservierende"
        price = 120.00
        active = true
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
        signed = true
        answers = ❴Herz: Nein, Medikamente: Nein, Allergien: Penicillin❵
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
| `max` | ACTIVE, Akte IN_PROGRESS | Untersuchung durchgeführt, Karies Zahn 36 festgestellt |
| `erika` | ACTIVE, im Behandlungszimmer | 10:00-Termin läuft, Zahnschmerzen rechts unten |
| `termin_0900` | DURCHGEFÜHRT | Max' Kontrolltermin beendet |
| `termin_1000` | CONFIRMED → wird gerade durchgeführt | Erika wird behandelt |
| `befund_36` | karioes | Heute diagnostiziert, Füllung geplant |
| `befund_37` | gefuellt | Bestehende Füllung von 2024, intakt |
| `zahlung_1` | PAID | Max hat PZR (80€) per Karte bezahlt |
