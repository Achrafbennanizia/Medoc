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

**Docker (Linux container, from repo root; Docker Desktop required):**

```bash
# Build once
docker build -f docker/ci/Dockerfile.rust-wave-v1 -t medoc-rust-wave-v1:latest .

# Rust Wave V1 scoped: fmt, clippy, tests, in-process e2e (excludes live port tests)
docker run --rm --shm-size=4g -e CARGO_BUILD_JOBS=1 \
  -v "$PWD:/work" \
  -v medoc-cargo-registry:/usr/local/cargo/registry \
  -v medoc-cargo-git:/usr/local/cargo/git \
  -v medoc-target-linux-e2e:/work/target \
  medoc-rust-wave-v1:latest

# Full pipeline: frontend + lan-web + Rust + e2e + multi-device (optional Tauri: VALIDATE_DOCKER_FULL=1)
bash scripts/validate-docker.sh
```

Details: [`docs/coordination/validation.md`](docs/coordination/validation.md).

CI: `.github/workflows/verify.yml` (repo root).

Legacy `app/` directory — see [`app/README.md`](app/README.md).

## Documentation

- Architecture: [`docs/architecture/three-systems.md`](docs/architecture/three-systems.md)
- Coordination ledgers: [`docs/coordination/`](docs/coordination/)
