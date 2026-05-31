# Deployment topologies — three systems

**Last updated:** 2026-05-26

## Three independent runtimes

| System | Binary / crate | Runs alone? | Data store |
|--------|----------------|-------------|------------|
| **Practice app** | `medoc` (Tauri) | Yes | `medoc.db` (SQLCipher) on host device |
| **LAN server** | `medoc-server` (`medoc-lan-server`) | Yes | Same `medoc.db` path via `--data-dir` |
| **Company server** | `medoc-company-server` | Yes | `company.db` |

Build proof (from repo root):

```bash
cargo build -p medoc -p medoc-lan-server -p medoc-company-server
```

## Admin deployment patterns

### A — Co-located (one machine)

- Run **practice desktop** (`cargo run -p medoc`).
- Enable **embedded LAN** in Einstellungen → System (same `medoc.db`).
- Optional: external tablets use `https://<host>:8787` (LAN client mode).

### B — Split host (two machines)

| Machine | Runs |
|---------|------|
| Admin PC | `medoc` desktop only |
| Small server / NAS | `medoc-server --data-dir <shared or copied db path>` |

Point LAN clients at the server URL. Company portal remains a third process (`medoc-company-server`).

### C — Serverless peer (no dedicated server for satellite)

| Machine | Mode | Role |
|---------|------|------|
| Main workstation | `practice_desktop` or `serverless_peer` | **MASTER** |
| Laptop / second chair | `serverless_peer` | **REPLICA** |

Replica keeps a full local `medoc.db`, records changes in `sync_outbox`, and pushes/pulls over the master’s HTTPS API (`/api/v1/sync/*`) when online. No `medoc-server` required on the replica.

See [serverless-sync.md](./serverless-sync.md) for replication semantics.

## Frontend transport selection

`createPracticeSystem()` (`practice-transport.ts`):

| `DeploymentMode` | Transport |
|--------------------|-----------|
| `practice_desktop` | Tauri IPC |
| `serverless_peer` | Tauri IPC (local DB + background sync) |
| `lan_client` | `HttpPracticeAdapter` → remote LAN |

Configure under **Einstellungen → System → Bereitstellung & Sync**.
