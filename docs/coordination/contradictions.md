# Contradiction ledger

**Last updated:** 2026-07-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |

## Workflow quality findings register (2026-07-26)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-2026-07-26-01 | Rust toolchain / workspace validation | Required Rust gates are blocked by toolchain incompatibility (`home v0.5.12` requires Cargo `edition2024`) so full backend validation is currently impossible in this environment. | `cargo clippy --workspace --all-targets -- -D warnings` and `cargo test --workspace --tests` both fail with `feature edition2024 is required` (Cargo 1.83.0). | **P1** | Upgrade Cargo/toolchain in CI/agent image, then rerun full Rust gate matrix. |
| WF-2026-07-26-02 | `apps/practice-host-ui/src/views/pages/{termine,leistungen,praxis-aufgabe-create,praxis-aufgabe-edit}.tsx` (+ others in lint output) | UI lint gate is red with React hooks compiler/dependency violations, including render-time ref mutation (`termine.tsx`) and memoization-preservation errors. | `npm run lint` reports `57 problems (19 errors, 38 warnings)`; hard errors include `react-hooks/refs` and `react-hooks/preserve-manual-memoization`. | **P1** | Create focused fix PRs per page cluster; enforce green lint before next quality sweep. |
| WF-2026-07-26-03 | Step 3 requirement coverage (component/page event matrix) | Coverage advanced (workflow adapter + route logger tests), but full “every UI component and page” event-matrix remains incomplete. | New tests added (`tauri-practice.adapter.test.ts`, `workflow-route-logger.test.tsx`) and smoke suites pass, but no exhaustive per-component/page matrix artifact yet. | **P2** | Generate component/page inventory and track matrix completion by file in next run. |
| WF-2026-07-26-04 | Step 5 requirement coverage (axe/WCAG full checklist) | Full `axe-core` compliance audit and full keyboard/dialog/toast/error-object checklist are not yet fully automated end-to-end. | **NOT RUN**: no dedicated `axe-core` suite in this run; only smoke + Playwright geometry snapshots were executed. | **P1** | Add dedicated accessibility suite (axe + keyboard/dialog assertions) and register violations. |
| WF-2026-07-26-05 | `apps/practice-host-ui/src/views/components/behandlung-akte-composer-panel.tsx` | Arbitrary Tailwind spacing token violated token-scale policy (`min-h-[72px]`). | New `lint-tailwind-token-scale.mjs` check detected violation; class changed to `min-h-20`, and `npm run lint:tailwind-scale` now passes. | **P2 (resolved)** | Closed in commit `47f8784`; keep lint in CI path. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
