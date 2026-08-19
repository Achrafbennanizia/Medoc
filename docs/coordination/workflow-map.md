# Workflow map (Phase E)

**Created:** 2026-06-10  
**Plan:** [`refactor-and-harden-plan.md`](refactor-and-harden-plan.md)  
**Scope:** Desktop `apps/practice-host-ui` routes + gates; RBAC via [`packages/shared/src/lib/rbac.ts`](../../packages/shared/src/lib/rbac.ts)

## Terminability legend

| Terminal | Meaning |
| -------- | ------- |
| **Success** | User goal completed; navigates away or sees confirmation |
| **Cancel** | Back, Escape, dialog dismiss, or explicit Abbrechen |
| **Error** | Toast/inline error with next action; user can retry or leave |

## Pre-app gates (ordered)

```mermaid
stateDiagram-v2
    [*] --> DbSetup
    DbSetup --> LicenseGate: db_ready
    DbSetup --> ErrorHandled: setup_fail
    LicenseGate --> VerbundGate: licensed_or_provisioned
    LicenseGate --> Onboarding: unlicensed
    Onboarding --> VerbundGate: lizenz_or_beitreten_done
    VerbundGate --> Login: cluster_ready
    Login --> SessionGate: auth_ok
    SessionGate --> AppShell: session_valid
    ErrorHandled --> [*]
    Cancel --> [*]
    AppShell --> [*]
```

| Gate | Entry | Terminals | Notes |
| ---- | ----- | --------- | ----- |
| DB setup | First launch | Success → license; Error → retry wizard | [`db-setup-gate.tsx`](../../apps/practice-host-ui/src/views/components/db-setup-gate.tsx) |
| License/pairing | Pre-login | Success → dashboard/onboarding; Cancel → onboarding routes | [`license-and-pairing-gate.tsx`](../../apps/practice-host-ui/src/views/components/license-and-pairing-gate.tsx) |
| Verbund onboarding | `/onboarding/*` | Success → `/login`; Cancel → stay on gate (Link back) | [`verbund-onboarding-gate.tsx`](../../apps/practice-host-ui/src/views/components/verbund-onboarding-gate.tsx) |
| Login | `/login` | Success → `/`; Error → inline message | TOTP branch terminable via back to credentials |
| Session | All protected routes | Redirect `/login` if expired | [`session-gate.tsx`](../../apps/practice-host-ui/src/views/components/session-gate.tsx) |

## Priority workflows

### W-01 Login / session

States: `idle → submitting → totp_enroll? → success | error`  
Terminals: success → `/`; error → stay with message; cancel → clear fields  
RBAC: N/A (pre-auth)

### W-02 Patient anlegen

Route: `/patients/new`  
States: `form → submitting → success | validation_error`  
Terminals: success → `/patients/:id`; cancel → confirm abandon → `/patients`; error → inline  
Smoke: [`p0-routes.smoke.test.tsx`](../../apps/practice-host-ui/src/p0-routes.smoke.test.tsx)

### W-03 Termin anlegen

Route: `/appointments/new`  
Terminals: success → `/appointments`; cancel → back; error → inline  
Loading: `PageLoading` + `PageLoadError` on list parent

### W-04 Patientenakte / export

Route: `/patients/:id`  
Subflows: akte save confirm, export picker, discharge PDF, workflow dialogs  
Terminals: each dialog `onClose`; export success closes picker; errors → toast  
Smoke: [`export-preview-dialog.smoke.test.tsx`](../../apps/practice-host-ui/src/views/components/export-preview-dialog.smoke.test.tsx), [`patient-akte-workflow-dialogs.smoke.test.tsx`](../../apps/practice-host-ui/src/views/components/patient-akte-workflow-dialogs.smoke.test.tsx)

### W-05 Finanzen / Zahlung

Routes: `/finance`, `/finance/new`, `/finance/cash/new`  
Terminals: save → list; cancel → back; RBAC: `finance.read` / `finance.write`

### W-06 Praxis-Aufgaben / Tickets

Routes: `/tickets`, `/tickets/new`, `/tickets/:id/bearbeiten`  
Redirect: `/inbox` → `/tickets` (terminable redirect)  
Smoke: [`praxis-tickets.smoke.test.tsx`](../../apps/practice-host-ui/src/views/pages/praxis-tickets.smoke.test.tsx)

### W-07 Einstellungen

Route: `/settings` (+ section panels in package)  
Terminals: save per section → toast; nav away → unsaved handled per section  
Smoke: [`settings.rbac.smoke.test.tsx`](../../apps/practice-host-ui/src/views/pages/settings.rbac.smoke.test.tsx)

### W-08 Migration wizard

Route: `/migration`  
Terminals: complete → success summary; cancel → `/`; stub device steps document non-live connectors

### W-09 Verwaltung hub

Route: `/administration` + nested TOC pages  
Legacy redirects terminable: `/administration/day-close` → finance-berichte; `/staff/new` → query param

## Flag-gated surfaces (not dead ends)

| Flag | Route / nav | Behavior |
| ---- | ----------- | -------- |
| `DATENSCHUTZ_UI_ENABLED=false` | `/privacy` | Route exists; nav hidden; page shows gate if navigated directly |
| `POSTEINGANG_UI_ENABLED=false` | `/inbox` | Redirect to `/tickets` |
| Deferred roles | login | TAX_ADVISOR/PHARMA_CONSULTANT rejected at IPC — documented in [`todos-deferred-roles.md`](todos-deferred-roles.md) |

## Register cross-reference (workflow items)

| ID | Status | Action taken |
| -- | ------ | ------------ |
| R-011 | open | G21b manual — not automatable in this pass |
| R-017 | done | Export/report dialogs: mime default + Blob fix; break-glass dismiss key |
| R-001–R-003 | deferred | Geräteverbund wire — feature track |

## Route inventory (shell)

Main authenticated routes in [`App.tsx`](../../apps/practice-host-ui/src/App.tsx): dashboard, appointments, patients, tickets, finance, purchase-orders, balance-sheet, administration/*, prescriptions, certificates, services, products, staff, statistics, audit, privacy, settings, logs, ops, compliance, hilfe, feedback, migration, charts-zu-validieren.

Onboarding (outside shell): `/onboarding`, `/onboarding/lizenz`, `/onboarding/beitreten`.

All `RoleRoute`-wrapped paths hidden when RBAC denies; direct URL → redirect or empty state per [`role-route.tsx`](../../apps/practice-host-ui/src/views/components/role-route.tsx).
