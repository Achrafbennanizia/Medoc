# Arzt ↔ Rezeption — Workflows (Use Case, Sequence, Activity)

**Stand:** 2026-05-21  
**Zweck:** Verbindliche Modellierung der **Zusammenarbeit** zwischen **ARZT** und **REZEPTION** — was heute im Code existiert, was geplant ist, und wo Lücken bleiben.

**Evidence:** `config/rbac.yaml`, `docs/reception-discovery.md`, `akte_workflow_commands.rs`, `akte_validation_commands.rs`, `akte_next_termin_commands.rs`, `domain/services/pricing.rs`, Pflichtenheft FA-AKTE-14/15, FA-LEIST-05/06, WAAD 1.3 / 2.2.

**Erweiterung (Leistung/Preis + Aufgaben):** [`09-aufgaben-leistung-kollaboration.md`](./09-aufgaben-leistung-kollaboration.md) — FA-LEIST-07, FA-AUFG-01..06.

**Legende in Diagrammen**

| Markierung | Bedeutung |
|------------|-----------|
| **✓ Implementiert** | Route/Command im Repo vorhanden |
| **◐ Teilweise** | Vorhanden, aber UX/RBAC/Data-Leakage offen |
| **○ Geplant** | In Discovery/Actions, noch kein dediziertes UI |

---

## 1. Use-Case-Diagramm (Kollaboration)

Fokus: **gemeinsame** und **rollenexklusive** Anwendungsfälle plus **Übergaben** (Handoffs).

```mermaid
flowchart TB
    subgraph Akteure
        REZ["📋 Rezeption<br/>(REZEPTION)"]
        ARZT["🩺 Arzt<br/>(ARZT)"]
        PAT["👤 Patient<br/>(extern)"]
    end

    subgraph System["MeDoc — Kollaborationskern"]
        subgraph Frontdesk["Empfang & Planung"]
            UC01["UC-R01: Patient suchen / anlegen ✓"]
            UC02["UC-R02: Termin anlegen / verschieben / stornieren ✓<br/>«includes» Konfliktprüfung"]
            UC03["UC-R03: Terminstatus setzen ✓<br/>(bestätigt / durchgeführt / nicht erschienen)"]
            UC04["UC-R04: Stammdaten & Anamnese erfassen ✓"]
            UC05["UC-R05: Akte an Arzt weiterleiten ✓<br/>FA-AKTE-14"]
            UC06["UC-R06: Praxis-Ticket an Arzt ✓<br/>FA-PERS-08"]
            UC07["UC-R07: Plan-next-Termin-Hinweis lesen ◐<br/>pro Patient öffnen"]
            UC08["UC-R08: Zahlung erfassen ✓"]
            UC09["UC-R09: Tagesabschluss ✓<br/>unter Verwaltung"]
            UC10["UC-R10: Posteingang / Druck-Warteschlange ○"]
        end

        subgraph Clinical["Ärztliche Verantwortung"]
            UC11["UC-A01: Patientenakte medizinisch öffnen ✓"]
            UC12["UC-A02: Untersuchung / Behandlung dokumentieren ✓"]
            UC13["UC-A03: Zahnschema bearbeiten ✓"]
            UC14["UC-A04: Rezept / Attest erstellen ✓"]
            UC15["UC-A05: Plan-next-Termin-Hinweis schreiben ✓"]
            UC16["UC-A06: Aktenabschnitte validieren ✓<br/>stamm / anam / anlage / zahl"]
            UC17["UC-A07: Akte an Ärzte weiterleiten ✓"]
            UC18["UC-A08: Validierungs-Warteschlange ✓<br/>/akten/zu-validieren FA-AKTE-15"]
            UC19["UC-A09: Patientenakte freigeben ✓<br/>Status → VALIDIERT"]
            UC20["UC-A10: Leistung zur Abrechnung freigeben ◐<br/>FA-LEIST-05"]
            UC21["UC-A11: Offene Buchung auto öffnen ○<br/>FA-LEIST-06"]
            UC24["UC-A12: Audit-Log einsehen ✓"]
        end

        subgraph Shared["Gemeinsam (mit RBAC-Grenze)"]
            UC22["UC-S01: Anmelden ✓"]
            UC23["UC-S02: Dashboard / Tagesplan ✓"]
        end
    end

    PAT -.->|erscheint| REZ
    REZ --> UC01 & UC02 & UC03 & UC04 & UC08 & UC09 & UC22 & UC23
    REZ --> UC05 & UC06 & UC07
    REZ -.->|soll| UC10

    ARZT --> UC02 & UC11 & UC12 & UC13 & UC14 & UC15 & UC16 & UC17 & UC18 & UC19 & UC20 & UC21 & UC24 & UC22 & UC23
    ARZT --> UC05 & UC07

    UC12 -.->|Leistung gespeichert| UC21
    UC21 -.->|offene Buchung| UC08
    UC04 -.->|Handoff: Daten prüfen| UC16
    UC05 -.->|Benachrichtigung| UC18
    UC15 -.->|Handoff: Folgetermin planen| UC02
    UC12 -.->|nach Behandlung| UC20
    UC20 -.->|Freigabe| UC08
    UC14 -.->|Handoff: Ausdruck| UC10
    UC19 -.->|Signal Abrechnung| UC08
```

### Use-Case-Kurztexte (Handoffs)

| ID | Akteur | Handoff an | Beschreibung |
|----|--------|------------|--------------|
| UC-R05 | REZ, ARZT | ARZT (In-App + Audit) | `forward_akte_to_physicians` → Notification `AKTE_FORWARD`; **kein** automatischer Queue-Eintrag ohne Statuswechsel |
| UC-R06 | REZ | ARZT | `create_praxis_ticket` → Ticket + Notification |
| UC-A15 → UC-R02 | ARZT | REZ | `set_akte_next_termin_hint` in SQLite; REZ sieht Hinweis in Aktenkopf / Termin anlegen |
| UC-A16 | ARZT | — | `set_akte_section_validated` — bestätigt Empfangsdaten (Stammdaten/Anamnese) |
| UC-A18/19 | ARZT | REZ (indirekt) | Queue `list_akten_zu_validieren` → `validate_patientenakte` (Status VALIDIERT) |
| UC-A20 → UC-R08 | ARZT | REZ | `freigegeben_von_arzt_id` / `freigegeben_am` auf Behandlung; sonst `pricing::require_released_for_billing` blockiert |
| UC-A11 → UC-R08 | ARZT | REZ | **FA-LEIST-06 (○):** Nach Leistung auf B/U → Tab Abrechnung + offene Buchung `AUSSTEHEND`; REZ übernimmt Zahlung |

---

## 2. Sequenzdiagramme

### 2.1 Tagesablauf: Patient kommt — Rezeption → Arzt → Abrechnung

```mermaid
sequenceDiagram
    actor PAT as Patient
    actor REZ as Rezeption
    actor ARZT as Arzt
    participant UI as React Pages
    participant IPC as Tauri Commands
    participant RBAC as rbac.require
    participant DB as SQLCipher
    participant AUD as audit_repo

    PAT->>REZ: Kommt zur Anmeldung
    REZ->>UI: /patienten suchen
    UI->>IPC: search_patienten
    IPC->>RBAC: patient.read ✓
    IPC->>DB: SELECT patient
    DB-->>UI: Trefferliste

    alt Neuer Patient
        REZ->>UI: /patienten/neu
        UI->>IPC: create_patient
        IPC->>DB: INSERT patient + patientenakte
        IPC->>AUD: CREATE Patient
    end

    REZ->>UI: Stammdaten / Anamnese (kein read_medical)
    UI->>IPC: update_patient, set_anamnese…
    IPC->>RBAC: patient.write ✓
    Note over REZ,ARZT: Medizinische Tabs für REZ gesperrt (patient.read_medical)

    REZ->>UI: Termin heute bestätigen
    UI->>IPC: update_termin (status)
    IPC->>RBAC: termin.write ✓

    REZ->>ARZT: Patient ist da (mündlich)
    ARZT->>UI: /patienten/:id (medizinisch)
    UI->>IPC: get_akte, list_behandlungen…
    IPC->>RBAC: patient.read_medical ✓
    ARZT->>UI: Behandlung + Zahnschema dokumentieren
    UI->>IPC: create_behandlung, upsert_zahnbefund
    IPC->>AUD: CREATE Behandlung

    ARZT->>UI: Plan-next-Termin-Hinweis speichern
    UI->>IPC: set_akte_next_termin_hint
    IPC->>DB: app_kv / akte hint JSON

    ARZT->>UI: Leistung freigeben (FA-LEIST-05)
    UI->>IPC: update_behandlung (freigegeben_*)
    IPC->>DB: UPDATE behandlung

    ARZT->>REZ: Patient zur Kasse (mündlich)
    REZ->>UI: /finanzen/neu oder Patient Tab Zahlung
    UI->>IPC: create_zahlung
    IPC->>RBAC: finanzen.write ✓
    IPC->>IPC: require_released_for_billing
    alt Nicht freigegeben
        IPC-->>UI: Fehler FA-LEIST-05
        UI-->>REZ: Abrechnung blockiert → Arzt kontaktieren
    else Freigegeben
        IPC->>DB: INSERT zahlung
        IPC->>AUD: CREATE Zahlung
        UI-->>REZ: Zahlung erfasst
    end
```

### 2.2 Akte weiterleiten & ärztlich validieren

```mermaid
sequenceDiagram
    actor REZ as Rezeption
    actor ARZT as Arzt
    participant UI as PatientDetail / Queue
    participant IPC as akte_workflow_commands
    participant NOTIF as in_app_notification
    participant DB as SQLCipher
    participant AUD as audit_repo

    REZ->>UI: „Akte an Arzt weiterleiten“
    UI->>IPC: forward_akte_to_physicians
    IPC->>IPC: RBAC patient.read, Rolle REZ|ARZT
    loop je Ziel-Arzt
        IPC->>NOTIF: insert AKTE_FORWARD
    end
    IPC->>AUD: FORWARD_AKTE

    ARZT->>UI: Notification oder /akten/zu-validieren
    UI->>IPC: list_akten_zu_validieren
    IPC->>IPC: patient.read_medical + Rolle ARZT
    IPC->>DB: Akten IN_BEARBEITUNG / ENTWURF
    DB-->>UI: Warteschlange

    ARZT->>UI: Patient öffnen, klinische Daten prüfen
    ARZT->>UI: Abschnitte validieren (optional vorher)
    UI->>IPC: set_akte_section_validated (stamm, anam, …)
    IPC->>DB: UPSERT akte_validation

    ARZT->>UI: „Validieren“ in Queue
    UI->>IPC: validate_patientenakte
    IPC->>IPC: patient.write_medical
    IPC->>DB: status → VALIDIERT
    IPC->>AUD: VALIDATE_AKTE
    UI-->>ARZT: Badge / Nav-Zähler aktualisiert

    Note over REZ: Kein dedizierter Posteingang „Akte freigegeben“ ○<br/>REZ erkennt Freigabe über Patientenstatus / manuell
```

### 2.3 Rezept: Arzt erstellt — Rezeption druckt (Soll vs. Ist)

```mermaid
sequenceDiagram
    actor ARZT as Arzt
    actor REZ as Rezeption
    participant UI as Rezepte / PatientDetail
    participant IPC as rezept_commands
    participant RBAC as rbac

    ARZT->>UI: Rezept erstellen
    UI->>IPC: create_rezept
    IPC->>RBAC: patient.write_medical ✓
    IPC-->>UI: rezept_id

    Note over ARZT,REZ: Soll-Prozess (○ Posteingang „rezept_zu_drucken“)

    REZ->>UI: Belege & Druck ○ / Patient Tab Rezepte
    UI->>IPC: list_rezepte
    IPC->>RBAC: patient.read_medical
    alt REZEPTION (Ist)
        RBAC-->>UI: 403 Unauthorized
        UI-->>REZ: Kein Zugriff — Handoff nur mündlich + Arzt-Druck
    else Soll (geplant)
        RBAC-->>UI: print.rezept (nur Metadaten/PDF)
        UI-->>REZ: Druckdialog
    end
```

---

## 3. Aktivitätsdiagramm (Swimlanes)

**Ein kompletter Praxisbesuch** mit parallelen Strängen und expliziten **Synchronisationspunkten**.

```mermaid
flowchart TB
    subgraph REZ["Swimlane: Rezeption"]
        R0([Patient betritt Praxis])
        R1[Identität prüfen: Patient suchen]
        R2{Gefunden?}
        R3[Neuen Patient anlegen + Akte]
        R4[Stammdaten / Anamnese erfassen]
        R5[Termin prüfen / Status setzen]
        R6{Akte unvollständig<br/>oder Arzt-Rückfrage?}
        R7[Akte an Arzt weiterleiten ✓<br/>oder Praxis-Ticket ✓]
        R8[Warten: Arzt behandelt]
        R9[Plan-Hinweis lesen ◐<br/>Termin Folge buchen]
        R10{Zahlung fällig?}
        R11[Zahlung erfassen ✓<br/>nach FA-LEIST-05 Freigabe]
        R12[Quittung / Belege ◐]
        R13[Tagesabschluss ✓]
        REnd([Ende Schicht])
    end

    subgraph ARZT["Swimlane: Arzt"]
        A0([Parallel: eigener Tagesplan])
        A1[Dashboard: Termine + Queue-Badge ✓]
        A2[Patient aufrufen — Akte öffnen]
        A3[Untersuchung / Behandlung / Zahnschema ✓]
        A4[Plan-next-Termin-Hinweis schreiben ✓]
        A5[Rezept / Attest erstellen ✓]
        A6[Empfangsdaten validieren ✓<br/>akte_validation]
        A7{Akte klinisch vollständig?}
        A8[Validierungs-Queue: VALIDIERT ✓]
        A9[Leistung zur Abrechnung freigeben ◐]
        A10([Freigabe für Kasse])
    end

    subgraph SYNC["Synchronisation (Handoff)"]
        H1((Mündlich:<br/>Patient bereit))
        H2((Notification:<br/>AKTE_FORWARD))
        H3((DB: Plan-Hinweis))
        H4((DB: freigegeben_*))
        H5((Status: VALIDIERT))
    end

    R0 --> R1 --> R2
    R2 -->|nein| R3 --> R4
    R2 -->|ja| R4
    R4 --> R5 --> H1
    H1 --> A2
    A1 --> A2
    A2 --> A3 --> A4 --> A5
    A3 --> A6 --> A7
    A7 -->|nein| A3
    A7 -->|ja| A8 --> H5
    A8 --> A9 --> H4
    H4 --> A10
    A10 --> H1
    R6 -->|ja| R7 --> H2
    H2 --> A1
    R8 --> H3
    H3 --> R9
    A4 --> H3
    R9 --> R10
    R10 -->|ja| R11
    R10 -->|nein| R13
    R11 --> R12 --> R13 --> REnd
    A5 -.->|Soll: Druckauftrag ○| R12
```

### Entscheidungstabelle (Rollengrenze)

| Aktivität | Rezeption | Arzt | Technische Absicherung |
|-----------|:---------:|:----:|------------------------|
| Stammdaten schreiben | ✓ | ✓ | `patient.write` |
| Anamnese erfassen | ✓ | ✓ | `patient.write` (kein `write_medical`) |
| Diagnose / Befund / Zahnschema | — | ✓ | `patient.read_medical` / `write_medical` |
| Termin CRUD | ✓ | ✓ | `termin.write` |
| Akte weiterleiten | ✓ | ✓ | `forward_akte_to_physicians` |
| Akte VALIDIERT setzen | — | ✓ | `validate_patientenakte` + Queue nur ARZT |
| Zahlung | ✓ | ✓ | `finanzen.write` + Billing-Release |
| Rezept **autor** | — | ✓ | `write_medical` |
| Rezept **drucken** (Soll) | ✓ | ◐ | **○** eigene Permission `print.rezept` |

---

## 4. Offene Produktentscheidungen (für „exakt definiert“)

Diese Punkte sind **noch nicht** als ein durchgängiger UI-Workflow geschlossen — sie sollten im Pflichtenheft / IA festgezogen werden:

| # | Frage | Optionen | Empfehlung aus Discovery |
|---|--------|----------|---------------------------|
| 1 | **Posteingang** für REZ? | Ein Queue vs. pro-Patient | Zentraler Posteingang (Plan-Hinweis, Druck, „zur Abrechnung“) |
| 2 | **Medizinische Daten** bei Zahlungszuordnung | Voll-Behandlung vs. Billing-DTO | `akte_list_billing` ohne Diagnose/Befund-Text |
| 3 | **REZ sieht Rezepte** | Gar nicht / nur Druck-PDF | `print.rezept` ohne Listen-Detail |
| 4 | **Check-in** | Terminstatus vs. Warteschlange | Optional Wartezimmer-Queue |
| 5 | **Nach VALIDIEREN** | Automatische REZ-Benachrichtigung | Notification `AKTE_FREIGEGEBEN` |

---

## 5. Verwandte Dateien

| Artefakt | Pfad |
|----------|------|
| RBAC | `config/rbac.yaml`, `docs/rbac-matrix.md` |
| Reception Discovery | `docs/reception-discovery.md` |
| IPC Workflow | `apps/practice-host/src/commands/akte_workflow_commands.rs` |
| UI Queue | `apps/practice-host-ui/src/views/pages/akten-zu-validieren.tsx` |
| Billing Release | `apps/practice-host/src/domain/services/pricing.rs`, `apps/practice-host-ui/src/lib/billing-release.ts` |
