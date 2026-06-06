# MeDoc MVP — cost–priority delivery plan

**Last updated:** 2026-06-02  
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

## MVP done checklist

- [ ] Workflows W1–W6 live-verified (G21b)
- [ ] W7 or W8 multi-host path verified
- [ ] Three binaries build: `medoc`, `medoc-server`, `medoc-company-server`
- [ ] `tools/g21-verify-automated.sh` + `scripts/validate-docker.sh` GREEN
- [ ] 100% unit on MVP module allow-list
- [ ] 85+ Rust HTTP e2e + expanded sync/RBAC negatives
- [ ] G21 live signed + (Playwright LAN or two-device sync)
- [ ] Serverless Tier-1 tables + mesh per-peer delivery
- [ ] Release gate complete
