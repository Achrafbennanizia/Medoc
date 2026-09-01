# Swing conversion checklist

Canonical full list: sibling repo [`/Users/achraf/pro/Medoc-swing/CONVERSION.md`](../../../Medoc-swing/CONVERSION.md) (outside this git tree).

**Last updated:** 2026-08-20 (Swing feature pack — drag / GOZ / e-Rx / license / staff / devices / composers)

Swing is a LAN HTTPS client (like `apps/lan-web-client`), not a Tauri replacement. English identifiers; German only as `LanDialect` inbound fallbacks and `messages_de.properties` values.

## Status snapshot

| Area | Status |
| --- | --- |
| Core practice UI (patients, appointments, billing, cash, orders, prescriptions, certificates, tickets, dashboard, privacy, onboarding, day close, balance, templates) | **Done** / **Subset** |
| Admin catalogs | **Subset** — full search/create/edit/delete on demo |
| Staff / migration / audit / logs / ops / compliance / feedback | **Subset** — staff security + migration device adapters demo-complete |
| Statistics | **Subset** — KPIs + week staff hours + disease-pattern table |
| Drag calendar, GOZ seed, e-prescription, license/pairing, GDT/scanner, staff passwords/RBAC, chart composers | **Subset** — demo Mock + UI (not TI / licensed GOZ / OS IPC) |
| `./gradlew test` | **PASS** — **101** tests |
| Live LAN HTTPS | **NOT RUN** (`cargo` not on PATH) |

## Honest limit

Swing cannot become a 1:1 Tauri clone without new LAN REST or embedding desktop IPC. Remaining gaps stay honest **Subset** (no real TI, no licensed GOZ dump, no OS scanner, no password/2FA host APIs).

See sibling `CONVERSION.md` for the file-by-file table.
