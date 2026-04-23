# Phase 6 — Modultest (Unit)

**Testgegenstück zu:** [`../04-modulentwurf/`](../04-modulentwurf/) (Modulentwurf).

## Zweck

Verifikation einzelner Module / Funktionen gegen die im Modulentwurf beschriebenen Verantwortlichkeiten.

## Traceability (Zielbild)

| Modul / Komponente (Doku) | Testart | Ort im Repo |
|---------------------------|---------|-------------|
| RBAC, Crypto, Payment, … | Rust `#[test]` | `app/src-tauri/tests/*.rs`, `src/**` inline tests |
| UI / Hooks | Vitest (`npm test`) | `app/src/**/*.test.ts(x)` |

## Referenzen

- CI führt aus: `cargo test --tests`, `npm test`, `npm run build`
