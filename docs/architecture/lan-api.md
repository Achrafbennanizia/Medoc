# LAN API — contract and design rules

The HTTPS API that practice devices use to talk to the main device (`crates/server/lan/medoc-lan/src/http/`).
The security review is in [lan-connection-review.md](lan-connection-review.md); this page covers the contract
and how it may evolve.

## Shape

- **Base path** `/api/v1`. `/health` (no auth) lives outside it, for monitors.
- **Layers**: one router; cross-cutting concerns are `tower` layers applied once, never per handler.

```
request
  → CORS origin gate → CORS
  → observability (request id, log line, headers)      http/observability.rs
  → gzip response compression                           tower-http CompressionLayer
  → body limit 16 MiB → timeout 120 s
  → public routes (15 s timeout): ping, login, pairing
  → protected routes: JWT (staff) or activation token (devices, /sync/*)
  → handler → AppError → ApiError (status + body)
```

| Quality | How it's achieved |
|---|---|
| Loose coupling & abstraction | Handlers return `AppError`; one `ApiError` mapping turns it into HTTP status and body. Cross-cutting behaviour is middleware, not handler code. |
| Scalability & performance | gzip for large JSON (sync pages); pinned TLS clients are cached per main device and reuse pooled keep-alive connections; sync pushes are paged. |
| Security by design | TLS with certificate pinning; separate credentials for people (JWT, 8 h, revocable via `token_version`) and devices (Ed25519 activation token); per-request staff re-check; body limit; CORS allow-list; `cache-control: no-store` and `nosniff` on every response. |
| Interoperability | JSON everywhere; the error token in the body is the same as the Tauri IPC error, so one resolver serves both. |
| Predictability & DX | Every response carries `x-request-id` (client-provided if well-formed, else generated) and `x-medoc-api-version`. The same id is in the server's `network.log` line. |
| Resilience & fault tolerance | Fast 15 s timeout for interactive calls, 120 s for sync; failures land in `errors.log`; sync problems are queued and retried (`/sync-problems`). |
| Traffic & payload optimization | gzip (clients send `Accept-Encoding: gzip`); paged sync; digests and row hashes so only differing rows travel (`/sync/digest`, `/sync/row-hashes`). |
| Safe evolution | Rules below. |

## Access management (main device)

Used by the replica app to manage roles for the signed-in person (`docs/architecture/device-flavors-and-access.md`).

| Route | Purpose |
|---|---|
| `GET /api/v1/access/catalog` | Areas, levels, roles and ceilings |
| `GET /api/v1/access/staff/{id}` | One person's role, levels and exceptions |
| `PUT /api/v1/access/staff/{id}` | `{ template, grants }`: assign a role and per-area changes |
| `DELETE /api/v1/access/staff/{id}` | Back to the default role |
| `PUT /api/v1/access/staff/{id}/scopes` | `{ ownAreas: ["calendar"] }`: own-records scopes |

Each change runs through the same rules as on the main device itself: you need `access.manage`, you can't change your own rights, you can't grant more than you hold, and the last access manager can't be removed.

## Errors

```json
HTTP 409
{ "error": "error.workflow.status_transition|current=COMPLETED|next=PLANNED", "status": 409 }
x-request-id: 7F3A9C21
```

- `error` is the **contract**: a wire token from `AppError::wire_code()`. Clients translate it with the error catalogue (`MD-…` codes).
- `status` mirrors the HTTP code (added in v1, additive).
- Internal and database errors carry `ref=…`, which matches `error_ref` in `errors.log`.

## Request id

- Send `x-request-id: <1–64 chars, A–Z a–z 0–9 - _>` to correlate your own logs; otherwise the server creates one.
- The id is always returned in the response header.
- Search `network.log` / `errors.log` for `request_id`.

## Evolution rules

1. **Additive changes stay in v1**: new routes, new optional request fields, new response fields. Clients must ignore fields they don't know.
2. **Breaking changes** need `/api/v2`. Examples: renaming or removing fields, changing types or meaning, making an optional field required, changing status codes for existing cases. v1 stays served until all paired devices report a version that supports v2 (`x-medoc-api-version` and the `version` in discovery answers).
3. The **error tokens** are part of the contract. Add new tokens freely, but never change the meaning of an existing one.
4. **Timeouts and limits** may become stricter only with a release note. A client relying on a 100 s login is a bug.

## Logging

One line per request in `network.log` (`target: medoc::http`):
- `HTTP_REQUEST_FAILED` (5xx, error);
- `HTTP_REQUEST_REJECTED` (4xx, warn);
- `HTTP_REQUEST_SLOW` (≥ 1.5 s, in `perf.log`);
- `HTTP_REQUEST` for successful writes.

Successful reads are logged at debug level only, so polling doesn't fill the disk. The route is the template (`/api/v1/pairing/status/{id}`), never the raw path, so ids and personal data stay out of the log.

## Next steps (not done yet)

- Move `/sync/*` into its own sub-router with a dedicated device-token layer, instead of matching path strings in the shared auth middleware (review item 2).
- Publish an OpenAPI description generated from the routes (`utoipa`), and run a contract test against it in CI.
- Add `ETag` / `If-None-Match` on `/sync/status` and the company summary, so polling devices get `304 Not Modified`.
- Rate-limit pairing requests per address, as login already is.
