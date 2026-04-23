# Aktivitätsdiagramm (Activity Diagram) – MeDoc

## Beschreibung
Modelliert die Geschäftsprozesse und Workflows der Zahnarztpraxis mit Entscheidungspunkten, Parallelaktivitäten und Schleifen.

## Workflow 1: Patientenaufnahme (Neuer Patient)

```mermaid
flowchart TD
    Start([Patient erscheint in Praxis]) --> A[Rezeption: Patient im System suchen]
    A --> B{Patient gefunden?}
    B -- Ja --> C[Patientendaten öffnen]
    B -- Nein --> D[Rezeption: Neuen Patienten anlegen]
    D --> E[Stammdaten erfassen]
    E --> F[System: Patientenakte automatisch erstellen]
    F --> G{Anamnesebogen vorhanden?}
    G -- Nein --> H[Patient: Anamnesebogen ausfüllen]
    H --> I[Rezeption: Anamnesebogen ins System übertragen]
    I --> J[Patient unterschreibt digital]
    J --> C
    G -- Ja --> C
    C --> K[Rezeption: Termin bestätigen]
    K --> L{Termin heute?}
    L -- Ja --> M[Patient wartet im Wartezimmer]
    L -- Nein --> N[Termin für späteren Zeitpunkt anlegen]
    N --> Ende([Ende])
    M --> O[Arzt: Patient aufrufen]
    O --> P([Weiter mit Untersuchung])
```

## Workflow 2: Untersuchung und Behandlung

```mermaid
flowchart TD
    Start([Patient im Behandlungszimmer]) --> A[Arzt: Patientenakte öffnen]
    A --> B[Arzt: Vorherige Befunde prüfen]
    B --> C[Arzt: Zahnschema einsehen]
    C --> D[Arzt: Untersuchung durchführen]
    D --> E[Arzt: Untersuchungsergebnisse dokumentieren]
    E --> F{Behandlung nötig?}

    F -- Nein --> G[Arzt: Befund dokumentieren]
    G --> H[Arzt: Termin als DURCHGEFÜHRT markieren]
    H --> I([Weiter mit Abschluss])

    F -- Ja --> J[Arzt: Behandlungsplan erklären]
    J --> K{Patient stimmt zu?}
    K -- Nein --> L[Arzt: Alternative vorschlagen oder Termin beenden]
    L --> H
    K -- Ja --> M[Arzt: Behandlung durchführen]
    M --> N[Arzt: Behandlung dokumentieren]
    N --> O[Arzt: Zahnschema aktualisieren]
    O --> P{Weitere Behandlung nötig?}
    P -- Ja --> Q[Folgetermin anlegen]
    Q --> R[Arzt: Termin als DURCHGEFÜHRT markieren]
    P -- Nein --> R
    R --> S[Arzt: Akte validieren]
    S --> I
```

## Workflow 3: Zahlungsprozess

```mermaid
flowchart TD
    Start([Behandlung abgeschlossen]) --> A[Rezeption: Leistung auswählen]
    A --> B[System: Preis automatisch eintragen]
    B --> C{Patient möchte bezahlen?}

    C -- Ja --> D[Rezeption: Zahlungsart wählen]
    D --> E{Welche Zahlungsart?}
    E -- Bar --> F[Bargeldzahlung entgegennehmen]
    E -- Karte --> G[Kartenzahlung durchführen]
    E -- Überweisung --> H[Rechnung mit Bankdaten erstellen]
    F --> I[Zahlung als BEZAHLT markieren]
    G --> I
    H --> J[Zahlung als OFFEN markieren]

    C -- Nein --> K[Rechnung erstellen und zusenden]
    K --> J

    I --> L[System: Audit-Log schreiben]
    J --> L
    L --> M{Quittung gewünscht?}
    M -- Ja --> N[Quittung drucken/senden]
    M -- Nein --> O([Ende])
    N --> O
```

## Workflow 4: Tagesablauf (Parallele Aktivitäten)

```mermaid
flowchart TD
    Start([Arbeitstag beginnt]) --> Login[Alle: Am System anmelden]
    Login --> Fork{Parallele Arbeit}

    Fork --> RezStrang[Rezeption-Strang]
    Fork --> ArztStrang[Arzt-Strang]

    subgraph "Rezeption"
        RezStrang --> R1[Tagesplan prüfen]
        R1 --> R2[Wartende Patienten aufnehmen]
        R2 --> R3{Neuer Patient?}
        R3 -- Ja --> R4[Patient anlegen + Anamnesebogen]
        R3 -- Nein --> R5[Stammdaten prüfen/aktualisieren]
        R4 --> R6[Patienten an Arzt übergeben]
        R5 --> R6
        R6 --> R7[Zahlungen abwickeln]
        R7 --> R8{Weitere Patienten?}
        R8 -- Ja --> R2
        R8 -- Nein --> RezEnde[Tagesabschluss: Kasse prüfen]
    end

    subgraph "Arzt"
        ArztStrang --> A1[Dashboard prüfen: Termine heute]
        A1 --> A2[Nächsten Patienten aufrufen]
        A2 --> A3[Akte + Zahnschema öffnen]
        A3 --> A4[Untersuchung/Behandlung durchführen]
        A4 --> A5[Dokumentation schreiben]
        A5 --> A6[Akte ggf. validieren]
        A6 --> A7{Weitere Termine?}
        A7 -- Ja --> A2
        A7 -- Nein --> ArztEnde[Tagesabschluss: Akten prüfen]
    end

    RezEnde --> Join{Zusammenführung}
    ArztEnde --> Join
    Join --> Logout[Alle: Abmelden]
    Logout --> Ende([Arbeitstag beendet])
```

## Workflow 5: Ärztliche Dokumentation (Detailprozess)

```mermaid
flowchart TD
    Start([Dokumentation starten]) --> A[Untersuchungsergebnisse eingeben]
    A --> B{Röntgen vorhanden?}
    B -- Ja --> C[Röntgenbild als Dokument hochladen]
    C --> D[Befund in Akte eintragen]
    B -- Nein --> D
    D --> E[Zahnschema öffnen]
    E --> F[Betroffene Zähne markieren]
    F --> G{Alle Zähne bearbeitet?}
    G -- Nein --> F
    G -- Ja --> H[Diagnose formulieren]
    H --> I[Behandlungsplan erstellen]
    I --> J{Behandlung sofort?}
    J -- Ja --> K[Behandlung dokumentieren]
    K --> L[Material und Leistung zuordnen]
    L --> M[Behandlungserfolg bewerten]
    J -- Nein --> N[Folgetermin vorschlagen]
    M --> O[Akte Status → IN_BEARBEITUNG]
    N --> O
    O --> P{Arzt validiert?}
    P -- Ja --> Q[Akte Status → VALIDIERT]
    P -- Nein --> R([Ende – Validierung später])
    Q --> R
```
