# Contradiction ledger

**Last updated:** 2026-07-26

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |
| C10 | Responsive audit breakpoint policy vs desktop viewport contract | Step-4 audit requires snapshots at 375/768/1259 and checks overflow | CSS contract enforces `--app-viewport-min-width: 1024px`; `html, body, #root` and `.app` use that min-width (`apps/practice-host-ui/src/index.css`) causing expected overflow below 1024px | **Documented divergence** — Playwright audit now asserts overflow for viewports below configured min-width; product decision needed if true mobile support is required. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C9 | Removed hardcoded `REZEPTION + verwaltung* => deny` guard and switched route authorization to policy-only evaluation (`ROUTE_VISIBILITY` + generated RBAC matrix), then updated regression expectations for `verwaltung/lager-und-bestellwesen`, `verwaltung/vertraege`, `verwaltung/leistungen-kataloge-vorlagen` (and `verwaltung/bestellstamm`) | `packages/shared/src/lib/rbac.ts`, `packages/shared/src/lib/rbac.test.ts`; `npm run test -w medoc -- src/lib/rbac.test.ts` | 2026-07-26 |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
