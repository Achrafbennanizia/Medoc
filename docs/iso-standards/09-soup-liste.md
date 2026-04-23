# SOUP-Liste (Software of Unknown Provenance)

**Standard-Bezug:** IEC 62304 §5.3.4, §8.1.2 (NFA-PROC-02)
**Stand:** 2026-04-19
**Verantwortlich:** MeDoc Engineering

> SOUP = bereits existierende Software, deren Entwicklungsprozess uns nicht
> vollständig dokumentiert vorliegt. Für Klasse-B-Software (IEC 62304) müssen
> alle SOUP-Komponenten inventarisiert, versioniert und auf bekannte Risiken
> bewertet werden.

## Bewertungsmethodik

| Risiko | Kriterium |
|--------|-----------|
| **Niedrig** | Reifes Projekt (>3 Jahre), aktive Wartung, kein direkter Patientendaten-Pfad |
| **Mittel** | Beteiligt an Datenverarbeitung oder UI, gepflegt, aber jüngere Codebase |
| **Hoch** | Kritischer Pfad (Krypto/Persistenz), Sicherheits-relevant, oder unzureichend gepflegt |

Alle Versionen sind in `app/src-tauri/Cargo.lock` und `app/package-lock.json`
fixiert (deterministische Builds).

---

## Backend (Rust / Cargo)

| Komponente | Version | Funktion | Lizenz | Risiko | Mitigationen |
|-----------|---------|----------|--------|--------|--------------|
| `tauri` | 2.x | Application Shell, IPC | Apache-2.0/MIT | Mittel | LTS-Branch, monatliches Audit, CSP gehärtet |
| `tauri-build` | 2.x | Build-Time-Glue | Apache-2.0/MIT | Niedrig | Build-only |
| `tauri-plugin-shell` | 2.x | Shell-API | Apache-2.0/MIT | Niedrig | Capabilities restriktiv |
| `serde` / `serde_json` | 1.x | (De-)Serialisierung | Apache-2.0/MIT | Niedrig | De-facto Standard |
| `sqlx` | 0.8 | DB-Zugriff (SQLite) | Apache-2.0/MIT | Mittel | Prepared Statements, FromRow-Mapping |
| `chrono` | 0.4 | Zeit/Datum | Apache-2.0/MIT | Niedrig | UTC-only API verwendet |
| `bcrypt` | 0.17 | Legacy-Passwort-Hashes | Apache-2.0/MIT | Mittel | Migration zu Argon2 läuft, nur lesend |
| `argon2` | 0.5 | **Aktueller Passwort-Hash (NFA-SEC-01)** | Apache-2.0/MIT | **Hoch** | OWASP-Parameter, RustSec-Watch |
| `jsonwebtoken` | 9 | Session-Tokens (intern) | MIT | Mittel | HS256, lokal signiert |
| `uuid` | 1 | Identifier | Apache-2.0/MIT | Niedrig | v4, OS-RNG |
| `thiserror` | 2 | Error-Ableitung | Apache-2.0/MIT | Niedrig | Compile-time |
| `tokio` | 1 | Async-Runtime | MIT | Mittel | Single-thread Pool, kein unsafe |
| `tracing` / `tracing-subscriber` / `tracing-appender` | 0.1 / 0.3 / 0.2 | **Audit-Logging (NFA-LOG)** | MIT | **Hoch** | 7-Channel-Setup, Rotation |
| `rand` | 0.8 | Krypto-Zufall | Apache-2.0/MIT | Mittel | OsRng |
| `hmac` / `sha2` | 0.12 / 0.10 | **Audit-Chain (NFA-SEC-04)** | Apache-2.0/MIT | **Hoch** | RustCrypto |
| `ed25519-dalek` | 2 | Audit-Signatur | BSD-3 | **Hoch** | RustCrypto, konstante Zeit |
| `zeroize` | 1 | Speicher-Wipe | Apache-2.0/MIT | Mittel | Derive auf Secret-Strukturen |
| `base64` | 0.22 | Transport-Encoding | Apache-2.0/MIT | Niedrig | Standard |
| `zip` | 2 | Log-Export | MIT | Niedrig | Nur deflate, kein zip64 nötig |
| `regex` | 1 | Pattern-Matching | Apache-2.0/MIT | Niedrig | Backtracking begrenzt |
| `dirs` | 5 | OS-Pfad-Auflösung | Apache-2.0/MIT | Niedrig | Read-only Helper |
| `filetime` (dev) | 0.2 | Test-Helfer | Apache-2.0/MIT | Niedrig | Nur Tests |

### Transitive Dependencies
Werden über `cargo tree` reproduzierbar erfasst. CI-Job `cargo audit` läuft
wöchentlich, blockiert Builds bei `RUSTSEC-`-Advisories der Stufe „high".

---

## Frontend (Node / npm)

| Komponente | Version | Funktion | Lizenz | Risiko | Mitigationen |
|-----------|---------|----------|--------|--------|--------------|
| `react` / `react-dom` | 19.1 | UI-Framework | MIT | Mittel | LTS, kein dangerouslySetInnerHTML |
| `react-router-dom` | 7.6 | Routing | MIT | Niedrig | Nur Hash-/Memory-Router |
| `@tauri-apps/api` | 2.5 | Bridge | Apache-2.0/MIT | Mittel | Whitelist via capabilities |
| `@tauri-apps/plugin-shell` | 2.2 | Shell-Bridge | Apache-2.0/MIT | Niedrig | Restriktiv |
| `zustand` | 5.0 | State-Mgmt | MIT | Niedrig | Lokaler Store |
| `zod` | 3.25 | Schema-Validierung | MIT | Niedrig | Eingaben am Bridge-Rand |
| `date-fns` | 4.1 | Zeit-Helfer | MIT | Niedrig | Read-only |
| `recharts` | 2.15 | Diagramme | MIT | Niedrig | Nur Aggregat-Daten |
| `clsx` / `tailwind-merge` | 2.1 / 3.3 | CSS-Helfer | MIT | Niedrig | Compile-time |
| `tailwindcss` | 3.4 | CSS-Framework | MIT | Niedrig | Build-time |
| `vite` (dev) | 6.3 | Build-Tooling | MIT | Niedrig | Nur Dev/Build |
| `typescript` (dev) | 5.8 | Sprache | Apache-2.0 | Niedrig | Build-time |
| `@vitejs/plugin-react` (dev) | 4.5 | Build-Plugin | MIT | Niedrig | Build-time |
| `autoprefixer` / `postcss` (dev) | 10.4 / 8.5 | CSS-Processor | MIT | Niedrig | Build-time |
| `@types/*` (dev) | 19.1 | Typ-Definitionen | MIT | Niedrig | Build-time |

`npm audit --omit=dev` wird als CI-Schritt geblockt bei „high"/„critical".

---

## Plattform-SOUP

| Komponente | Version | Funktion | Bezugsquelle |
|-----------|---------|----------|--------------|
| Rust Toolchain | 1.78+ stable | Compiler | rustup.rs (signiert) |
| Node.js | 20 LTS | Frontend-Build | nodejs.org (SHA256-verifiziert) |
| SQLite | gebündelt via sqlx | Persistenz | sqlite.org |
| WebView2 / WKWebView | OS-Komponente | UI-Renderer | Microsoft / Apple |

---

## Änderungsprotokoll

| Datum | Änderung | Verantwortlich |
|-------|----------|----------------|
| 2026-04-19 | Initiale Inventur (62 SOUP-Komponenten) | Engineering |

---

## Review-Zyklus

- **Monatlich**: `cargo audit` + `npm audit` ausführen, neue Advisories triagieren.
- **Vor Release**: SOUP-Liste mit `Cargo.lock` und `package-lock.json` abgleichen.
- **Quartalsweise**: Risiko-Bewertung der Hoch-Risiko-Komponenten (Krypto, Tauri, Logging) prüfen.
