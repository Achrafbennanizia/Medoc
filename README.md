# MeDoc

Monorepo für **MeDoc** (Zahnarztpraxis-Management).

## Produkt (CI / Release)

**Das auslieferbare Produkt ist ausschließlich die Tauri-Desktop-App unter `app/`.** Es gibt kein separates Web-Frontend oder `src/`-Root-Paket im Release-Pfad; alle UI-, IPC- und Datenbankpfade liegen in `app/`.

| Pfad | Rolle |
| ---- | ----- |
| **`app/`** | **Tauri 2**-Desktop: React + Vite (`app/src/`), Rust-Backend (`app/src-tauri/`), lokale SQLite (`medoc.db`, SQLCipher) |
| **`docs/`** | V-Modell, Anforderungen, Architektur, Koordination (`docs/coordination/`) |
| **`config/`** | Codegen-Quellen (z. B. `rbac.yaml`, `enums.yaml`) |

CI (`.github/workflows/ci.yml`): `cargo check` / `cargo test` in `app/src-tauri`, `npm run lint` / `npm test` / `npm run build` in `app/`.

## Dokumentation

- V-Modell und Anforderungen: [`docs/v-model/`](docs/v-model/)
- Architektur (Desktop): [`docs/architecture/architecture-design.md`](docs/architecture/architecture-design.md)

## Kurzkommandos

```bash
# Desktop-Frontend bauen
cd app && npm ci && npm run build

# Rust-Tests
cd app/src-tauri && cargo test --tests

# Lokale Tauri-Entwicklung (stabiler SQLCipher-Key + Demo-Seed)
bash tools/dev-tauri.sh
```
