# Klassendiagramm (Class Diagram) – MeDoc

## Beschreibung
Das Klassendiagramm zeigt die statische Struktur des MeDoc-Systems: alle Domänenklassen mit Attributen, Methoden und Beziehungen (Assoziation, Komposition, Vererbung).

## Vollständiges Klassendiagramm

```mermaid
classDiagram
    direction TB

    %% ============================================================
    %% ENUMERATIONS
    %% ============================================================

    class Rolle {
        <<enumeration>>
        PHYSICIAN
        RECEPTION
        TAX_ADVISOR
        PHARMA_CONSULTANT
    }

    class Geschlecht {
        <<enumeration>>
        MALE
        FEMALE
        DIVERSE
    }

    class PatientStatus {
        <<enumeration>>
        NEW
        ACTIVE
        VALIDATED
        READONLY
    }

    class AkteStatus {
        <<enumeration>>
        NEW
        IN_PROGRESS
        VALIDATED
        READONLY
    }

    class TerminArt {
        <<enumeration>>
        EXAMINATION
        TREATMENT
        NOTFALL
    }

    class TerminStatus {
        <<enumeration>>
        ANGEFRAGT
        CONFIRMED
        COMPLETED
        ABGESCHLOSSEN
        CANCELLED
    }

    class DokumentTyp {
        <<enumeration>>
        ROENTGEN
        LABORBEFUND
        REZEPT
        ATTEST
        QUITTUNG
        OTHER
    }

    class ZahlungStatus {
        <<enumeration>>
        PAID
        OPEN
        CANCELLED
    }

    class ZahlungsArt {
        <<enumeration>>
        CASH
        CARD
        BANK_TRANSFER
    }

    class LieferStatus {
        <<enumeration>>
        BESTELLT
        DELIVERED
        CANCELLED
    }

    %% ============================================================
    %% DOMAIN CLASSES
    %% ============================================================

    class Personal {
        +String id
        +String name
        +String email
        -String password_hash
        +Rolle role
        +String? activity_area
        +String? specialty
        +String? phone
        +bool available
        +DateTime _created_at
        +DateTime updated_at
        +authenticate(email, password) Option~Personal~
        +change_role(neue_rolle: Rolle) Result
        +set_verfuegbar(status: bool) void
        +validate_password(password: String) bool
    }

    class Patient {
        +String id
        +String name
        +Date date_of_birth
        +Geschlecht sex
        +String insurance_number
        +String? phone
        +String? email
        +String? address
        +PatientStatus status
        +DateTime _created_at
        +DateTime updated_at
        +get_alter() u32
        +change_status(neuer_status: PatientStatus) Result
        +get_vollstaendiger_name() String
        +has_active_termine() bool
    }

    class Patientenakte {
        +String id
        +String patient_id
        +AkteStatus status
        +String? behandlungsverlauf
        +String? diagnosis
        +String? findings
        +String? notes
        +String? validiert_von
        +DateTime? validiert_am
        +DateTime _created_at
        +DateTime updated_at
        +validieren(physician_id: String) Result
        +add_befund(finding: String) void
        +set_readonly() void
        +export_pdf() Vec~u8~
    }

    class Termin {
        +String id
        +Date date
        +String time
        +TerminArt kind
        +TerminStatus status
        +String? chief_complaint
        +String patient_id
        +String physician_id
        +DateTime _created_at
        +DateTime updated_at
        +hat_konflikt(andere_termine: Vec~Termin~) bool
        +change_status(neuer_status: TerminStatus) Result
        +is_heute() bool
        +get_dauer_minuten() u32
    }

    class BlockierteZeit {
        +String id
        +String physician_id
        +Date date
        +String from_time
        +String to_time
        +String? grund
        +DateTime _created_at
        +ueberschneidet(time: String) bool
    }

    class Anamnesebogen {
        +String id
        +String patient_id
        +JSON answers
        +bool signed
        +DateTime _created_at
        +DateTime updated_at
        +is_vollstaendig() bool
        +get_antwort(frage: String) Option~String~
    }

    class Untersuchung {
        +String id
        +String chart_id
        +String? chief_complaint
        +String? untersuchungsergebnisse
        +String? diagnosis
        +String? bildmaterial
        +DateTime _created_at
        +DateTime updated_at
        +hat_diagnose() bool
    }

    class Behandlung {
        +String id
        +String chart_id
        +String? behandlungsart
        +String? verlauf
        +String? materialien
        +String? dokumentation
        +bool? erfolg
        +String? abbruchgrund
        +String? service_item_id
        +DateTime _created_at
        +DateTime updated_at
        +is_abgeschlossen() bool
        +mark_erfolg(erfolg: bool) void
    }

    class Zahnbefund {
        +String id
        +String chart_id
        +i32 tooth_number
        +String finding
        +String? diagnosis
        +String? treatment
        +String? notes
        +DateTime _created_at
        +DateTime updated_at
        +is_fdi_valid() bool
        +needs_treatment() bool
    }

    class Dokument {
        +String id
        +String chart_id
        +DokumentTyp kind
        +String title
        +String datei_pfad
        +String? referenz_nr
        +String? tags
        +DateTime _created_at
        +get_extension() String
        +get_size_bytes() u64
    }

    class Zahlung {
        +String id
        +String patient_id
        +f64 amount
        +ZahlungsArt payment_method
        +ZahlungStatus status
        +String? description
        +String? service_item_id
        +DateTime _created_at
        +DateTime updated_at
        +mark_bezahlt() Result
        +stornieren() Result
        +format_betrag() String
    }

    class Finanzdokument {
        +String id
        +String kind
        +f64 amount
        +String? category
        +String? description
        +String? period
        +DateTime _created_at
        +is_einnahme() bool
    }

    class Leistung {
        +String id
        +String name
        +String category
        +f64 price
        +bool active
        +DateTime _created_at
        +DateTime updated_at
        +deactivate() void
        +format_preis() String
    }

    class Produkt {
        +String id
        +String name
        +String supplier
        +i32 quantity
        +LieferStatus lieferstatus
        +String? hersteller
        +f64? price
        +DateTime _created_at
        +DateTime updated_at
        +is_verfuegbar() bool
        +mark_geliefert() void
    }

    class ExternerPartner {
        +String id
        +String kind
        +String firmenname
        +String? personenname
        +String? activity_area
        +String? email
        +String? phone
        +bool available
        +DateTime _created_at
        +DateTime updated_at
    }

    class AuditLog {
        +String id
        +String user_id
        +String action
        +String entity
        +String? entity_id
        +String? details
        +DateTime timestamp
    }

    %% ============================================================
    %% RELATIONSHIPS
    %% ============================================================

    %% Composition (starke Zugehörigkeit)
    Patient "1" *-- "1" Patientenakte : besitzt
    Patient "1" *-- "0..1" Anamnesebogen : hat
    Patientenakte "1" *-- "0..*" Untersuchung : enthält
    Patientenakte "1" *-- "0..*" Behandlung : enthält
    Patientenakte "1" *-- "0..*" Zahnbefund : enthält
    Patientenakte "1" *-- "0..*" Dokument : enthält

    %% Association (Beziehung)
    Patient "1" -- "0..*" Termin : hat
    Patient "1" -- "0..*" Zahlung : zahlt
    Personal "1" -- "0..*" Termin : behandelt
    Personal "1" -- "0..*" BlockierteZeit : blockiert
    Personal "1" -- "0..*" AuditLog : erzeugt

    %% Dependency (optionale Referenz)
    Behandlung "0..*" ..> "0..1" Leistung : referenziert
    Zahlung "0..*" ..> "0..1" Leistung : für

    %% Enum usage
    Personal ..> Rolle
    Patient ..> Geschlecht
    Patient ..> PatientStatus
    Patientenakte ..> AkteStatus
    Termin ..> TerminArt
    Termin ..> TerminStatus
    Dokument ..> DokumentTyp
    Zahlung ..> ZahlungStatus
    Zahlung ..> ZahlungsArt
    Produkt ..> LieferStatus
```

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| `*--` | Komposition (Teil kann nicht ohne Ganzes existieren) |
| `--` | Assoziation (eigenständige Beziehung) |
| `..>` | Abhängigkeit (optionale Referenz) |
| `+` | Public |
| `-` | Private |
| `<<enumeration>>` | Aufzählungstyp |
