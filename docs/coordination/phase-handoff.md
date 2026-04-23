# Phase handoff (running state)

**Last phase label:** Maintenance — contradiction fixes + revalidation  
**Last closed:** 2026-04-19

## Verified (since last handoff)

- Repository layout unchanged in principle; **`app/`** = desktop, **`src/`** = Next reference; CI includes **`next-web`** (`.github/workflows/ci.yml`).
- **VVT** generator text distinguishes **current** SQLite (no SQLCipher) vs **planned** SQLCipher (`app/src-tauri/src/infrastructure/vvt.rs`).
- **Tauri CSP:** separate production `csp` and `devCsp` for Vite port 1420 (`app/src-tauri/tauri.conf.json`).
- **Validation:** `npm run lint`, `npm test`, `npm run build` in **`app/`** passed; **`cargo test --tests`** in **`app/src-tauri`** passed (`docs/coordination/validation.md`). Next **`src/`** build passed in same maintenance window.

## Remains unverified

- NFA-SEC-08 **implementation** (SQLCipher or alternative) — still absent in `connection.rs` (**C1b**).
- Full FA-* traceability; UI/a11y runtime (**NOT OBSERVED**).
- Long-term **`src/`** vs **`app/`** product story (**UNVERIFIED**).

## Project understanding — what changed

- **C1a, C2, C3, C4** closed per `docs/coordination/contradictions.md` (VVT honesty, architecture alignment, CI for Next, CSP).
- Open: **implementation** of at-rest DB encryption (**C1b**).

## Must happen next

1. When scheduled: **implement NFA-SEC-08** at-rest encryption and re-validate migrations + backups.
2. Document or decide **desktop vs Next** positioning for contributors.
3. Continue FA coverage / UX / a11y passes as separate workstreams.

## Continuity tokens (for search / agents)

- **Active branch / PR / ticket IDs:** _(not captured this session)_  
- **Blockers:** NFA-SEC-08 implementation scheduling (**C1b**)  
- **Files under active edit:** `docs/coordination/*`
