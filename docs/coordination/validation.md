# Validation ledger

**Last updated:** 2026-04-19

## Verified (commands run, outcomes recorded)

| Check | Command | Result | Date | Notes |
| ----- | ------- | ------ | ---- | ----- |
| Frontend lint | `cd app && npm run lint` | **PASS** | 2026-04-19 | eslint src --max-warnings 0 |
| Frontend unit tests | `cd app && npm test` | **PASS** | 2026-04-19 | vitest run — 1 file |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-19 | tsc + vite |
| Rust tests | `cd app/src-tauri && cargo test --tests` | **PASS** | 2026-04-19 | Includes integration suites |
| Rust clippy (deny warnings) | `cd app/src-tauri && cargo clippy --all-targets -- -D warnings` | **PASS** | 2026-04-19 | Includes tests; `manual_contains` fixes in `db_migrations_tests.rs` |
| Next.js reference build | `cd src && npm run build` | **PASS** | 2026-04-19 | Run before CSP fixes; Next 16 |

## Pending / not yet run

| Check | Why pending | Blocker |
| ----- | ----------- | ------- |
| `tauri build` full bundle | Not run this session | Optional heavy check |
| E2E | NOT RUN | No runner invoked |

## Regressions / failed runs (do not delete; append)

| Check | Command | Failure summary | Date |
| ----- | ------- | ----------------- | ---- |
| — | — | — | — |
