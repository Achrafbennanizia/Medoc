# MeDoc MVP — cost–priority delivery plan

**Last updated:** 2026-06-07  
**Status:** Active execution plan (serverless thread + full MVP scope)

## MVP boundary — excluded features

| # | Excluded | ID | MVP substitute |
|---|----------|-----|----------------|
| 1 | Live TI / KIM / E-Rezept | GAP-13 | Local rezept/attest PDF + honest integration labels |
| 2 | Mobile / tablet LAN client | GAP-14 | Desktop Tauri + optional `lan_client` on desktop browser |
| 3 | Production vendor billing | GAP-15 | License v2 local + company server `_demo` stub |

**Also out of MVP:** GAP-08/09/12, W12/G12 per-patient RBAC, MS-7 mDNS.

## Cost scale

| Size | Effort | Calendar (1 FTE) |
|------|--------|------------------|
| S | 2–4 days | < 1 week |
| M | 1–2 weeks | 1–2 weeks |
| L | 3–5 weeks | ~1 month |
| XL | 6–10 weeks | 2–2.5 months |

## Delivery phases

| Phase | Focus | Cost (1 FTE) |
|-------|--------|--------------|
| Phase 0 — Ship gate | G21b live, Docker GREEN, W2–W6 | 2–3 PW |
| Phase 1 — Seamless UX + serverless | W7–W8, MS-3/MS-6, UX-2–5, T-I1 | 4–6 PW |
| Phase 2 — Hardening | T-U1/T-U2 100%, T-S2–S3, UX-7–9, T-S4 | 5–8 PW |

See [`mvp-test-scope.md`](mvp-test-scope.md) for unit-coverage allow-list.

## W6 — Boot path (SQLCipher + license gate)

Documented smoke path for first launch:

1. **Fresh install** — Tauri starts → `LicenseAndPairingGate` if no valid license (`critical-flows.smoke.test.tsx`).
2. **DB setup** — `get_db_setup_status` → passphrase setup/unlock before session.
3. **Login** — TOTP for ARZT roles; session persisted in SQLCipher.
4. **Deployment default** — `practice_desktop` + `MASTER` until changed under Einstellungen → Deployment.

Automated proxy: `bash tools/g21-verify-automated.sh` + `critical-flows.smoke.test.tsx` license gate test.

## MVP done checklist

- [ ] Workflows W1–W6 live-verified (G21b) — manual; automated proxy GREEN
- [x] W7 or W8 multi-host path verified — Docker port **17/17** + `two-device-sync-smoke.sh` + Playwright LAN (opt-in)
- [x] Three binaries build: `medoc`, `medoc-server`, `medoc-company-server`
- [x] `tools/g21-verify-automated.sh` + `scripts/validate-docker.sh` GREEN (2026-06-07)
- [ ] 100% unit on MVP module allow-list — T-U2 **GREEN**; T-U1 **PARTIAL** (repo/engine tests added)
- [x] 85+ Rust HTTP e2e + expanded sync/RBAC negatives — **85** in-process + **17/17** port
- [ ] G21 live signed + (Playwright LAN or two-device sync) — Playwright + two-device **automated**; live rows pending
- [x] Serverless Tier-1 tables + mesh per-peer delivery
- [x] UI/UX: P0 error surfacing, onboarding hints, integration stubs honest — field hints + migration copy
- [ ] Release gate complete — automated items ticked in [`releases/v0.1.0/release-gate-checklist.md`](../../releases/v0.1.0/release-gate-checklist.md)
