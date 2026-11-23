# Logging architecture

Goal: when something fails, find the line that explains it in one step, and be able to add new log areas
without touching routing code.

## Where to look first

| Situation | Open | Why |
|---|---|---|
| A user reports an error with a reference (`ref=AB12CD34`) | `errors.log`, search the ref | Every backend error that reaches the UI logs the same ref |
| "Something is wrong", no reference | `errors.log` | Every WARN and ERROR from every area, in time order |
| A screen misbehaves (render crash, unexpected UI state) | `client.log` | Errors the UI showed or caught, with route and code |
| Sync, pairing, discovery, LAN API | `network.log` | All network traffic events |
| An API call failed (any side) | `errors.log`, search the request id or `API_CALL_FAILED` / `HTTP_REQUEST_` / `OUTBOUND_HTTP_` | Caller and receiver log the same `request_id` |
| Sign-in, lockout, permission | `security.log` | |
| Start-up, database, backups, window | `system.log` | |
| Slow screens | `perf.log` | |

Logs live in `~/medoc-data/logs/`, rotate daily and are kept per the retention rules (`infrastructure/retention.rs`).
The **Logs** page (`/logs`, permission `ops.logs`) exports the last 7 days as a ZIP (secrets and e-mails redacted).

## Pipeline

```
tracing event  (target = "medoc::<area>", event = "UPPER_SNAKE", fields…)
   │
   ├─ console (stderr, RUST_LOG)
   ├─ channel file  ← chosen by channels::CHANNELS (first matching target prefix)
   ├─ app.log       ← targets no channel claims; level adjustable at runtime (set_log_level)
   └─ errors.log    ← every WARN / ERROR, whatever the channel
          ↑
   redacting_writer: passwords, tokens, keys, JWTs, IBANs and e-mail addresses masked before disk
```

Code: `crates/shared/medoc-core/src/infrastructure/logging/`

| File | Responsibility |
|---|---|
| `channels.rs` | **The routing table.** Channel name, file, target prefixes, purpose. Tests ensure no overlaps. |
| `mod.rs` | Builds the subscriber from the table; `op_span` helper |
| `config.rs` | Runtime level for `app.log` |
| `redacting_writer.rs`, `sanitizer.rs` | Personal-data masking |
| `export.rs` | ZIP export |
| `brute_force.rs` | Lockout tracking (writes to `security`) |

## Channels

| Channel | File | Targets |
|---|---|---|
| security | `security.log` | `medoc::security`, `medoc::auth` |
| system | `system.log` | `medoc::system`, `medoc::workflow`, `medoc::app`, `medoc::native_menu`, `medoc::onboarding` |
| network | `network.log` | `medoc::sync`, `medoc::cluster`, `medoc::lan`, `medoc::company`, `medoc::http` |
| device | `device.log` | `medoc::device` |
| migration | `migration.log` | `medoc::migration` |
| perf | `perf.log` | `medoc::perf` |
| client | `client.log` | `medoc::client` (UI reports) |
| — | `app.log` | everything else (`medoc::staff`, `medoc::patient`, …) |
| — | `errors.log` | WARN + ERROR from all of the above |

## Writing a log line

```rust
tracing::warn!(target: "medoc::sync", event = "SYNC_PUSH_REJECTED", peer = %device_id, status = code, "master refused the batch");
```

Rules:
1. **`target`** is `medoc::<area>`; the area decides the file. Prefer the channel macros (`log_system!`, `log_security!`, …).
2. **`event`** is a stable `UPPER_SNAKE` name. Treat it as an API: dashboards and support searches depend on it.
3. Put identifiers in **fields**, not in the message: `patient_id = %id`, never names or free text about a patient.
4. **Levels**: `error` = the user's action failed; `warn` = degraded but handled (retry, fallback); `info` = state change worth keeping; `debug`/`trace` = development only.
5. Errors that reach the UI: `AppError::Database` / `Internal` log `error_ref` automatically and send `ref=` to the UI. Do not log them a second time.
6. Long operations: wrap them in `logging::op_span("sync.pull")` so every line inside carries `op` and `op_id`.

## UI errors (`client.log`)

`packages/shared/src/lib/client-log.ts` reports:
- every error the UI shows (through the error journal, with the catalogue code and the backend `ref=`),
- React render crashes (`MD-UIX-RENDER`),
- uncaught errors and unhandled promise rejections (`MD-UIX-UNCAUGHT`, `MD-UIX-REJECTION`).

The desktop app installs the sink in `main.tsx` (`log_client_event` command). Reports are de-duplicated for
5 s on the client and rate-limited to 30 per 10 s on the backend; messages are capped at 2,000 characters and
routes are stored without query strings.

## API failures

A failed API call is logged on every side it touches, and the sides are joined by one `request_id`:

| Side | Where | Event | Fields |
|---|---|---|---|
| UI → desktop backend (IPC) | `client.log` (`tauri-transport.ts` → `report-api-failure.ts`) | `API_CALL_FAILED` | transport `ipc`, command, catalogue code and kind, backend `ref=` |
| UI → main device (LAN client, HTTPS) | `client.log` (`http-practice.adapter.ts`) | `API_CALL_FAILED` | transport `lan`, command, code, HTTP status, `request_id` (sent as `x-request-id`) |
| Main device receiving a request | `network.log` (`observability.rs`, outermost layer) | `HTTP_REQUEST_FAILED` (5xx), `HTTP_REQUEST_REJECTED` (4xx) | method, route template, status, error `code`, `request_id`, elapsed |
| Device calling another device (sync push/pull/exchange, reconcile, peers, pairing, main link, vendor portal) | `network.log` (`logging/outbound_http.rs`) | `OUTBOUND_HTTP_FAILED` (5xx), `OUTBOUND_HTTP_REJECTED` (4xx), `OUTBOUND_HTTP_UNREACHABLE` (no answer) | call kind, route path, status, the other side's `request_id` and error code, `skipped` |

Rules:
- Arguments and error parameters are never logged (passwords, patient data): only the command, the error key and the code.
- Expected outcomes (validation, not found, conflict) are `info` in `client.log` and stay out of `errors.log`.
- Connectivity failures are throttled: once a minute per command (UI) or per call kind (outgoing), with the count of skipped ones, so an offline device polling twice a second cannot flood the files.
- The server logs requests refused before routing too (origin gate, CORS): the logging layer is the outermost one.
- Error responses carry their code to the log line as a response extension (`FailureCode`); hand-built JSON error bodies are read for their `error`/`reason` when small and uncompressed.
- `log_targets_routed_tests.rs` fails when code logs to a `medoc::…` target that no channel routes (and that is not a listed app.log area).

## Adding a new area

1. Pick a target, e.g. `medoc::imaging`.
2. If it deserves its own file, add one `Channel` entry in `channels.rs`. Nothing else changes: routing,
   `app.log` exclusion, export and errors.log follow automatically.
3. Otherwise it lands in `app.log`; its warnings and errors still land in `errors.log`.

## Extending later

The pipeline is a list of `tracing_subscriber` layers, so new outputs are one more layer:
- OpenTelemetry / OTLP export for a company dashboard (`tracing-opentelemetry` layer on the same registry),
- a size cap per file (replace `RollingFileAppender` with a size-aware appender in `json_file`),
- per-channel runtime levels (generalise `config::LoggingConfig` to a map keyed by channel name).
