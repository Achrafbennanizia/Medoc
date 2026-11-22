# Larger click targets — work plan

Setting: Settings → Appearance → Accessibility & comfort → **Larger click targets** (`html[data-targets="large"]`).
Audience: touchscreens, tremor, low vision, and anyone who misses small buttons.
Standard: WCAG 2.2 — 2.5.5 *Target Size (Enhanced)*, AAA: at least **44 × 44 CSS px**; 2.5.8 *Target Size
(Minimum)*, AA: at least 24 × 24 px or enough spacing.

## Phase 1 — Global rule (done)

`styles/themes/accessibility.css`, section "Larger click targets".

| What | Rule |
|---|---|
| Everything clickable, selected **by role** (`button`, `[role=tab|menuitem|option|switch|button]`, nav items, option bars, fields, table rows) | `min-height: 44px` |
| Icon-only buttons (`.icon-btn`, menu trigger, top-bar actions) | 44 × 44 |
| Checkboxes and radios | 22 px box; the surrounding `<label>` is a 44 px row |
| Neighbouring targets (option bars, row actions, toolbars) | at least 6–8 px apart |
| Table rows, sidebar items | taller padding |
| Keyboard focus | 3 px ring, 2 px offset |

Selecting by role means a new screen is covered as soon as it uses semantic markup. That's the reason for not listing component classes one by one, which is what the old rule did (it covered only 7).

**Exempt on purpose**:
- **Calendar event blocks** (`.week-event-pill`, `.cal-cell-appointment-pill`, day pill slots): their height *is* the appointment's duration, so enlarging them would misrepresent time. The planned alternative is in phase 4.
- **Window buttons**: they follow the OS (Windows, Linux).
- **Inline links inside running text**: WCAG exception.

Any other dense component can opt out with `data-target-exempt`, but only with a documented reason in the component.

## Phase 2 — Measure (tool ready)

The dev capture bridge has a `targetAudit` command. On the current page it lists every visible interactive element smaller than 44 px (icon-only ones also under 44 px wide), with its class, label and size.

How to run it:
1. Start the desktop app in dev mode and turn on *Larger click targets*.
2. For each route in the sidebar, send `targetAudit` through the dev capture bridge (`website/scripts/capture-app-screenshots.py`).

Output: a list per page, e.g. `button.cal-nav "Next week" 32x32`.

## Phase 3 — Fix per page (to do, driven by the audit)

Order by how often the page is used with touch or by staff with motor difficulties:
1. Schedule toolbar, appointment drawer, patient list
2. Patient record tabs and the prescription / certificate / payment row actions
3. Dialogs (confirm, export pickers), date and time pickers
4. Administration lists, Settings, Help

Each fix uses tokens. Raise `--input-h` or `--row-h` where possible instead of hard-coding sizes; components that hard-code `height: 32px` move to `min-height`.

## Phase 4 — Dense views

Calendar blocks stay proportional to time. With large targets on, these are the options (to decide with users):
- a minimum visual height of 44 px, where the block overlaps the next slot visually, but its start and end stay correct in the time labels;
- or tap opens a bottom sheet listing all appointments in that slot (one big target per appointment).

## Phase 5 — Keep it fixed

- Run the `targetAudit` pass on every route before a release; the result should be "0 small targets" outside the exempt list.
- New components: semantic roles plus `min-height` (never a fixed `height`) on interactive elements.

## Relation to other settings

| Setting | Effect on targets |
|---|---|
| Density: Compact | Smaller paddings. *Larger click targets* still enforces 44 px, so the two combine safely. |
| Text size Large and above | Scales everything, including targets. On small screens the cap is 110 %, so targets don't push layouts off screen. |
