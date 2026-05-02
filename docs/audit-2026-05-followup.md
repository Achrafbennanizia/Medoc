# MeDoc codebase audit — 2026-05 follow-up

**Baseline:** `docs/audit-2026-05.md`  
**Scope:** Same as baseline (`app/src/`, `app/src-tauri/`).  
**Session date:** 2026-05-01 (verification / documentation only; **no new product features**).

---

## Executive summary

| Original severity in baseline | Count | Follow-up disposition |
|-------------------------------|-------|------------------------|
| **Blocker** | 2 | **Resolved** in code (enum / serde alignment — evidence below) |
| **Major** (non-blocker) | Remain; see per-row **Won’t fix** or **Open** / **Deferred** |

---

## A. Schema / DTO drift — blockers

| # | Baseline finding | Status | Evidence |
|---|------------------|--------|----------|
| A1 | **TerminArt** Zod/TS/Rust/DB mismatch (`ROUTINE`/`NOTFALL` vs backend) | **Resolved** | `app/src/models/types.ts` lines 10–12: `TERMIN_ART_VALUES` matches Rust `TerminArt` (five arts, no `NOTFALL`); `app/src/lib/schemas.ts` lines 76–77: `TerminArtSchema` uses `TERMIN_ART_VALUES`; `app/src-tauri/src/domain/enums.rs` lines 23–29: same variant set. |
| A2 | **TerminStatus** `NICHTERSCHIENEN` vs `NICHT_ERSCHIENEN` serde/SQLite | **Resolved** | `app/src/models/types.ts` line 15: `NICHT_ERSCHIENEN`; `app/src-tauri/src/domain/enums.rs` lines 37–40: `#[serde(rename = "NICHT_ERSCHIENEN")]` + `termin_status_serde_tests`; `app/src/lib/schemas.ts` line 77: `TerminStatusSchema` from `TERMIN_STATUS_VALUES`. |

### A. Other baseline §A items (non-blockers)

| # | Finding | Status | Note |
|---|---------|--------|------|
| A3 | ZahlungsArt `VERSICHERUNG` in Zod | **Resolved** | `ZAHLUNGS_ART_VALUES` in `types.ts` line 24 is `RECHNUNG` (no `VERSICHERUNG`); schema uses same tuple (`schemas.ts` 126). |
| A4 | ZahlungsStatus ordering TS vs Zod | **Open / cosmetic** | Values match; ordering only. **Won’t fix** unless churn is justified. |
| A5 | `CreateLeistungSchema` vs Rust | **Deferred** | Schema now uses `name` + Rust-shaped fields (`schemas.ts` 179–184). Baseline “unused” risk reduced; full Rust DTO parity **not re-audited line-by-line** this session. |
| A6 | Geschlecht / Patient string read | **No change** | As baseline — acceptable pattern. |

---

## B. Tauri IPC casing

| Status | Notes |
|--------|--------|
| **Unchanged** | Still **inferred** from snake_case consistency; **this session did not** run a live WebView serde probe. **Mitigation:** smoke tests call mocked `tauriInvoke` with production-shaped payloads (`app/src/critical-flows.smoke.test.tsx` flows b,c,e). |

---

## C. RBAC

| # | Baseline | Status | Note |
|---|----------|--------|------|
| C1 | TS vs Rust alignment | **Assumed OK** | Not re-diffed line-by-line; no regression tests added for full parity. |
| C2 | Command palette `hilfe` vs `einstellungen` coupling | **Open (Minor)** | **Won’t fix** in this verification pass — product nav acceptable; baseline said low risk. |
| C3 | `personal.read` broad on Verwaltung subtree | **Open (Major)** | **Won’t fix** here — requires product decision + new capability strings + Rust mirror. |

---

## D. localStorage / sensitive keys

| Status |
|--------|
| **Qualitative only** (as baseline). Erasure path: UI uses `clearPatientScopedBrowserStorage` after `dsgvo_erase_patient` (`datenschutz.tsx`); Rust integration test `app/src-tauri/tests/dsgvo_erasure_tests.rs`. |

---

## E–H. Duplicates, dead code, a11y, error swallowing

| Section | Disposition |
|---------|-------------|
| **E** | No refactor — **Won’t fix** (maintenance backlog). |
| **F** | Unused Zod exports — **Open/Minor**; **Won’t fix** in this pass. |
| **G** | a11y samples — **Open**; tracked for future UX pass. |
| **H** | Silent catches — **Open**; no changes in verification pass. |

---

## Validation (this session)

| Command | Directory | Result |
|---------|-----------|--------|
| `npm test` | `app/` | **PASS** — 90 tests (includes `critical-flows.smoke.test.tsx`). |
| `npm run build` | `app/` | **PASS** (esbuild CSS warning on `index.css` line ~3549: `-: TZ.;` — pre-existing, non-blocking). |
| `cargo test` | `app/src-tauri/` | **PASS** when `CARGO_TARGET_DIR` points under workspace (e.g. `app/src-tauri/target`); default sandbox/cursor cache path hit **`libsqlite3-sys` build artifact missing** in one environment. **Recommendation:** use a stable local `CARGO_TARGET_DIR` in CI/docs if seen. |
| `npm run lint` | `app/` | **FAIL** (pre-existing): `schemas.test.ts` unused import; `patient-detail.tsx` react compiler memo warnings; `verwaltung-vertraege.tsx` hooks ordering — **not introduced by verification deliverables**. |

**NOT RUN:** full instrumented Tauri E2E in packaged app; manual click-through of every page.

---

## Smoke tests added (Vitest + jsdom)

| File | Flows |
|------|--------|
| `app/src/critical-flows.smoke.test.tsx` | **(a)** Login → dashboard → logout (mocked IPC + full `App`). **(b)** Patient / akte / Zahnbefund / Stamm validation IPC order. **(c)** Termin → durchgeführt → Zahlung → bezahlt IPC order. **(d)** Tagesabschluss form: cash mismatch + Notiz + protokollieren callback payload. **(e)** Datenschutz: export + erase + legacy `localStorage` key cleared + erase IPC. |

Supporting config: `app/vite.config.ts` (`environmentMatchGlobs`, `setupFiles`), `app/src/vitest-setup.ts` (jest-dom + jsdom `localStorage` shim for Node 22 quirk).

---

## Maintainer docs

| File | Purpose |
|------|---------|
| `docs/README-frontend.md` | Controllers → `tauriInvoke` → Rust; stores; design system; storage policy. |
| `docs/definition-of-done-pages.md` | **DoD matrix:** every `App.tsx` route ↔ component ↔ RBAC key ↔ smoke/manual notes. |

---

## Contradictions vs baseline

None new: baseline already noted §B IPC as inferred without runtime probe; follow-up adds automated **mock-IPC** coverage but **not** a replacement for production IPC serde experiments.

---

*End of follow-up audit.*
