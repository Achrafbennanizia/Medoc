# LAN browser client deployment (W7 / MS-2)

**Mode:** `lan_client` in [`packages/app/practice-host/src/lib/deployment-config.ts`](../../packages/app/practice-host/src/lib/deployment-config.ts)

Thin clients connect to a remote `medoc-server` over HTTPS. No local SQLCipher database on the client device.

Alternative browser shell: [`apps/lan-web-client`](../../apps/lan-web-client) (port 1421, no Tauri).

## Topology

```text
Browser (Vite :1420 or lan-web :1421) ──HTTPS──► medoc-server (:8787) ──► master SQLite
```

Configure under **Einstellungen → Deployment → LAN-Client**. The desktop app stores LAN URL + TLS certificate SHA-256 fingerprint in `lan-client-config` (localStorage when in browser-only mode).

## TLS fingerprint pinning

1. Start master: `medoc-server --data-dir ./master-data --http-port 8787`
2. Read self-signed cert fingerprint (first connect):
   ```bash
   openssl s_client -connect 127.0.0.1:8787 -servername localhost </dev/null 2>/dev/null \
     | openssl x509 -fingerprint -sha256 -noout
   ```
3. Paste the hex digest (no colons) into **Master-Zertifikat SHA-256** in deployment settings.

Production deployments should use a CA-signed certificate; pin the leaf or SPKI hash per your security policy.

## CORS

LAN server CORS is enforced in [`crates/shared/medoc-core/src/infrastructure/cors_policy.rs`](../../crates/shared/medoc-core/src/infrastructure/cors_policy.rs). Allowed origins default to local dev hosts (`http://localhost:1420`, Tauri webview). Extend via `MEDOC_CORS_ORIGINS` for staging.

Company server uses `CorsGate::company()` — separate from LAN.

## Automated tests

| Layer | Command |
|-------|---------|
| In-process JWT RBAC | `cargo test -p medoc-e2e --test serverful_lan_client_flows` |
| Port HTTP | `bash scripts/validate-docker-multi-device.sh` |
| Playwright (opt-in) | `MEDOC_LAN_E2E=1 MEDOC_LAN_URL=https://127.0.0.1:8787 npm run test:playwright -w medoc` |
| LAN web build | `bash scripts/validate-lan-web-client.sh` |

## MVP boundary

Mobile/tablet LAN (GAP-14) is out of scope. W7 targets **desktop browser** against the same LAN API.
