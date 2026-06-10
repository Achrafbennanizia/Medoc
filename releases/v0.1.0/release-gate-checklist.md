# Release Gate Checklist — MeDoc v0.1.0

Use this checklist before tagging the release. Every item must be either
checked off or have an explicit waiver linked in `docs/post-market/capa-tracking.md`.

## 1. Code quality

- [ ] `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings` (from repo root)
- [x] Or Linux container equivalent: `medoc-rust-wave-v1:latest` + `bash scripts/validate-docker.sh` — **PASS** 2026-06-07
- [x] `npm run lint -w medoc && npm run build -w medoc` — **PASS** 2026-06-07
- [ ] No TODO/FIXME without an associated issue link

## 2. Tests

- [x] `cargo test --workspace --tests` — Wave V1 + e2e **PASS** in Docker (2026-06-07)
- [x] `npm test` — **232+ PASS** (2026-06-07, incl. P0 route + export preview smokes)
- [x] `npm run test:mvp-coverage -w medoc` — scoped FE 100% allow-list
- [x] `bash tools/g21-verify-automated.sh` GREEN
- [x] `bash tools/two-device-sync-smoke.sh` — **automated proxy** via `scripts/validate-docker-multi-device.sh` **17/17**
- [ ] Optional LAN browser: `MEDOC_LAN_E2E=1 npm run test:playwright -w medoc` with `medoc-server` running — see `docs/architecture/lan-client-deployment.md`
- [x] Optional LAN web: `./scripts/validate-lan-web-client.sh` — build PASS
- [ ] Coverage report archived in `releases/v0.1.0/coverage/` (MVP scope: `docs/coordination/mvp-test-scope.md`) — **scoped allow-list, not whole workspace**
- [ ] Manual smoke test: patient → termin → akte → zahlung → backup → restore
- [ ] Serverless: pair replica → push/pull → revoke (see `g21-live-smoke-checklist.md`)

## 3. Security

- [ ] `cargo audit` — 0 unresolved high/critical advisories
- [ ] `npm audit --omit=dev` — 0 unresolved high/critical advisories
- [ ] OWASP Top 10 review notes attached
- [ ] Secrets scan (`gitleaks detect`) clean
- [ ] Dependency licenses reviewed (no GPL viral leaks into bundle)

## 4. SBOM & supply chain

- [ ] `./scripts/generate-sbom.sh v0.1.0`
- [ ] `releases/v0.1.0/sbom-rust.json` and `sbom-node.json` committed
- [ ] Build provenance attestation (`cosign attest`) signed with project key

## 5. Documentation

- [ ] `releases/v0.1.0/CHANGELOG.md` updated
- [ ] User manual `docs/benutzerhandbuch.md` reviewed by a dentist
- [ ] DSGVO RoPA `docs/datenschutz/verarbeitungsverzeichnis.md` updated (practice-specific entries)
- [ ] CAPA register reviewed; no open CAPAs > 90 days

## 6. Compliance evidence

- [ ] MDR Class I declaration of conformity signed
- [ ] Risk management file (ISO 14971) updated for delta from v0.0.x
- [ ] Post-market plan `docs/post-market/2026-Q2-pms.md` filed
- [ ] Clinical evaluation report (CER) updated if scope changed

## 7. Build & sign

- [ ] `npm run tauri build -w medoc` (macOS / Windows / Linux) — binary in `apps/practice-host/target/release/`
- [ ] Installers signed with current code-signing certificate
- [ ] Auto-update manifest published with detached signature

## 8. Release

- [ ] Git tag `v0.1.0` created and pushed
- [ ] GitHub release notes generated from CHANGELOG
- [ ] Download mirror updated
- [ ] Customers notified via release-channel newsletter
