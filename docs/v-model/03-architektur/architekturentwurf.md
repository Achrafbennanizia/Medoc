# Phase 3: Architekturentwurf

> **Kanonische Desktop-Implementierung:** Das in CI gebaute Produkt liegt unter **`app/`** (Tauri 2 + React + Vite, Rust-Backend). Verbindlicher Architekturüberblick: **`docs/architecture/architecture-design.md`**.  
> **Historisch / separater Prototyp:** Das untenstehende Verzeichnis **`src/`** (Next.js App Router, Prisma, PostgreSQL) beschreibt einen **älteren Web-Prototyp** — nicht den aktuellen Tauri-Stand. Nutzung nur für Vergleich oder Migration; Traceability zur Abnahme bitte gegen **`app/`** und das Pflichtenheft.

## 0. Geräteverbund & „kein öffentliches Netz“

Die Anforderung „nicht über öffentliche Netze erreichbar“ wird für den **Geräteverbund** technisch durch den **Private-Bind-Guard** umgesetzt (`medoc-sync/src/net/bind_guard.rs`): der TCP-Listener (Port 49300) bindet nur an RFC1918-, Link-Local- und ULA-Adressen. Globale Routable-Binds werden abgelehnt. mDNS-Metadaten enthalten keine Patientendaten. Vollständige Spezifikation: [`feature-geraeteverbund.md`](feature-geraeteverbund.md).

**Hybrid-Netz (Pflichtenheft NFA-NET-04/05):** Desktop-Instanzen koppeln per **Noise** (:49300). Browser-Rezeption nutzt weiterhin **`medoc-lan` HTTPS** (:8787) — kein Noise im Browser. Migration betrifft nur **HTTP-Pairing-Endpunkte**, nicht den Web-UI-Host.

---

## 1. Projektstruktur

```
medoc/
├── docs/                          # V-Modell Dokumentation
│   └── version-model/
│       ├── 00-uebersicht.md       # Kanonischer Stack + Implementierungspfad
│       ├── 01-anforderungen/
│       ├── 02-systementwurf/
│       ├── 03-architektur/        ← dieses Dokument
│       └── …
│
├── app/                           # **Tauri-Desktop (kanonisches Produkt, CI)**
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx                # react-router-dom
│   │   ├── main.tsx
│   │   ├── controllers/          # IPC-Orchestrierung → services/tauri.service
│   │   ├── models/                # Types, Zustand (auth-store)
│   │   ├── services/
│   │   │   └── tauri.service.ts   # invoke-Wrapper
│   │   ├── views/
│   │   │   ├── layouts/           # App-Shell + Navigation
│   │   │   ├── pages/
│   │   │   └── components/
│   │   └── lib/
│   │       ├── rbac.ts            # Navigation: Matrix spiegelt application/rbac.rs
│   │       ├── i18n.ts
│   │       └── utils.ts
│   └── src-tauri/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs             # Tauri Builder + invoke_handler
│           ├── commands/           # #[tauri::command] IPC-Endpunkte
│           ├── application/       # auth_service, rbac, break_glass
│           ├── domain/            # entities, repositories (Ports)
│           └── infrastructure/    # sqlx/SQLite, crypto, logging, …
│
├── src/                           # **Web-Referenz** (Next.js + Prisma) — nicht CI; siehe `src/README.md`
│   ├── app/
│   ├── prisma/
│   └── …
│
└── …
```

---

## 2. Datenbankschema (ER-Diagramm)

```
┌──────────────┐     1:n     ┌──────────────┐
│   Patient    │────────────▶│    Termin     │
│──────────────│             │──────────────│
│ id           │             │ id           │
│ name         │     1:1     │ date        │
│ date_of_birth │────────────▶│ time      │
│ sex   │  Patientenakte│ kind          │
│ versicherung │             │ status       │
│ kontakt      │             │ patientId    │
│ createdAt    │             │ arztId       │
└──────┬───────┘             └──────────────┘
       │
       │ 1:1
       ▼
┌──────────────┐     1:n     ┌──────────────┐
│Patientenakte │────────────▶│ Untersuchung │
│──────────────│             │──────────────│
│ id           │             │ chief_complaint  │
│ patientId    │     1:n     │ results   │
│ status       │────────────▶│ diagnosis     │
│ validiert    │  Behandlung │ bildmaterial │
│ notes      │             └──────────────┘
└──────┬───────┘
       │
       │ 1:n              ┌──────────────┐
       ├────────────────▶│  Behandlung  │
       │                  │──────────────│
       │                  │ kind          │
       │                  │ verlauf      │
       │                  │ materialien  │
       │                  │ erfolg       │
       │                  └──────────────┘
       │
       │ 1:n              ┌──────────────┐
       └────────────────▶│   Zahlung    │
                          │──────────────│
                          │ amount       │
                          │ payment_method  │
                          │ status       │
                          └──────────────┘

┌──────────────┐             ┌──────────────┐
│   Personal   │             │   Leistung   │
│──────────────│             │──────────────│
│ id           │             │ id           │
│ name         │             │ name         │
│ role        │             │ category    │
│ email        │             │ price        │
│ available   │             └──────────────┘
└──────────────┘
                              ┌──────────────┐
┌──────────────┐             │   Produkt    │
│   AuditLog   │             │──────────────│
│──────────────│             │ name         │
│ id           │             │ supplier    │
│ userId       │             │ quantity        │
│ action       │             │ lieferstatus │
│ entity       │             └──────────────┘
│ entityId     │
│ timestamp    │
└──────────────┘
```

---

## 3. API-Design (Server Actions)

### Konvention
- Alle Datenoperationen über Next.js **Server Actions**
- Validierung via **Zod** Schemas am Server
- Autorisierung via **RBAC Middleware** pro Action
- Rückgabe: `{ success: boolean, data?: T, error?: string }`

### Beispiel-Signaturen

```typescript
// actions/appointments.ts
"use server"
export async function createTermin(data: TerminFormData): ActionResult<Termin>
export async function updateTermin(id: string, data: Partial<TerminFormData>): ActionResult<Termin>
export async function deleteTermin(id: string): ActionResult<void>
export async function getTermine(filter: TerminFilter): ActionResult<Termin[]>
export async function blockZeit(data: BlockZeitData): ActionResult<void>

// actions/patients.ts
"use server"
export async function createPatient(data: PatientFormData): ActionResult<Patient>
export async function updatePatient(id: string, data: Partial<PatientFormData>): ActionResult<Patient>
export async function searchPatienten(query: string): ActionResult<Patient[]>
export async function getPatientMitAkte(id: string): ActionResult<PatientMitAkte>
```

---

## 4. Sicherheitsarchitektur

### 4.1 Authentifizierung
```
Login → NextAuth.js (Credentials Provider)
     → bcrypt Passwortvergleich
     → JWT Session Token
     → Middleware prüft Token auf jeder Route
```

### 4.2 Autorisierung (RBAC)
```typescript
// Middleware-Kette pro Server Action:
1. Session prüfen (auth)
2. Rolle extrahieren (session.user.role)
3. Berechtigung prüfen (rbac.canAccess(role, resource, action))
4. Audit-Log schreiben
5. Aktion ausführen
```

### 4.3 Datenvalidierung
```
Client (React Hook Form) → Zod Schema (Client-Validierung)
                         → Server Action → Zod Schema (Server-Validierung)
                         → Prisma (DB-Constraints)
```

---

## 5. Integrationstestkriterien (→ Phase 8)

| Test-ID | Module | Beschreibung |
|---------|--------|-------------|
| IT-01 | Auth + RBAC | Login → Dashboard → rollenbasierter Zugriff |
| IT-02 | Termin + Patient | Termin anlegen → automatische Aktenverknüpfung |
| IT-03 | Behandlung + Akte | Behandlung dokumentieren → in Akte gespeichert |
| IT-04 | Behandlung + Zahnschema | Behandlung → Zahn aktualisiert |
| IT-05 | Zahlung + Bilanz | Zahlung erfassen → in Bilanz reflektiert |
| IT-06 | Leistung + Behandlung + Zahlung | Leistungszuordnung → korrekte Abrechnung |
| IT-07 | PDF-Export + Finanzen | Finanzdaten → korrektes PDF |
| IT-08 | Audit + alle Module | Jede Aktion → Audit-Log Eintrag |
