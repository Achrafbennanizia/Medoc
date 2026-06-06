# MVP scoped coverage archive — v0.1.0

Generated during MVP plan completion (2026-06-06).

## Frontend (T-U2) — **100% on allow-list**

Command:

```bash
cd app && npm run test:mvp-coverage
```

Modules (see `docs/coordination/mvp-test-scope.md`):

- `sync.controller.ts`
- `pairing.controller.ts`
- `pairing-scan.controller.ts`
- `deployment-config.ts`
- `quittung-export-flow.ts`

Artifact: `mvp-unit-fe.lcov.info` (Vitest v8, `mvp-unit` project).

## Rust (T-U1) — **partial** (not 100% on full allow-list)

Command (example):

```bash
cd app && export MEDOC_VENDOR_PUBKEY=... MEDOC_DB_KEY=... MEDOC_PAIRING_MASTER_SECRET=...
cargo llvm-cov -p medoc-sync --summary-only
```

Snapshot (2026-06-06, `medoc-sync` crate only):

| Module | Lines |
|--------|-------|
| `schema.rs` | ~100% |
| `pairing.rs` | ~86% |
| `merge.rs` | ~62% |
| `engine.rs` | ~26% |
| `repo.rs` | ~32% |

Full T-U1 (100% on all scoped Rust modules) remains **XL** effort — tracked in `mvp-test-scope.md`.

## Integration (T-I1)

- **85** in-process + port HTTP tests in `medoc-e2e`
- **17/17** port tests GREEN via `bash scripts/validate-docker-multi-device.sh`
