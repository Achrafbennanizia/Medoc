# Swing conversion checklist

Canonical full list: sibling repo [`/Users/achraf/pro/Medoc-swing/CONVERSION.md`](../../../Medoc-swing/CONVERSION.md) (outside this git tree).

**Last updated:** 2026-08-20 (Swing prescriptions + invoice lines + day close)

Swing is a LAN HTTPS client (like `apps/lan-web-client`), not a Tauri replacement. English identifiers; German only as `LanDialect` inbound fallbacks and `messages_de.properties` values.

## Status snapshot

| Area | Status |
| --- | --- |
| Sidebar, admin TOC, catalogs, privacy, cash, onboarding, month list, invoice status/lines, templates, patient prescriptions, day close | **Done** / **Subset** (demo mock writes; LAN HTTPS still list/KV/`/me`) |
| Drag calendar, GOZ factor engine, rich template composer, e-prescription submit, license/pairing activate | **Not started** / stay thinner **Subset** |
| `./gradlew test` | **PASS** — 66 tests / 17 classes |
| Live LAN HTTPS | **NOT RUN** (`cargo` not on PATH) |

## Next

1. Restart `./run` and walk Billing lines, Prescriptions, Administration → Finance → Day close.
2. Live login + list + settings when `medoc-lan-server` can run.
3. Remaining nested richness if the Swing client should match desktop composers.

See the sibling `CONVERSION.md` for the file-by-file React → Swing table.
