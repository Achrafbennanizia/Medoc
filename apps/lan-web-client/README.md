# MeDoc LAN Web Client

Browser-only client for a remote **medoc-lan-server** over HTTPS. No Tauri, no local SQLite.

## Run

```bash
# from repo root
npm run dev:lan-web     # http://localhost:1421

# against a running LAN server
cargo run -p medoc-lan-server
```

## Architecture

- **Transport:** `HttpPracticeAdapter` via `src/practice-http-shim.ts` (Vite alias replaces Tauri adapters).
- **Features:** login, session restore, patient list + detail, appointments by date, own profile (`/me`), logout.
- **Packages:** `@medoc/system-practice`, `@medoc/system-lan`, `@medoc/shared`, `@medoc/ui`.
- **Styles:** reuses `apps/practice-host-ui/src/index.css`.

## Validate

```bash
./scripts/validate-lan-web-client.sh
```
