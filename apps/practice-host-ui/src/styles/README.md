# Practice-host styles

`src/index.css` is a **manifest only** — it imports the files below in cascade order. The split was
mechanical and verified: the compiled bundle was byte-identical before and after.

| Folder | Owns | Layer |
| --- | --- | --- |
| `tokens/` | Custom properties (colour, spacing, radius, density, chrome offsets). No selectors. | unlayered `:root` |
| `base/` | Element defaults | `@layer base` |
| `layout/` | App shell, window chrome, sidebar, master–detail panes | components / unlayered |
| `components/` | Reusable primitives: buttons, inputs, **table + DataTable**, toast, overlays, utilities | `@layer components` |
| `features/` | Domain blocks (finance, tasks, settings, help center, notifications, …) | `@layer components` |
| `pages/` | Page-level layouts (calendar, work plan, patient file) | unlayered |
| `responsive/`, `themes/` | Breakpoints, density/sidebar tone, dark overrides — load last | unlayered |

## Rules

1. **Import order is cascade order.** Add a file at the position that matches its specificity needs.
2. **One owner per selector.** Before adding `.foo`, grep — extend the file that already owns it.
3. **Tokens, not numbers.** Spacing uses `--space-*`, page rhythm `--page-stack-gap`, table cells
   `--tbl-cell-pad-x`. New magic numbers need a token.
4. **Logical properties.** Use `padding-inline-*`, `margin-inline-*`, `inset-inline-*` so Arabic (RTL)
   mirrors correctly. Physical `left/right` only with a matching `html[dir="rtl"]` rule.
5. **Tables** use `DataTable` (`packages/ui/src/data-table.tsx`): widths come from column definitions
   (`<colgroup>`), never from `nth-child` rules.
6. **No inline styles for layout** in new code; inline style is acceptable only for runtime values
   (computed positions, CSS variables).
7. Run `npm run css:tokens` after changes (fails on undefined custom properties).
