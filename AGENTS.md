# MeDoc workspace — agent instructions

This file is the **single place for project-wide “master commands”** you add for agents. Cursor also loads **`.cursor/rules/*.mdc`** (see below); both apply together.

## How instructions stack

1. **`.cursor/rules/`** — Rule files with `alwaysApply: true` are injected automatically (evidence, workflow, editing discipline).
2. **`AGENTS.md` (this file)** — Add **Master commands** here; keep them explicit and ordered. Update this file when you issue new master directives.
3. **`src/AGENTS.md`** — Only applies context for the Next.js app under `src/` (framework-specific). Use alongside this file when working in `src/`.

---

## Master commands

_Paste new master commands below. Prefer dated entries or numbered bullets so agents can refer to “Master command #N”._

### 2026-04-19 — Long-run coordination (ledgers + phase handoff)

For any **multi-phase**, **multi-session**, or **audit-sized** coordination work, maintain persistent state under **`docs/coordination/`**:

| Ledger | File | Purpose |
| ------ | ---- | ------- |
| Project truth | `docs/coordination/project-truth.md` | Canonical repository facts; cite evidence; separate stable truth from hypotheses. |
| Contradictions | `docs/coordination/contradictions.md` | Doc vs code, requirement vs implementation, settings vs runtime — track until resolved. |
| Validation | `docs/coordination/validation.md` | Commands run, pass/fail, pending checks, regressions. |
| Actions | `docs/coordination/actions.md` | Now / next / done for coordinated execution. |

**After each phase** (or equivalent milestone), update **`docs/coordination/phase-handoff.md`** with:

1. What is now **verified**
2. What **remains unverified**
3. What **changed** in project understanding (delta from prior handoff)
4. What **must happen next** (ordered)

**Continuity:** Start substantive coordination sessions by reading **`phase-handoff.md`** then the four ledgers; end sessions by updating ledgers + handoff so the next run continues from the same state.

---

### 2026-04-19 — Central Overseer / Orchestrator execution graph

When coordinating a full workspace audit or multi-agent run, act as **Central Overseer** and follow this graph. **SERIES** = run in order. **PARALLEL GROUP** = may run concurrently within the group after its phase gate; **do not** start Phase 3 parallel sweeps until Phase 1–2 truth work is stable.

**RULES**

- Do not parallelize substantive work until the truth foundation is stable enough to avoid contradictions.
- Architecture, requirements, features, and settings must be understood before deeper completeness judgments.
- If major contradictions appear, pause downstream conclusions and resolve them before continuing.

**PHASE 0 — Intake (SERIES)**

1. Inspect repository tree and major manifests/configs.
2. Inspect docs tree.
3. Run **Document Intelligence Agent**.

**PHASE 1 — Truth Foundation (SERIES)**

4. Build initial project truth model from docs + repo structure.
5. Run **Software Architect Agent**.
6. Run **Requirements Validator Agent**.
7. Run **Feature Auditor Agent**.
8. Run **Senior Settings Agent**.

**PHASE 2 — Dependent Completeness Analysis (SERIES)**

9. Run **Settings Completeness Engineer Agent**.
10. Update truth model with settings / feature / requirements mapping.

**PHASE 3 — Broad Specialist Audit Sweep (PARALLEL)**

- **GROUP A:** Code Auditor Agent; Stability Monitor Agent; Security Reviewer Agent.
- **GROUP B:** Rust Backend Developer Agent; Frontend Tauri Developer Agent.
- **GROUP C:** UX Auditor Agent; UI Inspector Agent; Accessibility Agent; Visual Polish & UI Completeness Engineer Agent.
- **GROUP D:** Documentation Writer Agent; Test Strategist Agent; Senior ISO Quality Agent; Company Infrastructure Agent; Reflection Agent; Marketing Agent.

_(Groups A–D may run in parallel with each other once Phase 2 is complete.)_

**PHASE 4 — Contradiction Resolution (SERIES)**

11. Collect all specialist reports.
12. Resolve contradictions: docs vs code; requirements vs features; architecture vs implementation; settings vs runtime behavior; quality/process docs vs repository discipline.
13. Identify critical blockers and cross-cutting issues.

**PHASE 5 — Execution and Revalidation (SERIES)**

14. Define critical immediate fixes.
15. Execute low-risk, high-impact tasks first.
16. Require responsible agents to rerun validation.
17. Collect **VALIDATION** reports.

**PHASE 6 — Final Synthesis (SERIES)**

18. Produce master integrated state report.
19. Produce prioritized roadmap: **Now** / **Next** / **Later**.
20. Produce remaining unknowns / evidence gaps.
