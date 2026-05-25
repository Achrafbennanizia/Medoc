# Aufgaben, Leistung/Preis & Abrechnung — Behavioral Diagrams

**Stand:** 2026-05-21  
**Requirements:** FA-LEIST-06/07, FA-AUFG-01..06 ([`pflichtenheft.md`](../v-model/01-anforderungen/pflichtenheft.md))  
**Related:** [`08-arzt-rezeption-kollaboration.md`](./08-arzt-rezeption-kollaboration.md)

---

## 1. Zielbild (ein Satz)

Wenn der **Arzt** eine **Behandlung** oder **Untersuchung** mit **Leistung und Preis** speichert, entstehen parallel: **(a)** abrechnungsfähige B/U-Daten, **(b)** eine **offene Buchung**, **(c)** eine **Aufgabe für die Rezeption**; die Rezeption erledigt und **benachrichtigt** den Arzt; der Arzt **validiert** und **schließt**.

---

## 2. Use-Case-Diagramm (Soll)

```mermaid
flowchart TB
    subgraph Akteure
        ARZT["🩺 Arzt"]
        REZ["📋 Rezeption"]
    end

    subgraph Leistung["Leistung & Preis (FA-LEIST)"]
        UC_L7["UC-L07: Untersuchung Leistung+Preis ○<br/>FA-LEIST-07"]
        UC_L6["UC-L06: Auto offene Buchung ○<br/>FA-LEIST-06"]
        UC_L5["UC-L05: Freigabe B/U ◐<br/>FA-LEIST-05"]
    end

    subgraph Aufgaben["Praxis-Aufgaben (FA-AUFG)"]
        UC_A2["UC-A02: Aufgabe anlegen ○<br/>manuell + auto aus B/U"]
        UC_A3["UC-A03: Posteingang REZ ○<br/>sync ≤5s"]
        UC_A4["UC-A04: Aufgabe erledigen ○<br/>ERLEDIGT_REZEPTION"]
        UC_A5["UC-A05: Validieren & schließen ○<br/>VALIDIERT / ZURUECK"]
        UC_A1["UC-A01: Bidirektionales Modell ○"]
    end

    subgraph Legacy["Heute ◐"]
        UC_T8["UC-T08: Ticket REZ→ARZT ✓<br/>FA-PERS-08"]
    end

    ARZT --> UC_L7 & UC_L6 & UC_L5 & UC_A2 & UC_A5
    REZ --> UC_A3 & UC_A4 & UC_L6 & UC_T8

    UC_L7 --> UC_L6
    UC_L7 --> UC_A2
    UC_A2 --> UC_A3
    UC_A3 --> UC_A4
    UC_A4 --> UC_A5
    UC_L6 -.->|optional parallel| UC_A4
    UC_T8 -.->|ersetzt durch| UC_A1
```

---

## 3. State-Diagramm — Aufgabenstatus (FA-AUFG-06)

```mermaid
stateDiagram-v2
    [*] --> OFFEN: Arzt/REZ erstellt Aufgabe

    OFFEN --> IN_BEARBEITUNG: REZ übernimmt
    IN_BEARBEITUNG --> ERLEDIGT_REZEPTION: REZ erledigt + Notiz/Link
    ERLEDIGT_REZEPTION --> VALIDIERT: ARZT validiert & schließt
    VALIDIERT --> [*]

    ERLEDIGT_REZEPTION --> ZURUECK: ARZT lehnt ab
    ZURUECK --> OFFEN: REZ korrigiert
    IN_BEARBEITUNG --> OFFEN: REZ gibt frei (optional)

    note right of ERLEDIGT_REZEPTION
        Notification PRAXIS_AUFGABE_ERLEDIGT
        an created_by (Arzt)
    end note
```

---

## 4. Sequenzdiagramm — Arzt speichert Untersuchung mit Leistung (Soll)

```mermaid
sequenceDiagram
    actor ARZT as Arzt
    participant UI as PatientDetail / Composer
    participant IPC as Tauri Commands
    participant DB as SQLCipher
    participant NOTIF as in_app_notification
    actor REZ as Rezeption

    ARZT->>UI: Untersuchung speichern + Leistung aus Katalog
    UI->>IPC: create_untersuchung (leistungsname, gesamtkosten, leistung_id)
    IPC->>DB: INSERT untersuchung + freigegeben_* (FA-LEIST-05/06)
    IPC->>DB: INSERT zahlung AUSSTEHEND (wenn kein Duplikat)
    IPC->>DB: INSERT praxis_aufgabe ABRECHNUNG → REZEPTION
    IPC->>NOTIF: (optional) broadcast hint für REZ-Pool

    IPC-->>UI: OK + navigate Tab zahl + Posteingang-Hinweis
    UI-->>ARZT: Toast „Aufgabe an Rezeption erstellt“

    Note over REZ: Posteingang poll ≤5s
    REZ->>UI: /posteingang
    UI->>IPC: list_aufgaben_for_me (REZEPTION, OFFEN)
    IPC-->>UI: Aufgabe + Deep-Link Patient

    REZ->>UI: Zahlung erfassen (FA-LEIST-06)
    UI->>IPC: create_zahlung
    REZ->>IPC: complete_aufgabe (ERLEDIGT_REZEPTION, zahlung_id)
    IPC->>NOTIF: PRAXIS_AUFGABE_ERLEDIGT → Arzt

    ARZT->>UI: Aufgaben „Erledigt — prüfen“
    ARZT->>IPC: validate_aufgabe (VALIDIERT)
    IPC->>DB: UPDATE status
    IPC-->>UI: Geschlossen
```

---

## 5. Aktivitätsdiagramm — Swimlanes (Soll)

```mermaid
flowchart TB
    subgraph ARZT["Arzt"]
        A1[Behandlung/Untersuchung dokumentieren]
        A2[Leistung aus Katalog wählen]
        A3[Preis prüfen / anpassen]
        A4[Speichern]
        A5{Auto-Aufgabe + offene Buchung?}
        A6[Warten auf REZ]
        A7[Benachrichtigung: erledigt]
        A8{Ergebnis OK?}
        A9[VALIDIERT — schließen]
        A10[ZURUECK — mit Grund]
    end

    subgraph SYS["System"]
        S1[(B/U + gesamtkosten)]
        S2[(zahlung AUSSTEHEND)]
        S3[(praxis_aufgabe OFFEN)]
        S4[Notify REZ Posteingang]
        S5[Notify ARZT erledigt]
    end

    subgraph REZ["Rezeption"]
        R1[Posteingang öffnen]
        R2[Aufgabe übernehmen]
        R3[Patient / Kasse öffnen]
        R4[Zahlung buchen]
        R5[Als erledigt markieren]
    end

    A1 --> A2 --> A3 --> A4 --> A5
    A5 -->|ja| S1 --> S2 --> S3 --> S4
    S4 --> R1 --> R2 --> R3 --> R4 --> R5 --> S5
    S5 --> A7 --> A8
    A8 -->|ja| A9
    A8 -->|nein| A10 --> S3
```

---

## 6. Ist vs. Soll (Evidence)

| Capability | Ist (Code) | Soll (Pflichtenheft) |
|------------|------------|----------------------|
| `untersuchung.gesamtkosten` | ❌ nicht in DB/Entity | FA-LEIST-07 |
| `untersuchung.leistungsname` | ❌ | FA-LEIST-07 |
| Auto Tab `zahl` + `AUSSTEHEND` | ❌ | FA-LEIST-06 |
| Arzt → REZ Aufgabe | ❌ | FA-AUFG-02 |
| REZ Posteingang zentral | ❌ (`/tickets` nur REZ→ARZT sent list) | FA-AUFG-03 |
| REZ erledigt → Notify Arzt | ❌ (Ticket: Arzt schließt allein) | FA-AUFG-04 |
| Arzt VALIDIERT / ZURUECK | ❌ | FA-AUFG-05 |
| `praxis_ticket` | ✓ `akte_workflow_commands.rs` | → FA-AUFG Migration |

---

## 7. Diagramme verbessern — Leitfaden für dieses Projekt

### 7.1 Probleme in den älteren UML-Dateien (`02`–`04`)

| Problem | Empfehlung |
|---------|------------|
| Generische UC-Nummern ohne Requirement-ID | Jedes UC = `FA-*` oder `NFA-*` im Label |
| Nur „Arzt“ / „Rezeption“ ohne **Handoff** | Gestrichelte Kanten mit Verb: „notify“, „validate“, „bill“ |
| Sequenzdiagramme veraltet (bcrypt, kein TOTP) | Kopfzeile **Soll/Ist** + Datei + Command-Namen |
| Kein **Zustandsdiagramm** für Tickets/Aufgaben | FA-AUFG-06 als `stateDiagram-v2` (oben) |
| Activity ohne **System**-Swimlane | Persistenz/Notification in eigener Lane |

### 7.2 Empfohlene Diagramm-Suite pro Feature

Für jedes Kollaborations-Feature **vier Artefakte**:

1. **Use Case (Soll)** — Akteure + FA-IDs + ○/◐/✓  
2. **State Machine** — Status + erlaubte Übergänge (eine Quelle für `workflow_transitions.rs`)  
3. **Sequence (Soll)** — Happy path + 1 Alternativpfad (Fehler Freigabe, ZURUECK)  
4. **Activity (Swimlanes)** — ARZT | REZ | System  

Optional: **Sequence (Ist)** grau/kommentiert — drift sichtbar.

### 7.3 Naming & Traceability

- Dateiname: `09-<feature>-<rolle>.md`  
- Jede Änderung am Pflichtenheft → gleiche IDs in Mermaid-Labels  
- `actions.md` Task-ID (G14–G18) ↔ Diagramm-○  

### 7.4 Technische Sync („direkt synchronisiert“)

| Stufe | Mechanismus | Wann |
|-------|-------------|------|
| **MVP** | REZ poll `list_aufgaben_for_me` alle 5 s + `medoc-nav-badges-refresh` Event nach Mutation | FA-AUFG-03 |
| **Besser** | Gleicher Event nach IPC `complete_aufgabe` (FE all tabs) | G17 |
| **Später** | LAN-SSE/WebSocket nur für Posteingang | NFA-NET Erweiterung |

### 7.5 Produktverbesserungen (über Diagramme hinaus)

1. **Ein Posteingang** statt Tickets + Plan-Hinweis + Druck verteilt — reduziert REZ-Kognitive Last (siehe `reception-discovery.md`).  
2. **Aufgaben-Typen** mit Deep-Links: `ABRECHNUNG` → Tab `zahl` + `aufgabe_id`; `TERMIN` → `/termine/neu?patient=`  
3. **Leistungs-Snapshot** auf Aufgabe (nicht nur live B/U) — Historie bleibt korrekt wenn Arzt später Preis ändert.  
4. **SLA-Badge** „seit 15 min offen“ auf Posteingang-Zeilen.  
5. **Diagramm-CI:** Vitest-Snapshot oder `mermaid-cli` render in `docs/uml/out/` bei PR (optional).  

---

## 8. Implementation backlog (actions.md)

| ID | Scope |
|----|--------|
| G14 | FA-LEIST-06 auto billing |
| G15 | FA-LEIST-07 Untersuchung schema + UI + pricing |
| G16 | FA-AUFG-01/06 model + transitions |
| G17 | FA-AUFG-02–05 Posteingang + notify + validate UI |
| G18 | Migrate `praxis_ticket` → `praxis_aufgabe` |
