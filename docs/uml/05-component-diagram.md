# Komponentendiagramm (Component Diagram) – MeDoc

## Beschreibung
Zeigt die modulare Zerlegung des Systems in Komponenten (Bibliotheken, Module) und ihre Abhängigkeiten.

## Systemkomponenten – Tauri Desktop App

```mermaid
graph TB
    subgraph "Desktop-Anwendung (Tauri v2)"
        subgraph "Frontend (React + TypeScript – WebView)"
            subgraph "Views (Presentation Layer)"
                V_Login["LoginView"]
                V_Dashboard["DashboardView"]
                V_Termine["TermineView"]
                V_Patienten["PatientenView"]
                V_Zahnschema["ZahnschemaView"]
                V_Anamnesebogen["AnamneseView"]
                V_Finanzen["FinanzenView"]
                V_Leistungen["LeistungenView"]
                V_Produkte["ProdukteView"]
                V_Personal["PersonalView"]
                V_Statistik["StatistikView"]
                V_Audit["AuditView"]
            end

            subgraph "Controllers (Business Logic Orchestration)"
                C_Auth["AuthController"]
                C_Termin["TerminController"]
                C_Patient["PatientController"]
                C_Akte["AkteController"]
                C_Finanzen["FinanzenController"]
                C_Admin["AdminController"]
            end

            subgraph "Models (State Management)"
                M_Auth["AuthModel (Session)"]
                M_Data["DataModel (Cache)"]
                M_UI["UIModel (Navigation, Modals)"]
            end

            subgraph "Services (Tauri IPC Bridge)"
                S_IPC["TauriInvokeService"]
            end

            subgraph "Shared Components"
                SC_DataTable["DataTable"]
                SC_DentalChart["DentalChart (SVG)"]
                SC_Forms["FormComponents"]
                SC_Layout["Layout (Sidebar, Header)"]
                SC_Dialogs["Dialogs (Confirm, Error)"]
            end
        end

        subgraph "Backend (Rust – Tauri Core)"
            subgraph "Commands Layer (Interface)"
                CMD_Auth["auth_commands"]
                CMD_Termin["termin_commands"]
                CMD_Patient["patient_commands"]
                CMD_Akte["akte_commands"]
                CMD_Zahlung["zahlung_commands"]
                CMD_Leistung["leistung_commands"]
                CMD_Produkt["produkt_commands"]
                CMD_Personal["personal_commands"]
                CMD_Statistik["statistik_commands"]
                CMD_Audit["audit_commands"]
            end

            subgraph "Application Layer (Use Cases)"
                UC_Auth["AuthService"]
                UC_Termin["TerminService"]
                UC_Patient["PatientService"]
                UC_Akte["AkteService"]
                UC_Zahlung["ZahlungService"]
                UC_Leistung["LeistungService"]
                UC_Produkt["ProduktService"]
                UC_Personal["PersonalService"]
                UC_Statistik["StatistikService"]
            end

            subgraph "Domain Layer (Entities & Traits)"
                D_Entities["Entities (Personal, Patient, Termin, ...)"]
                D_Repos["Repository Traits (abstrakte Interfaces)"]
                D_ValueObj["Value Objects (Email, ZahnNummer, Betrag)"]
                D_DomainSvc["Domain Services (KonfliktPrüfung, RBAC)"]
            end

            subgraph "Infrastructure Layer"
                I_SQLite["SQLiteRepository (sqlx)"]
                I_Backup["BackupService"]
                I_Audit["AuditLogger"]
                I_Crypto["CryptoService (bcrypt, SQLCipher)"]
            end
        end

        subgraph "Datenbank"
            DB[(SQLite + SQLCipher)]
        end
    end

    %% Frontend-Interne Abhängigkeiten
    V_Login --> C_Auth
    V_Dashboard --> C_Termin & C_Finanzen
    V_Termine --> C_Termin
    V_Patienten --> C_Patient
    V_Zahnschema --> C_Akte
    V_Finanzen --> C_Finanzen
    V_Personal --> C_Admin

    C_Auth --> M_Auth & S_IPC
    C_Termin --> M_Data & S_IPC
    C_Patient --> M_Data & S_IPC
    C_Akte --> M_Data & S_IPC
    C_Finanzen --> M_Data & S_IPC
    C_Admin --> M_Data & S_IPC

    V_Termine --> SC_DataTable
    V_Patienten --> SC_DataTable
    V_Zahnschema --> SC_DentalChart
    V_Login --> SC_Forms

    %% IPC Bridge
    S_IPC -.->|"Tauri invoke()"| CMD_Auth & CMD_Termin & CMD_Patient & CMD_Akte & CMD_Zahlung & CMD_Personal & CMD_Statistik & CMD_Audit

    %% Backend-Interne Abhängigkeiten
    CMD_Auth --> UC_Auth
    CMD_Termin --> UC_Termin
    CMD_Patient --> UC_Patient
    CMD_Akte --> UC_Akte
    CMD_Zahlung --> UC_Zahlung
    CMD_Personal --> UC_Personal
    CMD_Statistik --> UC_Statistik

    UC_Auth --> D_Entities & D_Repos & I_Crypto
    UC_Termin --> D_Entities & D_Repos & D_DomainSvc
    UC_Patient --> D_Entities & D_Repos
    UC_Akte --> D_Entities & D_Repos
    UC_Zahlung --> D_Entities & D_Repos

    D_Repos -.->|"implementiert"| I_SQLite
    I_SQLite --> DB
    I_Audit --> DB
    I_Backup --> DB
```

## Komponentenübersicht

| Schicht | Komponente | Technologie | Verantwortung |
|---------|-----------|-------------|---------------|
| **Views** | 12 Seiten-Komponenten | React + TypeScript | UI-Rendering, Benutzerinteraktion |
| **Controllers** | 6 Controller-Module | TypeScript | Geschäftslogik-Orchestrierung, Validierung |
| **Models** | 3 State-Module | Zustand/Jotai | Zustandsverwaltung, Caching |
| **Services** | TauriInvokeService | @tauri-apps/api | IPC-Brücke zum Rust-Backend |
| **Shared** | 5 UI-Bibliotheken | React + SVG | Wiederverwendbare Komponenten |
| **Commands** | 10 Command-Module | Rust (Tauri) | IPC-Endpunkte |
| **Application** | 9 Service-Module | Rust | Use Cases, Geschäftsregeln |
| **Domain** | Entities + Traits | Rust | Datenmodell, Abstraktion |
| **Infrastructure** | 4 Infrastruktur-Module | Rust (sqlx, bcrypt) | DB-Zugriff, Verschlüsselung |
| **Datenbank** | SQLite | SQLCipher | Persistente Datenhaltung |
