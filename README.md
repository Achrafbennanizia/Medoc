# MeDoc

Monorepo für **MeDoc** (Zahnarztpraxis-Management).

## Produkt (CI / Release)

- **`app/`** — **Tauri 2**-Desktop: React + Vite-Frontend, Rust-Backend, lokale SQLite (`medoc.db`).
- CI (`.github/workflows/ci.yml`): `cargo check` / `cargo test` in `app/src-tauri`, `npm run build` in `app/`.

## Web-Referenz / Prototyp

- **`src/`** — separate **Next.js**-Anwendung (NextAuth, Prisma, PostgreSQL). **Nicht** Teil des Desktop-CI; dient Referenz, Experimenten oder parallelen UI-Spikes. Details: [`src/README.md`](src/README.md).

## Dokumentation

- V-Modell und Anforderungen: [`docs/v-model/`](docs/v-model/)
- Architektur (Desktop): [`docs/architecture/architecture-design.md`](docs/architecture/architecture-design.md)

## Kurzkommandos

```bash
# Desktop-Frontend bauen
cd app && npm ci && npm run build

# Rust-Tests
cd app/src-tauri && cargo test --tests
```
# Medoc_app
# Medoc_app
# Medoc
