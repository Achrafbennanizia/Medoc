# Retired path index

**Purpose:** Quarantine banner for docs that still cite the legacy `app/src-tauri` / `app/src` layout.  
**Canonical layout:** [`project-truth.md`](project-truth.md) — `apps/`, `crates/`, `packages/` at repo root.

Do **not** bulk-update these files during refactor passes (see [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md) §2.8). Update only when a specific change makes a doc wrong.

## Build / CI — clean

No stale paths in:

- `.github/workflows/ci.yml`
- Root `Cargo.toml`, `package.json`
- `scripts/`, `docker/`, `tools/`

Legacy `app/` is README-only ([`app/README.md`](../../app/README.md)).

## Docs with stale `app/src-tauri` or `app/src` references

| File | Notes |
| ---- | ----- |
| `docs/architecture/architecture-design.md` | Directory trees §1–2 |
| `docs/architecture/three-systems.md` | Old systems paths |
| `docs/architecture/deployment-topologies.md` | `cd app` examples |
| `docs/version-model/00-uebersicht.md` | Stack table |
| `docs/version-model/01-anforderungen/pflichtenheft.md` | Historical evidence paths |
| `docs/version-model/04-modulentwurf/modulentwurf.md` | Module paths |
| `docs/version-model/07-systemtest/README.md` | Test paths |
| `docs/version-model/08-integrationstest/README.md` | Test paths |
| `docs/version-model/09-modultest/README.md` | Test paths |
| `docs/requirements-engineering/01b-traceability-waad.md` | Traceability paths |
| `docs/coordination/validation.md` | Historical command logs |
| `docs/coordination/phase-handoff.md` | Migration narrative |
| `docs/coordination/restructure-plan.md` | Historical |
| `docs/coordination/rust-restructure-plan.md` | Historical |
| `docs/coordination/wave-b-crate-mapping.md` | Historical |
| `docs/coordination/wave-c-package-mapping.md` | Historical |
| `docs/medoc-company-server.md` | `cd app/src-tauri` |
| `docs/README-frontend.md` | Old FE paths |
| `docs/rbac-matrix.md` | Old paths |
| `docs/page-layout-standard.md` | Old paths |
| `docs/responsive-audit.md` | Old paths |
| `docs/audit-2026-05.md` | Historical |
| `docs/audit-2026-05-followup.md` | Historical |
| `docs/iso-standards/08-anforderungen-iso-mapping.md` | Evidence paths |
| `docs/iso-standards/09-soup-liste.md` | Evidence paths |
| `docs/ui/wireframe-route-map.md` | Old paths |
| `docs/uml/08-arzt-rezeption-kollaboration.md` | Old paths |
| `docs/uml/10-master-feature-workflow-audit.md` | Old paths |

## Source comments (non-functional)

Codegen / generated headers may cite `app/src/lib/` while output targets `packages/shared/src/lib/`:

- `crates/shared/medoc-core/build.rs`
- `packages/shared/src/lib/list-params.ts`
- `packages/server/lan/src/controllers/lan-server.controller.ts`
- `packages/server/company/src/controllers/company-portal.controller.ts`

**Phase C action:** fix comments only (R-013).

## FE import canonical path

Prefer `@medoc/shared` / `packages/shared/src/` over symlink paths `apps/practice-host-ui/src/lib` (R-009).
