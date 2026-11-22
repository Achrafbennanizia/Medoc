# Small, single-purpose files

Each file does one job and holds only the functions that job needs. This keeps changes local, reviews short and merge conflicts rare as the team grows. It applies the SOLID principles at file level:

| Principle | What it means for a file here |
|---|---|
| Single responsibility | One reason to change: a component, a hook, a pure helper, *or* a data adapter, never all four. |
| Open/closed | New behaviour is added as a new file or entry, not as another branch in a long `if/else` (see `dev-capture/registry.ts`). |
| Liskov / interface segregation | Small typed props and inputs (e.g. `DiagnosticsInput`), not the whole app state. |
| Dependency inversion | Pure logic takes its inputs as arguments, so it can be tested without the UI or the backend. |

## Limits (checked in CI)

| Type | Max lines |
|---|---|
| `.ts`, `.tsx`, `.css`, `.mjs` | 400 |
| `.rs` | 600 (unit tests live in the same file) |

Run `npm run check:size`. CI fails when:
- a **new** file is over the limit, or
- a file listed in `scripts/file-size-baseline.json` (131 files that were over the limit when this rule was introduced) **grows**.

After shrinking a listed file, run `node scripts/check-file-size.mjs --update` to lock in the smaller size. The baseline only ever goes down. To see the ranked list: `node scripts/check-file-size.mjs --report`.

## How to split

1. **Pure logic first.** Move calculations, formatting and decision rules into a `.ts` file with a unit test (`about-diagnostics.ts`, `queues-for-path.ts`, `resolveCalendarWorkflowsMerge`).
2. **One component per part of the screen.** Put them in a folder named after the screen (`help/about/`, `appointment-grid/`, `layouts/shell/`), and keep the old file as a short composer or a re-export so imports elsewhere don't change.
3. **State clusters become hooks** (`use-sidebar-rail.ts`, `use-ui-zoom.ts`): state, effects and the actions on it together.
4. **Non-component exports stay out of `.tsx` files** (constants, hooks, helpers), so React fast refresh keeps working.

## Translations

- **Every** text a user can see lives in `packages/shared/locales/<lang>.json` (`en`, `de`, `fr`, `ar`). That includes the legal wording printed on documents (`document.legal.*`).
- A new text is added to **all four files, under the same key**. There are no translation tables in code, scripts or patch files.
- `npm run i18n:verify` (the same keys in every language) and `npm run i18n:scan` (no hardcoded UI text) run in CI.

## Splitting plan for the remaining large files

Order: the most-edited screens first (most conflicts), then the core Rust modules, which need careful review. The current list is from `--report`.

| Lines | File | Split into |
|---|---|---|
| 2949 | `medoc-sync/src/engine/run.rs` | push, pull, mesh, reconcile and the run report, one module each |
| 1964 | `medoc-core/.../pdf/clinical_layout.rs` | one module per document section (header, findings, treatment, signature) |
| 1919 | `views/pages/appointments.tsx` | toolbar, filters, drag handling hook, drawer wiring, data hook |
| 1831 | `medoc-core/.../documents/issue.rs` | one module per document type |
| 1571 | `views/pages/statistics.tsx` | one file per tab plus a shared chart wrapper |
| 1466 | `views/pages/staff-work-plan.tsx` | rules editor, calendar, assignment panel, data hook |
| 1260 | `views/layouts/app-layout.tsx` | started (`layouts/shell/`); next: account menu, notification wiring, native-menu bridge hook, keyboard shortcuts hook |
| 1205 | `pages/patient-detail/patient-detail.tsx` | one file per tab (some already are) plus a data hook |
| 1087 | `styles/pages/appointments-cards.css` | block, status pills, drag states, density variants |
