# Project truth ledger

**Last updated:** 2026-04-19  
**Scope:** Canonical statements supported by repository evidence.

## Stable truth (high confidence)

- **Desktop product identity:** Tauri app **MeDoc**, identifier `de.medoc.app`, version `0.1.0` (`app/src-tauri/tauri.conf.json`).
- **Desktop stack:** React 19 + Vite 6 + TypeScript frontend in `app/`; Rust **edition 2021** backend crate `medoc` with `sqlx` + SQLite (`app/package.json`, `app/src-tauri/Cargo.toml`).
- **Database (runtime):** SQLite file `medoc.db` via `sqlite:...?mode=rwc`, WAL journal — **plain SQLite connection options**, no SQLCipher pragma/key in code (`app/src-tauri/src/infrastructure/database/connection.rs` lines 12–22).
- **CI scope:** `.github/workflows/ci.yml` — Rust (`app/src-tauri`): fmt, check, test, clippy, cargo-audit; desktop frontend (`app`): npm audit, lint, vitest, build; Next reference (`src`): lint + build with env placeholders.
- **VVT export (runtime text):** Generated VVT lists SQLite WAL and **explicitly** states DB file currently without SQLCipher plus planned SQLCipher (`app/src-tauri/src/infrastructure/vvt.rs`).
- **Tauri security:** Content Security Policy set with separate **`devCsp`** for Vite (`localhost` / `127.0.0.1:1420` + websocket) and production **`csp`** without invalid `localhost:*` wildcards (`app/src-tauri/tauri.conf.json`).
- **Validation (fix session):** `npm run lint`, `npm test`, `npm run build` (app/) **passed**; `cargo test --tests` (app/src-tauri) **passed** (`docs/coordination/validation.md`).
- **Second application tree:** Next.js + Prisma under `src/` (`src/package.json`); covered by CI job `next-web`.

## Working model (needs confirmation)

- **Relationship desktop vs Next.js:** Whether `src/` is primary web channel, prototype, or deprecated — **UNVERIFIED** (architecture doc §7 mentions optional Prisma reference).
- **SQLCipher implementation:** Planned for NFA-SEC-08; **not** present in `connection.rs` yet — open item **C1b** (`docs/coordination/contradictions.md`).

## Evidence index

| Claim | Evidence | Date |
| ----- | -------- | ---- |
| Tauri + versions | `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| SQLite not SQLCipher in connector | `app/src-tauri/src/infrastructure/database/connection.rs` | 2026-04-19 |
| Frontend routes | `app/src/App.tsx` | 2026-04-19 |
| CI commands | `.github/workflows/ci.yml` | 2026-04-19 |
| Build + tests pass | Terminal: `npm run build`, `cargo test --tests` | 2026-04-19 |
| Next.js subtree | `src/package.json` | 2026-04-19 |
