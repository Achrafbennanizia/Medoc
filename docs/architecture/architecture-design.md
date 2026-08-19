# Architekturentwurf – MeDoc Desktop

## 1. Technologie-Entscheidung

### Warum Desktop mit Tauri + Rust?

| Kriterium | Begründung |
|-----------|-----------|
| **Hauptgerät** | Praxiscomputer (Desktop) – kein Browser nötig |
| **Offline-Fähigkeit** | Embedded SQLite, kein externer Server |
| **Performance** | Rust-Backend: native Geschwindigkeit, minimaler RAM |
| **Sicherheit** | Rust: Speichersicherheit ohne GC; geplante SQLCipher-DB nach NFA-SEC-08 |
| **Paketgröße** | Tauri: ~5-10 MB vs. Electron: ~150 MB |
| **Cross-Platform** | Windows, macOS, Linux aus einer Codebasis |

### Tech Stack

| Schicht | Technologie | Version |
|---------|-------------|---------|
| Desktop-Shell | Tauri | v2 |
| Frontend | React + TypeScript + Vite | React 19, Vite 6 |
| Styling | Tailwind CSS | v3 (`tailwindcss` in `app/package.json`) |
| State Management | Zustand | v5 |
| Charts | Recharts | v2 |
| Backend | Rust | Edition 2021 (`app/src-tauri/Cargo.toml`) |
| ORM / DB | sqlx (async) | v0.8 |
| Datenbank | SQLite (WAL); SQLCipher (NFA-SEC-08) **outstanding** | SQLite 3 |
| Auth | Argon2id + bcrypt-Fallback, JWT (lokal) | – |
| Testing | `cargo test` (Backend); `npm run test` / Vitest im Frontend (`app/package.json`) | – |

## 2. Architektur-Überblick

### Frontend: MVC (Model-View-Controller)

```
app/src/
├── models/
│   ├── types.ts               # TypeScript-Interfaces
│   └── store/
│       └── auth-store.ts      # Session
├── views/
│   ├── layouts/
│   │   └── app-layout.tsx     # Navigation, Notfallzugriff, Content-Outlet
│   ├── pages/                 # u. a. patient-detail (Akte, Befunde, Anamnese-JSON), finance (Rechnungs-PDF)
│   └── components/ui/         # Design-System
├── controllers/               # Tauri-Invoke; u. a. akte, payment, invoice, break-glass, ops, …
├── services/
│   └── tauri.service.ts
├── lib/
│   ├── utils.ts
│   ├── i18n.ts
│   └── rbac.ts
├── App.tsx                    # Router + Layout
├── main.tsx                   # Entry Point
└── index.css                  # Tailwind Imports
```

### Backend: Clean Architecture (Hexagonal / Ports & Adapters)

```
app/src-tauri/src/
├── main.rs                    # Tauri App Builder + Plugin Registration
├── lib.rs                     # Module Declarations
├── commands/                  # 🔌 Interface Layer (Tauri Commands = Ports)
│   ├── mod.rs
│   ├── auth_commands.rs       # #[tauri::command] login, logout, get_session
│   ├── termin_commands.rs     # #[tauri::command] CRUD appointments
│   ├── patient_commands.rs    # #[tauri::command] CRUD patients
│   ├── akte_commands.rs       # #[tauri::command] akte, dental_finding, anamnesis_form
│   ├── zahlung_commands.rs    # #[tauri::command] CRUD payments
│   ├── leistung_commands.rs   # #[tauri::command] CRUD services
│   ├── produkt_commands.rs    # #[tauri::command] CRUD products
│   ├── personal_commands.rs   # #[tauri::command] CRUD staff
│   ├── statistik_commands.rs  # #[tauri::command] Dashboard-Daten
│   └── audit_commands.rs      # #[tauri::command] Audit-Logs
├── application/               # 📋 Application Layer (Use Cases)
│   ├── mod.rs
│   ├── auth_service.rs        # authenticate(), validate_token()
│   ├── termin_service.rs      # create_appointment(), check_conflict()
│   ├── patient_service.rs     # create_patient() + auto-Akte
│   ├── akte_service.rs        # validate_akte(), update_dental_finding()
│   ├── zahlung_service.rs     # create_payment(), get_balance_sheet()
│   ├── leistung_service.rs    # CRUD mit Soft-Delete
│   ├── produkt_service.rs     # CRUD
│   ├── personal_service.rs    # create (Passwort-Hashing per NFA-SEC-03), prevent_self_delete
│   └── statistik_service.rs   # Aggregationen
├── domain/                    # 🏛️ Domain Layer (Entities + Traits)
│   ├── mod.rs
│   ├── entities/
│   │   ├── mod.rs
│   │   ├── staff.rs        # struct Personal, impl Personal
│   │   ├── patient.rs         # struct Patient, impl Patient
│   │   ├── appointment.rs          # struct Termin, impl (conflict check)
│   │   ├── patient_chart.rs   # struct Patientenakte
│   │   ├── dental_finding.rs      # struct Zahnbefund (FDI validation)
│   │   ├── treatment.rs      # struct Behandlung, Untersuchung
│   │   ├── payment.rs         # struct Zahlung, Finanzdokument
│   │   ├── serviceItem.rs        # struct Leistung
│   │   ├── product.rs         # struct Produkt
│   │   └── audit_log.rs       # struct AuditLog
│   ├── enums.rs               # Rolle, TerminArt, TerminStatus, etc.
│   ├── value_objects/
│   │   ├── mod.rs
│   │   ├── email.rs           # Email newtype mit Validierung
│   │   ├── tooth_number.rs     # ZahnNummer (FDI 11-48) mit Validierung
│   │   └── amount.rs          # Betrag (f64 > 0) mit Formatierung
│   ├── repositories/          # 🔌 Repository Traits (Ports)
│   │   ├── mod.rs
│   │   ├── personal_repo.rs   # trait PersonalRepository
│   │   ├── patient_repo.rs    # trait PatientRepository
│   │   ├── termin_repo.rs     # trait TerminRepository
│   │   ├── akte_repo.rs       # trait AkteRepository
│   │   ├── zahlung_repo.rs    # trait ZahlungRepository
│   │   ├── leistung_repo.rs   # trait LeistungRepository
│   │   ├── produkt_repo.rs    # trait ProduktRepository
│   │   └── audit_repo.rs      # trait AuditRepository
│   └── services/
│       ├── mod.rs
│       ├── rbac.rs            # can_access(role, resource, action)
│       └── konflikt.rs        # Terminkonflikt-Prüfung
├── infrastructure/            # 🔧 Infrastructure Layer (Adapters)
│   ├── mod.rs
│   ├── database/
│   │   ├── mod.rs
│   │   ├── connection.rs      # SQLite Pool + Migrations
│   │   ├── personal_repo.rs   # impl PersonalRepository for SqliteRepo
│   │   ├── patient_repo.rs    # impl PatientRepository
│   │   ├── termin_repo.rs     # impl TerminRepository
│   │   ├── akte_repo.rs       # impl AkteRepository
│   │   ├── zahlung_repo.rs    # impl ZahlungRepository
│   │   ├── leistung_repo.rs   # impl LeistungRepository
│   │   ├── produkt_repo.rs    # impl ProduktRepository
│   │   └── audit_repo.rs      # impl AuditRepository
│   ├── crypto.rs              # Argon2id, bcrypt-Fallback, Audit-HMAC
│   ├── backup.rs              # Automatisches DB-Backup
│   └── jwt.rs                 # JWT Token erstellen/validieren
└── error.rs                   # AppError enum + From-Impls
```

## 3. Architekturprinzipien & Software-Engineering-Grundlagen

### 3.1 Leitprinzip: Fachbereichsunabhängige Erweiterbarkeit

MeDoc wird zunächst für die **Zahnmedizin** entwickelt, die Architektur ist jedoch so konzipiert, dass das System in Zukunft um weitere medizinische Fachbereiche erweitert werden kann (z. B. Augenheilkunde, Dermatologie, Allgemeinmedizin). Daraus folgt:

| Entscheidung | Umsetzung |
|-------------|-----------|
| **Generischer Kern** | Patient, Termin, Akte, Zahlung, Personal, Leistung, Produkt, Statistik sind fachbereichsunabhängig |
| **Fachbereichsmodule als Plugins** | Zahnschema ist ein austauschbares Fachmodul – künftige Fachbereiche implementieren dasselbe Trait/Interface |
| **Domain Trait Abstraktion** | `trait SpecialtyModule { fn get_schema(); fn record_finding(); fn get_history(); }` – Zahnschema implementiert dieses Trait; künftige Module (z. B. Augen-Befund, Hautbild) ebenso |
| **Feature-Flags** | Fachmodule per Konfiguration aktivier-/deaktivierbar (kein Hardcoding) |
| **Getrennte DB-Migrationen** | Core-Tabellen + fachbereichsspezifische Tabellen in separaten Migrationsdateien |

```
┌──────────────────────────────────────────────────────────────┐
│                        MeDoc Core                            │
│  Patient │ Termin │ Akte │ Zahlung │ Personal │ Auth │ Audit │
├──────────┴────────┴──────┴─────────┴──────────┴──────┴───────┤
│                    Specialty Plugin API                       │
│              trait SpecialtyModule + trait SpecialtyRepository│
├──────────────────┬──────────────────┬────────────────────────┤
│  🦷 Zahnmedizin  │  👁 Augenheil.   │  🩺 Allgemeinmed.     │
│  Zahnschema      │  Augenbefund     │  Organbefund           │
│  FDI-Nomenklatur │  Visus-Tabelle   │  ICD-Kodierung         │
│  (implementiert) │  (Zukunft)       │  (Zukunft)             │
└──────────────────┴──────────────────┴────────────────────────┘
```

### 3.2 Software-Engineering-Prinzipien

Die folgenden Prinzipien gelten verbindlich für alle Code-Beiträge:

#### SOLID-Prinzipien

| Prinzip | Abkürzung | Umsetzung in MeDoc |
|---------|-----------|---------------------|
| **Single Responsibility** | SRP | Jede Datei/Modul hat genau eine Verantwortung (z. B. `auth_service.rs` = nur Authentifizierung) |
| **Open/Closed** | OCP | Neue Fachmodule durch Trait-Implementierung hinzufügbar, ohne bestehenden Code zu ändern |
| **Liskov Substitution** | LSP | Alle Trait-Implementierungen (z. B. `SqlitePatientRepo`) sind austauschbar gegen Mocks oder alternative Implementierungen |
| **Interface Segregation** | ISP | Granulare Repository-Traits pro Entität statt eines monolithischen Repository |
| **Dependency Inversion** | DIP | Domain definiert Traits (Ports); Infrastructure implementiert sie (Adapters). Services hängen nie von konkreten DB-Implementierungen ab |

#### Weitere Prinzipien

| Prinzip | Umsetzung |
|---------|-----------|
| **Modularity** | Frontend: MVC-Module pro Feature; Backend: Rust-Module pro Domain-Entität |
| **Abstraction & Encapsulation** | Rust: `pub(crate)` für interne Details; TypeScript: exportierte Interfaces, versteckte Implementierung |
| **DRY** (Don't Repeat Yourself) | Gemeinsame Logik in `lib/utils`, `domain/value_objects`, `components/ui`; generische `DataTable`-Komponente statt Copy-Paste |
| **KISS** (Keep It Simple) | Keine überflüssigen Abstraktionen; SQLite statt verteilter DB; lokale JWT statt OAuth-Server |
| **YAGNI** (You Aren't Gonna Need It) | Nur implementieren, was in der aktuellen Iteration benötigt wird; Zukunfts-Hooks nur als Trait-Definitionen |
| **Separation of Concerns** | Frontend: View rendert nur UI, Controller orchestriert Logik, Model hält State. Backend: Command = IPC-Adapter, Service = Use Case, Repository = Datenzugriff |
| **Law of Demeter** | Controller spricht nur mit Service; Service spricht nur mit Repository; Views sprechen nur mit ihrem Controller/Store |
| **Anticipation of Change** | Plugin-System für Fachmodule; Repository-Traits für DB-Austausch; Feature-Flags für optionale Module |
| **High Cohesion** | Alle Termin-Logik in `termin_service.rs`; alle Termin-UI in `views/pages/appointments.tsx` |
| **Low Coupling** | Module kommunizieren nur über definierte Interfaces (Traits/TypeScript-Interfaces); keine direkten Importe quer über Schichtgrenzen |
| **Incremental Development** | Feature-weise Implementierung im V-Modell; jedes Feature einzeln testbar und deploybar |
| **Continuous Validation** | Zod-Validierung (Frontend) + Rust-Typsystem (Backend) + SQL-Constraints (DB) = dreifache Absicherung |
| **IEEE/ACM Code of Ethics** | Datenschutz (DSGVO), Genauigkeit medizinischer Daten, Transparenz (Audit-Logs), Zugangskontrolle (RBAC) |

### 3.3 Design Patterns

| Pattern | Wo eingesetzt | Zweck |
|---------|---------------|-------|
| **Repository Pattern** | Backend `domain/repositories/` | Abstraktion des Datenzugriffs vom Domain-Modell |
| **Service Layer** | Backend `application/` | Orchestrierung von Use Cases, Geschäftsregeln |
| **Command Pattern** | Backend `commands/` | Tauri IPC-Handler als einheitliche Schnittstelle |
| **Observer Pattern** | Frontend Zustand-Stores | UI reagiert automatisch auf State-Änderungen |
| **Strategy Pattern** | Fachmodule (SpecialtyModule-Trait) | Austauschbare Fachbereichslogik zur Laufzeit |
| **Factory Pattern** | Entity-Konstruktoren mit Validierung | `Patient::new()` validiert Invarianten vor Erstellung |
| **Adapter Pattern** | Infrastructure-Layer | SQLite-Adapter implementiert abstrakte Repository-Traits |
| **Facade Pattern** | `tauri.service.ts` | Vereinfachte Schnittstelle zum Backend für Frontend-Controller |
| **Newtype Pattern** | `value_objects/` (Email, ZahnNummer, Betrag) | Typsichere Werte mit eingebauter Validierung |

## 4. Warum Clean Architecture?

```
┌─────────────────────────────────────────────────────┐
│                   Commands (Tauri IPC)               │  Interface
│          ┌───────────────────────────────┐           │
│          │     Application Services      │           │  Use Cases
│          │    ┌──────────────────────┐   │           │
│          │    │   Domain Layer       │   │           │  Entities
│          │    │  Entities + Traits   │   │           │  Business Rules
│          │    └──────────────────────┘   │           │
│          └───────────────────────────────┘           │
│                   Infrastructure                     │  DB, Crypto, FS
└─────────────────────────────────────────────────────┘
```

| Vorteil | Erklärung |
|---------|-----------|
| **Dependency Inversion** | Domain definiert Traits, Infrastructure implementiert sie |
| **Testbarkeit** | Mock-Repositories für Unit Tests, keine DB nötig |
| **Austauschbarkeit** | SQLite → PostgreSQL: nur Infrastructure anpassen |
| **Medizinische Domäne** | Komplexe Geschäftsregeln (RBAC, Validierung, Workflow) isoliert |
| **Rust-Passung** | Trait System = perfektes Ports & Adapters |
| **Team-Skalierung** | Frontend und Backend unabhängig entwickelbar |

## 5. Datenfluss (IPC)

```
Frontend (React)                 Backend (Rust)
┌──────────────┐                ┌──────────────────────────────┐
│              │   invoke()     │ #[tauri::command]            │
│ Controller ──┼───────────────►│ Command → Service → Repo → DB│
│              │                │                              │
│              │◄───────────────┤ Result<T, AppError>          │
│ View ◄── Model               │                              │
└──────────────┘                └──────────────────────────────┘
```

**Frontend → Backend:** `invoke("create_appointment", { data })` → Tauri serialisiert zu JSON → Rust deserialisiert → Command → Service → Repository → DB → Result → JSON → TypeScript

**Typsicherheit:** Shared types über `specta` (Rust → TypeScript Codegen) oder manuell synchronisierte Interfaces.

## 6. Sicherheitsarchitektur

| Schicht | Maßnahme |
|---------|----------|
| **Datenbank** | SQLite (WAL); SQLCipher/Verschlüsselung ruhender DB-Datei (NFA-SEC-08) **outstanding** |
| **Authentifizierung** | Argon2id (+ bcrypt-Fallback für Legacy), JWT mit lokaler Signatur |
| **Autorisierung** | RBAC in Domain Layer, geprüft in jedem Command |
| **Audit** | Jede Schreiboperation wird in audit_log geschrieben |
| **Transport** | Kein Netzwerk – lokale IPC (keine HTTPS nötig) |
| **Backup** | Tägliche verschlüsselte Sicherung |
| **Input** | Validierung auf beiden Seiten (Zod + Rust-Structs) |

## 7. Datenbankschema

SQLite-Schema über eingebettete DDL/Migrationen im Rust-Backend (`connection.rs`); nicht identisch zum optionalen Prisma-Schema der Web-Referenz unter `src/`:

```sql
-- SQLite Schema (Auszug)
CREATE TABLE staff (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('PHYSICIAN','RECEPTION','TAX_ADVISOR','PHARMA_CONSULTANT')),
    activity_area TEXT,
    specialty TEXT,
    phone TEXT,
    available BOOLEAN NOT NULL DEFAULT 1,
    _created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('MALE','FEMALE','DIVERSE')),
    insurance_number TEXT NOT NULL UNIQUE,
    phone TEXT,
    email TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACTIVE','VALIDATED','READONLY')),
    _created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ... weitere Tabellen analog zum Prisma-Schema
```
