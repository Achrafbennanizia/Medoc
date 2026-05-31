# Wave B — per-module crate mapping

**Opened:** 2026-05-25
**Status:** B1 (mapping) — done. B2/B3 — see end of document.
**Scope:** Maps every `.rs` file in `apps/practice-host/src/` to its target crate after the Cargo-workspace split. Evidence-backed via `Grep` / `Read` on tracked sources.

## Target crates

| Crate | Role | Tauri? | Axum? | Build script? |
|-------|------|--------|-------|---------------|
| `medoc-codegen` | Build-time RBAC + enums YAML → Rust + TS codegen | no | no | n/a (consumed via path-dep) |
| `medoc-core` | Domain entities/services + non-Tauri infrastructure | no | no | yes (calls `medoc-codegen` for enums; embeds RBAC matrix; vendor pubkey embed) |
| `medoc-lan` | LAN HTTPS server, TLS, discovery | no | yes | no |
| `medoc-company` | Vendor portal HTTPS server | no | yes | no |
| `medoc-practice` | Tauri IPC commands + Tauri-coupled infrastructure | yes | no (LAN/company embedded via medoc-{lan,company}) | no |
| **Binaries** | | | | |
| `apps/practice-host` (binary) | Tauri desktop entry; depends on `medoc-{core,practice,lan}` (LAN embedded) | yes | indirect | no |
| `apps/lan-server` (binary) | Headless LAN HTTPS; depends on `medoc-{core,lan}` | no | yes | no |
| `apps/company-server` (binary) | Headless company portal; depends on `medoc-{core,company}` | no | yes | no |

---

## Per-module assignments

### `domain/` → **`medoc-core`** (all 25 files)

Pure data types + 4 services. No Tauri, no HTTP, no FS.

**Caveat:** `domain/services/workflow_transitions.rs` has an inverted dependency `use crate::application::rbac::Role;` (`domain` → `application`). Two options for B2:
1. **Move `Role` enum into `domain/enums.rs`** (right answer — `Role` is a domain concept). `application/rbac.rs` keeps only the matrix lookup + Tauri-bound state functions.
2. **Move `workflow_transitions.rs` up into `application/`** (less clean — workflow rules are domain knowledge).

Recommended: option 1. Performed as part of B2 before lifting.

**Caveat:** `domain/enums.rs` line 8 has `include!(concat!(env!("OUT_DIR"), "/domain_enums_generated.rs"))`. After the move, `medoc-core/build.rs` must produce this file in `medoc-core`'s `OUT_DIR`.

### `error.rs` → **`medoc-core`** (`medoc_core::error::AppError`)

Used by ~120 files via `crate::error::AppError`. After lift, the most ergonomic compatibility option is `pub use medoc_core::error;` at `medoc-practice`'s crate root so `crate::error::AppError` keeps resolving — gives backward compatibility shim during B3-B7 staged lifts.

### `application/` → split

| File | Target | Reason / dependencies |
|------|--------|-----------------------|
| `application/akte/billing_release.rs` | **medoc-core** | uses `domain`, `infrastructure::database` only |
| `application/akte/clinical_line_persistence.rs` | **medoc-core** | uses `application::rbac::Role` (will resolve once Role moves to domain), `domain`, `infrastructure::database` |
| `application/akte/pdf_export.rs` | **medoc-core** | uses `application::{auth_service,rbac}`, `domain`, `infrastructure::{database,pdf}` |
| `application/akte/rezeption_redact.rs` | **medoc-core** | uses `application::rbac::Role`, `domain` |
| `application/app_kv_policy.rs` | **medoc-core** | leaf (no `use crate::*` visible — independent policy) |
| `application/audit_chain_guard.rs` | **medoc-core** | non-Tauri (verified separately if needed) |
| `application/auth_service.rs` | **medoc-core** | uses `infrastructure::{crypto,database::personal_repo,totp}`, `error` |
| `application/break_glass.rs` | **medoc-core** | local state machine |
| `application/own_profile.rs` | **medoc-core** | uses `domain`, `infrastructure::database::personal_repo`, `error` |
| `application/rbac.rs` | **split** | matrix lookup → **medoc-core** (it has `include!(rbac_generated.rs)`). Tauri-State helpers (`use tauri::State; use crate::commands::auth_commands::SessionState`) → **medoc-practice** as `practice::rbac::check_state_*`. |
| `application/termin_hint_fulfillment.rs` | **medoc-core** | `domain`, `infrastructure::database` |

### `infrastructure/` → split

#### medoc-core (non-Tauri, non-HTTP)
- `crypto/` (entire subdir)
- `database/` — **almost** entire subdir; **but** `connection.rs::init_db(app: &AppHandle)` is Tauri-bound. Surgically split:
  - `medoc-core/database/connection.rs` keeps `init_db_headless(&Path)` (already exists, used by headless servers).
  - `medoc-practice/database/connection_tauri.rs` adds `init_db(app: &AppHandle)` as a thin wrapper that resolves `app_data_dir()` and delegates.
- `logging/` — all 5 files (`brute_force.rs`, `config.rs`, `export.rs`, `mod.rs`, `sanitizer.rs`). Contains the `#[macro_export]` macros `log_security`, `log_system`, `log_device`, `log_migration`, `log_perf` — these become `medoc_core::log_*` and can be re-exported from `medoc-practice` for `crate::log_*` backward-compat.
- `backup.rs`, `clinical_pdf_layout.rs`, `clinical_text_format.rs`, `cors_policy.rs`, `dsfa.rs`, `dsgvo.rs`, `license.rs`, `migration.rs`, `notifications.rs`, `payment.rs`, `pdf.rs`, `pdf_core.rs`, `pdf_letterhead.rs`, `perf.rs`, `retention.rs`, `secret_store.rs`, `telematik.rs`, `totp.rs`, `update.rs`, `vvt.rs` — all non-Tauri.
- `infrastructure/license.rs` has `include!(concat!(env!("OUT_DIR"), "/pubkey.rs"))` — `medoc-core/build.rs` must produce `pubkey.rs` (consumes `MEDOC_VENDOR_PUBKEY` env).

#### medoc-lan
- `lan_server/` (entire subdir): `config.rs`, `discovery.rs`, `http.rs`, `jwt.rs`, `mod.rs`, `secrets.rs`, `tls.rs`.

#### medoc-company (server)
- `company_host/` (entire subdir): `api_key.rs`, `db.rs`, `http.rs`, `mod.rs`.

#### medoc-practice (Tauri/host-only)
- `company_portal/` (entire subdir — this is the **client** the practice host uses to talk to the company server): `client.rs`, `config.rs`, `mod.rs`.
- `devices/` (entire subdir — host OS integration: scanner, GDT, DICOM): `dicom.rs`, `gdt.rs`, `host_integration.rs`, `mod.rs`, `scanner.rs`.
- `app_menu.rs` — `tauri::Manager`.
- `photo_viewer_scan.rs` — host OS integration.

### `commands/` → **`medoc-practice`** (all 46 files)

Every file has `#[tauri::command]` and/or `tauri::State`. Includes the `#[macro_export] register_*_commands!()` family and `medoc_invoke_handler!()` in `register.rs`. Note: `commands/lan_commands.rs` calls into `medoc-lan`, `commands/company_portal_commands.rs` calls into `medoc-practice`'s `infrastructure::company_portal` client.

### `systems/` → split

| File | Target |
|------|--------|
| `systems/mod.rs` | **medoc-practice** (umbrella `pub use` of the others — useful for the Tauri binary; in headless binaries it's not needed) |
| `systems/practice/mod.rs` | **medoc-practice** (re-exports `crate::{application,domain,error,commands}` — most of these become `medoc_core::*` and `medoc_practice::commands`) |
| `systems/lan/mod.rs` | **medoc-lan** |
| `systems/lan/facade.rs` | **medoc-lan** (LanSystemFactory) |
| `systems/company/mod.rs` | **medoc-company** |
| `systems/company/port.rs` | **medoc-company** |
| `systems/company/adapter.rs` | **medoc-practice** (it's the *client-side* adapter the practice host uses; depends on `medoc-company`'s port definitions OR a shared interface in `medoc-core`) |

### `bin/` → binary crates

- `bin/medoc-server.rs` → `apps/lan-server/src/main.rs` (binary depending on `medoc-core` + `medoc-lan` only).
- `bin/medoc-company-server.rs` → `apps/company-server/src/main.rs` (binary depending on `medoc-core` + `medoc-company` only).

### `lib.rs`, `main.rs` → `apps/practice-host/`

- `main.rs` → `apps/practice-host/src/main.rs`.
- `lib.rs` becomes the wiring for `medoc::run()` (Tauri Builder + state + setup); depends on `medoc-{core,practice,lan}` (LAN embedded).

### `build/` → **`medoc-codegen` crate**

- `build/enums_codegen.rs` + `build/rbac_codegen.rs` → `crates/medoc-codegen/src/{enums,rbac}.rs`.
- `build.rs` callers (`medoc-core/build.rs`) add path-dep `[build-dependencies] medoc-codegen = { path = "../medoc-codegen" }` and call `medoc_codegen::enums::run(manifest_dir, out_dir, ts_out)` / `medoc_codegen::rbac::run(...)`.

---

## Dependency graph (post-split, no cycles)

```
                              ┌─────────────────┐
                              │  medoc-codegen  │  (build-dep only)
                              └────────┬────────┘
                                       ▼
                              ┌─────────────────┐
                              │   medoc-core    │  (build.rs uses codegen)
                              └─┬─────┬─────────┘
                                │     │     │
                ┌───────────────┘     │     └────────────┐
                ▼                     ▼                  ▼
         ┌────────────┐         ┌─────────────┐    ┌──────────────────┐
         │  medoc-lan │         │medoc-company│    │  medoc-practice  │
         └─────┬──────┘         └──────┬──────┘    └────────┬─────────┘
               │                       │                    │
               │                       │                    │
   ┌───────────┼───────────┐           │                    │
   ▼                       ▼           ▼                    ▼
┌──────────────────┐   ┌─────────────────┐  ┌─────────────────────┐
│ apps/lan-server  │   │apps/company-srv │  │ apps/practice-host  │
│ binary           │   │ binary          │  │ (Tauri binary,      │
│ deps: core+lan   │   │ deps: core+co.  │  │  embeds LAN)        │
└──────────────────┘   └─────────────────┘  │ deps: core+practice │
                                            │       +lan          │
                                            └─────────────────────┘
```

**Each binary's transitive deps:**
- `lan-server`  → `medoc-{core,lan}` only (no Tauri, no PDF? — verify; no devices, no company_host)
- `company-server` → `medoc-{core,company}` only (no Tauri, no LAN code, no devices)
- `practice-host` → `medoc-{core,practice,lan}` (Tauri + LAN embedded; practice depends on core for repos and on lan for the embedded server option)

---

## Known constraints (must be addressed in B2 BEFORE the moves)

1. **Inverted domain → application dependency.** `domain/services/workflow_transitions.rs:2` uses `crate::application::rbac::Role`. Fix: move `Role` enum to `domain/enums.rs` (or a new `domain/rbac.rs`); `application/rbac.rs` then re-uses it.
2. **Tauri leakage in `application/rbac.rs`.** `tauri::State` + `commands::auth_commands::SessionState` references. Fix: split into pure matrix (`medoc-core::rbac`) + Tauri-State helpers (`medoc-practice::rbac_state`).
3. **Tauri leakage in `infrastructure/database/connection.rs`.** Has `init_db(app: &AppHandle)`. Fix: keep `init_db_headless(&Path)` in core; move `init_db` to a `medoc-practice::database` shim.
4. **Crate-root macros.** `log_security`, `log_system`, `log_device`, `log_migration`, `log_perf` (`infrastructure/logging/mod.rs`) and all `register_*_commands!()` macros are `#[macro_export]`. They resolve at the crate root of whichever crate they're compiled into; once `medoc-core` owns them, consumers must `use medoc_core::log_system;` OR `medoc-practice` re-exports them. Plan: `medoc-practice/src/lib.rs` adds `pub use medoc_core::{log_security, log_system, log_device, log_migration, log_perf};` for backward compatibility during the transition.
5. **`OUT_DIR` includes in 3 files** (`domain/enums.rs`, `application/rbac.rs`, `infrastructure/license.rs`). All three move into `medoc-core`, so a single `medoc-core/build.rs` produces all three generated files.
6. **TS file generation from `build.rs`.** The current `build.rs` writes `apps/practice-host-ui/src/lib/rbac.generated.ts` and `apps/practice-host-ui/src/lib/enums.generated.ts`. The relative paths from `medoc-core/build.rs` will be `../../src/lib/` instead of `../src/lib/`. Path constants need updating.

---

## B3 minimal execution plan (this session)

User chose `do_b1_b3_now` with "Stop if anything won't build". Concrete B3 steps in priority order:

1. **B3.0** Add `app/Cargo.toml` workspace with members `["src-tauri"]`. Verify `cargo build --workspace` still works as a single-member workspace. (Pure no-op packaging step.)
2. **B3.1** Add empty `crates/medoc-codegen/Cargo.toml` + `src/lib.rs` (empty `pub fn placeholder() {}`). Add to workspace members. Verify build.
3. **B3.2** Add empty `crates/medoc-core/Cargo.toml` + `src/lib.rs` (`pub fn placeholder() {}`). Add to workspace members. Verify build.
4. **B3.3** STOP HERE.

This delivers the **workspace skeleton** without lifting any source code. Real lifts (B4+) require addressing all six known constraints above and are deferred to a follow-up session.

If B3.0–B3.3 fail, revert. No additional changes from this attempt.
