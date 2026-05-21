# Company server demo mode

The `medoc-company-server` binary exposes stub HTTP endpoints for integration testing without a live billing or Gematik backend.

## `_demo` response flag

Successful JSON bodies from these routes include `"_demo": true`:

| Route | Purpose |
| ----- | ------- |
| `GET /v1/integrations/status` | Integration placeholders |
| `GET /v1/feature-flags` | Feature toggles |
| `GET /v1/updates/manifest` | Update channel stub |
| `POST /v1/billing/portal-session` | Stripe demo portal URL |
| `POST /v1/billing/payment-methods` | Attach payment (204, demo) |

Clients (MeDoc desktop) should surface a **Demo-Modus** banner when any portal response contains `_demo: true`.

## Production

A production company server must omit `_demo` and return live data signed per `docs/operations/vendor-key-rotation.md` for update manifests.
