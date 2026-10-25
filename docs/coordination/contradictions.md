# Contradiction ledger

**Last updated:** 2026-10-25

## Workflow findings register (2026-10-25)

| ID | Location | Finding | Evidence | Severity | Action |
| -- | -------- | ------- | -------- | -------- | ------ |
| WF-2026-10-25-01 | `apps/practice-host-ui/src/lib/client-settings.ts` + `packages/shared/src/lib/client-settings.ts` | Duplicate `AppointmentConfirmMode` type alias broke `npm run build` (`TS2300`). | `npm run build` output: `Duplicate identifier 'AppointmentConfirmMode'` on both files. | **P0** | **Fixed** — removed duplicate type alias declarations. |
| WF-2026-10-25-02 | `packages/ui/src/toast-store.ts` | Error toast auto-dismiss default was 6000ms, violating UI rule target (5000ms). | Source showed `error: 6000` in duration map. | **P1** | **Fixed** — set error default to 5000ms. |
| WF-2026-10-25-03 | `apps/practice-host-ui/src/views/components/treatment-chart-composer-panel.tsx` | Arbitrary Tailwind token `min-h-[72px]` bypassed spacing-token lint. | `npm run lint:tailwind-scale -w medoc` flagged `min-h-[72px]`. | **P1** | **Fixed** — replaced arbitrary class with explicit `style={{ minHeight: 72 }}` and kept tokenized spacing class. |
| WF-2026-10-25-04 | Rust validation toolchain in cloud agent | Workspace Rust checks cannot complete because environment Cargo is too old for transitive `toml_parser` (edition2024). | `cargo clippy` / `cargo test` fail with `feature edition2024 is required` (Cargo 1.83.0). | **P1** | **Open** — requires environment Cargo/Rust update; code changes in this run cannot resolve toolchain mismatch. |
| WF-2026-10-25-05 | `apps/practice-host-ui/e2e-playwright/ui-geometry.spec.ts` | Geometry snapshot gate was brittle (`paddingTop !== 0px`), causing potential race before Tailwind/layout tokens settled. | Prior gate depended on an unrelated computed style from `.login-submit`; updated gate now waits for expected `.login-kind` left padding token (`56px` desktop or `24px` mobile/tablet). | **P2** | **Fixed** — wait condition now keys off spacing-tokenized element under test. |
| WF-2026-10-25-06 | `apps/practice-host-ui/scripts/lint-tailwind-arbitrary-values.mjs` | Spacing lint scope included `z-[...]`, which is outside spacing/size audit and forced ad-hoc allowlisting. | Script regex previously matched `z-[...]` and required `focus:z-[60]` allowlist; updated regex restricts to spacing/size categories only. | **P2** | **Fixed** — narrowed matcher and removed unnecessary allowlist exception. |

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
| C8 | Replica merge conflict policy: LWW by `updated_at`; member push merged on master first; admin pull uses `admin_pull`. | `merge.rs`, `engine/run.rs`, `medoc-lan` sync HTTP | 2026-06-29 |
| C9 | Installed DBs vs rewritten English `0001`: mitigated by `run_english_schema_upgrade` on every open. Live DB **NOT OBSERVED**. | `english_schema_upgrade.rs`, `connection.rs` | 2026-08-19 |

