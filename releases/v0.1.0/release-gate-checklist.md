# Release Gate Checklist — MeDoc v0.1.0

Use this checklist before tagging the release. Every item must be either
checked off or have an explicit waiver linked in `docs/post-market/capa-tracking.md`.

## 1. Code quality

- [ ] `cd app/src-tauri && cargo fmt --check && cargo clippy -- -D warnings`
- [ ] `cd app && npm run lint && npx tsc --noEmit`
- [ ] No TODO/FIXME without an associated issue link

## 2. Tests

- [ ] `cd app/src-tauri && cargo test --all-features`
- [ ] `cd app && npm test`
- [ ] Coverage report archived in `releases/v0.1.0/coverage/`
- [ ] Manual smoke test: patient → termin → akte → zahlung → backup → restore

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

- [ ] `cd app && npm run tauri build` (macOS / Windows / Linux)
- [ ] Installers signed with current code-signing certificate
- [ ] Auto-update manifest published with detached signature

## 8. Release

- [ ] Git tag `v0.1.0` created and pushed
- [ ] GitHub release notes generated from CHANGELOG
- [ ] Download mirror updated
- [ ] Customers notified via release-channel newsletter
