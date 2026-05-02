# Page layout standard (MeDoc)

Canonical **vertical order** for list/report modules (Patienten, Bestellungen, Finanzen, Audit, etc.):

1. **Page header** — `page-title`, `page-sub`, **primary CTA top-right** (`page-head`: title/block left, actions right; primary „+ Neu …“ rightmost in LTR).
2. **Filters & view controls** — search ( **`flex: 1 1`**, `min-width: 0` ), status/type dropdowns or segments (**content-width**), date range, density (if page-specific). Must appear **above** the listing they affect.
3. **Result summary** — counts, „X von Y“, „Stand …“ (optional line between filters and table).
4. **Content** — table (wrap in `.tbl-scroll` if columns can overflow), cards, or calendar.
5. **Pagination / „Mehr laden“** — below content.
6. **Bulk action bar** — only with selection; **sticky bottom** when introduced.

## Toolbar flex

- **Search** → `page-toolbar__search` or `flex: 1 1 220px; min-width: 0`.
- **Filters / selects** → `page-toolbar__filters` or `flex: 0 1 auto`; avoid making search narrower than adjacent dropdowns.

## Split layouts (Produkte, Leistungen, Personal, Vorlagen)

- Header + CTAs still follow rule (1).
- List is **filter target**; any future global filter row sits **above** the `*-workspace` grid.

## Abbreviations

- Use `app/src/lib/abbreviations.ts` + `ResponsiveLabel` for labels that must shorten in **narrow containers** — not raw CSS ellipsis for semantics.

## Breakpoints

- CSS: `--bp-sm` 640px, `--bp-md` 900px, `--bp-lg` 1200px (`index.css`).  
- TS: `app/src/lib/breakpoints.ts`.
