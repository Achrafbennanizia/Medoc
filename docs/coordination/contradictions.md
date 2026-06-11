# Contradiction ledger

**Last updated:** 2026-06-11

## Workflow QA register (2026-06-11 cron run)

| ID | Location | Finding | Evidence | Severity | Action | Status |
| -- | -------- | ------- | -------- | -------- | ------ | ------ |
| WQ-001 | Rust workspace validation (`libsqlite3-sys` / SQLCipher toolchain) | Required Rust validation gates are blocked on this runner because SQLCipher compilation cannot find `openssl/crypto.h`. | `cargo +stable clippy --workspace --all-targets -- -D warnings` and `cargo +stable test --workspace --tests` both fail with `fatal error: 'openssl/crypto.h' file not found`. | **P1** | Escalate runner image dependency (`libssl-dev` headers) for SQLCipher builds; keep this run’s Rust status as blocked. | **OPEN** |
| WQ-002 | `crates/shared/medoc-core/src/infrastructure/logging/*`, `crates/app/medoc-practice/src/commands/system/logging.rs`, `apps/practice-host-ui/src/services/*` | Workflow telemetry path was missing (no dedicated workflow channel + no frontend→backend bridge). | Code inspection before edits: no `medoc::workflow` target and no `record_workflow_event` IPC command; now added and registered. | **P1** | Added `workflow.log` channel, sanitized `record_workflow_event` command, route logger, and centralized command lifecycle logging in `tauri.service.ts`. | **FIXED** |
| WQ-003 | `packages/ui/src/toast-store.ts`, `apps/practice-host-ui/src/index.css` | Toast defaults violated requested UX policy (error timeout too long; stack anchored top-right). | Pre-fix values: error `6000ms` and `.toast-stack { top: ... }`. | **P2** | Set error default to `5000ms`, support persistent toasts (`durationMs=0`), and move stack anchor to bottom-right. | **FIXED** |
| WQ-004 | `apps/practice-host-ui/src/views/components/behandlung-akte-composer-panel.tsx` | Arbitrary Tailwind spacing value bypassed token scale (`min-h-[72px]`). | `rg '(...)-\\[[^\\]]+\\]' apps/practice-host-ui/src` hit `min-h-[72px]` in behandlung composer panel. | **P2** | Replaced with tokenized `min-h-18`, added Tailwind spacing token `18=4.5rem`, and added static lint script (`lint-tailwind-arbitrary-spacing.mjs`). | **FIXED** |
| WQ-005 | `apps/practice-host-ui/e2e-playwright/ui-geometry.spec.ts` + `public/geometry-probe.html` | No browser geometry regression audit existed for responsive breakpoints. | New Playwright run (`MEDOC_UI_GEOMETRY=1 ... ui-geometry.spec.ts`) now executes 3 breakpoint checks with screenshots. | **P3** | Added probe page + Playwright geometry assertions at `375/768/1259` and responsive screenshot capture. | **FIXED** |
| WQ-006 | Frontend lint gate (`react-hooks/preserve-manual-memoization`) | Workspace lint gate is red due pre-existing React Compiler memoization findings in Praxis-Aufgabe UI files. | `npm run lint` fails in `praxis-aufgabe-admin-panel.tsx`, `praxis-aufgabe-inbox-panel.tsx`, `praxis-aufgabe-create.tsx`, `praxis-aufgabe-edit.tsx` with `Compilation Skipped: Existing memoization could not be preserved`. | **P2** | Keep this run’s frontend lint state as blocked; schedule focused follow-up to remove or correct unstable `useCallback` dependency lists in those pages. | **OPEN** |

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
