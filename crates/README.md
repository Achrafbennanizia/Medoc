# MeDoc Rust crates

Three **independently runnable systems** share libraries under `shared/`.

```
crates/
├── app/          Practice desktop (Tauri IPC)
├── server/       Standalone HTTP servers (LAN + Company)
├── shared/       Domain, DB, sync engine, codegen
└── test/         Cross-system integration tests
```

## Runnable systems

| System | Package | Build / run |
|--------|---------|-------------|
| Practice app | `medoc` (`src-tauri/`) | `cargo build -p medoc` |
| LAN server | `medoc-lan-server` | `cargo build -p medoc-lan-server` |
| Company portal | `medoc-company-server` | `cargo build -p medoc-company-server` |

Validate all three in isolation:

```bash
export MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32
export MEDOC_DB_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export MEDOC_AUDIT_KEY="k9-medoc-test-audit-key-32bytes!"
./scripts/validate-three-systems.sh
```

## TypeScript packages

Frontend tiers live in `packages/` — see [`../packages/README.md`](../packages/README.md).

```
medoc (Tauri)
  └── medoc-practice
        ├── medoc-core
        ├── medoc-lan      (embedded LAN in desktop)
        ├── medoc-company  (client adapter)
        └── medoc-sync

medoc-lan-server
  └── medoc-lan
        ├── medoc-core
        └── medoc-sync

medoc-company-server
  └── medoc-company
        └── medoc-core
```

**App must not** depend on server binaries. **Servers must not** depend on `medoc-practice` or Tauri.

## TypeScript packages

Frontend tiers live in `packages/` — see [`../packages/README.md`](../packages/README.md).
