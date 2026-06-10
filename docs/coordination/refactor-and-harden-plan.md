# Master Command — MeDoc System Refactor, Quality Pass, and Workflow Audit

> **Suggested repo location:** `docs/coordination/refactor-and-harden-plan.md`  
> **Stack:** Tauri 2 · Rust (edition 2021, workspace crates) · React 19 + TS + Vite · Zustand  
> **Status:** process command + guardrails. The paste-ready agent prompt is in section 9.

This is a refactor and hardening command, not a rewrite. Its job is to make MeDoc easier to evaluate and extend, raise code quality and visibility, find and fix real defects, and prove that every UI option leads to a logical, consistent, terminable workflow, all without destabilizing a working app. The defining rule is that detection, restructuring, and fixing are three separate activities that never happen in the same commit.

---

## 1. Why this is incremental, not big-bang

A single "refactor everything" pass contradicts the goals you set: keep the app stable, reuse instead of rebuild, and apply KISS and YAGNI. Large simultaneous edits hide regressions, make review impossible, and tend to add abstraction the code does not yet need. So this command works in small, reversible steps, each with the test suite green before and after, each traceable to a specific finding or a named principle. Nothing speculative ships.

Two meanings of *terminable* are enforced:

- **Process terminability.** The refactor itself has a definition of done (section 8). It stops when the register is cleared and the gate passes. No endless polishing.
- **Workflow terminability.** Every UI path reaches a terminal state (success, cancel, or a handled error). No dead ends, no infinite spinners, no screen you cannot leave (section 6).

---

## 2. Cross-cutting rules (apply in every phase)

1. **Separate the three activities.** A behavior-preserving refactor, a defect fix, and a new abstraction are three different commits with three different messages. Never combine them.
2. **Green between every step.** `cargo test`, `cargo clippy` (zero warnings), `cargo fmt --check`, and the frontend `npm run test` + `npm run build` must pass before a step is considered finished. A refactor that changes a test's expected output is not behavior-preserving; treat it as a fix and justify it.
3. **Reuse before rewrite.** Prefer extending or consolidating an existing component, hook, service, or module over creating a new one. Every time you reject reuse and build new, record why in the register. Default answer is reuse.
4. **YAGNI gate on abstraction.** Introduce an interface, trait, generic, or pattern only when at least two concrete present-day call sites need it. One call site is not a pattern; it is speculation.
5. **Every change traces to a finding.** No change without either a register entry (a real defect, conflict, or incompleteness) or a named principle violation it corrects. This is the "no weird/spurious changes" rule: if you cannot name what was wrong, do not touch it.
6. **Respect the regulated context.** Do not silently alter security, crypto, audit, RBAC, or compliance behavior. If a cleanup would change any of those, stop and flag it for human review instead of editing.
7. **Do not fight in-flight work.** The Geräteverbund evolution is active. Do not restructure files that branch is editing. Operate on stable, merged code; coordinate ordering so structural cleanup lands before or between feature phases, not on top of them.
8. **Touch canonical docs only.** Many docs still cite the retired `app/src-tauri` paths. Do not do a broad doc sweep. Update only the coordination ledger and the specific docs a change makes wrong.
9. **Small blast radius.** Bound each pass to one module or one feature area. If a change spreads across more than a handful of files, split it.

---

## 3. Phase A — Inventory and audit (read-only, no edits)

Produce a single triaged register before changing anything. Nothing is modified in this phase.

Scan for and record:

- **Defects:** logic errors, unhandled errors, race conditions, resource leaks, incorrect state transitions, broken or misleading UI behavior.
- **Conflicts:** contradictions between code and the spec/docs, between two modules, or between the retired and live source trees. Cross-check against `docs/coordination/contradictions.md` and `docs/coordination/project-truth.md`; reuse those, do not start a parallel list.
- **Incompleteness:** TODO/FIXME/stubbed functions, half-built features, commands registered but unimplemented, dead code, unreachable branches.
- **Principle violations:** SRP breaks (god modules/components), DRY breaks (duplicated logic), KISS breaks (needless complexity), leaky abstractions, circular dependencies.
- **Duplication between trees:** anything that exists in both the retired `app/src-tauri` / `app/src` references and the live `crates/` + `apps/` + `packages/` layout.

Each entry uses the register format in section 7. Triage by severity: P0 correctness/security, P1 stability/conflict, P2 structure/quality, P3 polish. Output the register, then stop for review before Phase B.

---

## 4. Phase B — Stabilize the safety net

You cannot refactor safely without coverage on what you are about to change.

- Confirm CI is green on the current main as the baseline.
- For each area Phase C or D will touch, ensure characterization tests exist that capture current behavior. Add them where missing. These tests are the contract that proves a refactor changed nothing.
- Do not change behavior here. Only add tests and fix flaky or broken ones.

---

## 5. Phase C — Structure and abstractions (behavior-preserving)

Improve visibility, file structure, and the use of patterns, with no behavior change. Verified by the Phase B tests staying green and unmodified.

Targets, in priority order:

1. **Collapse the duplicate trees.** Make the live `crates/apps/packages` layout the single source; remove or quarantine the retired `app/src-tauri` / `app/src` references so no one builds against the wrong one.
2. **Enforce module boundaries.** In Rust, keep the Clean Architecture direction intact: `commands → application → domain ports → infrastructure`, dependencies pointing inward only. Break any inward/outward violations or cycles.
3. **Consolidate duplication into one home (DRY).** Shared logic moves to `medoc-core` or `packages/shared`; call sites import it instead of copying it.
4. **Apply patterns where they remove real complexity, not for their own sake.** Repository and Service Layer for data and use cases, Adapter for external interfaces, Facade for the `tauri.service.ts` boundary, Strategy where conditionals branch on a stable type, Newtype for validated identifiers. Only where two or more call sites justify it (rule 4).
5. **Frontend consistency.** One pattern for state (Zustand stores), one for IPC (controllers → `tauri.service.ts`), one for shared UI primitives. Consolidate one-off components into the shared package when two or more screens use the same shape.
6. **Naming and visibility.** Consistent names across the boundary, narrow public surfaces, internal items kept private.

Each item is its own behavior-preserving commit. If tests must change, it is not a Phase C item; move it to Phase D.

---

## 6. Phase D — Defect fixes (behavior-changing, one at a time)

Work the register from Phase A, P0 first. Each fix is isolated, carries a test that fails before and passes after, and is committed on its own. Reuse-over-rewrite still applies: fix the existing component rather than replacing it unless replacement is the smaller, clearer change, and record that decision.

---

## 7. Phase E — Workflow completeness and terminability

For every UI option, route, button, and menu item, prove the workflow it starts is logical, consistent, and terminable.

Method:

- Enumerate every entry point (route, primary action, secondary action, empty state, error state).
- Model each as a small state machine: states, transitions, and at least one reachable terminal state.
- **Terminability check:** every path reaches success, cancel, or a handled error. No state lacks an exit. Back and Escape always work. Loading states have a timeout and a failure branch, never an unbounded spinner. Confirmation dialogs can be dismissed. Destructive actions confirm, then resolve to a definite end.
- **Logical check:** the steps match what the user is trying to do, in an order that makes sense, with no step that leads nowhere.
- **Consistency check:** the same kind of action behaves the same way across screens (same confirm pattern, same error surface, same navigation affordance).
- Cross-reference the role model: a workflow offered to a role must be completable by that role, and hidden where the role lacks permission.

Record every dead end, inconsistency, or non-terminating path as a register entry and fix it in this phase. The deliverable is a workflow map plus the fixes.

---

## 8. Phase F — Polish and delivery gate

- Remove dead code and now-unused branches surfaced by earlier phases.
- Final consistency pass on naming, error messages (cause plus next action, per ISO 9241-110), and formatting.
- Sync the canonical docs only: update `docs/coordination/project-truth.md`, resolve closed items in `docs/coordination/contradictions.md`, and record results in `docs/coordination/validation.md` and `docs/coordination/phase-handoff.md`.
- **Definition of done (process terminates here):** register cleared to P2 or lower with the rest explicitly deferred and logged; full CI green; every workflow has a terminal state; no new abstraction without two or more call sites; no commit mixes refactor and fix. When these hold, stop.

---

## 9. Register entry format

```
ID:        R-001
Type:      defect | conflict | incompleteness | principle-violation | duplication
Severity:  P0 | P1 | P2 | P3
Location:  crate/path/file.rs:line  (or package/component)
Finding:   what is wrong, in one or two sentences
Evidence:  the code or behavior that proves it
Action:    refactor (Phase C) | fix (Phase D) | workflow (Phase E) | reject-and-document
Reuse?:    if a new component was considered, why reuse was or was not chosen
Status:    open | in-progress | done | deferred
```

---

## 10. THE MASTER COMMAND (paste into your coding agent)

> Run a disciplined, incremental refactor and hardening pass over MeDoc per `docs/coordination/refactor-and-harden-plan.md`. Do not do a big-bang rewrite. Keep the app stable: detection, behavior-preserving restructuring, and defect fixing are three separate activities and must never share a commit. Apply SOLID, KISS, DRY, YAGNI throughout. Prefer reusing or consolidating existing components, services, and modules over building new ones; every time you build new instead of reusing, log why.
>
> **Phase A (read-only):** Build one triaged register (format in section 9) of defects, conflicts, code incompleteness, principle violations, and duplication between the retired `app/src-tauri`/`app/src` references and the live `crates/`+`apps/`+`packages/` layout. Cross-check `docs/coordination/contradictions.md` and `project-truth.md` and reuse them. Change nothing. Output the register and stop.
>
> **Phase B:** Confirm CI green as baseline. Add characterization tests covering any area later phases will touch. No behavior change.
>
> **Phase C (behavior-preserving, tests stay green and unmodified):** Collapse the duplicate source trees to the live layout; enforce Clean Architecture dependency direction (`commands → application → domain ports → infrastructure`, inward only) and break cycles; consolidate duplicated logic into `medoc-core` / `packages/shared`; apply Repository, Service Layer, Adapter, Facade, Strategy, Newtype only where two or more present call sites justify it; unify frontend state (Zustand), IPC (controllers → `tauri.service.ts`), and shared UI primitives; tighten naming and visibility. One behavior-preserving commit per item.
>
> **Phase D (one fix per commit):** Work the register P0 first. Each fix carries a test that fails before and passes after. Fix the existing component rather than replacing it unless replacement is clearly smaller; record the decision.
>
> **Phase E:** For every UI option, route, and action, model the workflow as a small state machine and prove it is logical, consistent, and TERMINABLE: every path reaches success, cancel, or a handled error; Back and Escape always work; loading states have a timeout and a failure branch (no unbounded spinners); dialogs are dismissable; role-gated workflows are completable by the role they are shown to. Record and fix every dead end or inconsistency. Deliver a workflow map plus fixes.
>
> **Phase F:** Remove dead code, final consistency and error-message pass (cause + next action), and update only the canonical coordination docs (`project-truth.md`, `contradictions.md`, `validation.md`, `phase-handoff.md`). Stop when the definition of done in section 8 holds.
>
> **Guardrails, always on:** test suite green (`cargo test`, `cargo clippy` zero warnings, `cargo fmt --check`, `npm run test`, `npm run build`) before and after every step; no change without a register entry or a named principle it corrects (no speculative edits); do not alter security, crypto, audit, RBAC, or compliance behavior without flagging for human review; do not restructure files the active Geräteverbund branch is editing; keep each pass to a small blast radius. After every phase, record results in `docs/coordination/validation.md` and do not start the next phase until green.

---

## Related artifacts

| Artifact | Purpose |
| -------- | ------- |
| [`refactor-register.md`](refactor-register.md) | Triaged findings register (Phase A output) |
| [`retired-paths.md`](retired-paths.md) | Stale doc path index (Phase C quarantine) |
| [`workflow-map.md`](workflow-map.md) | UI workflow state machines (Phase E output) |
| [`contradictions.md`](contradictions.md) | Cross-source contradictions ledger |
| [`project-truth.md`](project-truth.md) | Canonical repository facts |

## Geräteverbund exclusion zone

Do **not** restructure or refactor these paths until phase-handoff marks wire handshake complete:

- `crates/shared/medoc-sync/src/verbund/**`
- `crates/shared/medoc-sync/src/net/**`
- `crates/app/medoc-practice/src/commands/network/verbund/**`
- `packages/app/practice-host/src/pages/onboarding/**`
- `apps/practice-host-ui/src/views/components/verbund-*`
- HTTP pairing shim in `pairing_commands.rs` / `medoc-lan` pairing routes
