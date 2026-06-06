# MeDoc packages (TypeScript)

Tiered npm workspaces mirroring `crates/`:

```
packages/
├── shared/              @medoc/shared — lib, models, generated enums/rbac
├── ui/                  @medoc/ui — design-system components
├── app/
│   └── practice-host/   @medoc/system-practice — Tauri IPC controllers + pages
└── server/
    ├── lan/             @medoc/system-lan — LAN client UI (no Tauri)
    └── company/         @medoc/system-company — company portal UI (no Tauri)
```

## App shell (`src/`)

The Tauri-bound desktop shell stays in `src/`:

- `App.tsx`, routing, `views/pages`, `views/layouts`
- `systems/registry.ts` — wires the three backends
- `systems/lan/adapters/`, `systems/company-portal/adapters/` — Tauri IPC bridges
- `systems/shared/transport/tauri-transport.ts`

## Path aliases

Legacy `@/lib/*`, `@/systems/practice-host/*`, etc. resolve into packages via `vite.config.ts` and `tsconfig.json` — existing imports keep working.

New code may use `@medoc/shared/*`, `@medoc/system-practice/*`, …

## Isolation

```bash
./scripts/validate-fe-three-systems.sh   # no @tauri-apps in server/shared packages
npm test
```

See also `crates/README.md` for Rust tier layout.
