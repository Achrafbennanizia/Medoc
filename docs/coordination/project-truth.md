# Project truth ledger

**Last updated:** 2026-04-25  
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

## WAAD requirements intake (2026-04-25)

- **Source artifact:** `docs/requirements-engineering/source/anforderungen-ableitung-waad.pdf`
  („Anforderungen – Ableitung der Anforderungen"), copied verbatim into the repo.
- **Verbatim transcript:** `docs/requirements-engineering/01a-waad-anforderungen.md` (39 IDs across
  9 categories, each with classification MUST / SHOULD / NICE TO HAVE).
- **Traceability matrix:** `docs/requirements-engineering/01b-traceability-waad.md` maps every
  WAAD-ID onto one or more `FA-*` / `NFA-*` IDs in `docs/v-model/01-anforderungen/pflichtenheft.md`,
  with status (COVERED / PARTIAL / NEW-PH / ORG) and code evidence (file + line / `rg` query).
- **New Pflichtenheft IDs derived from WAAD:** `FA-AKTE-14` (Akte-an-Arzt-Weiterleitung),
  `FA-AKTE-15` (Validierungs-Queue-Page), `FA-AKTE-16` (Vollständigkeits-Indikator),
  `FA-DOK-08` (Discharge Summary PDF), `FA-LEIST-05` (Arzt-Freigabe pro Leistung),
  `FA-PERS-07` (Permission Overrides), `FA-PERS-08` (Personal Ticket-System),
  `NFA-USE-09` (per-route Onboarding-Walkthrough), `NFA-USE-10` (Konfigurierbares Autocomplete).
- **Implementation status of new IDs:** All listed in `docs/coordination/actions.md` (A2–A10) as
  "Open" — code evidence sweep performed (`docs/coordination/validation.md` §"WAAD intake — code-evidence audit"),
  none of these IDs has runnable code yet.
- **Counts after intake:** FA = 83 (from 76), NFA = 18 (from 16) — see `02-klassifizierung.md`.

## Evidence index

| Claim | Evidence | Date |
| ----- | -------- | ---- |
| Tauri + versions | `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| SQLite not SQLCipher in connector | `app/src-tauri/src/infrastructure/database/connection.rs` | 2026-04-19 |
| Frontend routes | `app/src/App.tsx` | 2026-04-19 |
| CI commands | `.github/workflows/ci.yml` | 2026-04-19 |
| Build + tests pass | Terminal: `npm run build`, `cargo test --tests` | 2026-04-19 |
| Next.js subtree | `src/package.json` | 2026-04-19 |
| WAAD intake | `docs/requirements-engineering/01a-waad-anforderungen.md`, `01b-traceability-waad.md`, `source/anforderungen-ableitung-waad.pdf` | 2026-04-25 |
| WAAD-Pflichtenheft delta | `docs/v-model/01-anforderungen/pflichtenheft.md` (FA-AKTE-14..16, FA-DOK-08, FA-LEIST-05, FA-PERS-07/08, NFA-USE-09/10) | 2026-04-25 |
