# Release workflow dry-run

Early validation for [`.github/workflows/release.yml`](../../.github/workflows/release.yml) — run during Wave 2/3, not on ship day.

## Steps

1. Create branch `release/dry-run-YYYYMMDD` from current `main`.
2. Tag a non-shipping version: `git tag v0.0.0-dry-run.1` and push tag, **or** use GitHub **Actions → Release → Run workflow**.
3. Watch jobs: `build-keygen` (Linux/macOS/Windows), practice-host artifacts, signing/notarization secrets.
4. Record pass/fail in [`docs/coordination/validation.md`](../coordination/validation.md).

## Expected discovery areas

| Area | Risk |
|------|------|
| Windows | vcpkg / CMake / `medoc-keygen` build |
| macOS | codesign, notarization env vars |
| All | `MEDOC_VENDOR_PUBKEY` at build time |
| Artifacts | upload path names vs installer README |

## Status

**NOT RUN** — procedure documented 2026-06-16; execute on next CI-capable push.
