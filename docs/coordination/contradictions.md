# Contradiction ledger

**Last updated:** 2026-07-09

## Open contradictions

| ID | Topic | Source A | Source B | Impact | Resolution plan / owner |
| -- | ----- | -------- | -------- | ------ | ----------------------- |
| C1b | DB encryption (implementation) | NFA-SEC-08 / product goals | `connection.rs` + `sqlcipher.rs` — SQLCipher enabled 2026-05-19 | **Resolved** (TASK 1.5); see `sqlcipher_tests` |
| C5 | Activation-token RBAC scope | Plan ("activation-token allowed_actions on /sync/push|pull only") | `verify_activation_for_path` also accepts `/sync/status` + `/pairing/peers` | **Documented divergence** — broader allow-list documented in `serverless-sync.md`; matches frontend usage. |
| C6 | "Encrypt every microservice" | User request 2026-05-26 | Plan slice rejected literal interpretation as YAGNI; only license envelope + activation token are encrypted/signed | **Resolved by plan note** — see [`docs/architecture/licensing.md`](../architecture/licensing.md) "What was explicitly not built". |
| C7 | "Period" in license payload | User request 2026-05-26 | User chose `perpetual_device`; v2 schema stores `activated_at` only, no `expires_at` | **Resolved** — perpetual model documented in `licensing.md`. |
| C9 | Workflow instrumentation scope | Quality-run requirement: every Tauri command + application/service call + domain state transition logged | Current wiring logs frontend command lifecycle + backend invoke ingress/egress, but no explicit service/domain transition emit points (`workflow.rs` usage is command-scoped) | Gaps in traceability for mid-layer state transitions | Add explicit transition emitters at service/domain boundaries; keep sanitizer path mandatory. |
| C10 | Toast UX policy | Required policy: bottom-right toasts; success 3s, error 5s, action-required persistent | `toast-store.ts` sets error 6000ms; `index.css` anchors `.toast-stack` to `top` | Failing policy tests and inconsistent UX behavior | Align duration constants + CSS anchor; rerun `toast-policy.test.ts`. |
| C11 | Tokenized spacing discipline | Quality-run rule: no arbitrary Tailwind spacing values bypassing scale | `lint-tailwind-arbitrary-spacing.mjs` reports `min-h-[72px]` in `behandlung-akte-composer-panel.tsx` | Style drift outside design tokens | Replace arbitrary utility with approved spacing token or extend scale intentionally. |

## Resolved (recent)

| ID | Resolution | Evidence | Date closed |
| -- | ---------- | -------- | ----------- |
| C1a | VVT technical measures: first line states DB file **ohne SQLCipher**; second line **Geplant: SQLCipher** (no longer reads as if encryption were already in place) | `app/src-tauri/src/infrastructure/vvt.rs` `common_tech` | 2026-04-19 |
| C2 | Architecture markdown aligned with repo: `app/src/`, `app/src-tauri/src/`, stack table | `docs/architecture/architecture-design.md` §1–2; `app/package.json` | 2026-04-19 |
| C3 | CI includes Next.js app under `src/` | `.github/workflows/ci.yml` job `next-web` | **Resolved 2026-05-19** — job removed; no `src/package.json` in tree |
| C4 | Tauri CSP: production `csp` (no dev host wildcards); `devCsp` for Vite on port 1420 + IPC | `app/src-tauri/tauri.conf.json` | 2026-04-19 |
| C8 | Replica merge conflict policy | Product note: "update last when user connects, merge, then admin is connected" | **Product decision 2026-06-16 (codified 2026-06-29):** LWW by `updated_at`; push-then-pull transport; member push merged on master first; admin pull on replica uses `admin_pull` (admin wins missing timestamps). `last_seen_at` on push **and** pull. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
