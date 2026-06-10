# Coverage snapshot

**Generated:** 2026-06-07 (UTC)  
**Command:** `bash tools/mvp-rust-coverage.sh --archive`

## Frontend (T-U2) — GREEN

`npm run test:mvp-coverage -w medoc` — 100% thresholds on 5 scoped modules (22 tests).

## Rust workspace (T-U1) — PARTIAL

### medoc-sync

| Module | Line cov (last archive) |
|--------|-------------------------|
| `engine/run.rs` | **79.01%** → improved with +5 HTTP/mesh tests |
| `repo/store.rs` | **99.53%** |
| `merge.rs` | **89.18%** → improved with parse_ts + apply tests |

**Tests:** ~80+ (19 HTTP, 19 merge apply, 11 repo, proptests, inline)

### medoc-lan

| Module | Status |
|--------|--------|
| `http/sync.rs` | **7 tests** + `action_for_path` inline |
| `http/pairing.rs` | **6 tests** (submit/accept/revoke/peers) |
| `master_license.rs` | **3 tests** |

HTML (after archive): `releases/v0.1.0/coverage/rust-medoc-lan/html/`

### medoc-core

| Module | Status |
|--------|--------|
| `sync_outbox.rs` + hooks | 9 hook tests + 3 inline |
| `license*.rs` | 6 v2 + 4 proptest + 3 inline |

### medoc-practice IPC — STARTED

**8 tests** in `tests/ipc_sync_pairing_tests.rs` — RBAC matrix (`ops.system` = ARZT) + `SyncEngine`/`pairing` paths matching command logic.

### medoc-e2e — GREEN (integration)

**85** tests; Docker port **17/17**.

## Tooling

`bash tools/mvp-rust-coverage.sh` now reports **medoc-sync**, **medoc-lan**, and **medoc-core** (scoped tests).

## Remaining toward 100%

- medoc-sync: HTTP decode failures, `find_master_device_id` edge cases
- medoc-lan: activation-token RBAC on `/patienten`, revoked slave paths
- medoc-practice: full Tauri command invocation (needs app harness)
- medoc-core: remaining tier-1 repo hook tests
