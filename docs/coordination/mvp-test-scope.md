# MVP test scope — unit coverage allow-list

**Purpose:** Define modules targeted for **100% line coverage** (T-U1/T-U2). Whole-workspace coverage is explicitly out of scope.

## Rust (T-U1)

| Module / path | Rationale |
|---------------|-----------|
| `app/crates/medoc-sync/**` | Sync engine, merge, pairing, repo |
| `app/crates/medoc-lan/src/sync_http.rs` | Sync/pairing HTTP + activation RBAC |
| `app/crates/medoc-lan/src/pairing_http.rs` | Pairing routes |
| `app/crates/medoc-lan/src/master_license.rs` | License gate on LAN |
| `app/crates/medoc-core/src/infrastructure/database/sync_outbox.rs` | Outbox hooks |
| `app/crates/medoc-core/src/infrastructure/license*.rs` | License v2 |
| Repos with sync hooks (patient, akte, termin, zahlung, praxis_aufgabe, rezept, attest, leistung, ticket, notification) | Tier-1 replication |
| `app/src-tauri/src/commands/sync_commands.rs` | IPC sync |
| `app/src-tauri/src/commands/pairing_commands.rs` | IPC pairing |

**Tooling:** `cargo llvm-cov --ignore-filename-regex` for non-scoped paths.

## Frontend (T-U2)

| Module / path | Rationale |
|---------------|-----------|
| `app/src/systems/practice-host/controllers/sync.controller.ts` | Sync IPC |
| `app/src/systems/practice-host/controllers/pairing.controller.ts` | Pairing IPC |
| `app/src/systems/lan/controllers/pairing-scan.controller.ts` | Replica pairing |
| `app/src/systems/practice-host/lib/deployment-config.ts` | Deployment schema |
| `app/src/lib/quittung-export-flow.ts` | Finanzen quittung |

**Tooling:** Vitest project `mvp-unit` — run `npm run test:mvp-coverage` (100% thresholds on files above).

**Status (2026-06-06):** T-U2 **GREEN** — archived in `releases/v0.1.0/coverage/mvp-unit-fe.lcov.info`.

## Excluded from 100% target

Telematik, DICOM live, company billing production paths, Wave C/D page restructure, entire `views/pages/` unless covered by smokes (T-U3).

## Integration (T-I1)

Target: **85+** tests in `medoc-e2e` including port suite **18+**.

## System (T-S1–S4)

- T-S1: G21 live checklist
- T-S2: `tools/two-device-sync-smoke.sh`
- T-S3: Playwright LAN client (Phase 2)
- T-S4: `releases/v0.1.0/` gate
