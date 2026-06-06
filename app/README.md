# MeDoc — repository layout

The monorepo is organized into **apps**, **crates**, and **packages**:

```
Medoc/
├── apps/
│   ├── practice-host/       Tauri desktop binary (`medoc`)
│   ├── practice-host-ui/    React + Vite frontend
│   └── lan-web-client/      Browser-only LAN client (port 1421)
├── crates/                  Rust workspace libraries + server binaries
├── packages/                npm workspace (shared, ui, system-*)
├── config/                  rbac.yaml, enums.yaml
├── scripts/                 validate-three-systems.sh, …
├── Cargo.toml               Rust workspace root
└── package.json             npm workspace root
```

## Quick start

```bash
# Rust (from repo root)
export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32
export MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export MEDOC_AUDIT_KEY="k9-medoc-test-audit-key-32bytes!"
cargo check --workspace

# Frontend + Tauri dev
npm ci
npm run dev          # Vite on :1420
npm run dev:lan-web  # LAN browser client on :1421
npm run tauri dev    # full desktop app

# Isolation checks
./scripts/validate-three-systems.sh
./scripts/validate-fe-three-systems.sh
./scripts/validate-lan-web-client.sh
```

The legacy `app/` directory is retired; use paths above.
