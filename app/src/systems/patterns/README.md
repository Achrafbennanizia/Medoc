# Design patterns in MeDoc frontend systems

See **`docs/architecture/three-systems.md`** for the full 23-pattern map across Rust + TypeScript.

Quick reference for this folder:

- **Port** (`*/ports/*.port.ts`) — Interface Segregation + Dependency Inversion
- **Adapter** (`*/adapters/tauri-*.adapter.ts`) — Tauri IPC today; swap for HTTP without changing controllers
- **Facade** (`registry.ts`) — `systems.practice` / `systems.lan` / `systems.company`
- **Proxy** (future) — `HttpPracticeAdapter` calling LAN `https://host:8787/api/v1`
