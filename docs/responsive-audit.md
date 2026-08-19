# Responsive audit (< 900px viewport)

Audit date: 2026-05-02. Breakpoint reference: `--bp-md` / `BP_MD` = **900px** (`app/src/index.css`, `app/src/lib/breakpoints.ts`).  
Method: static code review of layout/CSS (no device lab). **UNVERIFIED** in real browsers until manual pass.

| Page / area | File:line (approx.) | Finding | Proposed fix |
|-------------|---------------------|---------|--------------|
| App shell sidebar | `app-layout.tsx` (sidebar + `app/src/index.css` ~2691+) | Prior: drawer hid entire nav below 1000px; no persistent icon affordance. | **Done:** ≤899px icon rail + hamburger overlay; ≥900px optional `data-sidebar-rail="icons"`. |
| Top bar | `app-layout.tsx` + `.topbar` in `index.css` | Actions wrap; crumbs long — risk of horizontal pressure. | Keep wrap; crumb `overflow-wrap: anywhere` (existing). |
| Patienten | `patients.tsx` ~194–244 | Search lived in header beside CTAs; status segment below; search narrower than ideal next to buttons. | **Done:** toolbar row: search `flex:1`; header CTAs top-right. |
| Patienten table | `patients.tsx` ~280–284 | Grid columns may overflow on small widths. | Add **Done:** `tbl-scroll` wrapper; use `ResponsiveLabel` on key headers. |
| Bestellungen | `purchase-orders.tsx` ~131–162 | Filters hidden when `rows.length === 0` — filters not before content. | **Done:** show toolbar whenever list loaded/empty-with-zero. |
| Audit | `audit.tsx` ~112–142 | `.tbl` in card without horizontal scroll — wide rows clip. | **Done:** `tbl-scroll` + summary before table. |
| Finanzen | `finance.tsx` ~510+ | Wide transaction table, status dropdowns — overflow risk. | **Done:** `finance-tx__scroll` already scrolls; ensure min-width preserved. |
| Statistik | `statistics.tsx` ~571+ | Left nav + charts — workspace may feel crowded. | Monitor; nav is filter for panel (order OK). Recharts uses responsive width. |
| Dashboard („Posteingang“) | `dashboard.tsx` ~108–118 | CTAs: secondary left of primary; spec wants primary top-right. | **Done:** order `Neu` last (right in LTR). |
| Vorlagen | `vorlagen-prescriptions-certificates.tsx` | Table `minWidth: 480` inside card — OK with scroll. | Ensure parent `overflow-x: auto` (present on card). |
| Leistungen / Produkte / Personal | `services.tsx`, `products.tsx`, `staff.tsx` | Split panes stack on small screens via CSS — verify workspace CSS. | Grep `products-workspace` / `services-workspace` — add `tbl-scroll` if missing. |
| Einstellungen | `settings.tsx` | Many rows — settings two-column split may crowd. | Existing `settings-shell` grid — consider single column <900 (future). |

**Tables — horizontal scroll affordance:** Prefer wrapping any `table.tbl` in `.tbl-scroll` (see `index.css`).

**Buttons:** Prefer `white-space: nowrap` on `.btn` only when short; long German labels should wrap at word boundaries — avoid mid-word breaks via normal `word-break` (default).

## Follow-up (not done in this pass)

- Full device QA on iOS/Android WebView.
- Replace remaining hard-coded abbreviations with `LABELS` + `ResponsiveLabel` incrementally.
