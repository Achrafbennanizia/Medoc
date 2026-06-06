# MeDoc

Monorepo for **MeDoc** (Zahnarztpraxis-Management) — three independently runnable systems.

## Repository layout

```
Medoc/
├── apps/
│   ├── practice-host/       Tauri desktop binary (`medoc`)
│   ├── practice-host-ui/    React + Vite (Tauri shell)
│   └── lan-web-client/      Browser client → LAN HTTPS (no Tauri)
├── crates/                  Rust workspace (app / server / shared)
├── packages/                npm workspace (shared / ui / system-*)
├── Cargo.toml               Rust workspace root
└── package.json             npm workspace root
```

## Quick start

```bash
export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32
export MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export MEDOC_AUDIT_KEY="k9-medoc-test-audit-key-32bytes!"

npm ci
npm run dev              # practice desktop UI (Vite :1420)
npm run tauri dev        # full Tauri app
npm run dev:lan-web      # LAN browser client (:1421)

cargo check --workspace
cargo run -p medoc-lan-server
cargo run -p medoc-company-server
```

## Validation

```bash
./scripts/validate-three-systems.sh
./scripts/validate-fe-three-systems.sh
./scripts/validate-lan-web-client.sh
npm test && npm run build
```

CI: `.github/workflows/ci.yml` (repo root).

Legacy `app/` directory — see [`app/README.md`](app/README.md).

## Documentation

- Architecture: [`docs/architecture/three-systems.md`](docs/architecture/three-systems.md)
- Coordination ledgers: [`docs/coordination/`](docs/coordination/)
