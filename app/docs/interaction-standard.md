# MeDoc Interaction Standard

This document defines the default interaction behavior used across the app and must be reused for future views.

## Core Principles

- Use one interaction language across all screens: same spacing, same sizes, same open/close behavior.
- Every trigger must provide clear feedback: navigation, action, or an info toast if the feature is not implemented yet.
- Keep overlays predictable: open near the trigger, close on outside click and `Escape`.
- Prefer reusable classes and tokens from `app/src/index.css` and `app/src/lib/interaction-standards.ts`.

## Standard Building Blocks

- **Dialog pattern**: `Dialog` / `ConfirmDialog` from `app/src/views/components/ui/dialog.tsx`.
- **Overlay dismissal hook**: `useDismissibleLayer` from `app/src/views/components/ui/use-dismissible-layer.ts`.
- **Dropdown pattern**: `.menu-surface`, `.menu-header`, `.menu-list`, `.menu-item`, `.menu-sep`.
- **Button sizes**: use `INTERACTION_STANDARD.control` values for icon and compact controls.
- **Surface sizing**: use `INTERACTION_STANDARD.dropdown` and `INTERACTION_STANDARD.dialog`.

## Modal Rules

- Backdrop + centered panel only (`.modal-backdrop`, `.modal`).
- Keep confirm actions in `.modal-actions` (cancel left, primary/destructive right).
- Confirm dialogs use the standardized content structure (`.confirm-body`, `.confirm-title`, `.confirm-text`).
- Modal must trap focus and restore focus on close.

## Dropdown Rules

- Dropdown opens with scale/fade motion (`popIn`) and closes on:
  - click outside
  - `Escape`
  - action selection (when navigation or destructive action is triggered)
- Implement close behavior through `useDismissibleLayer` to keep behavior identical.
- Group menu entries by intent (role, preferences, session).
- Use compact rows (`.menu-item`) to preserve scanability and avoid visual noise.

## Composition Rules

- Primary topbar/shell controls use 34px icon buttons.
- Dense contextual controls use 28px icon buttons.
- Keep content width aligned with current page cards and avoid oversized flyouts.
- Any new view introducing dropdown/modal behavior must adopt these same classes and token values.
