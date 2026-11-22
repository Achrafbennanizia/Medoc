# Practice-host styles

Two kinds of files:

- **Rule files** hold CSS. Each one is small (at most 400 lines, checked by `npm run check:size`) and is named after the component or page that uses its classes. Its folder mirrors the code:

| Styles folder | Code it styles |
| --- | --- |
| `views/pages/<page>.css`, `views/pages/<page>/<part>.css` | `apps/practice-host-ui/src/views/pages/<page>.tsx` |
| `views/components/…`, `views/layouts/…` | `apps/practice-host-ui/src/views/components/…`, `…/layouts/…` |
| `practice-host/pages/…` | `packages/app/practice-host/src/pages/…` |
| `ui/<component>.css` | `packages/ui/src/<component>.tsx` and `views/components/ui/` |
| `shared/<class>.css` | Classes used across many screens (`.card`, `.tbl`, `.btn` …) |
| `tokens/`, `base/` | Custom properties and element defaults; no component owner |
| `themes/<theme>/…`, `responsive/<file>/…` | Overrides for one theme or breakpoint, same mirrored path inside |

- **Manifests** list rule files in cascade order: `src/index.css` and the ITCSS files under `layout/`, `components/`, `features/`, `pages/`, `themes/` and `responsive/`. They contain only `@import` lines.

The split into rule files was done by a script and verified. The compiled CSS has the same 2,889 rules in the same order as before; only `@layer` block boundaries differ, and they don't affect the cascade.

## Rules

1. **Import order is cascade order.** A rule file is imported from exactly one manifest, at the position its specificity needs. Theme and breakpoint overrides stay in `themes/` and `responsive/` because they must load last.
2. **Add a rule to the file named after its component.** If the component has no file yet, create it in the mirrored folder and import it from the manifest of its layer (`features/<area>.css` for a domain block, `pages/<page>.css` for a page layout).
3. **One owner per selector.** Before adding `.foo`, search for it and extend the file that already owns it.
4. **Same class family in two places** (a file ending in `-2.css`) means the original cascade put other rules in between. Merge them only after checking that no rule in between styles the same elements.
5. **Tokens, not numbers.** Spacing uses `--space-*`, page rhythm `--page-stack-gap`, table cells `--tbl-cell-pad-x`. New magic numbers need a token.
6. **Logical properties.** Use `padding-inline-*`, `margin-inline-*` and `inset-inline-*` so Arabic (RTL) mirrors correctly. Use physical `left`/`right` only with a matching `html[dir="rtl"]` rule.
7. **Tables** use `DataTable` (`packages/ui/src/data-table.tsx`): widths come from column definitions, and secondary columns use `hideBelow`, which follows the table's own width.
8. **No inline styles for layout** in new code. Inline style is fine only for runtime values (computed positions, CSS variables).
9. Run `npm run css:tokens` and `npm run check:size` after changes.
