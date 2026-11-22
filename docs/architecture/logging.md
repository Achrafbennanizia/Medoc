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
