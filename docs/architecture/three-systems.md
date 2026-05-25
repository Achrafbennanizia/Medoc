# MeDoc — three systems architecture

**Last updated:** 2026-05-21

## Systems

| # | System | Rust | FE module | Binary | Database |
|---|--------|------|-----------|--------|----------|
| 1 | **Practice Host** | `src-tauri/src/systems/practice/` | `app/src/systems/practice-host/` | `medoc` (Tauri) | `medoc.db` |
| 2 | **LAN** | `src-tauri/src/systems/lan/` | `app/src/systems/lan/` | `medoc-server` (+ embedded) | same `medoc.db` |
| 3 | **Company** | `src-tauri/src/systems/company/` | `app/src/systems/company-portal/` | `medoc-company-server` | `company.db` |

## Boundaries (SOLID)

- **Single Responsibility:** Each system owns one deployment concern (clinical host / LAN API / vendor portal).
- **Open/Closed:** New transports (HTTP LAN client) = new adapter implementing the same port.
- **Liskov:** `PracticeSystemPort`, `LanSystemPort`, `CompanySystemPort` are substitutable in tests.
- **Interface Segregation:** Ports expose only commands for that system.
- **Dependency Inversion:** UI → controllers → ports → adapters → transport.

## Data flow

```
React views
  → controllers (per system, under systems/*/controllers/)
  → adapters (Tauri today)
  → Rust: Practice IPC | LAN HTTP | Company HTTP
```

Legacy import path `app/src/controllers/*.ts` re-exports from `systems/*` (**Facade**).

## Goethe / Gang of Four — pattern map

| Pattern | Where |
|---------|--------|
| **Abstract Factory** | `LanSystemFactory::build_state` / `build_router` |
| **Adapter** | `TauriPracticeAdapter`, `TauriLanAdapter`, `TauriCompanyAdapter`, `CompanyPortalHttpAdapter` |
| **Bridge** | Ports decouple UI from Tauri vs future HTTP |
| **Builder** | SQL migrations / PDF layout builders (practice infrastructure) |
| **Chain of Responsibility** | Axum middleware: CORS → JWT → handler |
| **Command** | Tauri `#[tauri::command]` + controller functions |
| **Composite** | React page + tab components |
| **Decorator** | `tower_http` layers (timeout, body limit, CORS) |
| **Facade** | `systems/registry.ts`, `commands::register`, `LanSystemFactory` |
| **Factory Method** | `LanSystemFactory` |
| **Flyweight** | Generated enums / RBAC tables |
| **Interpreter** | Zod `parseOrThrow` at controller boundary |
| **Iterator** | Repo list queries / pagination |
| **Mediator** | Zustand stores (`auth-store`, UI prefs) |
| **Memento** | Termin drafts in `app_kv`, form-dirty store |
| **Observer** | Audit chain guard, Tauri event hooks |
| **Prototype** | Demo seed data (`company.db`, dev vertrag seed) |
| **Proxy** | LAN `/api/v1/company/*` → Company HTTP adapter; `HttpPracticeAdapter` → LAN `/api/v1/*` |
| **Factory** | `createPracticeSystem()` — Tauri IPC vs LAN HTTP (`practice-transport.ts`) |
| **Singleton** | `COMPANY_PORTAL`, `systems` registry, DB pool in Tauri state |
| **State** | Workflow transitions (`workflow_transitions.rs`) |
| **Strategy** | RBAC `allowed(perm, role)`, pricing rules |
| **Template Method** | Domain service + repo hooks |
| **Visitor** | *(reserved — export pipelines)* |
| **Repository** | `infrastructure/database/*_repo.rs` |
| **Service Layer** | `application/*`, `domain/services/*` |
| **Unit of Work** | `sqlx` transactions in command handlers |

## Related docs

- `docs/README-frontend.md` — UI data flow
- `docs/medoc-company-server.md` — company binary
- `app/src-tauri/src/systems/mod.rs` — Rust module index
