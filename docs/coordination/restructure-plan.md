# Workspace restructure plan — three-system independence

**Opened:** 2026-05-25
**Goal:** Make Practice / LAN / Company **independently runnable** (own binary, own dependency closure, own tests) and reshape the repo into a Cargo + npm workspace.
**Decision matrix (user, 2026-05-25):** `finish_systems` + `full_repo_restructure` + `commit_first`.
**Checkpoint commit:** `33171bd` — three-system wave 23 captured before restructure.

---

## Verified context (from evidence on disk at 33171bd)

| Fact | Evidence |
|------|----------|
| Frontend legacy `app/src/controllers/*.ts` are re-export shims | `app/src/controllers/akte.controller.ts` = `export * from "@/systems/practice-host/controllers/akte.controller.ts";` (and `auth.controller.ts` identical pattern) |
| Frontend new layout: `app/src/systems/{practice-host,lan,company-portal,shared,patterns}/` | `git ls-files app/src/systems/` |
| Rust legacy implementation lives in `application/`, `commands/`, `domain/`, `infrastructure/` | unchanged tree |
| Rust new `systems/{practice,lan,company}/` are **thin façades** (`pub use crate::application`, `pub use crate::infrastructure::lan_server`) | `app/src-tauri/src/systems/practice/mod.rs`, `lan/mod.rs`, `company/mod.rs` |
| Single Cargo crate `medoc`, two extra binaries | `app/src-tauri/Cargo.toml` lines 76–82 |
| Single npm package, no workspaces | `app/package.json` |
| Three-system architecture documented | `docs/architecture/three-systems.md` |
| Last full-stack PASS reported 2026-05-22 (wave 23) | `docs/coordination/phase-handoff.md` |

---

## Target layout (after Wave D)

```
Medoc/
├── apps/
│   ├── practice-host/                 (Tauri desktop binary `medoc`)
│   │   ├── Cargo.toml                 deps: medoc-core, medoc-practice, medoc-lan (embedded)
│   │   ├── src/main.rs                Tauri entry
│   │   ├── tauri.conf.json            (moved from app/src-tauri/)
│   │   ├── icons/, capabilities/
│   │   └── build.rs                   (rbac+enums codegen lives in medoc-codegen)
│   │
│   ├── lan-server/                    (headless `medoc-server` binary)
│   │   ├── Cargo.toml                 deps: medoc-core, medoc-lan
│   │   └── src/main.rs                (was app/src-tauri/src/bin/medoc-server.rs)
│   │
│   ├── company-server/                (headless `medoc-company-server` binary)
│   │   ├── Cargo.toml                 deps: medoc-core, medoc-company
│   │   └── src/main.rs                (was app/src-tauri/src/bin/medoc-company-server.rs)
│   │
│   ├── practice-host-ui/              (Tauri-bound React app for the desktop binary)
│   │   ├── package.json               deps: @medoc/shared, @medoc/ui, @tauri-apps/api
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/                       (was app/src/, minus shared/ and systems/lan|company-portal)
│   │
│   └── lan-web-client/                (pure browser client targeting LAN HTTPS)
│       ├── package.json               deps: @medoc/shared, @medoc/ui (NO @tauri-apps/api)
│       ├── vite.config.ts
│       └── src/                       reuses systems/practice-host but binds HttpPracticeAdapter
│
├── crates/
│   ├── medoc-core/                    (domain + shared infrastructure; no Tauri, no axum)
│   │   └── src/
│   │       ├── domain/                (was app/src-tauri/src/domain/)
│   │       ├── application/           (was app/src-tauri/src/application/, minus Tauri-only)
│   │       ├── infrastructure/
│   │       │   ├── crypto/, database/, logging/, dsgvo, pdf*, backup, …
│   │       │   └── (NO lan_server, NO company_host, NO Tauri plugin code)
│   │       └── error.rs
│   │
│   ├── medoc-practice/                (Tauri IPC surface; depends on medoc-core + tauri)
│   │   └── src/commands/              (was app/src-tauri/src/commands/, except lan_commands & company_portal_commands)
│   │
│   ├── medoc-lan/                     (axum HTTPS server, TLS, discovery; depends on medoc-core)
│   │   └── src/
│   │       ├── http.rs, tls.rs, discovery.rs, cors_policy.rs
│   │       └── facade.rs              (LanSystemFactory)
│   │
│   ├── medoc-company/                 (axum portal server; depends on medoc-core)
│   │   └── src/
│   │       ├── http.rs, api_key.rs, db.rs
│   │       └── facade.rs
│   │
│   └── medoc-codegen/                 (build-time codegen: rbac.yaml, enums.yaml)
│       └── src/lib.rs                 (was app/src-tauri/build/, callable from build.rs)
│
├── packages/
│   ├── medoc-shared/                  (TS: schemas, generated rbac.ts, generated enums.ts, types, i18n)
│   │   ├── package.json
│   │   └── src/                       (lifted from app/src/lib/{schemas, rbac.generated, …} + app/src/models/types)
│   │
│   ├── medoc-ui/                      (TS: shared React design-system components)
│   │   └── src/                       (lifted from app/src/views/components/* that are presentational only)
│   │
│   ├── medoc-system-practice/         (TS: practice-host controllers + ports + adapters + pages)
│   │   └── src/                       (was app/src/systems/practice-host/)
│   │
│   ├── medoc-system-lan/              (TS: lan controllers + pages + adapter)
│   │   └── src/                       (was app/src/systems/lan/)
│   │
│   └── medoc-system-company/          (TS: company-portal controllers + pages + adapter)
│       └── src/                       (was app/src/systems/company-portal/)
│
├── tools/                             (was scripts/)
├── config/                            (unchanged: rbac.yaml, enums.yaml, …)
├── docs/                              (unchanged + coordination ledgers)
├── releases/                          (unchanged)
├── third_party/                       (unchanged)
├── .github/workflows/                 (CI updated to drive workspaces)
├── Cargo.toml                         (Cargo workspace root)
├── package.json                       (npm workspace root)
├── AGENTS.md, README.md, LICENSE
└── ...
```

### Dependency graph

```
practice-host (binary)  → medoc-practice → medoc-core
                        ↘ medoc-lan ─────↗

lan-server (binary)     → medoc-lan ─────→ medoc-core

company-server (binary) → medoc-company ─→ medoc-core
```

```
practice-host-ui (Vite) → medoc-system-{practice,lan,company} → medoc-shared, medoc-ui
                                                                          ↑
lan-web-client (Vite)   → medoc-system-practice (HTTP adapter) ───────────┘
```

**No cycles. Each binary's dependency closure is closed under "only what it needs".**

---

## Waves

### Wave A — Frontend duplicate cleanup *(start here)*

**Scope:** Inside `app/`, no root restructure yet. Pure cleanup of the in-flight migration.

1. Replace re-export shims at `app/src/controllers/*.ts` with hard removal. Update every import (`@/controllers/*` → `@/systems/practice-host/controllers/*` or LAN / company-portal where appropriate).
2. Remove pages from `app/src/views/pages/` that are now under `app/src/systems/*/pages/`. Update routes in `app/src/App.tsx` / router config.
3. Make sure `app/src/lib/*` items that already exist under `app/src/systems/lan/lib/` or `app/src/systems/practice-host/pages/...` are not duplicated. (E.g. `app/src/lib/lan-client-config.ts` vs `app/src/systems/lan/lib/lan-client-config.ts`.)
4. Validation: `npm run lint && npm test && npm run build`. Target: green, no regressed test count vs. `phase-handoff.md` (151 vitest as of 2026-05-22).
5. Commit: `refactor(systems): drop legacy controller/page shims; single source under app/src/systems/*`.

**Estimated edits:** ~50–80 files (delete shims + 1–3 imports rewrites per consumer).
**Risk:** low. Re-exports remove cleanly; lint will catch broken imports.

### Wave B — Rust split into Cargo workspace under `crates/`

**Scope:** Still inside `app/` for now; add Cargo workspace at `app/Cargo.toml`. Defer repo-root move to Wave D.

1. Create `app/Cargo.toml` with `[workspace] members = ["src-tauri", "crates/*"]`.
2. Create `app/crates/medoc-core/` and lift `domain/`, `application/` (minus Tauri-aware bits), `infrastructure/` (minus `lan_server`, `company_host`).
3. Create `app/crates/medoc-lan/` from `infrastructure/lan_server/` + `systems/lan/facade.rs`.
4. Create `app/crates/medoc-company/` from `infrastructure/company_host/` + `systems/company/`.
5. Create `app/crates/medoc-practice/` from `commands/` (minus lan/company commands which migrate up into binaries or stay in lan/company crates).
6. Create `app/crates/medoc-codegen/` from `app/src-tauri/build/`.
7. `app/src-tauri/Cargo.toml` becomes the **practice-host binary crate**; its `[lib]` is removed, `main.rs` depends on the new crates. The two extra binaries `medoc-server` and `medoc-company-server` move to `app/src-tauri/src/bin/` (unchanged path, but their dep set shrinks to just `medoc-core + medoc-lan` / `medoc-core + medoc-company`).
8. Re-path every `use crate::*` → `use medoc_core::*` / `use medoc_lan::*` etc. (This is the expensive step. ~150 files.)
9. Validation: `cargo build --workspace`, `cargo test --workspace`, `cargo clippy --workspace -D warnings`, `cargo fmt --check`. Verify each binary builds in isolation: `cargo build -p medoc-server --no-default-features` mock test.
10. Commit: `refactor(rust): split medoc into Cargo workspace (medoc-{core,practice,lan,company,codegen})`.

**Estimated edits:** ~200–300 files (move + import re-path). **Risk:** high — touches every Rust file. Plan: do imports with sed-style replacements but verify each crate compiles before moving the next.

### Wave C — Frontend split into npm workspace under `packages/`

1. Add `app/package.json` `"workspaces": ["packages/*", "src"]` or move the React app into `app/apps/practice-host-ui/`.
2. Create `app/packages/medoc-shared/` (schemas, generated rbac/enums TS, types, i18n).
3. Create `app/packages/medoc-system-{practice,lan,company}/` by moving `app/src/systems/*`.
4. Create `app/packages/medoc-ui/` optionally for presentational React components.
5. Update Vite alias config; re-path `@/systems/*`, `@/lib/*`, `@/models/*` to `@medoc/*` packages.
6. Validation: `npm run lint && npm test && npm run build`.
7. Commit: `refactor(frontend): split app/src into npm workspace packages`.

**Estimated edits:** ~300+ TS/TSX files (import path changes). **Risk:** moderate. eslint + tsc catch breaks fast.

### Wave D — Repo-root restructure

1. Move `app/src-tauri/` → `apps/practice-host/` (the Tauri binary crate).
2. Move `app/src-tauri/src/bin/medoc-server.rs` → `apps/lan-server/src/main.rs` (own Cargo.toml).
3. Move `app/src-tauri/src/bin/medoc-company-server.rs` → `apps/company-server/src/main.rs` (own Cargo.toml).
4. Move `app/src/` → `apps/practice-host-ui/src/`.
5. Move `app/packages/*` → repo-root `packages/*`.
6. Move `app/crates/*` → repo-root `crates/*`.
7. New root `Cargo.toml` (workspace) and root `package.json` (workspace).
8. Update CI (`.github/workflows/ci.yml`), `README.md`, `AGENTS.md`, `docs/architecture/three-systems.md` paths.
9. Validation: full matrix (cargo + npm) at repo root.
10. Commit: `refactor(repo): restructure root into apps/ crates/ packages/ workspaces`.

**Risk:** moderate-high — CI, scripts, releases all reference `app/` paths. Plan: grep for `app/src-tauri`, `app/src/`, update each occurrence.

---

## Validation cadence

After **every** wave:

| Command | Must pass |
|---------|-----------|
| `cargo fmt --check` | yes |
| `cargo clippy --workspace --all-targets -- -D warnings` | yes |
| `cargo test --workspace` | yes (no test count regression vs. phase-handoff.md) |
| `npm run lint` | yes |
| `npm test` | yes (≥151 tests as of wave 23) |
| `npm run build` | yes |
| `cargo build -p <each-binary>` in isolation | yes (proves independence) |

If any fails, stop, revert that wave's commit, fix, recommit.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Rust crate split breaks `use crate::*` in 200+ files | Do per-crate; compile after each crate is lifted before lifting the next |
| Vite/TypeScript path aliases drift | Keep `tsconfig.paths.json` in sync at every wave; `npm run lint` enforces |
| Tauri's `tauri.conf.json` references paths (`frontendDist`, `devUrl`) | Update at Wave D when binary moves; verify `npm run tauri build --debug --no-bundle` in CI smoke job |
| `build.rs` codegen path references (`config/rbac.yaml`, `OUT_DIR`) | `medoc-codegen` crate exposes function; binary's `build.rs` calls it with explicit paths |
| Repo consumers (CI, scripts/, releases/) reference old paths | grep + update at Wave D; CI must stay green |
| Mid-restructure rollback | Each wave is one commit; `git revert <wave-sha>` restores |
| User asks to pause | Each wave's commit is independent; safe to stop after any wave |

---

## Continuity (per AGENTS.md master command)

After each wave, update:

- `docs/coordination/project-truth.md` — new layout facts
- `docs/coordination/validation.md` — commands + outputs
- `docs/coordination/actions.md` — Now / Next / Done
- `docs/coordination/phase-handoff.md` — verified / unverified / understanding delta / next steps
- `docs/coordination/contradictions.md` — only if any tension appears (e.g. AGENTS.md vs. new layout)
