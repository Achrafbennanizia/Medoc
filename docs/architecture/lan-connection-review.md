# LAN connection review

Status: November 2026, branch `claude/ui-ux-architecture-refactor-ea9775`.
Scope: how practice devices find each other, pair, authenticate and sync on the local network.

Code owners:

| Concern | File |
|---|---|
| HTTP API (routes, auth middleware, limits) | `crates/server/lan/medoc-lan/src/http/mod.rs` |
| Pairing endpoints | `crates/server/lan/medoc-lan/src/http/pairing.rs` |
| Sync endpoints | `crates/server/lan/medoc-lan/src/http/sync.rs` |
| Staff JWT | `crates/server/lan/medoc-lan/src/jwt.rs` |
| TLS (self-signed cert, fingerprint) | `crates/server/lan/medoc-lan/src/tls.rs` |
| Client-side TLS pin | `crates/shared/medoc-sync/src/tls_pin.rs` |
| Pairing PIN / SAS | `crates/shared/medoc-sync/src/pairing/pin.rs`, `cluster/crypto/sas.rs` |
| UDP discovery | `crates/shared/medoc-core/src/discovery/lan_udp.rs` |
| mDNS discovery (cluster) | `crates/shared/medoc-sync/src/net/discovery.rs` |
| Peer channel (Noise XX) | `crates/shared/medoc-sync/src/net/handshake.rs`, `channel.rs` |
| Tauri commands (scan, pairing) | `crates/app/medoc-practice/src/commands/network/lan.rs`, `pairing/discovery_lan.rs` |

---

## 1. Flow

1. **Discovery.** A device sends UDP probes to the broadcast address of every interface and listens for
   answers (`scan_lan_hosts_on_ports`). Responders answer with instance id, label, HTTPS port and version.
   The cluster layer additionally browses mDNS.
2. **Pairing.** The new device calls `POST /api/v1/pairing/request`. The host shows the request to an
   administrator, who accepts it. Both screens show a 4-digit code (SAS); the device confirms it via
   `POST /pairing/confirm/{id}` (10-minute TTL, at most 5 attempts). On success the host issues an
   **Ed25519-signed activation token** and the device stores the host's **TLS certificate SHA-256 pin**.
3. **Sessions.** Staff log in with `POST /auth/login` (rate limited) and get an HS256 JWT valid for 8 h.
   Each request re-checks the staff `token_version`, so changing a password or revoking a user ends
   every session at once.
4. **Sync.** Replicas push/pull/reconcile on `/api/v1/sync/*` with the activation token only. Staff JWTs
   are explicitly rejected there. Conflicts merge with hybrid logical clocks (`hlc.rs`, `merge.rs`).
5. **Clock.** `/health` and `/ping` return `server_time`; clients correct their own drift so every device
   agrees on "now" (`practice-clock.ts`).

## 2. What was broken and is fixed on this branch

| Problem | Effect | Fix |
|---|---|---|
| Pairing scanned UDP port 8788 while responders listen on 47830 by default | "Device sessions → scan" never found anything | All scans probe configured + 47830 + 8788 (`discovery_ports_to_probe`) |
| One probe burst, receive errors aborted the scan | Hosts that answered late or on a second interface were missed | Re-probe every 500 ms during the window, tolerate per-packet errors; 3.5 s window (pairing UI 4 s) |
| mDNS scan left its browse thread and daemon running | Thread leak per scan | Stop browse and shut the daemon down when the window ends |
| LAN API errors were free English text, with mixed HTTP codes | UI could not translate them; clients guessed status | One `ApiError` built from `AppError::wire_code()` / `http_status()` for every handler |

## 3. Security assessment

**Good**
- TLS everywhere, with certificate **pinning** instead of trusting a self-signed cert blindly. An empty pin
  is a hard error.
- Sync channel and staff channel use different credentials; one cannot be replayed on the other.
- Session revocation via `token_version` works without a token blacklist.
- Login rate limiting, a 16 MiB request body limit and a 120 s request timeout are applied globally.
- CORS is an allow-list plus an origin gate middleware, not `*`.
- Rejected tokens are logged with only an 8-character prefix.
- Peer-to-peer cluster traffic uses Noise XX with read timeouts on every frame.

**Risks and recommendations** (ordered by priority)

1. **Pairing code length (fixed: now 6 digits).** Previously: **4-digit pairing code.** 5 attempts out of 10,000 combinations give a 0.05 % chance per request to
   guess the code. Pairing still needs an administrator to accept the request, so this is acceptable, but
   a 6-digit code would cost users little. If you change it, change `SAS_LEN` and the pairing UI together.
2. **Sync routes are recognised by matching path strings** (`path.contains("/sync/")`) inside the shared JWT
   middleware. A future route that happens to contain `/sync/` would silently switch auth mode. Move the
   sync routes into their own sub-router with a dedicated activation-token layer.
3. **One timeout for everything.** 120 s suits large sync pulls but lets a stalled login or ping hold a
   connection for two minutes. Use about 15 s for auth and pairing, and keep 120 s for sync and blob routes.
4. **Discovery answers are unauthenticated and in clear text.** They reveal the practice label and version
   to anyone on the network. This is acceptable inside a practice network, but the label should not
   contain patient-identifying text. Mention this in the setup guide.
5. **`/health` is public and returns the version.** That is useful for support, but it tells an attacker
   which version runs. Consider returning the version only to authenticated callers.

## 4. Performance notes

- Discovery is now bounded: one task per scan window, no thread left behind, and duplicate answers are
  dropped by instance id.
- Sync pushes are paged. The `large_outbox_drains_in_pages` test covers this, but it currently fails on
  `fix/finance-workflows` as well; see the test baseline below.
- Clients should reuse one HTTP client (connection pool) per host. `reqwest::Client` is cheap to clone, so
  do not build one per request.

## 5. Test baseline

`cargo test --no-fail-fast -p medoc-core -p medoc -p medoc-lan -p medoc-sync -p medoc-practice` with the
dummy `MEDOC_VENDOR_PUBKEY` (64 zeros):

- This branch: 51 failing tests, all of which also fail on `fix/finance-workflows`.
- `fix/finance-workflows`: 53 failing tests. The two extra failures are the backup-restore tests, which
  this branch fixes.
- Most failures are licence, pairing and sync HTTP tests that need the real vendor signing key
  ("test signing key must match build-time VENDOR_PUBKEY"). Run them with the real key in CI.
- Not caused by the key, and also failing on `fix/finance-workflows`: GDPR erasure (the new retention
  guard blocks the test fixture), the table registry missing `document_sequence` and `sync_packet_queue`,
  RBAC `reception_cannot_read_medical_records_or_audit`, `rejects_non_eur_currency`,
  `test_invoice_goz_has_required_fields`, the paged-push drain and a migration foreign-key test.
