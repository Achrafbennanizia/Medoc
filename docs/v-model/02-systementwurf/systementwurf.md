# Phase 2: Systementwurf

## 1. Systemarchitektur-Übersicht

### 1.1 Systemkontext

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              MeDoc System                                    │
│                                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │   Arzt-PC    │   │ Rezeption-PC │   │  Rezeption   │   │  Externe    │  │
│  │  (Desktop)   │   │  (Desktop)   │   │ Smartphone/  │   │  Partner    │  │
│  │              │   │              │   │   Tablet     │   │ (STB, PHB)  │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬──────┘  │
│         │                  │                   │                  │          │
│         │  Tauri IPC       │  TCP/HTTP (LAN)   │  HTTP (LAN)     │          │
│         │  (lokal)         │                   │  (Browser)      │          │
│         │                  │                   │                  │          │
│  ┌──────▼──────────────────▼───────────────────▼──────────────────▼──────┐   │
│  │                     API-Server (Rust/Actix-Web)                       │   │
│  │           Host: Arzt-PC oder dedizierter Praxis-Server               │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │    Auth      │  │  RBAC        │  │  Business   │  │  Audit    │  │   │
│  │  │  (JWT/Sess.) │  │  Middleware   │  │  Logic      │  │  Logger   │  │   │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  └───────────┘  │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Lizenz-     │  │  Update-     │  │  SQLite (WAL, SQLCipher) │   │   │
│  │  │  Manager     │  │  Manager     │  │  praxis.db (nur Host)    │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘   │   │
│  └─────────┼─────────────────┼──────────────────────────────────────────┘   │
│            │                 │                                               │
│  ══════════╪═════════════════╪══════════ Internet (HTTPS) ═══════════════    │
│            │                 │                                               │
│  ┌─────────▼─────────┐  ┌───▼───────────────┐                              │
│  │  Hersteller       │  │  Hersteller        │                              │
│  │  Lizenzserver     │  │  Update-Server     │                              │
│  │  (Validierung,    │  │  (Versionsprüfung, │                              │
│  │   Abo-Verwaltung) │  │   OTA-Downloads,   │                              │
│  └─────────┬─────────┘  │   Code-Signing)    │                              │
│            │             └───────────────────┘                              │
│  ┌─────────▼─────────┐                                                      │
│  │  Payment-Provider │                                                      │
│  │  (Stripe/Mollie)  │                                                      │
│  │  PCI-DSS-konform  │                                                      │
│  └───────────────────┘                                                      │
│                                                                              │
│  Lokale Systeme:                                                             │
│  - Drucker (System-Druckdialog / PDF-Export)                                │
│  - Röntgen-Scanner (Datei-Upload)                                           │
│  - Backup (lokale Dateien + optional verschlüsselte Cloud)                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Betriebsmodi

Das System unterstützt drei Betriebsmodi:

| Modus | Beschreibung | Host | Clients |
|-------|-------------|------|---------|
| **Standalone** | Ein einzelner PC betreibt alles lokal | Arzt-PC (Tauri-App) | – (kein Netzwerk) |
| **Praxis-Netzwerk (Arzt als Host)** | Der Arzt-PC startet den API-Server, andere Geräte verbinden sich | Arzt-PC (Tauri-App + API-Server) | Rezeption-Desktop (Tauri), Rezeption-Mobil (Browser) |
| **Praxis-Netzwerk (Dedizierter Server)** | Ein separater Server (Headless) in der Praxis | Dedizierter Server (nur API-Server, keine GUI) | Arzt-PC (Tauri), Rezeption-Desktop (Tauri), Rezeption-Mobil (Browser) |

### 1.3 Schichtenarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Präsentationsschicht                       │
│                                                              │
│  ┌───────────────────────┐   ┌────────────────────────────┐ │
│  │   Tauri Desktop-App   │   │   Responsive Web-App       │ │
│  │   (React 19 + TS)     │   │   (gleicher React-Code)    │ │
│  │   Zugriff: IPC oder   │   │   Zugriff: HTTP via        │ │
│  │   HTTP (Client-Modus) │   │   Browser (Smartphone/     │ │
│  │                       │   │   Tablet)                   │ │
│  └───────────┬───────────┘   └──────────────┬─────────────┘ │
│              │                               │               │
├──────────────┼───────────────────────────────┼───────────────┤
│              │     API-Schicht (HTTP/REST)    │               │
│              │                               │               │
│  ┌───────────▼───────────────────────────────▼─────────────┐ │
│  │              Rust API-Server (Actix-Web)                 │ │
│  │                                                          │ │
│  │  Routes → Guards (Auth + RBAC) → Handler → Services      │ │
│  │                                                          │ │
│  └──────────────────────────┬───────────────────────────────┘ │
│                              │                                │
├──────────────────────────────┼────────────────────────────────┤
│                   Geschäftslogikschicht                       │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────────┐ │
│  │  Domänen-Services (Rust)                                  │ │
│  │  termin, patient, akte, zahnbefund, behandlung,           │ │
│  │  zahlung, leistung, produkt, personal, statistik, audit   │ │
│  └──────────────────────────┬───────────────────────────────┘ │
│                              │                                │
├──────────────────────────────┼────────────────────────────────┤
│                    Datenzugriffsschicht                       │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────────┐ │
│  │  Repository-Layer (sqlx 0.8 async)                        │ │
│  │  Prepared Statements, Migrations, Seed                    │ │
│  └──────────────────────────┬───────────────────────────────┘ │
│                              │                                │
├──────────────────────────────┼────────────────────────────────┤
│                     Persistenzschicht                         │
│                              │                                │
│  ┌───────────────────────────▼──────────────────────────────┐ │
│  │  SQLite (WAL-Modus) + SQLCipher (AES-256)                 │ │
│  │  Datei: praxis.db – ausschließlich auf dem Host           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
│  Querschnittsbelange:                                         │
│  Auth (JWT), RBAC-Middleware, Audit-Logger, Error-Handling,   │
│  TLS (optional), Rate-Limiting, IP-Whitelist,                 │
│  Lizenz-Manager, Update-Manager, Payment-Gateway              │
└────────────────────────────────────────────────────────────────┘
```

| Schicht | Technologie | Verantwortung |
|---------|-------------|---------------|
| Präsentation | React 19 + TypeScript 5.8 + Vite 6 + Tailwind 3.4 | UI-Rendering, Client-Interaktion, Responsive Layout |
| API | Actix-Web (Rust) / Tauri IPC (Standalone) | REST-Endpunkte, Request-Validierung, Routing |
| Geschäftslogik | Rust Domänen-Services | Validierung, Autorisierung, Workflows, Geschäftsregeln |
| Datenzugriff | sqlx 0.8 (async SQLite) | DB-Queries, Prepared Statements, Migrationen |
| Persistenz | SQLite (WAL) + SQLCipher | Datenspeicherung, Verschlüsselung, ACID-Transaktionen |
| Querschnitt | JWT, RBAC-Guards, Audit-Logger, TLS | Auth, Zugriffskontrolle, Logging, Verschlüsselung |
| Lizenz & Abo | Lizenz-Manager, Payment-Gateway (Stripe/Mollie) | Lizenzvalidierung, Abo-Verwaltung, Zahlungsabwicklung |
| Update | Tauri-Updater, Update-Manager | Versionsprüfung, OTA-Download, DB-Migration, Rollback |

### 1.4 Netzwerktopologie

```
                        Praxis-LAN (z. B. 192.168.1.0/24)
                        ─────────────────────────────────
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
    │   Host / Server    │   │  Rezeption-PC      │   │  Rezeption-Mobil  │
    │                    │   │                    │   │                    │
    │  Tauri-App oder    │   │  Tauri-App         │   │  Browser           │
    │  Headless-Server   │   │  (Client-Modus)    │   │  (Safari/Chrome)  │
    │                    │   │                    │   │                    │
    │  API-Server :8080  │   │  → HTTP :8080      │   │  → HTTP :8080     │
    │  SQLite praxis.db  │   │  Keine lokale DB   │   │  Keine lokale DB  │
    │  Web-Assets        │   │                    │   │  Responsive UI    │
    └────────────────────┘   └────────────────────┘   └────────────────────┘
           │                                                    │
           │  mDNS / Bonjour                                    │
           │  "_medoc._tcp.local"                               │
           └────────────────────────────────────────────────────┘
                    Automatische Erkennung im LAN
```

**Kommunikationsprotokoll:**
- **Transport**: TCP/IP über lokales Netzwerk (LAN)
- **Anwendungsprotokoll**: HTTP/1.1 (REST-API mit JSON)
- **Verschlüsselung**: TLS 1.3 optional konfigurierbar (HTTPS)
- **Authentifizierung**: JWT-Token pro Sitzung (Login → Token → Authorization-Header)
- **Geräteerkennung**: mDNS/Bonjour (`_medoc._tcp.local`) oder manuelle IP:Port-Eingabe

---

## 2. Modulübersicht

### 2.1 Fachliche Module

```
MeDoc
├── auth/              # Authentifizierung & Autorisierung (JWT, Sessions)
├── dashboard/         # Startseite, KPIs, Übersicht
├── termine/           # Terminverwaltung + Kalender
├── patienten/         # Patientenverwaltung
│   ├── akten/         # Elektronische Patientenakte
│   ├── zahnschema/    # Interaktives 2D-Zahnschema (FDI)
│   └── anamnesebogen/ # Digitaler Anamnesebogen
├── behandlung/        # Untersuchung + Behandlung + Dokumentation
├── finanzen/          # Zahlungen, Bilanz, Übersicht
│   ├── zahlungen/     # Zahlungsdokumentation
│   ├── bilanz/        # Bilanzierung
│   └── statistiken/   # Finanzstatistiken
├── produkte/          # Produktkatalog + Bestellungen
├── leistungen/        # Leistungskatalog
├── personal/          # Personalverwaltung
├── rezepte-atteste/   # Rezept-/Attesterstellung + PDF-Druck
├── statistik/         # Praxisstatistiken + Reporting + Diagramme
├── lizenz/            # Lizenzaktivierung, Abo-Status, Geräte-Kontingent
│   ├── aktivierung/   # Erstaktivierung, Lizenzschlüssel-Eingabe
│   ├── validierung/   # Periodische Lizenzprüfung (online/offline)
│   └── abo-verwaltung/# Abo-Stufe, Upgrade/Downgrade, Feature-Gating
├── abonnement/        # Integriertes Zahlungssystem für Abo
│   ├── payment/       # Payment-Provider-Integration (Stripe/Mollie)
│   ├── rechnungen/    # Rechnungsgenerierung + PDF-Download
│   └── zahlungsverlauf/# Transaktionshistorie
├── updates/           # OTA-Update-Infrastruktur
│   ├── versioncheck/  # Versionsprüfung beim Hersteller-Server
│   ├── download/      # OTA-Download mit Signaturprüfung
│   ├── migration/     # DB-Schema-Migrationen bei Versionswechsel
│   └── rollback/      # Automatischer Rollback bei Update-Fehler
├── bildgebung/        # Medizinische Bildgebung & Geräteanbindung
│   ├── dicom/         # DICOM-Client (C-STORE SCP, C-FIND, Worklist)
│   ├── twain/         # TWAIN/WIA-Bilderfassung (Sensoren, Kameras)
│   ├── gdt/           # GDT-Schnittstelle (Gerätedatentransfer v2.1+)
│   ├── bildarchiv/    # Mini-PACS (AES-256 verschlüsselt)
│   ├── annotation/    # Bildannotation (Text, Pfeile, Markierungen)
│   └── geraete/       # Geräte-Konfiguration, Hotplug, Status
├── datenmigration/    # Import von Fremdsystemen
│   ├── vdds-transfer/ # VDDS-transfer v2.22 Parser
│   ├── bdt/           # BDT v3.0 Parser (Behandlungsdatentransfer)
│   ├── csv-json/      # Generischer CSV/JSON-Import mit Feldmapping
│   ├── dicom-import/  # DICOM-Bildmigration aus Fremd-PACS
│   ├── assistent/     # Geführter Migrations-Wizard (6 Schritte)
│   └── validierung/   # Datenvalidierung, Dry-Run, Qualitätsbericht
└── einstellungen/     # Systemeinstellungen, Backup, Netzwerk, Geräte
```

### 2.2 Technische Module

```
Frontend (React 19 + TypeScript)
├── views/
│   ├── components/
│   │   ├── ui/            # Komponentenbibliothek (Button, Input, Dialog, Toast,
│   │   │                  #   Card, Badge, EmptyState)
│   │   ├── layout/        # AppLayout (Glass-Sidebar, Header, ToastContainer)
│   │   └── charts/        # Diagramme (Recharts)
│   └── pages/             # Seitenkomponenten (Login, Dashboard, Termine, ...)
├── controllers/           # Tauri-IPC- oder HTTP-API-Aufrufe
├── stores/                # Zustand (Auth-Store, Toast-Store)
└── types/                 # TypeScript-Typen und Interfaces

Backend (Rust)
├── api/
│   ├── server.rs          # Actix-Web HTTP-Server (LAN-Betrieb)
│   ├── routes/            # REST-Endpunkte pro Modul
│   ├── guards/            # Auth-Guard (JWT), RBAC-Guard, Lizenz-Guard
│   └── middleware/        # Audit-Logger, Rate-Limiter, CORS
├── domain/
│   ├── models/            # Domänenmodelle (Patient, Termin, Akte, Lizenz, ...)
│   └── services/          # Geschäftslogik pro Modul
├── infrastructure/
│   ├── db/                # SQLite-Verbindung, Migrationen, Seed
│   ├── repositories/      # sqlx-basierte Repository-Implementierungen
│   ├── crypto/            # bcrypt, SQLCipher, JWT-Signing, Lizenz-Signatur
│   ├── licensing/         # Lizenz-Manager: Validierung, Feature-Gating, Offline-Karenz
│   ├── payment/           # Payment-Gateway: Stripe/Mollie SDK, Webhook-Handler
│   ├── updater/           # Update-Manager: Versionsprüfung, OTA, Rollback, Signatur
│   ├── dicom/             # DICOM-Engine: SCU/SCP, C-STORE, C-FIND, Worklist
│   ├── twain/             # TWAIN/WIA-Brücke: Geräteauswahl, Bilderfassung
│   ├── gdt/               # GDT-Parser/Generator: IN/OUT-Dateien, Zeichensatz-Mapping
│   ├── bildarchiv/        # Verschlüsseltes Bildarchiv (AES-256), Thumbnail-Erzeugung
│   └── migration_engine/  # VDDS/BDT/CSV-Parser, Feldmapping, Validierung, Snapshot
├── tauri/
│   ├── commands/          # Tauri-IPC-Kommandos (Standalone/Host-Modus)
│   └── setup.rs           # App-Setup, Server-Start, DB-Init, Lizenzprüfung
└── shared/
    ├── errors.rs          # Zentrale Fehlertypen (thiserror)
    ├── config.rs          # Konfiguration (Betriebsmodus, Port, TLS, Whitelist, Update-Kanal)
    └── dto.rs             # Data Transfer Objects für API-Grenze
```

### 2.3 Controller-Abstraktionsschicht (Frontend)

Die Frontend-Controller abstrahieren den Kommunikationsweg zum Backend. Im **Standalone-Modus** nutzen sie Tauri-IPC (`@tauri-apps/api`), im **Client-Modus** senden sie HTTP-Requests an den API-Server:

```typescript
// Abstraktion: IPC vs. HTTP je nach Betriebsmodus
async function apiCall<T>(command: string, args: object): Promise<T> {
  if (isStandalone()) {
    return invoke<T>(command, args);     // Tauri IPC
  } else {
    return httpPost<T>(`/api/${command}`, args);  // HTTP/REST
  }
}
```

---

## 3. Rollenmatrix (RBAC)

| Funktion | ARZT | REZ | STB | PHB |
|----------|------|-----|-----|-----|
| Dashboard anzeigen | ✓ | ✓ | ✓ (eingeschränkt) | ✗ |
| **Termine** | | | | |
| Termine anzeigen | ✓ | ✓ | ✗ | ✗ |
| Termine anlegen/bearbeiten | ✓ | ✓ | ✗ | ✗ |
| Tage blockieren | ✓ | ✗ | ✗ | ✗ |
| **Patienten** | | | | |
| Patientenliste anzeigen | ✓ | ✓ | ✗ | ✗ |
| Patient anlegen | ✓ | ✓ | ✗ | ✗ |
| Medizinische Daten lesen | ✓ | ✗ (konfigurierbar) | ✗ | ✗ |
| Medizinische Daten schreiben | ✓ | ✗ | ✗ | ✗ |
| Akte validieren/freigeben | ✓ | ✗ | ✗ | ✗ |
| **Behandlung** | | | | |
| Diagnosen eintragen | ✓ | ✗ | ✗ | ✗ |
| Behandlungen dokumentieren | ✓ | ✗ | ✗ | ✗ |
| Rezepte/Atteste erstellen | ✓ | ✗ | ✗ | ✗ |
| **Finanzen** | | | | |
| Zahlungen dokumentieren | ✓ | ✓ | ✗ | ✗ |
| Finanzübersicht einsehen | ✓ | ✗ | ✓ | ✗ |
| Leistungen freigeben | ✓ | ✗ | ✗ | ✗ |
| Bilanz/Export | ✓ | ✗ | ✓ | ✗ |
| **Produkte** | | | | |
| Produktkatalog verwalten | ✓ | ✗ | ✗ | ✓ (eingeschränkt) |
| Bestellungen anlegen | ✓ | ✓ | ✗ | ✗ |
| **Personal** | | | | |
| Personal verwalten | ✓ | ✗ | ✗ | ✗ |
| Rollen/Rechte vergeben | ✓ | ✗ | ✗ | ✗ |
| **Statistik** | | | | |
| Alle Statistiken | ✓ | ✗ | ✗ | ✗ |
| Finanzstatistiken | ✓ | ✗ | ✓ | ✗ |
| **Einstellungen** | | | | |
| System konfigurieren | ✓ | ✗ | ✗ | ✗ |
| Netzwerk konfigurieren | ✓ | ✗ | ✗ | ✗ |
| Backup auslösen | ✓ | ✗ | ✗ | ✗ |

### 3.1 Rollenmatrix — Mobiler Zugriff (Rezeption)

Die mobile Web-Oberfläche (Smartphone/Tablet) bildet **alle Funktionen der Rolle REZEPTION** vollständig ab:

| Funktion | Desktop (REZ) | Mobil (REZ) | Anmerkung |
|----------|:------------:|:-----------:|-----------|
| Termine anzeigen/anlegen | ✓ | ✓ | Vereinfachtes Kalender-Layout auf Smartphone |
| Patientenliste + Suche | ✓ | ✓ | Kartenansicht statt Tabelle auf Smartphone |
| Patient anlegen | ✓ | ✓ | Vollständiges Formular, Touch-optimiert |
| Zahlungen dokumentieren | ✓ | ✓ | Vereinfachte Eingabe |
| Bestellungen anlegen | ✓ | ✓ | — |
| Dashboard | ✓ | ✓ | Kompaktere KPI-Ansicht |

---

## 4. Datenflüsse

### 4.1 Terminvereinbarung (Normalfall)
```
Patient → Rezeption (Desktop oder Mobil)
           → [Client: Kalender öffnen]
           → [API-Server: Verfügbarkeit prüfen]
           → [API-Server: Termin speichern + Akte verknüpfen]
           → [Client: Bestätigung anzeigen (Toast)]
Rezeption → Patient (Terminbestätigung)
```

### 4.2 Behandlungsdokumentation
```
Arzt (Desktop)
  → [Client: Patientenakte öffnen]
  → [API-Server: Akte laden + Audit-Log (Lesezugriff)]
  → [Client: Untersuchung/Behandlung erfassen]
  → [API-Server: Zahnschema aktualisieren + Validieren + Speichern]
  → [API-Server: Rechnung/Leistung zuordnen]
  → [API-Server: Audit-Log (Schreibzugriff)]
Rezeption (Desktop/Mobil) ← [Notification: Behandlung abgeschlossen]
Patient ← Rezeption (Zahlung + Folgetermin)
```

### 4.3 Multi-Device Datenfluss (Netzwerk-Modus)
```
┌────────────┐     HTTP/JSON      ┌──────────────┐
│ Rezeption  │ ──── POST ────────→│              │
│ Smartphone │ ←── 200 OK ───────│  API-Server  │
│ (Browser)  │                    │  (Host)      │
└────────────┘                    │              │
                                  │  SQLite DB   │
┌────────────┐     HTTP/JSON      │  (praxis.db) │
│ Rezeption  │ ──── GET ─────────→│              │
│ Desktop    │ ←── 200 OK ───────│              │
│ (Tauri)    │                    │              │
└────────────┘                    │              │
                                  │              │
┌────────────┐     Tauri IPC      │              │
│ Arzt-PC    │ ──── invoke ──────→│              │
│ (Host)     │ ←── Result ───────│              │
└────────────┘                    └──────────────┘
```

### 4.4 Finanz-Export
```
Arzt (Desktop)
  → [Client: Finanzen öffnen → Zeitraum wählen]
  → [API-Server: Daten aggregieren + PDF generieren]
  → [Client: PDF herunterladen / Drucken]
  → Steuerberater (per E-Mail oder Ausdruck)
```

### 4.5 Verbindungsverlust-Handling
```
Client (Rezeption)
  → [API-Anfrage fehlgeschlagen: Netzwerk-Timeout]
  → [UI: Banner "Verbindung zum Server unterbrochen"]
  → [Reconnect-Timer: alle 5 Sekunden Ping an Host]
  → [Verbindung wiederhergestellt]
  → [UI: Banner verschwindet, Daten neu laden]
```

---

## 5. Deployment-Architektur

### 5.1 Standalone-Modus (1 PC)

```
┌──────────────────────────────────┐
│         Arzt-PC (macOS/Win/Linux)│
│                                  │
│  ┌───────────────────────────┐   │
│  │      Tauri-App (v2)       │   │
│  │                           │   │
│  │  React-UI ←── IPC ──→ Rust│  │
│  │                     Backend│  │
│  │                       │    │  │
│  │                  praxis.db │  │
│  └───────────────────────────┘   │
└──────────────────────────────────┘
```

### 5.2 Netzwerk-Modus (Arzt-PC als Host)

```
┌──────────────────────────────────┐
│         Arzt-PC (Host)           │
│                                  │
│  ┌───────────────────────────┐   │
│  │      Tauri-App (v2)       │   │
│  │                           │   │
│  │  React-UI ←── IPC ──→ Rust│  │
│  │                     Backend│  │
│  │                       │    │  │
│  │  API-Server (:8080) ──┤    │  │
│  │  Web-Assets-Server    │    │  │
│  │                  praxis.db │  │
│  └────────────┬──────────────┘   │
│               │ LAN :8080        │
└───────────────┼──────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐
│Rez.-PC │ │Rez.-PC │ │Rez.-Mobil│
│(Tauri) │ │(Tauri) │ │(Browser) │
└────────┘ └────────┘ └──────────┘
```

### 5.3 Netzwerk-Modus (Dedizierter Server)

```
┌──────────────────────────────────┐
│     Praxis-Server (Headless)     │
│                                  │
│  ┌───────────────────────────┐   │
│  │   MeDoc Server (Rust)     │   │
│  │                           │   │
│  │  API-Server (:8080)       │   │
│  │  Web-Assets-Server        │   │
│  │  praxis.db                │   │
│  │  Backup-Scheduler         │   │
│  └────────────┬──────────────┘   │
│               │ LAN :8080        │
└───────────────┼──────────────────┘
                │
    ┌───────────┼───────────────────┐
    │           │           │       │
    ▼           ▼           ▼       ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│Arzt-PC │ │Rez.-PC │ │Rez.-PC │ │Rez.-Mobil│
│(Tauri) │ │(Tauri) │ │(Tauri) │ │(Browser) │
└────────┘ └────────┘ └────────┘ └──────────┘
```

---

## 6. Responsive Web-Client (Mobil/Tablet)

### 6.1 Breakpoints und Layout-Strategie

| Breakpoint | Gerät | Layout | Navigation |
|-----------|-------|--------|------------|
| ≥ 1259 px | Desktop | Sidebar + Content (Glass-Sidebar, 240px) | Persistente Sidebar |
| 768–1258 px | Tablet | Collapsible Sidebar + Content | Hamburger-Menü → Overlay-Sidebar |
| 375–767 px | Smartphone | Full-Width Content | Bottom-Tab-Navigation (5 Tabs) |

### 6.2 Mobile Navigation (Smartphone)

```
┌──────────────────────────────┐
│  MeDoc            🔔  👤     │  ← Header (48px)
├──────────────────────────────┤
│                              │
│         Content              │
│     (volle Breite)           │
│                              │
│                              │
├──────────────────────────────┤
│  🏠    📅    👥    💰    ⚙️  │  ← Bottom-Tabs
│ Home  Termine Pat. Zahlung  │
└──────────────────────────────┘
```

### 6.3 Touch-Optimierung

- Mindest-Tap-Target: 44×44 px (Apple HIG)
- Swipe-Gesten für Navigation (z. B. Patient-Karte wischen für Aktionen)
- Pull-to-Refresh für Listen
- Vereinfachte Formulare: mehrstufige Eingabe statt einer langen Seite

---

## 7. Sicherheitsarchitektur

### 7.1 Authentifizierung & Autorisierung

```
Client                          API-Server (Host)
  │                                    │
  │══ TLS 1.3 verschlüsselter Kanal ══════════════════════│
  │                                    │
  │── POST /api/auth/login ───────────→│
  │   { email, password }              │
  │                                    │── Argon2id verify
  │                                    │── JWT generieren (RS256)
  │←── 200 { token, user, rolle } ────│
  │                                    │
  │── GET /api/termine ───────────────→│
  │   Authorization: Bearer <token>    │
  │                                    │── JWT validieren
  │                                    │── RBAC prüfen (Rolle → Endpunkt)
  │←── 200 [termine...] ──────────────│
  │                                    │
  │══ Ende TLS-Session ═══════════════════════════════════│
```

### 7.2 Verschlüsselungsarchitektur — Kein Klartext, nirgends

> **Grundsatz:** In MeDoc werden **alle sensiblen Daten ausnahmslos verschlüsselt** gespeichert, übertragen und verarbeitet. Kein Patientendatum, kein Passwort, kein Schlüssel darf jemals im Klartext auf einer Festplatte, in einem Netzwerkpaket oder in einem Log erscheinen.

#### 7.2.1 Encryption at Rest (Daten im Ruhezustand)

```
┌────────────────────────────────────────────────────────────────┐
│  praxis.db — SQLCipher (AES-256-CBC, PBKDF2 key derivation)   │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐  │
│  │ Patienten  │  │  Termine   │  │  Finanzen  │  │ Audit   │  │
│  │ AES-256 ✓  │  │ AES-256 ✓  │  │ AES-256 ✓  │  │ AES-256 │  │
│  └────────────┘  └────────────┘  └────────────┘  └─────────┘  │
│                                                                │
│  → DB-Datei ohne Masterkey = unlesbar (binärer Datenstrom)     │
│  → PRAGMA cipher_version → bestätigt aktive Verschlüsselung   │
│  → PRAGMA cipher_page_size = 4096                              │
│  → Jede Page einzeln verschlüsselt + HMAC-authentifiziert      │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Backups — AES-256-GCM verschlüsselt                          │
│                                                                │
│  praxis_backup_2026-04-19.db.enc                              │
│  → Verschlüsselt VOR dem Schreiben auf Festplatte             │
│  → Separater Backup-Schlüssel (abgeleitet aus Masterkey)      │
│  → Integritätsprüfung über GCM-Authentication-Tag             │
└────────────────────────────────────────────────────────────────┘
```

| Datenkategorie | Verschlüsselung | Algorithmus | Schlüssel |
|----------------|:-:|-------------|-----------|
| Gesamte Datenbank (praxis.db) | ✅ | AES-256-CBC (SQLCipher) | DB-Masterkey (PBKDF2/Argon2-abgeleitet) |
| Backup-Dateien | ✅ | AES-256-GCM | Backup-Schlüssel (vom Masterkey abgeleitet) |
| Audit-Logs (archiviert) | ✅ | AES-256-GCM | Archiv-Schlüssel |
| Exportierte Dateien (PDF/CSV/JSON) | Optional | AES-256-GCM | Benutzer-Passwort (PBKDF2-abgeleitet) |
| Konfigurationsdatei (Secrets) | ✅ | OS-Keychain oder AES-256 | Maschinengebundener Schlüssel |

#### 7.2.2 Encryption in Transit (Daten bei Übertragung)

| Kommunikationskanal | Verschlüsselung | Pflicht? |
|---------------------|:-:|:-:|
| Client ↔ Host (LAN, Netzwerk-Modus) | TLS 1.3 (HTTPS) | **PFLICHT** — kein HTTP-Fallback |
| App ↔ Lizenzserver (Internet) | TLS 1.3 (HTTPS) | **PFLICHT** |
| App ↔ Update-Server (Internet) | TLS 1.3 (HTTPS) | **PFLICHT** |
| App ↔ Payment-Provider (Internet) | TLS 1.3 (HTTPS) | **PFLICHT** |
| Tauri-IPC (Standalone-Modus) | Prozessintern (kein Netzwerk) | N/A — kein externer Zugriff |

- **Kein unverschlüsselter HTTP-Verkehr** im Netzwerk-Modus (kein Fallback, kein Opt-out)
- TLS-Zertifikat wird beim Erststart automatisch generiert (selbstsigniert) oder manuell konfiguriert (CA)
- Certificate-Pinning für Hersteller-Endpunkte (Lizenz, Update, Payment)

#### 7.2.3 Kryptographische Verarbeitung sensibler Daten

| Datentyp | Algorithmus | Speicherort | Klartext? |
|----------|-------------|-------------|:-:|
| Passwörter | **Argon2id** (bevorzugt) / bcrypt (Fallback) | DB (nur Hash + Salt) | **NIE** |
| JWT-Secret | RS256 (RSA 2048+) oder Ed25519 | OS-Keychain | **NIE** |
| DB-Masterkey | PBKDF2-SHA512 (256.000 Iterationen) oder Argon2 | OS-Keychain / verschlüsselte Datei | **NIE** |
| Lizenzschlüssel | Ed25519-Signatur (Public-Key eingebettet) | DB (signiertes Token) | **NIE** (nur signiert) |
| Update-Pakete | Ed25519-Signatur (Code-Signing) | Temp-Download-Verzeichnis | **NIE** (Signaturprüfung vor Install) |
| Payment-Token | Nur Provider-Token-ID (kein PAN/IBAN/CVV) | DB (token_id) | **NIE** lokal (nur beim Provider) |

#### 7.2.4 Schlüsselmanagement (Key Management)

```
┌───────────────────────────────────────────────────────┐
│  Schlüsselhierarchie                                  │
│                                                       │
│  Benutzer-Passwort / Maschinenparameter               │
│         │                                             │
│         ▼                                             │
│  ┌─────────────────┐                                  │
│  │  PBKDF2/Argon2  │  Key Derivation Function         │
│  │  (256.000 Iter.) │                                  │
│  └────────┬────────┘                                  │
│           │                                           │
│           ▼                                           │
│  ┌─────────────────┐  ┌────────────────────────┐      │
│  │  DB-Masterkey   │  │  Backup-Schlüssel      │      │
│  │  (AES-256)      │──│  (HKDF-abgeleitet)     │      │
│  └────────┬────────┘  └────────────────────────┘      │
│           │                                           │
│           ▼                                           │
│  ┌─────────────────────────┐                          │
│  │  SQLCipher               │                          │
│  │  praxis.db (verschl.)    │                          │
│  └─────────────────────────┘                          │
│                                                       │
│  Speicherort der Schlüssel:                           │
│  - macOS: Keychain (kSecAttrAccessible)               │
│  - Windows: Windows Credential Manager (DPAPI)        │
│  - Linux: libsecret / GNOME Keyring                   │
│                                                       │
│  Schlüsselrotation:                                   │
│  - Einstellungen → Sicherheit → „Schlüssel ändern"    │
│  - Re-Encryption der gesamten DB (VACUUM + rekey)     │
│  - Alter Schlüssel wird sicher überschrieben (zeroize)│
└───────────────────────────────────────────────────────┘
```

#### 7.2.5 Speichersicherheit (Runtime)

- Alle sicherheitskritischen Rust-Typen implementieren `Zeroize` + `ZeroizeOnDrop`
- Passwörter, Schlüssel, entschlüsselte PII werden nach Gebrauch im RAM überschrieben
- Kein Klartext in Panic-Messages, Log-Ausgaben oder Core-Dumps
- `secmem_alloc` oder `mlock` für hochsensible Schlüsselbereiche (optional)

### 7.3 Sicherheitsmaßnahmen (Übersicht)

| Maßnahme | Umsetzung | Normbezug |
|----------|-----------|-----------|
| Authentifizierung | JWT mit RS256 oder Ed25519, Ablauf 30 Min. | ISO 27001 A.9, FA-AUTH-03 |
| Autorisierung | RBAC-Middleware prüft Rolle pro Endpunkt | ISO 22600, NFA-SEC-01 |
| Transportverschlüsselung | **TLS 1.3 PFLICHT** im Netzwerk-Modus (kein HTTP-Fallback) | ISO 27001 A.10, NFA-SEC-09 |
| DB-Verschlüsselung | **SQLCipher AES-256-CBC** — standardmäßig aktiviert, nicht optional | ISO 27799, NFA-SEC-08 |
| Backup-Verschlüsselung | **AES-256-GCM** — Backup wird vor dem Schreiben verschlüsselt | ISO 27001 A.12.3, NFA-SEC-05 |
| Passwort-Hashing | **Argon2id** (bevorzugt) / bcrypt Fallback — niemals Klartext | NFA-SEC-03 |
| Schlüsselmanagement | PBKDF2/Argon2 Key-Derivation; OS-Keychain; Rotation möglich | NFA-SEC-11 |
| Speichersicherheit | Rust `zeroize` Crate; kein Klartext in RAM nach Gebrauch | NFA-SEC-13 |
| Audit-Log | Jede API-Anfrage (inkl. Lesezugriffe) mit User-ID + Zeitstempel + IP; append-only + HMAC | NFA-SEC-04, NFA-SEC-07, ISO 27799 |
| Rate-Limiting | Max. 60 Requests/Minute pro Client-IP | NFA-NET-11 |
| IP-Whitelist | Konfigurierbare Liste erlaubter Client-IPs | NFA-NET-11 |
| CORS | Nur erlaubte Origins (LAN-IPs) | OWASP Top 10 |
| Kein lokaler Speicher auf Clients | Clients speichern keine Patientendaten | DSGVO Art. 5, NFA-NET-10 |
| Lizenz-Signatur | Ed25519/RSA-Signaturen für Lizenzschlüssel | NFA-LIC-02 |
| Lizenzprüfung non-blocking | 3s Timeout, bei Fehler → lokale Signatur | NFA-LIC-03 |
| Keine Zahlungsdaten lokal | PCI-DSS: nur Token-ID, kein PAN/IBAN/CVV | NFA-LIC-05, FA-PAY-06 |
| Code-signierte Updates | Ed25519-Signatur auf Update-Paketen verifiziert | NFA-UPD-09 |
| Endpunkt-Whitelist | Nur dokumentierte Hersteller-URLs (§8.4) | NFA-LIC-06 |
| Verschlüsselte Exporte | Optional AES-256-GCM mit Benutzer-Passwort für PDF/CSV/JSON | NFA-SEC-12 |

---

## 8. Lizenz-, Abonnement- & Update-Architektur

### 8.1 Lizenz-Lebenszyklus

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ERSTSTART   │────→│   AKTIV      │────→│   KARENZ     │────→│  READ-ONLY   │
│              │     │              │     │  (30 Tage)   │     │              │
│ Lizenzschlüs-│     │ Alle Funk-   │     │ Alle Funk-   │     │ Nur Lesen +  │
│ sel eingeben │     │ tionen frei  │     │ tionen frei  │     │ Datenexport  │
│ + Aktivierung│     │              │     │ + Warnbanner │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘     └──────────────┘
                            │
                    ┌───────▼───────┐
                    │  Validierung  │  (bei App-Start + monatlich)
                    │               │
                    │  Online:      │
                    │  HTTPS → Lizenzserver
                    │               │
                    │  Offline:     │
                    │  Lokale Signaturprüfung
                    │  + Karenz-Timer
                    └───────────────┘
```

**Abo-Stufen und Feature-Gating:**

| Abo-Stufe | Max. Ärzte | Max. Geräte | Module | Preis (Beispiel) |
|-----------|:----------:|:-----------:|--------|:----------------:|
| **Basis** | 1 | 2 | Termine, Patienten, Akte, Zahnschema, Finanzen, Leistungen | €49/Monat |
| **Professional** | 2 | 5 | Basis + Statistik, Rezepte/Atteste, Produkte, Personal | €99/Monat |
| **Enterprise** | 3+ | ∞ | Professional + API für STB/PHB, erweitertes Reporting, dedizierter Server-Modus | €179/Monat |

### 8.2 Payment-Integration

```
┌────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  MeDoc App     │     │  Hersteller-     │     │  Payment-Provider  │
│  (Einstellungen│     │  Backend         │     │  (Stripe/Mollie)   │
│   → Abonnement)│     │                  │     │                    │
│                │     │                  │     │                    │
│  1. Klick      │     │                  │     │                    │
│  "Abo verwalten"     │                  │     │                    │
│       │        │     │                  │     │                    │
│  2. WebView /  │─────│─→ Checkout-URL   │─────│─→ Gehostetes       │
│     Browser    │     │   generieren     │     │   Zahlungsformular │
│       │        │     │                  │     │                    │
│  3. Nutzer     │     │                  │     │  4. Zahlung        │
│  gibt Daten ein│     │                  │     │     verarbeiten    │
│  (beim Provider)     │                  │     │       │            │
│       │        │     │  5. Webhook      │←────│───────┘            │
│       │        │     │  "payment_success"│    │                    │
│       │        │     │       │          │     │                    │
│  7. Lizenz     │←────│──6. Lizenz       │     │                    │
│  aktualisiert  │     │  verlängern      │     │                    │
│  (Toast: ✓)    │     │  + Rechnung gen. │     │                    │
└────────────────┘     └──────────────────┘     └────────────────────┘
```

**Sicherheitsregeln:**
- Kein PAN, IBAN oder CVV wird jemals lokal gespeichert (PCI-DSS)
- Zahlungsformular wird vollständig vom Provider gerendert (gehostete Felder / Redirect)
- Webhook-Endpunkt beim Hersteller verifiziert Provider-Signatur
- Lokale DB speichert nur: `provider_token_id`, `betrag`, `status`, `rechnungs_pdf_url`

### 8.3 OTA-Update-Architektur

```
┌──────────────────┐     ┌──────────────────┐
│   MeDoc App      │     │  Hersteller      │
│   (Update-Mgr.)  │     │  Update-Server   │
│                  │     │                  │
│  1. GET /api/    │────→│  Aktuelle Version│
│     version/check│     │  + Manifest      │
│                  │     │  + Changelog     │
│  2. Neue Version │←────│                  │
│     verfügbar?   │     │                  │
│     ↓ Ja         │     │                  │
│  3. Dialog:      │     │                  │
│  "Version X.Y.Z  │     │                  │
│   verfügbar.     │     │                  │
│   Was ist neu?   │     │                  │
│   [Jetzt] [Später]"    │                  │
│     ↓ Jetzt      │     │                  │
│  4. DB-Backup    │     │                  │
│     erstellen    │     │                  │
│  5. Download     │────→│  Signiertes      │
│     Update-Paket │←────│  Update-Bundle   │
│  6. Signatur     │     │  (.tar.gz + sig) │
│     prüfen (Ed25519)   │                  │
│  7. Update       │     │                  │
│     installieren │     │                  │
│  8. DB-Migration │     │                  │
│     ausführen    │     │                  │
│  9. Neustart     │     │                  │
│  10. Changelog   │     │                  │
│      anzeigen    │     │                  │
│                  │     │                  │
│  ⚠️ Bei Fehler:  │     │                  │
│  → Rollback auf  │     │                  │
│    alte Version  │     │                  │
│  → DB-Backup     │     │                  │
│    wiederherstellen    │                  │
│  → Fehlerbericht │────→│  Crash-Report    │
│    senden        │     │  (optional)      │
└──────────────────┘     └──────────────────┘
```

**Update-Sicherheit:**
- Update-Pakete sind mit **Ed25519 digital signiert** (Hersteller-Private-Key)
- Die App enthält den eingebetteten **Public-Key** zur Verifikation
- Tauri v2 Updater-Plugin übernimmt Download, Signaturprüfung und Installation
- Semantic Versioning: MAJOR (Breaking) → Pflicht-Backup, MINOR (Features), PATCH (Bugfix)
- Erzwungene Sicherheitsupdates: Server markiert Update als `"mandatory": true`

### 8.4 Externe Endpunkte (Hersteller-Infrastruktur)

| Endpunkt | Zweck | Häufigkeit | Protokoll |
|----------|-------|------------|-----------|
| `https://license.medoc.de/api/v1/validate` | Lizenzvalidierung | App-Start + 1×/Monat | HTTPS (TLS 1.3) |
| `https://license.medoc.de/api/v1/activate` | Erstaktivierung | Einmalig | HTTPS |
| `https://license.medoc.de/api/v1/devices` | Geräte-Kontingent prüfen | Bei Verbindungsaufbau | HTTPS |
| `https://update.medoc.de/api/v1/check` | Versionsprüfung | App-Start + alle 24h | HTTPS |
| `https://update.medoc.de/api/v1/download` | Update-Paket herunterladen | Bei Update | HTTPS |
| `https://pay.medoc.de/api/v1/checkout` | Checkout-URL generieren | Bei Abo-Verwaltung | HTTPS |
| `https://pay.medoc.de/api/v1/invoices` | Rechnungen abrufen | Auf Nutzeranfrage | HTTPS |

**Keine weiteren Endpunkte werden kontaktiert.** Keine Telemetrie, kein Tracking, keine Analytics — es sei denn, der Nutzer stimmt explizit zu (Opt-in Crash-Reports).

---

## 9. Geräteintegrations-Architektur

### 9.1 Übersicht

MeDoc integriert zahnmedizinische Geräte über standardisierte Industrieprotokolle. Das Geräte-Subsystem ist als Plugin-Architektur konzipiert — jede Schnittstelle (DICOM, TWAIN, GDT) wird als eigenständiges Modul implementiert, das über einen gemeinsamen `GeraeteManager` orchestriert wird.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MeDoc Host-PC                                │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐   │
│  │  Frontend    │    │         Backend (Rust)                    │   │
│  │ Bildanzeige  │◄──►│  ┌────────────────────────────────────┐  │   │
│  │ Annotation   │    │  │        GeraeteManager               │  │   │
│  │ 3D-Viewer    │    │  │  ┌──────┐ ┌──────┐ ┌─────┐ ┌────┐ │  │   │
│  └─────────────┘    │  │  │DICOM │ │TWAIN │ │ GDT │ │USB │ │  │   │
│                      │  │  │Engine│ │Bridge│ │I/O  │ │Mon.│ │  │   │
│                      │  │  └──┬───┘ └──┬───┘ └──┬──┘ └─┬──┘ │  │   │
│                      │  └─────┼────────┼────────┼──────┼────┘  │   │
│                      └────────┼────────┼────────┼──────┼───────┘   │
│                               │        │        │      │           │
└───────────────────────────────┼────────┼────────┼──────┼───────────┘
                                │        │        │      │
                    ┌───────────┼────────┼────────┼──────┼───────────┐
                    │    Praxis-Netzwerk / USB-Bus                    │
                    │           │        │        │      │           │
                    │  ┌────────▼──┐ ┌───▼────┐ ┌─▼────┐│┌─────────┐│
                    │  │ OPG/CBCT  │ │Intra-  │ │Dental││ │Intraoral││
                    │  │ (DICOM)   │ │oral-   │ │Unit  ││ │Kamera   ││
                    │  │ Ethernet  │ │Sensor  │ │RS232 ││ │USB      ││
                    │  │ Port 104/ │ │(USB)   │ │/Eth. ││ │TWAIN    ││
                    │  │ 2762(TLS) │ │TWAIN   │ │GDT   ││ │         ││
                    │  └───────────┘ └────────┘ └──────┘│└─────────┘│
                    └────────────────────────────────────────────────┘
```

### 9.2 DICOM-Integration

MeDoc implementiert folgende DICOM-Dienste:

| Rolle | Service | SOP-Klasse | Beschreibung |
|-------|---------|-----------|-------------|
| **SCP** | C-STORE | Storage SCP | Empfang von Röntgenbildern (CR, DX, CT, IO) von Modalitäten |
| **SCU** | C-FIND | Query SCU | Abfrage von Studien/Serien im lokalen Archiv |
| **SCP** | Modality Worklist | MWL SCP | Stellt Patientendaten als Worklist für Modalitäten bereit |
| **SCU** | C-MOVE / C-GET | Retrieve SCU | Abruf archivierter Bilder für Anzeige |

**Netzwerk-Konfiguration:**

```
DICOM-Standardkonfiguration:
  AE-Title (MeDoc):     MEDOC_PACS
  Port (Standard):      11112
  Port (TLS):           2762
  Max. PDU-Größe:       131072 Bytes
  Transfer-Syntaxen:    Implicit VR Little Endian,
                         Explicit VR Little Endian,
                         JPEG 2000 Lossless,
                         JPEG Lossless (Process 14)
  Zeichensatz:          ISO_IR 100 (Latin-1)
```

**Worklist-Ablauf:**

```
[Zahnarzt erstellt Auftrag in MeDoc]
       │
       ▼
[MeDoc MWL-SCP: Worklist-Eintrag aktiv]
       │
       ▼
[OPG/CBCT sendet C-FIND → MeDoc liefert Worklist]
       │
       ▼
[Aufnahme am Gerät mit Patientendaten aus Worklist]
       │
       ▼
[Gerät sendet C-STORE → MeDoc SCP empfängt Bild]
       │
       ▼
[MeDoc: Bild validieren → AES-256 verschlüsseln → Archiv]
       │
       ▼
[Bild in Patientenakte angezeigt + Audit-Log-Eintrag]
```

### 9.3 TWAIN/WIA-Bilderfassung

Für USB-basierte Geräte (Intraoralröntgen-Sensoren, Intraorale Kameras):

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│ USB-Gerät    │◄───►│ OS-Treiber       │◄───►│ MeDoc       │
│ (Sensor/Cam) │     │ (TWAIN/WIA/      │     │ TWAIN-Bridge│
│              │     │  ImageKit macOS)  │     │ (Rust FFI)  │
└──────────────┘     └──────────────────┘     └──────┬──────┘
                                                      │
                                              ┌───────▼───────┐
                                              │ Bildpipeline  │
                                              │ 1. Erfassung  │
                                              │ 2. Vorschau   │
                                              │ 3. Rotation   │
                                              │ 4. AES-256    │
                                              │ 5. Archiv     │
                                              └───────────────┘
```

**Plattform-Abstraktion:**
- **Windows**: TWAIN DSM (twain_dsm.dll) über Rust FFI
- **macOS**: ImageKit Framework via Objective-C-Bridge oder Datei-Upload-Fallback
- **Beide**: WIA (Windows Image Acquisition) als Alternative zu TWAIN

### 9.4 GDT-Schnittstelle (Gerätedatentransfer)

GDT (v2.1+) nutzt dateibasierten Austausch über ein gemeinsames Verzeichnis:

```
MeDoc                           GDT-Verzeichnis                  Gerät
──────                          ──────────────                    ─────
[Patient auswählen] ──────► gdt_out/MEDOCXXX.gdt ──────► [Gerät liest Datei]
                                                                    │
                                                          [Untersuchung]
                                                                    │
[Ergebnis in Akte] ◄──────  gdt_in/GERAETXXX.gdt  ◄──────  [Ergebnis schreiben]
```

**GDT-Satzarten:**
| Satzart | Richtung | Inhalt |
|---------|----------|--------|
| 6310 | OUT → Gerät | Stammdaten anfordern (Patient-ID, Name, Geburtsdatum) |
| 6311 | IN ← Gerät | Untersuchungsergebnis (Befund, Messwerte, Bilder) |

### 9.5 Geräte-Konfiguration & -Management

Die Geräte werden in `Einstellungen → Geräte` konfiguriert:

| Parameter | Beschreibung | Beispiel |
|-----------|-------------|---------|
| Name | Anzeigename | „Planmeca ProMax 2D" |
| Gerätetyp | Kategorie | OPG, CBCT, INTRAORAL, KAMERA, IOS, DENTALEINHEIT, CADCAM |
| Schnittstelle | Verbindungsart | USB, ETHERNET, RS-232, WIFI |
| Protokoll | Kommunikationsprotokoll | DICOM, TWAIN, GDT, VDDS-media, Proprietär |
| IP-Adresse / Port | Netzwerkadresse | 192.168.1.50:11112 |
| AE-Title | DICOM Application Entity | PLANMECA_OPG |
| COM-Port / Baudrate | Seriell (Legacy) | COM3 / 9600 |

**Unterstützte Geräte (Marktforschung):**

| Kategorie | Hersteller/Modell | Schnittstelle | Protokoll |
|-----------|------------------|---------------|-----------|
| Intraoralröntgen | DEXIS IXS/Ti2, Planmeca ProSensor HD, Carestream RVG 6200, Sirona XIOS XG, Vatech EzSensor | USB 2.0/3.0 | TWAIN, DICOM |
| Panorama (OPG) | Planmeca ProMax 2D, DEXIS OP 3D, Sirona ORTHOPHOS S, Vatech PaX-i3D | Ethernet | DICOM, GDT |
| CBCT | Planmeca ProMax 3D Mid, i-CAT FLX V-Series, Sirona ORTHOPHOS SL 3D, DEXIS OP 3D Pro | Gigabit Ethernet | DICOM |
| Intraoralscanner | DEXIS IS 3800, 3Shape TRIOS 5, Medit i700, iTero Element 5D | USB 3.0, Wi-Fi | STL/PLY/OBJ, SDK |
| Intraorale Kamera | DEXIS DEXcam 4 HD, Acteon SOPRO 617, Planmeca ProID | USB 2.0 | TWAIN, VDDS-media |
| Dentaleinheit | Planmeca Compact i5, KaVo ESTETICA E80, Sirona INTEGO, A-dec 500 | RS-232, Ethernet | GDT, Proprietär |
| CAD/CAM | Sirona CEREC Primemill, Planmeca PlanMill 30 S, Ivoclar PrograMill | USB 3.0, Ethernet | STL, Proprietär |

### 9.6 Infrastruktur-Anforderungen

```
Praxis-Netzwerk für Bildgebung:
┌─────────────────────────────────────────────────────────┐
│                     Gigabit Switch (≥ 8 Ports)          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────────┐  │
│  │Host-PC │  │OPG     │  │CBCT    │  │Client-PCs    │  │
│  │(MeDoc) │  │DICOM   │  │DICOM   │  │(MeDoc-Clients│  │
│  │4×USB3.0│  │Ethernet│  │GigE    │  │ oder Browser) │  │
│  └────────┘  └────────┘  └────────┘  └──────────────┘  │
│       │                                                  │
│  ┌────┴───────────────┐                                 │
│  │ USB-Geräte:        │                                 │
│  │ • Intraoralröntgen │                                 │
│  │ • Intraorale Kamera│                                 │
│  │ • Intraoralscanner │                                 │
│  │ • RS-232-Adapter   │                                 │
│  └────────────────────┘                                 │
└─────────────────────────────────────────────────────────┘

Verkabelung:
  • CAT-6 für alle Ethernet-Verbindungen (≥ 1 Gbit/s)
  • USB 3.0 Kabel ≤ 3m (oder aktive USB-Verlängerung)
  • Optionaler Wi-Fi AP (802.11ac/ax) für IOS und Mobile
  • Optionales VLAN für Bildgebungs-Traffic (Isolation)
```

---

## 10. Datenmigrations-Architektur

### 10.1 Übersicht

MeDoc unterstützt den Import bestehender Praxisdaten aus Fremdsystemen über einen geführten Migrationsassistenten. Die Architektur basiert auf einem Parser-Pipeline-Modell mit Validierung, Dry-Run und Rollback-Fähigkeit.

```
┌────────────────────────────────────────────────────────────┐
│                  Migrationsassistent (Frontend)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │1. Quelle │→│2. Datei  │→│3. Mapping│→│4. Validierung│  │
│  │ wählen   │ │ laden    │ │ prüfen   │ │ + Vorschau   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────┬───────┘  │
│                                                 │          │
│  ┌──────────────┐                    ┌──────────▼───────┐  │
│  │6. Bericht    │←───────────────────│5. Import / DryRun│  │
│  │ anzeigen     │                    │   ausführen       │  │
│  └──────────────┘                    └──────────────────┘  │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                 Migrations-Engine (Backend / Rust)          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Parser-Registry                      │  │
│  │  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │  │
│  │  │VDDS-transfer│ │BDT v3.0  │ │CSV/JSON  │ │DICOM │ │  │
│  │  │Parser       │ │Parser    │ │Generic   │ │Bulk  │ │  │
│  │  └──────┬──────┘ └────┬─────┘ └────┬─────┘ └──┬───┘ │  │
│  └─────────┼─────────────┼────────────┼──────────┼─────┘  │
│            └──────┬──────┴────────────┴──────┬───┘         │
│                   ▼                          ▼              │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ Feld-Normalisierer     │  │ Validierungs-Engine    │    │
│  │ • Datumsformate        │  │ • Pflichtfelder        │    │
│  │ • PLZ-Format           │  │ • Referenzintegrität   │    │
│  │ • Zahnschema (FDI↔US)  │  │ • Plausibilitätsprüfung│    │
│  │ • Zeichensatz (CP437→  │  │ • Duplikaterkennung    │    │
│  │   UTF-8)               │  │                        │    │
│  └────────┬───────────────┘  └────────┬───────────────┘    │
│           └──────────┬───────────────┘                      │
│                      ▼                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │                Import-Executor                      │    │
│  │  • DB-Snapshot erstellen (für Rollback)             │    │
│  │  • Transaktionsbasierter Import                     │    │
│  │  • Fortschritts-Callback an Frontend               │    │
│  │  • Qualitätsbericht generieren (PDF)               │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### 10.2 Parser-Formate

| Format | Version | Quellsysteme | Datenumfang |
|--------|---------|-------------|-------------|
| **VDDS-transfer** | v2.22 | Dampsoft DS-Win, CGM Z1, Evident AERA, DATEXT ivoris, Solutio Charly, LinuDent | Patienten, Termine, Behandlungen, Abrechnungen, Stammdaten |
| **BDT** | v3.0 | KBV-kompatible Systeme (Praxis-EDV) | Patientenstamm, Anamnese, Diagnosen, Behandlungsverläufe, Gebührenziffern |
| **CSV/JSON** | Generisch | Beliebige Systeme mit Datenexport | Konfigurierbar per Feldmapping; Patienten, Termine, Finanzen |
| **DICOM** | PS3.10 | Fremd-PACS, lokale Bilddatenbanken | Röntgenbilder (CR, DX, CT, IO), 3D-Datensätze |

### 10.3 Datenvalidierungs-Regeln

| Kategorie | Regel | Schweregrad |
|-----------|-------|-------------|
| Pflichtfelder | Nachname, Vorname, Geburtsdatum bei Patienten | FEHLER (Import abgelehnt) |
| Referenzen | Termin → Patient muss existieren | FEHLER |
| Plausibilität | Geburtsdatum nicht in der Zukunft | WARNUNG |
| Duplikate | Patient mit gleicher Kombination (Name + Geburtsdatum) bereits vorhanden | WARNUNG (manuell entscheiden) |
| Zahnschema | FDI-Nummern im gültigen Bereich (11–48) | WARNUNG (ggf. Umrechnung US→FDI) |
| Zeichensatz | CP437/ISO-8859-1 → UTF-8 Konvertierung | Automatisch |

---

## 11. Logging- & Observability-Architektur

### 11.1 Übersicht

MeDoc implementiert ein 7-schichtiges Logging-System, das den gesamten Anwendungs-Lebenszyklus abdeckt. Der bestehende Audit-Log (NFA-SEC-04, datenbankbasiert) wird durch dateibasierte Logs für Anwendung, Sicherheit, System, Geräte, Migration und Performance ergänzt.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Logging-Architektur (Querschnitt)                 │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Log-Erzeuger                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ API/     │ │ Auth/    │ │ Geräte-  │ │ Migrations-      │ │  │
│  │  │ Business │ │ Security │ │ Module   │ │ Engine           │ │  │
│  │  │ Logic    │ │ Module   │ │ (DICOM,  │ │ (VDDS, BDT,      │ │  │
│  │  │          │ │          │ │ GDT,     │ │ CSV, DICOM)      │ │  │
│  │  │          │ │          │ │ TWAIN)   │ │                  │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────────┘ │  │
│  └───────┼────────────┼────────────┼────────────┼───────────────┘  │
│          │            │            │            │                   │
│  ┌───────▼────────────▼────────────▼────────────▼───────────────┐  │
│  │              Rust `tracing` Framework                         │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  tracing-subscriber (FanOut)                            │  │  │
│  │  │  ├── JSON-File-Layer (app.log)    ← Level: konfigurierbar│ │  │
│  │  │  ├── Security-Layer (security.log) ← Filter: auth events│ │  │
│  │  │  ├── System-Layer (system.log)     ← Filter: lifecycle  │ │  │
│  │  │  ├── Device-Layer (device.log)     ← Filter: geraete::* │ │  │
│  │  │  ├── Migration-Layer (migration.log)← Filter: migration │ │  │
│  │  │  ├── Perf-Layer (perf.log)         ← Filter: slow_*     │ │  │
│  │  │  └── Audit-DB-Layer (audit_log)    ← Filter: audit::*   │ │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │                  Log-Management                              │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │ Log-Rotation  │ │ Sanitizer    │ │ Export-Service       │ │  │
│  │  │ (Größe+Alter) │ │ (PII-Mask,   │ │ (ZIP der letzten    │ │  │
│  │  │ max 1 GB      │ │ Token-Mask)  │ │ 7 Tage, maskiert)   │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.2 Log-Format (Strukturiertes JSON)

Alle dateibasierten Logs verwenden ein einheitliches JSON-Format:

```json
{
  "timestamp": "2026-04-19T14:32:05.123Z",
  "level": "INFO",
  "module": "api::routes::patienten",
  "correlation_id": "a1b2c3d4-e5f6-7890",
  "message": "Patient erstellt",
  "fields": {
    "patient_id": 42,
    "user_id": 1,
    "duration_ms": 23
  }
}
```

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `timestamp` | ISO 8601 (UTC) | Zeitpunkt des Ereignisses |
| `level` | Enum | ERROR, WARN, INFO, DEBUG, TRACE |
| `module` | String | Rust-Modulpfad (z.B. `infrastructure::dicom`) |
| `correlation_id` | UUID | Verknüpft zusammengehörige Einträge (Request-Lifecycle) |
| `message` | String | Menschenlesbarer Text |
| `fields` | Object | Kontextdaten (keine PII außer IDs) |

### 11.3 Log-Kanäle & Filter

| Kanal | Datei | tracing-Filter | Rotation | Aufbewahrung |
|-------|-------|---------------|----------|-------------|
| **Anwendung** | `app.log` | `level >= {konfiguriert}` | 50 MB × 10 | 30 Tage |
| **Sicherheit** | `security.log` | `module = auth::* OR target = security` | 20 MB × 10 | 90 Tage |
| **System** | `system.log` | `target = system OR target = lifecycle` | 20 MB × 10 | 90 Tage |
| **Geräte** | `device.log` | `module = geraete::* OR module = infrastructure::dicom` | 50 MB × 10 | 30 Tage |
| **Migration** | `migration.log` | `module = migration_engine::*` | Unbegrenzt | Permanent |
| **Performance** | `perf.log` | `target = perf AND duration_ms > threshold` | 20 MB × 5 | 7 Tage |
| **Audit** | `praxis.db:audit_log` | `target = audit` (→ DB, nicht Datei) | DB-Tabelle | 10 Jahre |

### 11.4 Sicherheitslog — Brute-Force-Erkennung

```
[Login-Versuch]
      │
      ▼
[Auth-Service prüft Credentials]
      │
      ├── Erfolg → security.log: LOGIN_SUCCESS {user_id, ip}
      │
      └── Fehlschlag → security.log: LOGIN_FAILED {username, ip}
              │
              ▼
        [Zähler: Fehlversuche für IP in letzten 10 Min.]
              │
              ├── ≤ 5 → Normaler Ablauf
              │
              └── > 5 → security.log: BRUTE_FORCE_LOCKOUT {ip, dauer: 15min}
                         │
                         ▼
                   [IP temporär gesperrt (15 Min.)]
                   [Antwort: 429 Too Many Requests]
```

### 11.5 Gerätelog — Beispiel DICOM-Workflow

```
[Worklist-Abfrage]
  → device.log: DICOM_WORKLIST_QUERY {ae_title: "PLANMECA_OPG", patients: 3}

[C-STORE Bildempfang]
  → device.log: DICOM_STORE_START {ae_title, study_uid, series_uid}
  → device.log: DICOM_STORE_COMPLETE {ae_title, images: 4, duration_ms: 1230, size_mb: 45.2}
  
[Fehler]
  → device.log: DICOM_STORE_ERROR {ae_title, error: "connection_timeout", retry: 2}

[USB-Hotplug]
  → device.log: USB_DEVICE_CONNECTED {vendor_id, product_id, name: "DEXIS IXS"}
  → device.log: USB_DEVICE_REMOVED {vendor_id, product_id}
```

### 11.6 Log-Sanitizer (PII-Schutz)

Der Log-Sanitizer ist ein `tracing`-Layer, der vor dem Schreiben alle Einträge prüft:

| Datentyp | Maskierung | Beispiel |
|----------|-----------|---------|
| Patientenname | Entfernt | `patient_name: "***"` |
| Geburtsdatum | Entfernt | `geburtsdatum: "***"` |
| Passwort | Entfernt | `password: "***"` |
| JWT-Token | Gekürzt | `token: "eyJ...***"` |
| Lizenzschlüssel | Gekürzt | `key: "MEDOC-****-****"` |
| IP-Adresse | Beibehalten | `ip: "192.168.1.42"` (für Security-Log benötigt) |
| Patient-ID | Beibehalten | `patient_id: 42` (ID, kein PII) |

**Implementierung**: Rust Trait `Sanitize` mit `#[derive(Sanitize)]` Macro für alle Log-Strukturen.

### 11.7 Log-Export für Support

```
Einstellungen → System → Logs exportieren
      │
      ▼
[Letzte 7 Tage aller .log-Dateien sammeln]
      │
      ▼
[Sanitizer: PII-Prüfung aller Einträge]
      │
      ▼
[ZIP-Archiv: medoc-logs-2026-04-19.zip]
      │
      ▼
[Benutzer: Datei speichern / an Support senden]
```

### 11.8 Backend-Integration

```rust
// Rust-Modulstruktur
infrastructure/
├── logging/
│   ├── mod.rs              // Log-System-Initialisierung
│   ├── config.rs           // Log-Level-Konfiguration (Runtime)
│   ├── layers/
│   │   ├── json_file.rs    // JSON-Datei-Layer (app.log)
│   │   ├── security.rs     // Security-Filter-Layer
│   │   ├── system.rs       // System-Filter-Layer
│   │   ├── device.rs       // Device-Filter-Layer
│   │   ├── migration.rs    // Migration-Filter-Layer
│   │   ├── perf.rs         // Performance-Threshold-Layer
│   │   └── audit_db.rs     // Audit-DB-Layer (praxis.db)
│   ├── sanitizer.rs        // PII-Maskierung
│   ├── rotation.rs         // Log-Rotation (Größe + Alter)
│   └── export.rs           // ZIP-Export-Service
```

---

## 12. Usability-Architektur

### 12.1 Übersicht

MeDoc setzt die **10 Nielsen-Heuristiken** und die **7 Usability-Engineering-Prinzipien** (Learnability, Efficiency, Memorability, Errors, Satisfaction, User-Centered Design, Accessibility) als architektonische Querschnittsanforderungen um. Die Usability-Architektur durchdringt alle Schichten des Systems.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Usability-Architektur (Querschnitt)               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Präsentationsschicht                         │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │  │
│  │  │Design-System│ │Feedback-   │ │Navigation- │ │Hilfe-     │  │  │
│  │  │(Palenight  │ │System      │ │Framework   │ │System     │  │  │
│  │  │Tokens,     │ │(Toast,     │ │(Sidebar,   │ │(Tooltips, │  │  │
│  │  │Glasmorph.) │ │Spinner,    │ │Breadcrumb, │ │Onboarding,│  │  │
│  │  │            │ │Progress,   │ │Shortcuts)  │ │FAQ, Docs) │  │  │
│  │  │H4,H8       │ │Banner)     │ │            │ │           │  │  │
│  │  │            │ │H1,H9       │ │H2,H6,H7    │ │H10        │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Interaktionsschicht                          │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │  │
│  │  │Validierung │ │Undo/Redo   │ │Keyboard-   │ │Accessibility│ │  │
│  │  │(Inline,    │ │Manager     │ │Shortcut-   │ │Engine      │  │  │
│  │  │Plausibilit)│ │(State-     │ │Registry    │ │(ARIA,      │  │  │
│  │  │            │ │History)    │ │(⌘/Strg+*)  │ │Kontrast,   │  │  │
│  │  │H3,H5       │ │H3          │ │H7          │ │Tab-Order)  │  │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Qualitätssicherung                           │  │
│  │  ┌──────────────────┐ ┌─────────────────┐ ┌────────────────┐ │  │
│  │  │Heuristische      │ │SUS-Fragebogen   │ │Automated A11y  │ │  │
│  │  │Evaluation        │ │(System Usability │ │Audit (axe-core)│ │  │
│  │  │(Nielsen H1–H10)  │ │Scale ≥ 72)      │ │WCAG 2.1 AA     │ │  │
│  │  └──────────────────┘ └─────────────────┘ └────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.2 Nielsen-Heuristiken → Architekturkomponenten

| Heuristik | Architekturkomponente | Implementierung |
|-----------|----------------------|----------------|
| **H1: Sichtbarkeit des Systemstatus** | Feedback-System | `ToastContainer` (Zustand-Store), `LoadingSpinner`, `ProgressBar`, `ConnectionBanner` — globaler Toast-Store mit Queue; automatisch nach jeder Tauri-IPC/API-Antwort |
| **H2: System ↔ reale Welt** | Fachdomänen-Layer | Zahnmedizinische Terminologie in `types/dental.ts` (FDI-Zahnschema, BEMA/GOZ); rollenspezifische Sidebar-Labels; Fehlermeldungen über `i18n`-Sprachdateien (keine technischen Codes) |
| **H3: Benutzerkontrolle** | Undo-Manager + Dialog-System | `useUndoRedo()` Hook (State-History-Stack); `ConfirmDialog` Komponente (automatisch bei destruktiven + mutierenden Aktionen); globaler „Zurück"-Button in AppLayout |
| **H4: Konsistenz** | Design-Token-System | `tailwind.config.ts` Palenight-Token (Farben, Abstände, Radien, Schatten); `ui/` Komponentenbibliothek (Button, Input, Dialog, Card, Badge, Toast, EmptyState) — einmal definiert, überall verwendet |
| **H5: Fehlervermeidung** | Validierungs-Framework | `useFormValidation()` Hook mit Zod-Schemas; Inline-Validierung (`onBlur`); Pflichtfeld-Markierung (visual indicator); Plausibilitätsregeln im Backend (`domain/services/validation.rs`) |
| **H6: Wiedererkennung** | Navigation + Recents | Sidebar mit Icons + Labels; `RecentItems`-Store (letzte 10 Patienten/Termine); `AutoComplete`-Komponente für Suchfelder; kontextbezogene Aktionsleiste |
| **H7: Flexibilität** | Shortcut-Registry | `useKeyboardShortcuts()` Hook; globale Shortcut-Map (`⌘N`, `⌘P`, `⌘S` etc.); Shortcut-Cheatsheet in Hilfe; Drag-and-Drop via `useDragDrop()` im Kalender |
| **H8: Minimalistisches Design** | Design-System | Palenight-Glasmorphismus; `glass-*` Utility-Klassen; tonal elevation (`bg-opacity-*`); progressive Offenlegung (Akkordion, Tabs, Collapse); Millersche Zahl (7±2) als Layout-Guideline |
| **H9: Fehlermeldungen** | Error-Boundary + Toast | `ErrorBoundary` React-Komponente; strukturierte Fehlermeldungen: `{ title, message, action }` — Was passiert? Warum? Was tun?; Feldmarkierung (roter Rahmen + Inline-Text) |
| **H10: Hilfe** | Hilfe-System | `HelpButton` (Fragezeichen-Icon pro Seite); `OnboardingWizard` (rollenspezifisch, nur beim ersten Start); `Tooltip`-Komponente auf allen Icon-Buttons; Link zu `/docs/benutzerhandbuch/` |

### 12.3 Usability-Engineering-Prinzipien → Architekturentscheidungen

| Prinzip | Architekturentscheidung | Messmetrik |
|---------|------------------------|-----------|
| **Learnability** | Rollenspezifische Startansichten (ARZT → Dashboard mit heutigen Terminen + Patienten; REZEPTION → Kalender + Wartezimmer); Onboarding-Wizard; konsistente Interaktionsmuster (CRUD überall gleich) | Einarbeitungszeit ≤ 2 Monate; Task-Completion-Rate ≥ 90% bei Erstbenutzern nach Training |
| **Efficiency** | Max. 2-Klick-Navigation (Sidebar → Seite); Tastaturkürzel; Auto-Complete; Notfalltermin-Schnellerfassung (< 3 Klicks); Bulk-Aktionen in DataTable; Smart-Defaults (heutiges Datum vorausgewählt) | Aufgabenerledigungszeit sinkt ≥ 20% nach 4 Wochen |
| **Memorability** | Stabile Menüstruktur zwischen Versionen; konsistente Iconografie (Lucide-Icons); `RecentItems` auf Dashboard; gleiches Layout-Pattern in allen Modulen | Recall-Test: Hauptfunktionen in ≤ 30s nach 2 Wochen Pause |
| **Errors** | Zweistufige Bestätigungsdialoge (NFA-USE-03/07); Inline-Validierung vor Submit; `useUndoRedo()` für Texteingaben; DB-Snapshot vor Migration; kein irreversibler Datenverlust möglich | Fehlerrate < 5% bei Standardaufgaben |
| **Satisfaction** | Palenight-Ästhetik; sanfte CSS-Transitions (200–300ms ease); positive Toast-Meldungen (grüner Haken); kein visueller Noise; Dark-Theme-Optimierung (reduzierte Augenbelastung) | SUS-Score ≥ 72 |
| **User-Centered Design** | Figma-Prototyp → Heuristische Evaluation → Implementierung → Usability-Test → Iteration; Personas (Dr. Lehner / Anna Scholz) als Designentscheidungs-Grundlage; Feedback-Schleife pro Release | ≥ 1 Usability-Test-Zyklus pro Major-Release |
| **Accessibility** | `aria-label` auf allen interaktiven Elementen; `tabIndex`-Management für Tastaturnavigation; Mindest-Kontrast 4.5:1 (WCAG 2.1 AA) in Palenight-Tokens verifiziert; `alt`-Texte für Bilder; skalierbare Schrift (rem-basiert, 100%–200%); `axe-core` im CI/CD | 0 kritische WCAG-Verstöße im axe-Audit |

### 12.4 Feedback-System (Detail-Architektur)

```
┌──────────────────────────────────────────────────────┐
│                  Feedback-System                      │
│                                                      │
│  Tauri IPC / API Response                            │
│       │                                              │
│       ▼                                              │
│  ┌─────────────────┐    ┌─────────────────────────┐  │
│  │ Toast-Store      │    │ Inline-Feedback         │  │
│  │ (Zustand)        │    │                         │  │
│  │ ┌─────────────┐  │    │ • Feld-Validierung      │  │
│  │ │ queue[]     │  │    │   (roter Rahmen + Text) │  │
│  │ │ {type,      │  │    │ • Loading-States        │  │
│  │ │  title,     │  │    │   (Skeleton-Loader)     │  │
│  │ │  message,   │  │    │ • Empty-States          │  │
│  │ │  duration}  │  │    │   (Illustration + CTA)  │  │
│  │ └─────────────┘  │    └─────────────────────────┘  │
│  │       │          │                                 │
│  │       ▼          │    ┌─────────────────────────┐  │
│  │ ToastContainer   │    │ Globale Statusanzeigen  │  │
│  │ (Position:       │    │                         │  │
│  │  bottom-right)   │    │ • ConnectionBanner      │  │
│  │ Auto-Dismiss:    │    │   (LAN-Status)          │  │
│  │  3s success      │    │ • LicenseBanner         │  │
│  │  5s error        │    │   (Ablauf-Warnung)      │  │
│  │  ∞ action-req.   │    │ • UpdateBanner          │  │
│  └─────────────────┘    │   (Neue Version)         │  │
│                          └─────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 12.5 Accessibility-Architektur

```
Accessibility-Layer:
┌───────────────────────────────────────────────┐
│ 1. Semantisches HTML                          │
│    • <nav>, <main>, <aside>, <header>         │
│    • <button> statt <div onClick>             │
│    • <table> mit <thead>/<tbody>/<th scope>   │
│                                               │
│ 2. ARIA-Attribute                             │
│    • aria-label auf Icon-Buttons              │
│    • aria-live="polite" auf Toast-Container   │
│    • aria-expanded auf Akkordions             │
│    • role="alert" auf Fehlermeldungen         │
│                                               │
│ 3. Tastaturnavigation                         │
│    • Tab-Reihenfolge logisch (links→rechts,   │
│      oben→unten)                              │
│    • Focus-Ring sichtbar (2px solid accent)   │
│    • Escape schließt Dialoge/Modals           │
│    • Enter bestätigt Primäraktion             │
│                                               │
│ 4. Visuell                                    │
│    • Kontrastrate ≥ 4.5:1 (Text)             │
│    • Kontrastrate ≥ 3:1 (UI-Elemente)        │
│    • Schrift rem-basiert (skalierbar)         │
│    • Farbkodierung + Textlabel (NFA-USE-06)  │
│                                               │
│ 5. CI/CD-Integration                          │
│    • axe-core im Build-Pipeline               │
│    • Lighthouse Accessibility-Score ≥ 90      │
│    • Manuelle Tests mit Screen-Reader         │
│      (VoiceOver macOS, NVDA Windows)          │
└───────────────────────────────────────────────┘
```

---

## 13. Systemtest-Kriterien (→ Phase 8)

| Testfall-ID | Beschreibung | Erwartetes Ergebnis |
|-------------|-------------|---------------------|
| ST-01 | Vollständiger Terminvereinbarungsprozess | Termin erscheint im Kalender, Akte verknüpft |
| ST-02 | Neue Patientenaufnahme + Anamnesebogen | Akte angelegt, Status „neu" |
| ST-03 | Behandlungsdokumentation + Zahnschema | Daten korrekt gespeichert, Zahn markiert |
| ST-04 | Zahlungsdokumentation + Bilanz | Zahlung in Bilanz reflektiert |
| ST-05 | Rollenwechsel: REZ versucht medizinische Daten zu bearbeiten | Zugriff verweigert (403) |
| ST-06 | Backup + Wiederherstellung | Daten nach Restore identisch |
| ST-07 | Notfalltermin-Workflow | In < 3 Klicks erstellt |
| ST-08 | PDF-Export Finanzdaten | Korrektes PDF generiert |
| ST-09 | **Netzwerk: Rezeption-PC verbindet sich zum Host** | Login erfolgreich; Termine/Patienten abrufbar; Latenz < 200 ms |
| ST-10 | **Netzwerk: Smartphone-Browser greift auf Web-UI zu** | Responsive Layout korrekt; alle Rezeptionsfunktionen bedienbar |
| ST-11 | **Netzwerk: 5 gleichzeitige Clients** | Keine Verlangsamung; kein Datenverlust; kein DB-Lock |
| ST-12 | **Verbindungsverlust: Client verliert LAN-Verbindung** | Banner „Verbindung unterbrochen"; automatischer Reconnect |
| ST-13 | **Standalone-Modus: System ohne Netzwerk** | Alle Funktionen lokal verfügbar; kein Fehler |
| ST-14 | **Sicherheit: Unautorisierter API-Zugriff** | 401 Unauthorized bei fehlendem/abgelaufenem Token |
| ST-15 | **Sicherheit: RBAC im Netzwerk-Modus** | REZ-Client kann keine ARZT-Endpunkte aufrufen (403) |
| ST-16 | **Lizenz: Erstaktivierung mit gültigem Schlüssel** | Lizenz aktiviert; Abo-Stufe korrekt gesetzt; alle freigeschalteten Module verfügbar |
| ST-17 | **Lizenz: Ablauf → Read-Only-Modus** | Nach Ablauf: Schreibzugriffe blockiert; Lesezugriff + Datenexport funktionieren |
| ST-18 | **Lizenz: 30-Tage Offline-Karenz** | Ohne Internet: App funktioniert 30 Tage normal; ab Tag 31 → Read-Only |
| ST-19 | **Lizenz: Geräte-Kontingent überschritten** | 3. Gerät bei Basis-Abo: Aktivierung verweigert mit klarer Fehlermeldung |
| ST-20 | **Payment: Abo-Zahlung über Provider** | WebView/Redirect öffnet Zahlungsformular; nach Erfolg Lizenz verlängert |
| ST-21 | **Payment: Fehlgeschlagene Zahlung + Karenz** | Zahlung fehlgeschlagen: 14-Tage-Karenz aktiv; danach → Read-Only |
| ST-22 | **Payment: Rechnungen abrufen** | Rechnungshistorie zeigt alle Zahlungen; PDF-Download funktioniert |
| ST-23 | **Update: OTA-Update mit DB-Migration** | Update heruntergeladen; Signatur geprüft; Backup erstellt; Migration ausgeführt; App startet korrekt |
| ST-24 | **Update: Rollback bei fehlgeschlagenem Update** | Update fehlschlägt: automatischer Rollback; DB-Backup wiederhergestellt; alte Version läuft |
| ST-25 | **Update: Erzwungenes Sicherheitsupdate** | Server meldet mandatory Update: Dialog ohne „Später"-Option; Update wird installiert |
| ST-26 | **DICOM: Bildempfang von OPG-Gerät** | C-STORE SCP empfängt Panorama-Bild; Patient per DICOM-Worklist zugeordnet; Bild verschlüsselt im Archiv |
| ST-27 | **DICOM: Worklist-Abfrage** | Patient in MeDoc angelegt → Gerät fragt Worklist ab → Patientendaten korrekt übertragen |
| ST-28 | **TWAIN: Intraoralröntgen-Sensor** | Sensor über TWAIN erfasst Bild; Vorschau angezeigt; Bild in Akte gespeichert |
| ST-29 | **GDT: Bidirektionaler Datenaustausch** | Patient per GDT-OUT an Gerät gesendet; Ergebnis per GDT-IN zurückgelesen und in Akte angezeigt |
| ST-30 | **Geräte-Hotplug: USB-Sensor anschließen** | Sensor wird innerhalb 5s erkannt; Geräteliste aktualisiert; sofort einsatzbereit |
| ST-31 | **Migration: VDDS-transfer Import** | VDDS-transfer-Datei importiert; Patientenanzahl korrekt; Migrationsbericht vollständig |
| ST-32 | **Migration: BDT Import** | BDT-Datei geparst; Pflichtfelder zugeordnet; Validierungsbericht zeigt 0 kritische Fehler |
| ST-33 | **Migration: Dry-Run ohne DB-Änderung** | Testlauf zeigt Vorschau; Datenbank bleibt unverändert; Bericht korrekt |
| ST-34 | **Migration: Rollback nach Fehler** | Import mit Fehler → automatischer Rollback auf DB-Snapshot; Datenbank in Originalzustand |
| ST-35 | **Bildarchiv: AES-256-Verschlüsselung** | Bilddateien auf Festplatte nicht im Klartext lesbar; nur über App-Entschlüsselung zugänglich |
| ST-36 | **EU: DSGVO-Export (Art. 20)** | Alle Patientendaten als strukturiertes JSON exportierbar; maschinenlesbar; vollständig |
| ST-37 | **EU: Recht auf Löschung (Art. 17)** | Patientendaten nach Löschanfrage vollständig entfernt (inkl. Bilder, Audit-Log anonymisiert) |
| ST-38 | **Usability: Nielsen-Heuristik-Evaluation** | Score ≥ 80% durch ≥ 3 unabhängige Evaluatoren; alle kritischen Findings (Schweregrad 3–4) behoben |
| ST-39 | **Usability: SUS-Fragebogen** | System Usability Scale Score ≥ 72 (überdurchschnittlich) mit ≥ 10 Testpersonen |
| ST-40 | **Usability: 2-Klick-Navigation** | Jede Hauptfunktion (Termine, Patienten, Behandlung, Finanzen) ist in ≤ 2 Klicks erreichbar |
| ST-41 | **Usability: Tastaturnavigation** | Alle interaktiven Elemente per Tab erreichbar; Focus-Ring sichtbar; Escape schließt Dialoge |
| ST-42 | **Accessibility: WCAG 2.1 AA** | axe-core Audit zeigt 0 kritische Verstöße; Kontrast ≥ 4.5:1; ARIA-Labels vollständig |
| ST-43 | **Accessibility: Screen-Reader** | VoiceOver (macOS) / NVDA (Windows) kann alle Hauptworkflows vorlesen und navigieren |
| ST-44 | **Usability: Fehlermeldungs-Qualität** | Jede Fehlermeldung enthält: Was passiert, Warum, Was tun. Keine technischen Codes sichtbar |
| ST-45 | **Usability: Onboarding-Wizard** | Erstbenutzer durchläuft rollenspezifischen Wizard; danach Task-Completion-Rate ≥ 90% |
| ST-46 | **Logging: Strukturiertes JSON-Format** | Alle Einträge in `app.log` sind valides JSON mit timestamp, level, module, message |
| ST-47 | **Logging: Brute-Force-Erkennung** | 6 fehlgeschlagene Logins in 10 Min. → `security.log` enthält `BRUTE_FORCE_LOCKOUT`; IP gesperrt für 15 Min. |
| ST-48 | **Logging: Log-Rotation** | Bei Überschreiten von 50 MB wird rotiert; Gesamtgröße `~/medoc-data/logs/` bleibt < 1 GB |
| ST-49 | **Logging: PII-Maskierung** | Grep über alle `.log`-Dateien nach Testpatient-Name ergibt 0 Treffer; nur IDs |
| ST-50 | **Logging: Log-Export** | ZIP-Export enthält letzte 7 Tage; sensible Daten maskiert; Datei ≤ 100 MB |
| ST-51 | **Logging: Systemstart-Eintrag** | App-Start erzeugt `system.log`-Eintrag mit Version, OS, DB-Schema-Version |
| ST-52 | **Logging: DICOM-Gerätelog** | DICOM C-STORE erzeugt Einträge in `device.log` mit AE-Title, Bildanzahl, Dauer |
| ST-53 | **Logging: Log-Level Runtime-Änderung** | Wechsel von INFO auf DEBUG in Einstellungen → sofort mehr Einträge; kein Neustart |
