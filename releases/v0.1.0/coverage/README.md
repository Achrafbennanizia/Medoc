# MVP scoped coverage archive — v0.1.0

Generated during MVP plan execution. Re-run anytime:

```bash
bash tools/mvp-rust-coverage.sh --archive   # Rust HTML + snapshot (~25 min)
npm run test:mvp-coverage -w medoc          # FE scoped 100% (~3 s)
```

## Contents

| Path | Description |
|------|-------------|
| `rust-medoc-sync/html/` | `cargo llvm-cov -p medoc-sync` HTML report |
| `fe-mvp-unit/lcov.info` | Vitest lcov for 5 T-U2 modules |
| [`../../docs/coordination/coverage-snapshot.md`](../../docs/coordination/coverage-snapshot.md) | Human-readable numbers |

## Latest snapshot (2026-06-07)

### Frontend (T-U2) — **100%** on allow-list

Modules: sync/pairing controllers, pairing-scan, deployment-config, quittung-export-flow.

### Rust medoc-sync (T-U1) — **partial**

| Module | Lines |
|--------|-------|
| `engine/run.rs` | 47.80% |
| `repo/store.rs` | 94.59% |
| `merge.rs` | 62.31% |

### Integration (T-I1)

- **85** tests in `crates/test/medoc-e2e`
- Docker port **17/17**
