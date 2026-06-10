# Deferred roles — STEUERBERATER & PHARMABERATER (TODO)

**Status:** Commented out / disabled in runtime (2026-06-10).  
**Active roles:** `ARZT`, `REZEPTION` only.

## Re-enable checklist

1. **`config/rbac.yaml`** — uncomment `STEUERBERATER` / `PHARMABERATER` in `roles`, restore `role_sets` (`finanzen_staff`, `inventory_write`, `everyone`) and permission lists (`finanzen.read`, `verwaltung.read`, `finanzen.tagesabschluss.write`, `aufgabe.status.admin`). Run `cargo build` to regenerate `rbac.generated.ts`.
2. **`packages/shared/src/lib/deferred-roles.ts`** — set `DEFERRED_ROLES_ENABLED = true` or remove module; restore `parseRole` / nav entries in `rbac.ts`.
3. **`crates/shared/medoc-core/src/domain/rbac.rs`** — remove `is_deferred_role_wire` guard from `Role::parse` / `is_login_allowed`.
4. **`crates/app/medoc-practice/src/commands/admin/auth.rs`** — remove post-login deferred-role rejection.
5. **`apps/practice-host-ui/src/views/pages/personal.tsx`** — uncomment `STEUERBERATER` / `PHARMABERATER` in `ROLLE_OPTIONS`.
6. **`packages/shared/src/lib/onboarding.ts`** — uncomment `STEUERBERATER` / `PHARMABERATER` coachmark routes.
7. **`packages/app/practice-host/src/pages/einstellungen/einstellungen-konto-section.tsx`** — restore role badge copy.
8. **`crates/.../migrations/seed.rs`** — uncomment demo users `seed-ctl-001` / `seed-pharma-001`.
9. **Tests** — re-enable skipped blocks in `rbac.test.ts`, `rbac_tests.rs`, `onboarding.test.ts`, `native-go-menu.test.ts`.
10. **Docs** — update `docs/rbac-matrix.md`, Pflichtenheft role matrix, onboarding copy.

## Not in scope (keep as-is)

- **`PharmaberaterStamm`** — Bestellstamm *contact* entity (“Pharmaberater / Kontakt”), not the login role.
- **`config/enums.yaml` `Rolle` variants** — kept for SQLite `CHECK` + existing rows; only login/UI/RBAC gated off.

## Evidence

- Gate module: `packages/shared/src/lib/deferred-roles.ts`
- RBAC matrix: `config/rbac.yaml`
- Login block: `crates/app/medoc-practice/src/commands/admin/auth.rs`
