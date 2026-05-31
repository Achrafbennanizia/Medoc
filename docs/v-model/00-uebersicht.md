# MeDoc — V-Modell Übersicht

## Projektname
**MeDoc** – Praxismanagementsystem für Zahnarztpraxen

## V-Modell Phasen

```
  Anforderungsanalyse ─────────────────────────── Abnahmetest
         │                                              │
    Systementwurf ───────────────────────── Systemtest
         │                                         │
   Architekturentwurf ──────────────── Integrationstest
         │                                    │
     Modulentwurf ──────────────── Modultest (Unit)
         │                              │
         └──── Implementierung ─────┘
```

## Phasenübersicht

| Phase | Dokument | Testgegenstück | Status |
|-------|----------|----------------|--------|
| 1. Anforderungsanalyse | `01-anforderungen/` | `06-abnahmetest/` | In Arbeit |
| 2. Systementwurf | `02-systementwurf/` | `07-systemtest/` | Vorlagen (README) |
| 3. Architekturentwurf | `03-architektur/` | `08-integrationstest/` | Vorlagen (README) |
| 4. Modulentwurf | `04-modulentwurf/` | `09-modultest/` | Vorlagen (README) |
| 5. Implementierung | `../app/` (Tauri-Desktop, **CI-kanonisch**) | — | In Arbeit |
| 6. Modultest | `09-modultest/` | ← Modulentwurf | In Arbeit (CI: `cargo test`, `npm test`) |
| 7. Integrationstest | `08-integrationstest/` | ← Architekturentwurf | In Arbeit (Rust-Tests) |
| 8. Systemtest | `07-systemtest/` | ← Systementwurf | Offen (Dokumentation) |
| 9. Abnahmetest | `06-abnahmetest/` | ← Anforderungsanalyse | Offen (UAT) |

## Technologie-Stack (verbindlich: **Desktop** `app/`)

| Komponente | Technologie |
|------------|-------------|
| Desktop-Shell | Tauri 2 |
| Frontend | React 19 + TypeScript + Vite 6 + `react-router-dom` |
| Styling | Tailwind CSS 3 + `apps/practice-host-ui/src/index.css` |
| State | Zustand |
| Backend / IPC | Rust 2021, Tauri-Commands, `sqlx` + SQLite (WAL) |
| Auth (lokal) | Argon2id (bcrypt-Fallback) + Sitzung; Rollen ARZT/REZEPTION/… |
| Tests (CI) | `cargo test` (Backend) + `npm test` (Vitest) + `npm run build` / `tsc` (Frontend) |
| Sprache UI | Deutsch (partiell i18n) |

**Hinweis:** Die Implementierung liegt ausschließlich unter `../app/` (Tauri-Desktop). Historische Next.js-Web-Referenz-Dokumente in `03-architektur/` sind als Archiv gekennzeichnet.

## Zielgruppen (Primäre Nutzer)
- **Arzt/Admin** (Praxisinhaber)
- **Rezeptionist:in** (Empfang)
- Sekundär: Steuerberater, Pharmaberater
