# MVP test scope — unit coverage allow-list

**Purpose:** Define modules targeted for **100% line coverage** (T-U1/T-U2). Whole-workspace coverage is explicitly out of scope.

**Layout (post R9):** repo root — see [`rust-restructure-plan.md`](rust-restructure-plan.md).

## Rust (T-U1)

| Module / path | Rationale |
|---------------|-----------|
| `crates/shared/medoc-sync/**` | Sync engine, merge, pairing, repo |
| `crates/server/lan/medoc-lan/src/http/sync.rs` | Sync/pairing HTTP + activation RBAC |
| `crates/server/lan/medoc-lan/src/http/pairing.rs` | Pairing routes |
| `crates/server/lan/medoc-lan/src/master_license.rs` | License gate on LAN |
| `crates/shared/medoc-core/src/infrastructure/database/sync_outbox.rs` | Outbox hooks |
| `crates/shared/medoc-core/src/infrastructure/license*.rs` | License v2 |
| Repos with sync hooks (patient, akte, appointment, payment, practice_task, prescription, certificate, serviceItem, ticket, notification) | Tier-1 replication |
| `crates/app/medoc-practice/src/commands/network/sync_commands.rs` | IPC sync |
| `crates/app/medoc-practice/src/commands/network/pairing_commands.rs` | IPC pairing |

**Tooling:** `bash tools/mvp-rust-coverage.sh` — reports medoc-sync, medoc-lan, medoc-core (scoped).

**Status (2026-06-07):** **PARTIAL**

| Crate / module | Line cov / tests |
|----------------|------------------|
| `medoc-sync` `engine/run.rs` | **79%+** (17 HTTP tests) |
| `medoc-sync` `repo/store.rs` | **99.53%** |
| `medoc-sync` `merge.rs` | **89%+** |
| `medoc-lan` `http/sync.rs` | **7 unit tests** (new) |
| `medoc-lan` `master_license.rs` | **3 tests** |
| `medoc-core` outbox + license | **22 tests** |
| `medoc-lan` `http/pairing.rs` | **6 unit tests** (new) |
| `medoc-practice` IPC sync/pairing | **8 tests** (RBAC + engine) |

Snapshot: [`coverage-snapshot.md`](coverage-snapshot.md). HTML: `releases/v0.1.0/coverage/rust-medoc-sync/html/`.

## Frontend (T-U2)

| Module / path | Rationale |
|---------------|-----------|
| `packages/app/practice-host/src/controllers/sync.controller.ts` | Sync IPC |
| `packages/app/practice-host/src/controllers/pairing.controller.ts` | Pairing IPC |
| `packages/server/lan/src/controllers/pairing-scan.controller.ts` | Replica pairing |
| `packages/app/practice-host/src/lib/deployment-config.ts` | Deployment schema |
| `packages/shared/src/lib/quittung-export-flow.ts` | Finanzen quittung |

**Tooling:** Vitest project `mvp-unit` in `apps/practice-host-ui/vite.config.ts` — run from repo root:

```bash
npm run test:mvp-coverage -w medoc
```

**Status (2026-06-06):** T-U2 **GREEN** — 100% thresholds on 5 scoped modules (22 tests).

## Excluded from 100% target

Telematik, DICOM live, company billing production paths, Wave C/D page restructure, entire `apps/practice-host-ui/src/views/pages/` unless covered by smokes (T-U3).

## Integration (T-I1)

Target: **85+** tests in `crates/test/medoc-e2e` including port suite **18+**.

**Status (2026-06-06):** **85** in-process + port tests; Docker port suite **17/17 PASS**.

## System (T-S1–S4)

- T-S1: G21 live checklist — `docs/coordination/g21-live-smoke-checklist.md`
- T-S2: `tools/two-device-sync-smoke.sh`
- T-S3: Playwright — `apps/practice-host-ui/e2e-playwright/lan-server.spec.ts` (+ `apps/lan-web-client`)
- T-S4: `releases/v0.1.0/` gate
