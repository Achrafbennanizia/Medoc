# Product editions: restructuring plan (Solo, Duo, Group)

**Status:** Revision 3: all product decisions folded in (§0.1); legal research in §5.1.
**P0 (foundations) implemented** on 2026-11-24, see §8 "P0 status". No behaviour change yet: every edition still
contains all code until the capability gates of P2.
**Date:** 2026-11-24
**Scope:** desktop app only: `crates/`, `apps/practice-host`, `apps/practice-host-ui`, `packages/shared`,
`packages/ui`, `packages/server/lan`, `packages/app/practice-host`. Not `website/`.
**Builds on:** [device-flavors-and-access.md](./device-flavors-and-access.md) (main/replica flavor, access v2),
[serverless-sync.md](./serverless-sync.md), [licensing.md](./licensing.md), [logging.md](./logging.md),
[../security/access-profiles.md](../security/access-profiles.md).

---

## 0. Summary

| | **Solo** (shown as *Essentiel*) | **Duo** (*Cabinet*) | **Group** (*Cabinet+*) |
|---|---|---|---|
| Devices (hard limit) | 1 | 3 (1 main + 2 replicas) | 5 (2 admin devices + 3 replicas) |
| Admins | 1 (the dentist) | 1 (usually the dentist) | 2 (two dentists, one legal entity for now) |
| Logins | **1 admin + 1 guest** | 3 (one per device) | 2 admins + staff |
| Doctors in the data | 1 | 1 | 2 or more |
| Network code (LAN API, sync, pairing, discovery) | **compiled out** | star sync: replicas ↔ main | two-hub sync, both admin devices full peers, replicas attach to a home hub |
| Staff administration (roles, privileges, team) | **compiled out** | simplified (fixed profiles) | full, plus the **Allowances** page |
| Tasks, tickets, work time, team pages, multi-user options | **compiled out** | simplified | full |
| Doctor pickers / filters | none | none (single doctor filled in automatically) | everywhere: calendar, tasks, finance, statistics, documents |
| Sharing between admins | – | – | **everything shared by default**; each admin decides what to stop sharing and who may change what (Allowances) |
| Review of others' work | **guest inbox: Add / Dismiss** (guest changes are staged until the admin integrates them) | doctor validates reception work | validation per Allowances |
| Logs | local | local + sync status | per-author, per-device change records, maintenance view |
| Display name (app and website) | Essentiel | Cabinet | Cabinet+ |

**Mechanism in one line:** one source file `config/editions.yaml` lists editions as bundles of **capabilities**;
`medoc-codegen` (already generating `rbac` and enums) turns it into Cargo features + a Rust `const CAPS` and a
TypeScript `CAPS` constant injected by Vite `define`. Code checks a capability, never an edition name. Modules
whose capability is off are not compiled (Rust `#[cfg]`, optional crates) and not bundled (Vite dead-code
elimination of `if (CAPS.x)` around `import()`).

The existing `replica` flavor stays and is orthogonal: **edition × flavor** gives the builds
`solo`, `duo-main`, `duo-replica`, `group-hub`, `group-replica`.

### 0.1 Decisions taken (user, 2026-11-24)

| # | Decision | Effect on the plan |
|---|---|---|
| Q1 | **Solo = one admin login + one guest account.** The guest is for external or temporary users; whatever the guest changes stays **staged** until the admin comes and integrates it. The admin's action is **Add** or **Dismiss**, not "Validate". Tasks/ticket protocol, chart validation workflow, work time and every multi-user option are removed. The app must be lighter, simpler and more compact. | §4.2 guest inbox design, §6 Solo column, `guest_inbox` capability, tickets T2.3/T2.5 |
| Q3 | **Group = one legal entity for now** (two entities stays possible later). One shared header/letterhead; the **signing doctor's name** changes per document: by default the patient's treating doctor; when reception asks, the doctor chosen at request time; when an admin issues it, that admin. | `units` capability postponed (no per-unit numbering or cash book now; columns not added yet); §5.1 PDF rule |
| Q5 | **Everything is shared by default.** Each admin decides what to stop sharing (statistics, patient acts, calendar, …) and who may change what. Both admins administer the shared master data (prescription presets, treatments, orders, catalogues). Person-bound settings (working hours, holidays, breaks) get a target: **for me / for the other admin / for both**, shown only when Allowances permit it. A **Settings → Allowances** page holds all these rules. | §4.5 rewritten, §6.15 Allowances page with the full rule list |
| Q7 | (from Q5) Catalogues and predefinitions are **shared**, one set for the practice. | no per-doctor price lists |
| Q11 | Research the law. | §5.1 |
| Q-A | **Solo has no day-close workflow.** A guest payment is a simple inbox item to validate. The inbox is a list of items, each with a clear title and a description that carries enough information to decide. | §4.2 inbox item format; day close compiled out of Solo |
| Q-B | Guest default view: calendar, patient master data, cash desk, stock. **Read access to the clinical record is a switch the admin can turn on** in Settings → Guest (off by default). | §4.2 |
| Q2 | **Duo: at most 3 accounts, one per device.** One dentist; a second dentist means Group. | `limits.duo.accounts = 3`, §4.3 |
| Q-D | **Group numbering: reserved number blocks.** The second hub holds a pre-reserved block and issues offline. | §4.4 |
| Q-A' | Confirmed: **no day-close workflow in Solo**; each payment is still written to the cash book (daily recording of cash takings, § 146 (1) AO in Germany), period reports remain. | §4.2 |
| Q-E | **Group: each dentist edits only their own clinical entries**; the other adds entries and comments. The owner can widen it in Allowances. | §6.15 |
| Q4 | **LAN browser/tablet client kept in Duo and Group**; each client counts toward the device limit. | `lan_client` in duo and group; seat check on LAN sign-in |
| Q8 | Licences: **BASIC→Solo, PRO→Duo, ENTERPRISE→Group**, mapped automatically at start. | §3.2 |
| Q9 | **A higher edition app accepts a lower licence**; in-place upgrade, same data folder. | §3.2 |
| Q13 | **Display names Essentiel / Cabinet / Cabinet+**; internal ids, features and file names stay `solo|duo|group`. | i18n keys `edition.solo` etc.; installer product names |
| Q10 | (my call, not asked) Dev default build compiles everything (`group`). | §3.2 |
| Ops | Logs, error reports, maintenance, updates, delivery decided. | §11 |
| Q12 | **Hybrid routing:** through the primary hub while it is online, origin-sends while it is not, with a careful catch-up and join protocol. | §4.4.1, §4.4.2 |

---

## 1. What exists today (findings that shape the plan)

- **Flavor already done at build time.** Cargo feature `replica` (`medoc-core`, `medoc-practice`, `apps/practice-host`),
  `VITE_MEDOC_FLAVOR`, `tauri.replica.conf.json`, `domain::device::{FLAVOR, MainOnly, Placement}`,
  `packages/shared/src/lib/device-flavor.ts`. Only 2 files use `#[cfg(feature = "replica")]`. The pattern is right;
  it needs widening, not replacing.
- **Editions exist only as licence strings.** `license.rs` carries `edition: BASIC|PRO|ENTERPRISE` and
  `edition_features[]`; `medoc-sync/src/cluster/seat_budget.rs` maps them to seat caps (2/1/1, 5/2/5, 10/3/7).
  These do not match the new editions (1, 3, 5 devices) and are run-time only.
- **Network coupling is concentrated.** In `medoc-practice`, `medoc_sync`/`medoc_lan` are used by 15 files, almost all
  under `commands/network/*` and `systems/{lan,main_device}`, plus `admin/staff.rs`, `practice/purchase_order.rs`,
  `system/core.rs`, `systems/usb_install_startup.rs`. `medoc-core` has ~30 files that touch sync/cluster/outbox
  (mostly `sync_outbox::record_or_noop` hooks in repos). Making `medoc-lan` and `medoc-sync` optional is feasible.
- **One IPC registration list.** `commands/register.rs` (`medoc_invoke_handler!`) registers ~390 commands in one
  `tauri::generate_handler!`. This is the main seam to split per module.
- **Route list is duplicated** across `App.tsx` (≈90 routes), `rbac.generated.ts`, `native-go-menu.ts`,
  `command-palette-data.ts`, `breadcrumb-keys.ts`. A module registry should become the single source.
- **Sync registry is already a table** (`sync_registry.rs`: `SyncClass::{Admin, Numbered, Shared, Files, DeviceLocal}`,
  `MASTER_ONLY_TABLES`, `DENY_COLUMNS`, `DENY_APP_KV_PREFIXES`). Good base for per-edition sync scope.
- **Doctor dimension is partial.** `appointment.physician_id` (NOT NULL), `prescription.physician_id`/`prescribing_physician_id`,
  `certificate.physician_id`/`issuing_physician_id`, `treatment`/`examination.released_by_physician_id`,
  `practice_ticket.to_physician_id`. **Missing:** responsible doctor on `treatment`, `examination`, `patient_chart`,
  `patient` (treating doctor), `payment` (no `created_by`, no beneficiary), `cash_movement`/`day_close_protocol`
  (no unit), `purchase_order` (has `created_by`, no "for whom" / "paid by").
- **Audit is device-local and has no device.** `audit_log(user_id, action, entity, entity_id, details, prev_hash, hmac)`
  is `DeviceLocal`; no `device_id`. `sync_outbox` already carries `device_id` + `seq` + signed payload, so a
  replicated change record can be derived from it.
- **`staff` is `DeviceLocal` in the registry but is applied by `merge.rs` (`apply_staff_without_secrets`).** Needs a
  clear rule per edition (see §4).
- **Calendar already has per-doctor colours** (`appointment-doctor-legend.tsx`, `appointment-grid/*`); statistics,
  finance, tasks and work-time pages have no doctor filter.
- **Country layer exists in places** (`pdf/invoice_goz.rs`, `pdf/invoice_ma.rs`, `telematik.rs`, `eprescription`);
  the specialty (dental) is hard-wired (DentalChart, `dental_finding`, tooth picker, GOZ catalogue).

---

## 2. Inventory and classification per edition

Legend: **●** full · **◐** simplified · **✕** compiled out · **＋** new or extended · **R** replica forwards to main.
"Use" = usefulness for the target customer: H high, M medium, L low.

### 2.1 Backend modules (Tauri commands, grouped; count = `#[tauri::command]`)

| Module (file) | Cmds | Goal | Use | Solo | Duo | Group |
|---|---|---|---|---|---|---|
| Patients `clinical/patient.rs` | 12 | master data, search, merge | H | ● | ● | ＋ treating doctor, per-record private / hide from |
| Chart `clinical/chart.rs` | 18 | findings, examinations, treatments, anamnesis, chart PDF | H | ● | ● | ＋ responsible doctor |
| Attachments `clinical/chart_attachment.rs` | 8 | X-rays, scans, files | H | ● | ● (blob sync) | ● + visibility |
| Chart validation / workflow `chart_validation.rs`, `chart_workflow.rs` | 13 | reception drafts → doctor validates, tickets | M | ✕ replaced by guest inbox (Add / Dismiss) | ● | ＋ per Allowances |
| Next-appointment hints | 3 | doctor tells reception to book | M | ✕ (one person books) | ● | ● per doctor |
| Prescriptions, certificates, sick leave | 10 | documents with prescriber | H | ● | ● | ● author doctor on PDF |
| Documents issue `documents/issue.rs` | 7 | numbered official documents | H | ● | ● main allocates | ● one sequence (one entity), signing doctor per document |
| Appointments `scheduling/appointment.rs` (+relation) | 9 | calendar | H | ◐ no doctor field in UI | ◐ | ＋ per-doctor colour/filter, rooms |
| Tasks `scheduling/practice_task.rs` | 9 | team tasks, comments | M | ✕ | ◐ assign among few people | ＋ per doctor, sharing |
| Payments `billing/payment.rs` | 12 | cash desk | H | ● | ● | ＋ collected by, for which doctor |
| Day close, balance sheet, invoice docs | 26 | legal cash book, period reports | H | ◐ no day-close workflow; cash book, balance sheet, invoices kept | ● | ● one cash book, filter by doctor |
| Contracts `billing/contract.rs` | 4 | patient contracts / payment plans | M | ● | ● | ● |
| Service items, catalogue | 4+ | price list | H | ● | ● | ● shared, editable by both admins |
| Products, purchase orders | 9 | stock and orders | M | ● | ● | ＋ ordered by, for whom, paid by |
| **new** Guest inbox | – | staged guest changes, Add / Dismiss | H | ＋ | ✕ | ✕ |
| **new** Allowances | – | who may change / who sees what, per admin | H | ✕ | ✕ | ＋ |
| Statistics `practice/statistics.rs` | 2 | KPIs, month comparison | M | ◐ | ◐ | ＋ filters, per doctor, pro charts |
| Practice core, templates, notifications, feedback | 30 | practice profile, document templates | H | ● (feedback/notifications slimmed) | ● | ● one letterhead, signing doctor block |
| Staff `admin/staff.rs` | 21 | accounts | H | ✕ (fixed: admin + guest) | ◐ | ● |
| Access `admin/access.rs` | 6 | roles, privileges, scopes | H | ✕ two fixed profiles (admin, guest) | ◐ fixed profiles R | ● + Allowances, R |
| Auth `admin/auth.rs`, TOTP, break-glass | 13 | sign-in, lockout, 2FA, emergency | H | ◐ local PIN/password, TOTP optional | ● | ● |
| Work time, work plan, absences | 16 | time tracking, plans | M | ✕ | ◐ | ● |
| Audit, audit chain | 6 | tamper-evident trail | H (legal) | ● local (records guest Add/Dismiss) | ● local | ＋ replicated per-device chains |
| App KV, UI prefs, offline cache | 8 | settings | H | ● | ● | ● |
| LAN server `network/lan.rs` | 6 | embedded HTTPS API | H | ✕ | ● main | ● hubs |
| Sync `network/sync.rs`, reconnect check | 7 | push/pull/exchange | H | ✕ | ● | ＋ two-hub |
| Pairing `network/pairing/*` (+BLE/LAN discovery) | 11 | join a practice | H | ✕ | ● | ＋ re-pairing, home hub |
| Cluster `network/cluster.rs` | 24 | seats, cluster reset, install plan | M | ✕ | ◐ | ● |
| Company portal `network/company_portal.rs` | 14 | vendor portal client (licence, billing) | M | ● (needs only outbound HTTPS) | ● | ● |
| Devices `system/devices.rs` | 14 | scanners, printers, device sessions | H | ◐ local devices only | ● | ● |
| Ops `system/ops.rs`, logging | 22 | backups, maintenance, logs export | H | ● | ● | ＋ maintenance view, remote logs |
| Export, report PDF, document PDF, menu, subscription, integration | 12 | exports, native menu | M | ● | ● | ● |
| e-Prescription / Telematik (DE) | – | Germany only | M (DE) | country | country | country |

### 2.2 UI pages (`apps/practice-host-ui/src/views/pages`, `packages/app/practice-host/src/pages`, `packages/server/lan/src/pages`)

| Page / route | Goal | Solo | Duo | Group |
|---|---|---|---|---|
| `dashboard` | day overview | ◐ one-doctor day | ◐ | ＋ per-doctor columns, filter |
| `appointments`, `appointments/new` | calendar | ◐ no doctor legend/picker | ◐ same | ＋ redesigned (§6.3) |
| `patients`, `patients/new`, `patients/:id` (tabs: anamnesis, examination, treatment, prescription, payment, attachments) | record | ● | ● | ＋ owner badge, "make private", "hide from" |
| `charts/to-validate` | validation queue | ✕ → **guest inbox** (`/inbox`: Add / Dismiss) | ● | ＋ "mine / all / other doctor" |
| `tickets`, `tickets/new`, `tickets/:id/edit` | tasks / tickets | ✕ | ◐ | ＋ per doctor, sharing |
| `finance`, `finance/cash`, `finance/new`, `finance/cash/new`, `payment-create-panel` | cash desk | ● compact | ● | ＋ "for doctor" + "collected by" |
| `balance-sheet`, `balance-sheet/new`, `day-close` | period close | ◐ balance sheet only, `day-close` ✕ | ● | ● + doctor filter |
| `purchase-orders`, `/new`, `/:id`, `products`, `order-master-administration` | stock | ● | ● | ＋ ordered by / for / paid by |
| `prescriptions`, `certificates`, `prescription-*`, `medication-presets`, `prescription-presets` | documents | ● | ● | ● author doctor |
| `services`, `treatment-catalog`, `templates*`, `template-editor` | catalogues | ● | ● | ● shared, both admins edit |
| `administration` hub + `team`, `team/work-time`, `tasks`, `work-days`, `practice-planning`, `work-hours`, `special-blocked-times`, `practice-preferences`, `contracts`, `finance-reports*`, `inventory-and-ordering`, `services-catalogs-templates`, `sick-leave-certificate` | practice admin | ◐ hub keeps practice, catalogues, templates, finance reports, stock, work days / opening hours; drops team, work time, tasks, sick-leave admin | ◐ team as cards, no role editor | ● + target "for me / other / both" where Allowances permit |
| `staff`, `staff/work-plan`, `staff/work-time`, `work-time-tracking`, `work-time-team`, `staff-work-plan` | team | ✕ | ◐ | ● |
| `statistics` | analytics | ◐ | ◐ | ＋ (§6.7) |
| `audit` | audit trail | ● | ● | ＋ author + device columns, filters |
| `logs`, `ops` | support | ● | ● + sync status | ＋ maintenance view (§6.9) |
| `privacy`, `compliance` | GDPR / Loi 09-08 | ● | ● | ＋ sharing register (from Allowances) |
| **new** Settings → Allowances | who may change / who sees what | ✕ | ✕ | ＋ (§6.15) |
| `settings` sections: about, accessibility, account, appearance, backups, integrations, license, migration, notifications, practice, practice-billing, security, system, pdf-header-designer | settings | ● | ● | ● |
| settings: deployment, device-sessions, network-reset, pairing-inbox, reconcile, device-cluster-panel, `settings-lan-host` | network | ✕ | ● | ● |
| onboarding: subscription, account, license, join; `cluster-join`, `pairing-scan` | first run | ◐ licence → admin account → practice → optional guest | ● | ＋ second admin onboarding, home hub |
| `login` | sign-in | ◐ two tiles: admin, guest | ● | ● |
| `help`, `feedback`, `migration-wizard` | support | ● | ● | ● |
| Gates: `license-and-pairing-gate`, `cluster-onboarding-gate`, `initial-copy-banner`, `replica-sync-background`, `sync-status-badge`, `cluster-reset-listener` | network UI | ✕ | ● | ● |

### 2.3 Database tables (≈ 70, from `migrations/*`, `medoc-sync` schema)

| Group | Tables | Solo | Duo | Group |
|---|---|---|---|---|
| Clinical | `patient`, `patient_chart`, `anamnesis_form`, `dental_finding`, `examination`, `treatment`, `chart_attachment`, `chart_validation`, `chart_next_appointment_hint` | ● | ● synced | ＋ `treating_staff_id`, `responsible_staff_id`, per-record "private / hide from" |
| Documents | `prescription`, `certificate`, `sick_leave_certificate`, `issued_document`, `issued_document_print`, `document_sequence`, `number_sequence`, `document_template(_user)` | ● | ● | ＋ `signed_by_staff_id`, `requested_by_staff_id` |
| Scheduling | `appointment`, `absence`, `practice_task`, `practice_task_comment`, `practice_task_patient_optional`, `practice_ticket`, `in_app_notification` | ◐ `appointment`, `absence` used; task/ticket tables empty | ● | ＋ room/chair, `absence.staff_id` target |
| Finance | `payment`, `payment_receipt`, `payment_reminder`, `cash_movement`, `day_close_protocol`, `balance_sheet_snapshot`, `invoice_document`, `invoice_document_audit`, `contract`, `service_item`, `treatment_catalog` | ● | ● | ＋ `created_by`, `collected_by`, `for_staff_id`, `device_id` |
| Stock | `product`, `purchase_order`, `supplier_master`, `supplier_pharma_template`, `pharma_consultant_master` | ● | ● | ＋ `ordered_for`, `paid_by`, `approved_by` |
| Staff & access | `staff`, `staff_access_profile`, `staff_permission_override`, `work_time_session`, `work_time_pause_segment`, `work_time_preference`, `work_plan_adjustment` | ◐ exactly 2 rows (admin, guest), work time tables empty | ◐ | ● + `allowance_rule` (new) |
| Security | `device_session`, `brute_force_lockout`, `device_blocklist`, `audit_log`, `audit_log_archive`, `audit_chain_ack`, `license`, `provisioning_state` | ● | ● | ＋ `audit_log.device_id`, `origin_seq` |
| Sync & pairing | `sync_device`, `sync_device_key`, `sync_vector`, `sync_outbox`, `sync_applied`, `sync_peer_vector`, `sync_tombstone`, `sync_row_hlc`, `sync_blob`, `sync_packet_queue`, `sync_problem`, `sync_pull_failure`, `sync_watch_seen`, `pairing_request`, `slave_permission` | tables kept, **empty, code compiled out** (eases Solo → Duo upgrade) | ● | ● + `home_hub` on `sync_device` |
| Misc | `app_kv`, `feedback`, `practice` | ● | ● | ● |
| **new** Staging | `staged_change` (guest edits waiting for Add / Dismiss) | ＋ | – (empty) | – (empty) |

**Decision:** all editions share **one schema**. The edition changes code and defaults, not table layout. That keeps
migrations single-track and makes an upgrade (Solo → Duo → Group) "install the new binary, open the same database".
New columns for Group are added for everyone (nullable or with defaults filled by the single doctor).

### 2.4 LAN HTTP API (`medoc-lan`, `/api/v1`)

| Routes | Goal | Solo | Duo | Group |
|---|---|---|---|---|
| `/health`, `/ping` | liveness | ✕ | ● | ● |
| `/auth/login`, `/me`, `/me/access` | LAN sign-in, main link | ✕ | ● | ● |
| `/access/catalog`, `/access/staff/{id}`, `/access/staff/{id}/scopes` | access management forwarding | ✕ | ◐ (fixed profiles) | ● + allowances endpoints |
| `/pairing/{request,status,master-info,decide,confirm,revoke,pending,peers,all}` | pairing | ✕ | ● (seat cap 3) | ＋ hub-to-hub pairing, re-pair |
| `/sync/{push,pull,status,exchange,digest,row-hashes,rows,blob}` | sync | ✕ | ● | ＋ per-device scope filter |
| `/sync-problems*` | conflict inbox | ✕ | ● | ● |
| `/app-kv` | settings LWW | ✕ | ● | ● |
| `/license`, `/license/activate` | licence | ✕ | ● | ● |
| `/company/*` | proxy to vendor portal | ✕ | ● | ● |
| `/eprescriptions/*` | DE e-prescription | ✕ | country | country |
| `/patients`, `/appointments` (LAN client) | browser / tablet client | ✕ | ● (counts as a device) | ● (counts as a device) |
| **new** `/logs/export`, `/maintenance/status` | remote support from an admin device | ✕ | ◐ | ● |

### 2.5 Cross-cutting services in `medoc-core`

| Service | Solo | Duo | Group |
|---|---|---|---|
| SQLCipher DB, key in keychain, backups (USB/external, attachments) | ● | ● | ● |
| PDF engine (fonts, Arabic shaping, letterhead, GOZ/MA invoices) | ● | ● | ＋ signing doctor block, shared letterhead |
| RBAC `effective_allowed` + `access::relation` | ◐ fixed owner profile, still enforced | ● | ● + allowances scope |
| Logging channels, redaction | ● | ● | ＋ device id + edition in every line |
| Retention, GDPR, DPIA, VVT | ● | ● | ＋ sharing register |
| Licence verify, seat budget | ● | ● | ● |
| Durable cache, sync spool | ◐ (offline cache only) | ● | ● |
| Update, migration wizard, USB vault | ● | ● | ● |
| Telematik / e-prescription | country | country | country |

---

## 3. Target architecture

### 3.1 Single source of truth: `config/editions.yaml`

```yaml
capabilities:            # what code checks
  guest_inbox:    "guest account whose changes are staged until the admin Adds or Dismisses them (Solo)"
  net:            "LAN API, sync engine, pairing, discovery"
  multi_staff:    "accounts beyond admin + guest, roles, privileges, team pages"
  tasks:          "practice tasks, tickets, comments, next-appointment hints"
  work_time:      "time tracking, work plans, sick-leave administration"
  validation:     "reception drafts validated by a doctor"
  multi_doctor:   "doctor dimension in UI: pickers, filters, colours, per-doctor stats, signing doctor"
  multi_admin:    "two admins, two hubs"
  allowances:     "Settings -> Allowances: who may change / who sees what, per admin; per-record private / hide from"
  units:          "LATER: several legal entities (per-unit numbering, cash book, letterhead); not built now (Q3)"
  lan_client:     "browser/tablet client API"
  maintenance:    "maintenance view, remote log export"
editions:
  solo:  { devices: 1, admins: 1, caps: [guest_inbox] }
  duo:   { devices: 3, admins: 1, caps: [net, multi_staff, tasks, work_time, validation, lan_client, maintenance] }
  group: { devices: 5, admins: 2, caps: [net, multi_staff, tasks, work_time, validation, multi_doctor,
                                         multi_admin, allowances, lan_client, maintenance] }
limits:                  # UI sizing and validation, per edition
  solo:  { accounts: 2,  doctors: 1 }   # admin + guest, fixed
  duo:   { accounts: 3,  doctors: 1 }   # one account per device (Q2)
  group: { accounts: 20, doctors: 4 }
```

`medoc-codegen` generates:
- `crates/shared/medoc-core/src/edition.generated.rs`: `pub const EDITION: Edition`, `pub const CAPS: Caps`
  (a struct of `bool`s), `pub const LIMITS: Limits`, chosen with `#[cfg(feature = "edition-…")]`.
- `packages/shared/src/lib/edition.generated.ts`: types + `capsFor(edition)`; the actual values come from Vite `define`.
- A CI check that Cargo features in every `Cargo.toml` match the YAML.

### 3.2 Flag mechanism

**Rust (Cargo features).**

```toml
# apps/practice-host/Cargo.toml
[features]
default = ["edition-group"]                # dev default = everything compiled (Q10)
edition-solo  = ["medoc-practice/edition-solo"]
edition-duo   = ["medoc-practice/edition-duo"]
edition-group = ["medoc-practice/edition-group"]
replica       = ["medoc-practice/replica"]  # existing, orthogonal

# crates/app/medoc-practice/Cargo.toml
[dependencies]
medoc-lan  = { path = "...", optional = true }
medoc-sync = { path = "...", optional = true }
[features]
cap-net         = ["dep:medoc-lan", "dep:medoc-sync", "medoc-core/cap-net"]
cap-multi-staff = ["medoc-core/cap-multi-staff"]
cap-multi-doctor = ["medoc-core/cap-multi-doctor"]
cap-allowances  = ["cap-multi-doctor", "medoc-core/cap-allowances"]
cap-guest-inbox = ["medoc-core/cap-guest-inbox"]
# …
edition-solo  = ["cap-guest-inbox"]
edition-duo   = ["cap-net", "cap-multi-staff", "cap-tasks", "cap-work-time", "cap-validation", "cap-lan-client", "cap-maintenance"]
edition-group = ["edition-duo", "cap-multi-doctor", "cap-multi-admin", "cap-allowances"]
```

- Code uses `#[cfg(feature = "cap-net")]`, **never** `edition-*`. Editions are only bundles.
- `medoc-core` gets matching `cap-*` features. `sync_outbox::record_or_noop` becomes an `#[inline]` no-op without
  `cap-net`, so repos stay unchanged.
- `compile_error!` in `medoc-core/src/edition.rs` when zero or several `edition-*` features are on.
- Feature flags are additive (Cargo rule). Solo is almost the empty set (only `cap-guest-inbox`); this is why
  capabilities, not "remove-X" flags. `cap-guest-inbox` and `cap-multi-staff` are mutually exclusive (`compile_error!`).
- `replica` + `edition-solo` is a `compile_error!`.

**Frontend (Vite define).**

```ts
// vite.config.ts
const edition = process.env.MEDOC_EDITION ?? "group";
define: {
  __MEDOC_EDITION__: JSON.stringify(edition),
  __CAP_NET__: String(caps.net), __CAP_MULTI_STAFF__: String(caps.multi_staff), /* … one per capability */
}
```

- Each capability is its own literal `true`/`false`, so Rollup removes `if (__CAP_NET__) { … }` and every
  `import()` inside it. An object lookup (`CAPS.net`) would not be tree-shaken reliably, so `CAPS` is
  exposed for reading but **gating uses the bare constants**.
- `VITE_MEDOC_FLAVOR` stays.
- A Vite plugin fails the build if a module listed as `net`-only appears in the Solo bundle (bundle-content check, see §7).

**Boot check.** Rust exposes `edition_info()` (edition, caps, flavor, limits, version). The UI compares it with its
own constants at start and refuses to run on mismatch (mixing a Solo UI with a Group core).

**Licence.** The licence envelope's `edition` becomes `SOLO|DUO|GROUP`; legacy `BASIC|PRO|ENTERPRISE` map to them
at start (Q8). A binary accepts a licence for its own edition **or lower** (a Group binary can run a Duo licence with
Group code paths switched off at run time through `Limits`), so support can hand out one installer per edition
and upgrades are a new licence plus the new binary. `seat_budget_from_edition` gets SOLO 1/1/0, DUO 3/1/2,
GROUP 5/2/3 and is enforced at pairing (`/pairing/decide`) and at join.

**Installers and scripts.**

```
npm run tauri:build:solo
npm run tauri:build:duo            npm run tauri:build:duo:replica
npm run tauri:build:group          npm run tauri:build:group:replica
```

`tauri.<edition>.conf.json` overlays set product name and identifier (`de.medoc.app.solo`, …). Data folder stays
the same across editions of the same flavor so an upgrade keeps the database (Q9).

### 3.3 Module boundaries (feature modules)

Each feature module owns, in one place: Tauri commands, services, repo, LAN routes, UI routes, nav entries,
settings sections, palette entries, help pages, i18n namespace, tests.

```
crates/app/medoc-practice/src/modules/
  mod.rs                 // ModuleRegistry: collects handlers + LAN routes from enabled modules
  clinical/   scheduling/  billing/  stock/  documents/  statistics/      (always)
  team/       (cap-multi-staff)   work_time/ (cap-work-time)    tasks/ (cap-tasks)
  network/    (cap-net)           maintenance/ (cap-maintenance)
  allowances/ (cap-allowances)    guest_inbox/ (cap-guest-inbox)
```

- **IPC registration.** Spike T0.2 settled it: Tauri 2's `generate_handler!` (tauri-macros 2.7, `command/handler.rs`)
  parses outer attributes on each entry and puts them on the generated match arm, so `#[cfg(feature = "cap-net")]`
  on an entry in `register.rs` removes that command. One list stays; no composed handler needed. Commands of a disabled module do not exist; the UI never calls them because the same capability
  removes the caller.
- **LAN routes.** `LanSystemFactory::build_router` asks each enabled module for a `Router` fragment.
- **TS side.** `packages/app/practice-host/src/modules/<name>/module.ts` exports a `FeatureModule`:

```ts
export interface FeatureModule {
  id: string;
  enabled: boolean;                    // = a __CAP_*__ constant
  routes: RouteDef[];                  // path, lazy element, rbac routePath, breadcrumb key
  nav?: NavEntry[];  palette?: PaletteEntry[];  settings?: SettingsSection[];  help?: HelpPage[];
  dashboardWidgets?: WidgetDef[];
}
```

`App.tsx`, the shell nav, `native-go-menu.ts`, `command-palette-data.ts` and `breadcrumb-keys.ts` all read the
registry, which removes the five-way duplication of the route list. `rbac.generated.ts` keeps route → privilege
mapping; the registry joins on `routePath`.

### 3.4 Patterns

| Need | Pattern | Where |
|---|---|---|
| "What can this build do?" | **Capability registry** (generated const), code asks `CAPS.x` / `cfg(cap-x)` | `edition.generated.*` |
| Different behaviour per edition for the same feature | **Strategy**, selected at compile time | `DoctorContext` (single vs multi), `SyncTopology` (none / star / two-hub), `NumberingAuthority` (this device / primary hub), `ValidationPolicy`, `ScopeFilter` (none / allowances), `WritePath` (direct / staged for guest) |
| Feature on/off | **Feature module / plugin** registered in `ModuleRegistry` | §3.3 |
| Main vs replica (existing) | **Proxy/forwarder** (`Placement`) | `domain::device` |
| Per-table sync behaviour | **Strategy per table** in `sync_registry` (`MergePolicy`) | §4 |
| Specialty (dental, later others) | **Specialty pack** (see 3.5) | `specialty/` |
| Country rules | **Strategy per country**, run time from practice settings | `country/` (existing GOZ/MA split moves here) |
| Doctor-less UI | **Null Object** `SingleDoctorContext` returns the one doctor; components ask the context, not the edition | `useDoctorContext()` |

Rule: **no `if edition == …` anywhere.** Only capabilities and strategies. This is what lets a fourth edition
(e.g. "Clinic", 10 devices) be added as YAML + maybe one strategy.

### 3.5 Specialty layer (dentistry today, other specialties later)

Dental-specific today: odontogram (`DentalChart`, `dental-arch-svg`, tooth pickers, `dental_finding`), dental
anamnesis fields, GOZ/BEMA and Moroccan dental catalogues, chart PDF sections, discharge leaflets.

- Rust trait `SpecialtyPack { chart_kinds(), finding_schema(), catalog_loaders(), pdf_sections(), seed() }`,
  dental pack behind feature `specialty-dental` (default on). Generic tables (`patient_chart`, `examination`,
  `treatment`) stay; specialty data goes in specialty tables (`dental_finding` today; e.g. `ophthalmic_finding`
  later) or a typed JSON column validated by the pack's schema.
- TS `SpecialtyModule` contributes patient-detail tabs, the chart component, the mini chart in the header,
  catalogue pickers and help pages, through the same `FeatureModule` registry.
- Editions and specialties are independent axes: `edition × specialty × flavor`. Country stays run time.
- Not in scope for the first phases beyond moving dental code behind the trait (phase P6), so a second specialty is
  a pack, not a fork.

---

## 4. Database, schema and sync design per edition

### 4.1 Common schema changes (all editions, nullable / defaulted)

| Table | New columns | Filled in Solo/Duo with |
|---|---|---|
| `patient` | `treating_staff_id` (default signing doctor) | the single doctor |
| `patient_chart`, `examination`, `treatment` | `responsible_staff_id` (fixes the known gap in device-flavors doc), `created_by`, `device_id` | current user / device |
| `payment`, `cash_movement` | `created_by`, `collected_by`, `for_staff_id`, `device_id` | current user / single doctor |
| `prescription`, `certificate`, `sick_leave_certificate`, `issued_document`, `invoice_document` | `signed_by_staff_id` (name printed in the signature block), `requested_by_staff_id` (stored, not printed) | single doctor / current user |
| `purchase_order` | `ordered_for_staff_id`, `paid_by_staff_id`, `paid_at`, `approved_by` | – |
| `practice_task` | `doctor_id` | – |
| `appointment` | `room_id` (chair) | – |
| `absence`, `work_plan_adjustment` | `staff_id` target (for me / other admin / both = two rows) | single doctor |
| `audit_log` | `device_id`, `origin_seq`, `edition` | this device |
| **new** `staged_change` (Solo) | `id, target_table, target_id, op, payload_json, base_updated_at, summary, created_by, created_at, status (PENDING/ADDED/DISMISSED), decided_by, decided_at, reason` | Solo only |
| **new** `allowance_rule` (Group) | `owner_staff_id, area, action (view/change), grantee (other_admin / staff:<id> / role:<id> / all), level (none/view/change), updated_at, hlc` | empty = defaults |
| **new** `record_visibility` (Group) | `table, row_id, owner_staff_id, mode (shared/private), hidden_from (json), updated_at, hlc` | empty = shared |

Postponed with the `units` capability (Q3: one legal entity for now): `practice_unit`, `unit_id` on finance and
numbering tables, per-unit sequences. The `for_staff_id` / `signed_by_staff_id` columns are what a later split
into two entities would key on, so nothing built now is thrown away.

Migration: one forward migration per phase, idempotent, back-filling defaults from the single physician. Indexes on
every new `*_staff_id` used in filters (calendar by doctor and day, payments by doctor and date, tasks by doctor and
status, `staged_change(status, created_at)`, `allowance_rule(owner_staff_id, area)`).

### 4.2 Solo

**Lightness.**
- No sync code. Sync tables exist and stay empty. `record_or_noop` is a compile-time no-op.
- No LAN server, no TLS listener, no mDNS/BLE, no pairing keys in the keychain.
- Background tasks not spawned: watcher, reconcile, mesh, reconnect check.
- Not compiled: tasks/tickets, chart validation workflow, next-appointment hints, work time, work plans,
  **day-close workflow** (Q-A; every payment is still written to the cash book and period reports stay), sick-leave administration, team and access management, cluster, LAN client, maintenance view.
- Numbering: local, gap-free.
- Performance goals: cold start < 1.5 s on a 2018 laptop; binary and bundle size measured per phase (target: at
  least 25 % smaller than today's main build; measured, not promised).
- Upgrade to Duo: install the Duo binary and licence; first start builds a **snapshot bootstrap** (initial copy
  already exists in `engine/initial_copy.rs`). Pending guest changes must be added or dismissed before the upgrade
  (the installer refuses otherwise).

**Accounts.** Exactly two, fixed: the **admin** (the dentist, full rights) and one **guest** (an external or
temporary person: a stand-in assistant, a student, a technician). The guest can be switched off, has its own
password, and its session ends at lock/idle like any other. No roles page, no privilege editor.

**Guest inbox: "the guest proposes, the admin integrates".**

```
guest saves a form
  → same service, same validation as for the admin
  → WritePath::Staged: instead of writing the target table, insert one staged_change row (PENDING)
  → guest sees the item as "pending" (dashed outline / badge) in its own screens
admin opens Inbox (badge in the header)
  → per item: before/after view, who, when
  → Add      : applied through the normal service as the admin, audit "guest change added"
  → Dismiss  : optional reason, audit "guest change dismissed"; guest sees it as dismissed
  → Add all / Dismiss all per day or per patient
conflict: the target row changed after the guest staged (base_updated_at differs)
  → show both versions; Add applies only the fields the guest changed, or the admin edits before adding
```

- `WritePath` is a strategy chosen from the session role, so no service needs two versions. Reads of the guest
  overlay their own pending changes on top of the real data.
- What the guest may see and propose (Q-B): calendar, patient master data, cash desk, stock. **Read access to the
  clinical record** is one switch in Settings → Guest, off by default. Documents, statistics and audit stay hidden.
- Guest payments (Q-A) are inbox items like the rest: the payment counts once the admin adds it.

**Inbox item format (Q-A).** A list, newest first, grouped by day. Each item has:

| Part | Content | Example |
|---|---|---|
| Title | verb + object, in the user's language | "New appointment: Salma B., Tue 3 Dec 10:30" |
| Description | the facts needed to decide, on 1–2 lines: what changed (before → after for edits), patient, amount, time, any warning | "Check-up, 30 min. Proposed by the guest on Mon 2 Dec 17:04. Overlaps nothing." / "Cash payment 300 MAD for treatment of 28 Nov. Open balance after: 0 MAD." |
| Warning line (if any) | conflict, overlap, patient already changed since, missing data | "The patient's phone was changed by you after this proposal." |
| Actions | **Add** (primary), **Dismiss** (asks an optional reason), open the record | – |

Bulk: Add all / Dismiss all per day. The header badge shows the count; the admin is notified at sign-in when
items are waiting.
- Numbered documents (prescriptions, certificates, invoices) can never be issued by the guest: it can only prepare
  them as staged drafts; the number is allocated when the admin adds them.
- The guest can't change settings, delete, export, or see statistics and audit.
- Every Add and Dismiss is audited with the original guest content kept: this also meets the "original content
  stays visible" rule for records (§5.1, § 630f BGB).

### 4.3 Duo (star: 1 main, ≤ 2 replicas)

Keep the current design (outbox + HLC LWW + signed entries + anti-entropy) and tighten it:

1. **Hard limit 3** enforced in three places: licence seat budget, `/pairing/decide` (refuse a 3rd replica),
   and join on the replica (show "this practice already has 3 devices").
2. **Merge policy per table** (`MergePolicy` in `sync_registry.rs`):
   - `LwwRow` (default, today's behaviour),
   - `LwwField` for `patient`, `appointment`, `practice_task`: per-field HLC in the payload (`syncHlcFields`), so
     two people editing phone and address offline both keep their change. This is the limit listed in
     serverless-sync.md.
   - `AppendOnly` for comments, audit, prints, payment receipts.
   - `Immutable` for numbered documents after issue (a conflicting edit becomes a `sync_problem`, never an overwrite).
   - `MainWins` for `MASTER_ONLY_TABLES` (existing).
3. **Conflict inbox**: `sync_problem` already exists; surface "two edits to the same field" as a resolvable item
   (keep mine / keep theirs / merge text) on the main device only.
4. **Efficient transfer**: batch by table queue (exists), zstd-compress bodies > 4 KB, send only fields that changed
   for `LwwField` tables, content-addressed blobs (`sync_blob`) with resume, digest buckets for anti-entropy
   (exists). Measure with the e2e harness (`crates/test/medoc-e2e`).
5. **Staff rows**: `staff` replicates main → replicas without secrets (as `merge.rs` does), registry entry changed
   from `DeviceLocal` to `Admin` with `DENY_COLUMNS`, so the registry says what really happens.

### 4.4 Group (two admin hubs, ≤ 3 replicas, one legal entity)

Goals from the brief: sync of distributed DBs, indexing, only the originating device broadcasts a change, clear
initialization and pairing/re-pairing rules, and sharing decided per admin.

**Topology.**

```
   Hub A (admin A, primary)  ⇄  Hub B (admin B)
     ↑        ↑                    ↑
  replica1  replica2            replica3        (each replica has a home hub; falls back to the other)
```

- Both admin devices run the full main code (`group-hub` build) and serve the sync API, so either admin's
  computer can be off without stopping the practice.
- The **primary hub** (the one that activated the licence) holds the licence, the seat budget (5 devices,
  2 admins) and the **numbering authority** for the single legal entity.
- **Reserved number blocks (Q-D).** The primary hub reserves a block per document kind for hub B (default 50,
  refilled when half used). Hub B issues from its block when the primary is unreachable. Blocks are recorded as
  synced, signed `number_block` rows so a number is never issued twice; unused numbers of a revoked block are listed
  as void in the period report (no silent gap). Numbers stay unique and gap-free per block; their order across the
  two hubs may differ from strict date order (documented in the period report).
- **Routing: hybrid (Q12).** Through the primary hub while it is reachable; origin-sends while it is not. See
  §4.4.1. Routing never decides the outcome of a merge: every entry carries origin device, origin seq, HLC and
  actor, and applies idempotently (`sync_applied`). Switching modes can therefore delay a change but never lose
  or duplicate one.
- **Merge policies** as in Duo (§4.3). Two extra rules:
  - `allowance_rule` and `record_visibility` rows are **owner-only**: accepted only when the signed entry's actor
    is the owner admin (actor id travels in the signed entry, see §5).
  - `staff_access_profile` stays `MainWins`, but "main" means either hub, and each admin may only change access to
    their own data (see §4.5).
- **No per-device data filtering.** One entity, everything shared by default: every device holds the full database
  (SQLCipher). "Not shared" and "private" are enforced in queries (§4.5), not by withholding rows. If a later
  two-entity setup needs data separation at rest, that belongs to the `units` capability.
- **Indexing.** `(for_staff_id, date)` on appointments and payments, `(responsible_staff_id, created_at)` on
  clinical acts, `sync_row_hlc(table, row_id)`, outbox `(device_id, seq)` (exists).
- **Initialization** of the practice and of each new device: §4.4.2.
- **Re-pairing.** Replacing a device: revoke old (`/pairing/revoke`), new device joins with a new device key and a
  fresh origin sequence under a new `device_id`. Replacing hub B: admin A approves. Replacing the primary hub:
  admin B approves; licence moves with a vendor re-activation; numbering continues from the highest number seen in
  synced documents, with a gap check before the first issue (refuse and alert on a gap). A lost hub with no backup
  follows `safe-bridge-recovery.md`.

#### 4.4.1 Sync protocol: star when the primary hub is up, origin-sends when it is down

**Mode S (star), primary hub reachable.** Normal state.
1. A device writes locally (outbox entry: origin, seq, HLC, actor, signature) and pushes it to the **primary hub only**.
2. The primary verifies, applies (merge policies), records `sync_applied`, and appends the entry to its **relay log**
   with a hub sequence number (one total order for everyone).
3. Every other device (hub B included) pulls the relay log after its last hub sequence, or is woken by a short
   "new data" notice from the primary. One push per change and one fan-out from the hub: least traffic for 5 devices.

**Mode O (origin-sends), primary hub unreachable.** Entered per device after 3 failed heartbeats (≈ 30 s).
1. The device that makes a change pushes it to **every peer it can reach** (hub B and the replicas). Nobody re-sends
   someone else's change.
2. A device that comes back, or that missed something, **pulls by origin vector** from any reachable peer
   ("entries of origin X after seq N"). Hub B is the preferred peer because it receives everything in mode O.
3. Numbered documents use hub B's reserved number block (Q-D). Main-only operations (pairing, licence) wait.
4. A device leaves mode O only when the primary says it is ready (below), never on its own.

**Primary hub comes back (catch-up protocol).**
1. **Announce, not yet relay.** The primary signals "catching up" with its vectors. Devices stay in mode O, so no
   change is routed to a hub that is behind.
2. **Collect.** The primary pulls by origin vector from hub B first (most complete), then from each replica, for
   every origin, everything after its own vector. It applies with the usual merge policies; true conflicts go to
   `sync_problem` (conflict inbox), never silently overwritten.
3. **Send its own.** If the primary itself worked during a network split, it pushes its own unsent entries the
   mode O way.
4. **Numbers.** It reads which numbers hub B used from its block, marks them consumed, voids unused ones of a
   block it revokes, and refills hub B's block.
5. **Verify.** Digest comparison with every reachable peer (existing anti-entropy, `reconcile.rs`); differences are
   repaired by row pulls.
6. **Ready.** The primary signs "ready" with its vectors and becomes the relay again. Each device confirms its own
   outbox entries are in the primary's vector before switching to mode S; anything missing is pushed first.
   Entries already received in mode O are dropped as duplicates by `sync_applied`.

**Split network** (some devices reach the primary, others only each other): each device picks its mode by its own
reachability; both groups converge once connectivity returns, through the same vectors.

#### 4.4.2 Initialization and pairing protocol

**Practice creation (once).** Primary hub: licence activation → practice profile → admin A account → device key and
signing key in the keychain → it is the only device and the primary.

**Joining a new device (hub B or a replica).**

| Step | New device | Primary hub |
|---|---|---|
| 1. Preconditions | – | Online (joining is refused in mode O), seat free (5 total, 2 admins), version compatible (same sync schema version). |
| 2. Discover | mDNS / BLE / typed address (existing) shows the primary; a device only offers "join as second admin" if no second admin exists. | Answers with practice name, signed `master-info`. |
| 3. Request | Sends device id, public key, flavor, edition, version, label. | Shows the request to an admin (A, or B for replicas once B exists) with those details. |
| 4. Approve | 6-digit code shown on both screens, compared by the admin. | Admin approves: seat certificate, activation token, home hub, peer list (signed), and for hub B a number block. |
| 5. Bootstrap | Receives a **consistent snapshot** taken at primary vector V (SQLite backup of synced tables, without device-local tables and secrets), applies it in one transaction. Read-only until then. | Streams the snapshot over pinned TLS; resumable. |
| 6. Catch up | Pulls the relay log after V; attachments download in the background, on demand first. | – |
| 7. Ready | Announces "ready"; becomes a sync target for everyone; admin B (for hub B) creates their own account and allowances. | Adds it to the signed peer list and fans out the new list. |

**Re-pairing an existing device** (new OS, new disk, moved to another room): revoke the old identity first, then
join as a new device (new `device_id`, new origin sequence). Unsent entries of the old identity are recovered from
its database if it still opens (export → import as that origin); otherwise they are lost and the admin is told how
many were pending at last contact.

**Duo** uses the same join protocol with the main as the only hub, and stays star-only: when the main is down,
replicas queue locally (as today) and catch up through the main's return protocol, steps 2, 5 and 6.

### 4.5 Sharing and allowances model (Group)

Decision Q5: **everything is shared by default**; each admin narrows it for what concerns them.

| Concept | Rule |
|---|---|
| Owner of a record | The doctor it concerns: `responsible_staff_id` (clinical acts), `for_staff_id` (appointments, payments), `signed_by_staff_id` (documents), `staff_id` (working hours, absences), `doctor_id` (tasks), `ordered_for_staff_id` (orders). Practice-wide master data (catalogues, presets, templates, suppliers, products, practice settings) has no owner: both admins administer it. |
| View rule | Per owner admin and area: who sees it. Default **all**. Options per area: all / other admin only / chosen staff / nobody but me. |
| Change rule | Per owner admin and area: who may change it. Defaults in §6.15. Options: me only / me and the other admin / plus chosen staff. |
| Per record | "Make private" (only me) and "Hide from …" (named people) on an appointment, clinical act, document, task, payment: a `record_visibility` row. Only the owner sets it. |
| Target selector | Forms for person-bound data (working hours, holidays, breaks, absences, calendar blocks) show **For: me / Dr B / both** only for targets the change rules allow. "Both" writes one row per person. |
| Enforcement | Backend `ScopeFilter` strategy builds the SQL `WHERE` from the session's allowances for every list/get/search/statistics/export query, plus `require_allowed(row, action)` on single-row commands. UI hiding follows `useAccess()` but is not the security boundary. |
| Grant rules | Only the owner changes rules about their data. Nobody grants more than they hold. Rules sync owner-signed. Every change is audited. |
| Break-glass | Existing break-glass stays; using it on data not shared with you notifies the owner and is logged. |

---

## 5. Security, privacy and logging

- **Compiled-out attack surface.** Solo has no listener, no pairing keys, no peer trust store. Duo/Group keep pinned
  TLS, signed entries (make `sync.require_signed_entries.v1 = 1` the default for new Duo/Group installs), mt2 tokens.
- **Least privilege defaults per edition.** Solo: two fixed profiles (admin, guest) with RBAC still enforced, plus
  the staged write path for the guest. Duo: fixed profiles (owner, assistant, reception) without the role editor.
  Group: access v2 + Allowances.
- **Second admin cannot escalate.** Admin B cannot change rules about admin A's data; last-admin rule stays.
- **Actor in every change.** Signed sync entries gain `actor_staff_id` (today they carry device, seq, table, id, op,
  time, payload hash). Receivers check owner-only tables against it.
- **Change records (Group; useful in Duo).** Every applied change keeps `actor_staff_id`, `device_id`, `origin_seq`,
  `hlc`, `table`, `row_id`, `op`, changed fields with old and new values. Source: the signed outbox entry. Shown in
  a record's "History" and in Audit.
- **Audit chain per device.** `audit_log` gains `device_id`; each device keeps its own hash chain; chains replicate
  as `AppendOnly` to the hubs so an admin sees one merged trail, each chain verified separately.
- **Logs.** Every line gets `device_id`, `edition`, `flavor`, `version`; error refs become `<device-short>-<ref>` so a
  ref from a replica points to the right machine. Remote log export (`/logs/export`, admin only, redacted,
  audited) for the maintenance view.
- **Privacy docs.** `privacy`/`compliance` pages get a sharing register generated from Allowances (who shares what
  with whom, since when).

### 5.1 Who must be named on documents (research for Q11)

What I could confirm from primary or reliable sources, and what I could not:

| Country | Document | Requirement | Source | Confidence |
|---|---|---|---|---|
| DE | Prescription | Name, first name, professional title and practice address **with phone number of the prescribing person**; issue date; patient name and date of birth; handwritten signature, or a qualified electronic signature for e-prescriptions. | AMVV § 2 | confirmed (law text); a 2024 amendment debate on dropping the title for e-prescriptions: check the current version |
| DE | GOZ invoice | Per service: date, fee number and description, tooth, amount and multiplier; justification above the threshold multiplier. A dentist may bill only services **they performed**, so with two dentists the invoice should make the treating dentist identifiable. | GOZ § 10, § 4 (2) | § 10 confirmed; "name the treating dentist" is my inference from § 4 (2): to confirm with the Zahnärztekammer or your accountant |
| DE | Medical record | Corrections must leave the original content visible and show when they were made; case law and insurers expect "who" too, and software must make later changes visible. | BGB § 630f (1) | confirmed (law text) + practice guidance |
| MA | Invoice / note d'honoraires | Mentions of CGI art. 145-III, including the issuer's IF and **ICE** (art. 145/146): these are the entity's identifiers, i.e. the shared header. | CGI art. 145, 146 (press and law-firm summaries) | likely; exact list to check against the current CGI |
| MA | Ordonnance | I did **not** find the Moroccan text listing mandatory fields. Loi 17-04 (code du médicament, consolidated 2024 on adala.justice.gov.ma) and the Ordre des médecins-dentistes rules are where it lives. Common practice: prescriber name, qualification, address, INPE, date, signature, patient identity. | not confirmed | to confirm with the Ordre or a Moroccan pharmacist |

**Design rule (safe superset, works for both countries):**
- **Header** = the practice (one legal entity): name, address, phone, legal ids (MA: IF, ICE, INPE of the practice
  if any; DE: practice data). Shared by both doctors (Q3).
- **Signature block** = the **signing doctor**: full name, professional title, professional id (MA: INPE;
  DE: the dentist's own number where used), signature line or e-signature. Printed on prescriptions,
  certificates, sick-leave notes, clinical reports, and as "treating dentist" on invoices.
- **Signing doctor resolution** (Q3): default = patient's treating doctor (`patient.treating_staff_id`); when
  reception prepares the document, the doctor chosen at request time; when an admin issues it, that admin.
  `requested_by_staff_id` is stored for the audit trail, not printed.
- Records keep the original on every change (change records, guest staging), which meets § 630f.

Sources: [AMVV § 2](https://www.gesetze-im-internet.de/amvv/__2.html),
[GOZ § 10](https://www.gesetze-im-internet.de/goz_1987/__10.html),
[BGB § 630f](https://www.gesetze-im-internet.de/bgb/__630f.html),
[La Vie Éco: factures et ICE](https://www.lavieeco.com/affaires/factures-ice-mentions-obligatoires-et-sanctions/),
[Loi 17-04 consolidated (adala)](https://adala.justice.gov.ma/api/uploads/2026/07/31/Dahir%20n%C2%BA%201-06-151%20%20portant%20promulgation%20de%20la%20loi%20n%C2%B0%2017-04%20portant%20code%20du%20m%C3%A9dicament%20et%20de%20la%20pharmacie.-1785510136514.pdf),
[ABDA/KBV statements on the AMVV amendment](https://www.bundesgesundheitsministerium.de/fileadmin/Dateien/3_Downloads/Gesetze_und_Verordnungen/Stellungnahmen_WP20/AMVV/2024-02-13_KBV_Stellungnahme_AEVO_AMVV.pdf).
This is research, not legal advice.

---

## 6. UI/UX changes page by page

Principles: Solo and Duo are **single-doctor**: the doctor is implicit (Null Object context), no "Dr." column,
picker or filter appears. Group adds the doctor dimension consistently (same colour per doctor everywhere, same
filter control in the same place). **Solo is compact**: fewer nav entries, denser tables, administration folded into
Settings, no multi-user controls anywhere (no assignee, no "for whom", no role chips, no team badges).

| # | Page | Solo | Duo | Group |
|---|---|---|---|---|
| 6.1 | Onboarding | licence → admin account → practice → optional guest → done | + "add a device" step (optional) | + second admin flow, home hub choice for replicas |
| 6.2 | Nav | Today · Calendar · Patients · Cash · Documents · Stock · Statistics · Settings (+ Inbox badge) | as today minus role editor | as today + Allowances in Settings |
| 6.3 | Dashboard | today's patients, cash, pending guest changes | + device/sync health chip | + doctor switcher (mine / A / B / all), per-doctor tiles |
| 6.4 | Calendar | single column per day, no legend, guest proposals dashed | same, plus who booked | **redesigned:** column per doctor (and chair), colour per doctor, filter chips, target selector on blocks |
| 6.5 | Patient detail | as today without validation badges; guest proposals marked | as today | treating doctor, per-item doctor, "Make private / Hide from…", History tab (author + device) |
| 6.6 | Inbox (Solo) / Tasks (Duo, Group) | **Inbox**: guest changes, Add / Dismiss, bulk per day/patient | tasks among few people | tasks per doctor, filters (doctor, assignee, status, due) |
| 6.7 | Finance, cash, day close, balance sheet | compact, no "collected by" | + "collected by" | + "for doctor" and "collected by" columns and filters; one cash book |
| 6.8 | Statistics | KPIs, month comparison | same | filters (doctor, period, treatment type, payment method), compare doctors when both share, professional charts (consistent palette, axes, exports) |
| 6.9 | Administration | folded into Settings tabs: practice, opening hours, catalogues, templates, finance reports, stock | + team (cards), work time | + target "for me / Dr B / both" where allowed |
| 6.10 | Ops / Logs | backups, local logs | + sync status, conflict inbox | **maintenance view:** device list (version, last seen, queue depth, last error, disk, backup age), remote log export, re-pair/revoke, sync problems by device |
| 6.11 | Audit | as today + guest Add/Dismiss events | as today | author + device columns, filters, sharing events |
| 6.12 | Orders / stock | as today | + who ordered | ordered by / for whom / paid by / approved by, filters |
| 6.13 | Settings | no deployment/pairing/network/team sections; new "Guest" section | as today | + home hub, **Allowances** |
| 6.14 | Documents & PDFs | as today | as today | signing doctor picker (defaulted per §5.1), shared letterhead |

### 6.15 Settings → Allowances (Group)

One page, two tabs, and **both admins' columns side by side**, so each sees their own choices (editable) and the
other admin's (read-only). Staff rows below. Every row says in plain words what it does.

**Tab 1: "What I share" (view rules).** Default: shared with everyone.

| Area | Options | Default | Affects |
|---|---|---|---|
| My calendar appointments | everyone / other admin only / chosen staff / nobody | everyone | calendar, dashboard, patient appointments tab |
| My working hours, holidays, breaks | everyone / other admin / chosen staff | everyone | calendar background, booking |
| My clinical acts (examinations, treatments, findings, attachments) | everyone / other admin / chosen staff / nobody | everyone | patient record, chart PDF, exports |
| Documents I signed (prescriptions, certificates, reports) | same | everyone | documents lists, patient tab |
| Payments for me, my revenue | same | everyone | finance, day close detail (totals stay complete for the legal cash book) |
| My statistics | same | everyone | statistics, dashboard tiles |
| My tasks | same | everyone | tasks |
| Orders I placed / placed for me | same | everyone | orders |
| History of my records | same | everyone | History tab, audit (audit itself stays visible to both admins) |

Patient master data and practice-wide master data are always shared (one entity, front desk needs them).

**Tab 2: "Who may change" (change rules).**

| Area | Options | Default |
|---|---|---|
| My working hours / work plan | me / me + other admin / + chosen staff | me + other admin |
| My holidays, breaks, absences | same | me + other admin |
| My calendar (book, move, cancel in my agenda) | same | me + other admin + reception |
| My clinical acts | me / me + other admin | **me** (Q-E: the other dentist adds new entries and comments, never edits mine unless I allow it here; § 630f) |
| Documents in my name | me / me + other admin / + reception prepares | me + reception prepares |
| Payments for me (cancel, refund) | me / me + other admin / + cashier | me + other admin |
| My tasks | me / + other admin / + staff | everyone |
| Shared master data: catalogues, prescription/treatment presets, templates, suppliers, products, orders | practice rule set by both: both admins (default) / both + chosen staff | both admins |
| Practice settings, letterhead, opening hours | both admins | both admins |

**Staff section.** One row per staff member, one column per admin: "sees my data" (all / chosen areas / none) and
"may change" (per the areas above). Reception sees both doctors by default; either doctor can limit what they see
of their own data.

**Effects elsewhere.** The target selector "For: me / Dr B / both" appears in working hours, holidays, breaks and
calendar blocks only for targets the change rules allow. Lists and statistics show a small "not shared by Dr B"
note instead of silently missing data.

---

## 7. Test plan

| Level | What | Where |
|---|---|---|
| Build matrix (CI) | `cargo check` and `cargo test` for `solo`, `duo`, `duo+replica`, `group`, `group+replica`; `vite build` per edition | GitHub Actions matrix |
| Compiled-out proof | Solo binary: `cargo tree -e features -p medoc` has no `medoc-lan`, `medoc-sync`, `axum`, server `rustls`, `mdns`; symbol grep finds no `sync_push`, `practice_task`, `work_time`; Solo bundle has no `pairing`, `cluster`, `sync`, `tasks`, `work-time`, `team` chunks (Vite plugin + test) | `scripts/check-edition-surface.sh` |
| Size/perf budget | binary size, bundle size, cold start, first-screen time per edition, tracked per PR | `perf.log` + CI artifact |
| Capability unit tests | generated consts match YAML; `compile_error!` on 0/2 editions and on guest_inbox + multi_staff; boot mismatch refusal | `medoc-core`, vitest |
| Guest inbox (Solo) | every guest write lands in `staged_change`, never in the target table; Add applies through the service; Dismiss leaves data untouched; conflict path; guest cannot issue numbered documents, export, delete or change settings; audit keeps original | Rust integration tests + Playwright |
| Sync property tests | random concurrent edits on 3 (Duo) and 5 (Group) simulated devices, random partitions and restarts → all converge, no lost field (LwwField), no duplicate numbers, numbered docs immutable | `medoc-sync` (proptest) |
| Multi-device e2e | real HTTP between processes: pairing limits (4th device refused in Duo, 6th in Group), re-pairing, primary offline → mode O → catch-up → mode S with no lost or duplicated entry, split network, join refused in mode O, snapshot join resumed after a cut, origin-only in mode O (count pushes), owner-only rows refused from a non-owner actor | `crates/test/medoc-e2e` (extends `multi_device_port_http.rs`) |
| Allowances tests | generated matrix: area × view/change rule × grantee × per-record override → allowed or not, for list, get, search, statistics, exports, PDFs; target selector shows only allowed targets | Rust integration tests + vitest |
| Migration tests | current production DBs → new schema per edition; Solo → Duo → Group upgrade keeps data; upgrade refused with pending guest changes | `medoc-core/tests` |
| UI | Playwright per edition: nav shows only enabled modules; no doctor or multi-user UI in Solo/Duo; Group calendar filters and Allowances page; RTL screenshots for new pages | `apps/practice-host-ui/e2e-playwright` |
| PDFs | signing doctor resolution (patient default / reception choice / admin issuer) and the superset signature block per country | `medoc-core` PDF tests |
| Operations | sealed bundle opens only with the vendor key and fails on tamper; no patient field in error/health payloads (allow-list test); remote command with bad signature, expired or replayed is refused; update with a bad signature is refused; incompatible replica pauses sync without losing queued work; security patch waits for after hours | Rust tests + e2e |
| Security | Solo: no open port (scan); Duo/Group: unsigned entry refused, admin B can't change rules about admin A's data | e2e + `security-audit` pass before release |

---

## 8. Phased tickets

Each ticket is one PR, mergeable on its own, with tests. Effort: S ≤ 1 day, M ≤ 3 days, L ≤ 1 week.

**P0: Foundations (no behaviour change)**
- T0.1 `config/editions.yaml` + codegen to Rust/TS + CI consistency check. (M)
- T0.2 Spike: per-module IPC registration in Tauri 2 (cfg in `generate_handler!` vs composed handler). (S)
- T0.3 Cargo `cap-*`/`edition-*` features, `compile_error!` guards, `edition_info` command, boot mismatch check. (M)
- T0.4 Vite defines per capability, npm/tauri scripts, `tauri.<edition>.conf.json` overlays. (S)
- T0.5 CI build matrix (5 builds) + edition surface check script. (M)

**P0 status (done 2026-11-24)**

| Ticket | Result |
|---|---|
| T0.1 | `config/editions.yaml`; `medoc-codegen::editions` → `OUT_DIR/edition_generated.rs` (`Caps`, `SOLO/DUO/GROUP`, `CORE_CAPS`), `packages/shared/src/lib/edition.generated.ts`, `packages/shared/src/edition-defines.generated.d.ts`. Codegen fails on unknown or exclusive capabilities and on a capability without a `cap-*` feature in medoc-core's `Cargo.toml`. |
| T0.2 | `#[cfg]` on `generate_handler!` entries works (see §3.3). |
| T0.3 | medoc-core `cap-*` (+ `full`), medoc-practice `edition-*` (default group) and `cap-*`, apps/practice-host `edition-*` (default group). `compile_error!` for no edition, two editions, Solo + replica, guest_inbox + multi_staff; `const` assert that the edition's caps equal the compiled `cap-*` features. `edition_info` command (`crate::edition`). |
| T0.4 | Vite `define`: `__MEDOC_EDITION__` and one literal `__CAP_*__` per capability from `MEDOC_EDITION` (default group, unknown value fails the build); `@/lib/edition` (`EDITION`, `CAPS`, `editionMismatch`); boot check in `main.tsx` refuses a UI/core mismatch (`error.device.edition_mismatch`, 4 languages); npm scripts `build:<edition>`, `tauri:build:<edition>[:replica]`, `check:editions`; overlays `tauri.{solo,duo,duo.replica,group,group.replica}.conf.json` (display names Essentiel / Cabinet / Cabinet+, same identifier per flavor for in-place upgrade). |
| T0.5 | CI job `editions` (5 builds: cargo check + web build) gating `ci-ok`; `scripts/check-edition-surface.sh` runs informational (`continue-on-error`) and today lists 11 Solo leaks (medoc-lan, medoc-sync, axum, 8 commands): the baseline P2 removes. |

**P1: Module registry (no behaviour change, default = group)**
- T1.1 Split `register.rs` into module handler lists; `ModuleRegistry` for IPC and LAN routes. (L)
- T1.2 TS `FeatureModule` registry; `App.tsx`, nav, native menu, palette, breadcrumbs read it. (L)
- T1.3 `DoctorContext` strategy (single/multi) and `useDoctorContext()`; replace direct physician pickers. (M)

**P1 status (done 2026-11-24)**

Also: the start-up message key became `error.device.edition_mismatch` (code MD-APP-047, generated catalog refreshed).

| Ticket | Result |
|---|---|
| T1.1 | Not needed as planned. T0.2 showed `#[cfg]` works per entry, so `register.rs` stays one list and P2 gates entries in place. LAN routes need no per-module router: Duo and Group both have `net`, and Solo drops `medoc-lan` as a whole in T2.1. |
| T1.2 | Smaller than planned: `ROUTE_VISIBILITY` (rbac.ts) already is the single route list that the route guard, palette, sidebar and native menu key on. `packages/shared/src/lib/feature-modules.ts` adds which capability owns which route (tasks, chart validation, team, work time). `routeChildPathAllowed` (guard + palette), `navItemVisible` (sidebar) and the native "Go to" menu refuse routes of modules that are off; `apps/practice-host-ui/src/edition-gated-pages.ts` loads those pages behind `__CAP_*__` (else `NotInEdition`), so their chunks leave the bundle (Solo surface leaks 11 → 9). Breadcrumbs only hold labels, unchanged. |
| T1.3 | `packages/shared/src/lib/doctor-context.ts`: `SINGLE_DOCTOR` / `MULTI_DOCTOR` strategies, `DOCTOR_CONTEXT` chosen by `__CAP_MULTI_DOCTOR__` (a constant, no hook needed). Applied through `DoctorSelect` and `AppointmentDoctorFilter` (new components, which also shrink the page files) to the doctor legend (calendar, day view, month view), the calendar doctor filter, the booking form doctor picker (the form already fills in the signed-in physician / default / first), and the "default doctor" setting in work hours. Left for T3.5: per-doctor work-hours profile picker, chart "forward to physicians" dialog, per-doctor colours in the grid. |

Group builds behave exactly as before; Solo and Duo builds now hide the routes and doctor UI above.

**P2 status (in progress, 2026-11-24, uncommitted)**

- Fixed the two test targets that no longer compiled: `backup_tests` (rewritten for the current 3-day / previous-week / previous-half-year retention) and `sync_mesh_harness` (new struct fields; day-close schema ensured as the commands do).
- **T2.1 done.** Solo links no network code: `medoc-lan` optional (`cap-net`); `medoc-company` (vendor server) is a dev-dependency only; `medoc-core`'s CORS helper behind `http-host` (servers only, so no axum); `medoc-sync` gained a `net` feature (default on) for mDNS / Noise / CBOR, with `net_types.rs` (plain data, always built) and `net_offline.rs` (Solo stand-in: discovery finds nobody, remote calls fail with `error.device.no_network`, MD-APP-048). Licence activation, install plan and device status moved to `commands/network/local.rs`; `cluster`, `sync`, `lan`, `pairing`, reconnect check and their background tasks compiled out of Solo. Network UI hidden in Solo (badges, banners, queue bar, replica sync, join route and links, device-role chooser on the licence screen, network settings).
- **T2.2 done for tasks, validation, work time.** Rust commands gated per capability in `register.rs` (tasks and tickets, the validation queue, work time, work plans, sick-leave admin) plus the work-time sweep; UI callers gated (nav badges, dashboard queues, notifications, statistics work-time panel, plan-next "send to reception", chart hand-off dialogs, focus mode, work-time auto-record). Kept in Solo on purpose: chart/payment validation marks (`chart_validation`, also used by the cash desk) and the next-appointment note (pre-fills booking).
- `scripts/check-edition-surface.sh` now checks every gated command name (generated from `register.rs`) and the network crates; Solo: **no leaks**; the CI step is now blocking.
- **T2.3 done.** Solo has two fixed accounts: the admin (owner) and one guest (`application::guest`, Settings → Security → Guest account: on/off, password, "may read the clinical record"). Guest profiles `solo.guest` / `solo.guest_clinical` exist only in guest-inbox builds. Team and access commands (19) are compiled out of Solo, with the access guide in Help. A turned-off guest cannot sign in (`error.guest.disabled`); the login page has a "Guest" shortcut.
- **T2.4 done.** One chokepoint: `rbac::effective_allowed` refuses every non-read action of the guest (Solo: the only reception login); `rbac::proposal_allowed` says what it may propose. Guest saves of appointments (create, change, move), patients (create, change) and cash payments go to `staged_change` through `staged_change_submit` (arguments checked against the command's own input types). The admin's **Add** replays the same command with the admin's session; **Dismiss** takes an optional reason. Both are audited; the guest's original stays untouched. Inbox page at `/inbox` (grouped by day, title + description from `guest-inbox-text.ts`, Add / Dismiss, Add all / Dismiss all, guest sees own proposals and their outcome), sidebar badge for the admin, notice for the guest after sending. Tests: `medoc-core/tests/guest_inbox_tests.rs` (run in the CI editions job), `guest-inbox-text.test.ts`.
- Known limits of the guest inbox: no "pending" overlay in the guest's calendar (the guest follows its proposals in the inbox); edits show the new values, not a before/after diff; Add does not warn when the record changed after the proposal (the replay runs the normal checks and a failure leaves the item waiting with the error shown); app-kv writes of the guest (e.g. booking drafts) are refused like every other write.
- **T2.5 done (scope reduced).** New capability `day_close` (Duo, Group): Solo has no day-close page, buttons or the 5 day-close commands (Q-A); the cash book, cash movements, day-close reports and the balance sheet stay. Dashboard drops the hand-offs card (validation queue / reception tasks) where neither exists. One-person editions start with the existing *compact* density (Appearance can change it). Administration folded into Settings (2026-11-24): one-person editions (no `multi_staff`) drop the sidebar entry; Settings → Administration shows the same overview table (practice planning, catalogues and templates, finance reports, stock), and the administration pages' back buttons lead there. The `/administration` route stays for links and the command palette. Not done: renaming the remaining Solo nav entries.
- **Accounts vs devices (2026-11-24).** `config/editions.yaml` now names two separate limits: `devices` (computers: Solo 1, Duo 3, Group 5; licence seats and pairing) and `accounts` (sign-in accounts: Solo 2 = admin + guest, Duo 3, Group 20, at most `doctors` physicians). The staff account quota (`mvp_security::staff_quota_limits`, DB triggers reinstalled at start) follows the edition's `accounts`; builds without an edition keep the old MVP caps (5). Messages say "accounts", and the guest gets its own message when the cap is reached.
- **T2.6 done (size; start-up time not measured).** Measured 2026-11-24 on macOS arm64, plain `cargo build --release` (no LTO), desktop binary `medoc`:

  | | Binary | Web JS | gzipped | chunks | start-up chunk |
  |---|---|---|---|---|---|
  | Solo | 58.5 MB | 4.10 MB | 1.07 MB | 137 | 1.20 MB |
  | Group | 78.9 MB | 4.34 MB | 1.13 MB | 166 | 1.24 MB |
  | Solo vs Group | **−25.9 %** | −5.6 % | −5.5 % | −29 | −3 % |

  Duo's web bundle is within 0.1 % of Group's. The binary meets the 25 % target of §4.2; the web bundle gains little because the shared screens dominate it. Cold start was not measured (needs the packaged app on the reference laptop).

**P2: Solo**
- T2.1 Make `medoc-lan`/`medoc-sync` optional; `cap-net` gates in the 15 practice files and ~30 core files; no-op outbox. (L)
- T2.2 Gate out tasks, tickets, chart validation, next-appointment hints, work time, sick-leave admin, team, access. (M)
- T2.3 Fixed accounts admin + guest; Settings → Guest. (M)
- T2.4 `staged_change` + `WritePath::Staged` + Inbox (Add / Dismiss, bulk, conflicts) + pending overlay. (L)
- T2.5 Compact Solo UI: nav, administration folded into Settings, dense tables, onboarding. (M)
- T2.6 Size/perf baseline and Solo budget report. (S)

**P3 status (started 2026-11-24, uncommitted)**

- **T3.1 (device seats) done:** `medoc-sync::cluster::seat_budget` takes devices from the edition (`devices`, `admins`): Solo 1/1/0, Duo 3/1/2, Group 5/2/3 (total / admin / member). Old licence names map BASIC→Solo, PRO→Duo, ENTERPRISE→Group (Q8); a build accepts its own edition's licence or a lower one and the seats are the smaller of the two (Q9). USB owner activation uses the build's edition. Existing clusters keep the seat numbers stored at their activation until the licence is activated again.
- **T3.5 (single-doctor UI) finished** for the three spots left from P1: chart hand-off dialogs (ticket recipient picker hidden, forward pre-selects the practice's dentist; the dentist's own "forward" button is gone because nobody else is there to forward to), calendar colours need no change (one doctor = one colour). The work-hours per-clinician profile stays: it is the dentist's own hours.
- **T3.6 (schema) done:** `migrations/edition_columns.rs` adds the §4.1 columns, nullable, in every edition: treating doctor on patients; responsible doctor, author and device on charts / examinations / treatments (backfilled from `released_by_physician_id`); author, collector, beneficiary doctor and device on payments and cash movements; signing / requesting doctor on prescriptions, certificates, sick-leave notes, issued documents and invoices; for whom / paid by / approved by on orders; chair on appointments; doctor on tasks; device on audit entries. Every audit entry now records the device that wrote it (not part of the HMAC, so existing chains still verify). Writing the other columns from the commands comes with the features that read them (Group, P4–P5). Tests: `edition_columns_tests.rs`.
- **T3.2 (field merge) done:** patients, appointments and tasks merge field by field (`field_hlc::FIELD_LWW_TABLES`). Each field has its own clock in `sync_field_hlc`, with a fingerprint of the value it was stamped with; a local write bumps only the fields whose value changed and sends the map as `syncFieldHlc`. On receive (`medoc-sync` `merge_fields.rs`) each field is decided on its own: newer clock wins, a tie goes to the main device. Two devices that edit different fields offline both keep their edit. A peer that sends no field clocks is decided with its row clock, as before; every other table keeps row-level LWW. Tests: `medoc-sync/tests/field_merge_tests.rs`.
- **T3.3 (conflict inbox) done:** each change also names, per changed field, the clock the field had before (`syncFieldBase`). The main device compares it with its own clock for that field: if they differ and the values differ, the writer had not seen the main device's value — a real conflict, not a later edit. The newer value is kept and the other one goes to the existing sync-problems list as `FIELD_CONFLICT`. Settings → device network (main device, admins with `ops.system`) shows open problems with "Keep" / "Use other value"; taking the other value writes it as a new local edit, so it reaches every device. Other problem kinds (gave up, duplicate, not sent) show there too with Retry / Dismiss. Commands: `sync_problem_list`, `sync_problem_open_count`, `sync_problem_retry`, `sync_problem_dismiss` (cap-net).
- **T3.4 (transfer) done:** pull pages were already gzipped by the main device. Push pages ≥ 8 KB are now gzipped by the replica (`medoc-sync::push_body`); `medoc-lan` decompresses them outside its 16 MB body limit, so the limit counts decompressed bytes. A main device without that layer answers 400/415 and the page is sent once more uncompressed. Benchmark of record (unit test): a 200-entry appointment page shrinks more than 5×. Attachment downloads resume: the main device honours `Range: bytes=N-` (206), the replica keeps a broken download in `sync_blob_partial` and asks for the rest next round; the SHA-256 check of the finished blob is unchanged (`blob_resume_tests.rs`). Not done on purpose: field-only deltas — the payload stays the full row because older peers and first inserts need it, and gzip already removes most of the repetition.

**P3: Duo**
- T3.1 Seat budget DUO 3/1/2 at licence, pairing decide, join; licence edition mapping. (M)
- T3.2 `MergePolicy` per table; `LwwField` for patient, appointment, task. (L)
- T3.3 Conflict inbox UI on main. (M)
- T3.4 Transfer efficiency: compression, field deltas, blob resume; benchmark. (M)
- T3.5 Single-doctor UI pass: calendar, tasks, work time, tables, statistics, team cards. (L)
- T3.6 `staff` registry class fix; schema columns from §4.1 (created_by, device_id, responsible_staff_id, signed_by). (M)

**P4 / T5.1 status (started 2026-11-24, uncommitted)**

- **T4.1 (routing) done, reduced:** `medoc-sync::engine::route`. A Group device that misses 3 sync rounds with the primary (no answer at all, not an error status) switches to origin-sends: it pushes its own pending entries to every peer of the last peer list the primary signed (kept in `app_kv`, signature re-checked with the pinned key). As soon as the primary answers again the device is back in star mode. That is safe without a catch-up handshake because every device keeps its own entries pending for the primary (`delivered_at`) in both modes, and receivers drop duplicates (`sync_applied`). Duo stays star-only. Pull by origin vector and the catch-up handshake followed (see the 2026-11-25 entries below). Test: `medoc-sync/tests/route_mode_tests.rs` (run with `--features medoc-core/full` for Group).
- **T4.2 done (owner-only rows):** `allowance_rule` and `record_visibility` rows are accepted by the merge only when `updated_by_staff_id` is the row's owner, and a rule's id must carry its owner (`application::allowances::is_owner_signed`). The writer travels in the signed payload (the payload hash is in the signed bytes), so no per-entry actor field was needed.
- **T4.3 done (number blocks):** `number_sequence::blocks`. The primary reserves a block (default 50) for a device whose pairing grant lists the new action `sync.number_block` (`POST /sync/number-block`, Group builds only) and moves its own counter past it. Hub B asks the primary for each number while it answers, refills its block when less than half is left, and issues from it only when the primary cannot be reached; an error answer from the primary is never bypassed. `void_ranges` lists unused numbers of blocks whose day / month / year has ended, for the period report. The pairing screen offers the grant in Group ("Second admin hub: issue numbers offline"). Void ranges in the period report: done 2026-11-26 (below). Tests: `blocks` unit tests, `medoc-sync/tests/number_block_tests.rs`, `medoc-lan` `number_block_needs_its_own_grant_and_moves_the_main_counter`.
- **T5.1 done (backend):** `domain::allowances` (areas, view / change / record rules, §6.15 defaults, decisions) and `application::allowances` (tables, owner-only `set_my_rule` / `set_record_rule`, both audited and synced; `ScopeFilter` with a SQL condition and per-row sight; `require_change`; error `error.access.not_allowed_by_owner`, MD-APP-055). Tests: `medoc-core/tests/allowances_tests.rs`. Wired into commands and the Sharing page in T5.2 (below).
- **T4.1 follow-up done (2026-11-25): pull by origin vector.** `medoc-sync::engine::origin_pull`. In Group every replica keeps a signed copy of each change another device pushes to it (`sync_origin_copy`, 30 days) and serves "entries of origin X after seq N" on `POST /sync/origin-pull` (grant `sync.pull`). A device in mode O asks each peer for what it missed; each origin's entries are checked against that origin's own pinned key, so a forged copy is refused and a forwarded one is as trustworthy as the original. Peer pushes in mode O are now signed (they were sent unsigned before). Test: `origin_pull_tests.rs`.
- **T4.1b done (2026-11-25): primary catch-up.** `medoc-sync::engine::catch_up` + `SyncEngine::primary_catch_up`, started at launch (`spawn_primary_catch_up`). A Group primary with paired devices announces "catching up", refuses replica push / pull / exchange with 503 `primary_catching_up` and does not relay; replicas read that as "not reached" and stay in mode O. It collects every reachable peer's copies by origin vector (with its own exchange token, now accepted on `/sync/origin-pull`), then marks itself ready (at most 10 minutes). Joining is refused while it catches up (`error.pairing.primary_catching_up`). Number blocks need no extra step (their rows travel as entries). The snapshot join is the existing initial copy (`engine/initial_copy.rs`); no new snapshot format. Not done: hub B first in the collect order (order does not change the result), the signed "ready" vector, digest verification as a separate catch-up step (hourly reconcile still runs). Test: `catch_up_tests.rs`.
- **T4.4 done, reduced (2026-11-25): hub replacement numbering.** A hub becomes primary through the vendor MASTER licence activation (`set_deployment` from replica to main), which now marks a takeover (`number_sequence::mark_takeover`). A sequence this device never counted continues after every number it has seen: documents and number blocks it held (`blocks_floor`, all editions). After a takeover, Group refuses the first issue of a daily / monthly sequence while numbers below that floor are unaccounted for (`error.numbering.gap_found`); Help → Support lists the gap and an admin lets numbering continue (`numbering_gap_acknowledge`, audited). Re-pairing a device stays revoke + join as a new device (existing). Not done: recovering unsent entries from an old device's database, the "n changes were pending" message, yearly sequences in the gap check (no table lists them). Tests: `number_sequence_tests.rs` (`takeover`).
- **T4.5 done, reduced (2026-11-25):** `five_device_convergence_proptests.rs`: 5 devices, random field edits, partial delivery (partitions) and duplicate re-delivery (restarts, mode O), then a shuffled full delivery: every device ends equal and each field keeps its newest edit. Existing tests already cover pairing seat limits (`medoc-e2e/cluster_seat_caps.rs`), numbered documents and number blocks. Not done: a 5-process HTTP e2e of mode O → catch-up → mode S (the steps are covered one by one in `route_mode_tests`, `origin_pull_tests`, `catch_up_tests`).
- **T5.2 progress (2026-11-25):** Settings → Sharing page, `allowances_*` / `record_visibility_*` commands, calendar filtering (hidden owners, change rule on book / move / cancel) and clinical filtering exist. Added: the per-record control "Who sees this record: shared / only me / hidden from chosen people" (`record-privacy.tsx`, owner only, Group only), in the appointment panel. Not done: the control on clinical entries, documents and tasks; the target selector "for me / Dr B / both"; the staff section of the page.
- **Owners on new records (T5.4 / T5.7 backend, 2026-11-25):** `commands/ownership.rs`. In Group, create commands fill the §4.1 columns: responsible doctor, author and device on examinations and treatments; for whom, collected by, author and device on payments; signing and requesting doctor on prescriptions and certificates; a patient's first booked doctor becomes their treating doctor. Signing doctor (§5.1): the issuing dentist, else the doctor chosen at request, else the patient's treating doctor. Each stamped row is queued again so the columns reach the other devices. Test: `medoc-practice/tests/ownership_tests.rs`. Not done: per-doctor fields and filters in the task, finance and order UIs.
- **T5.3 done, reduced (2026-11-25): calendar.** Group day view shows one agenda column per doctor (up to 4, `limits.group.doctors`) under a shared hour gutter, each headed by the doctor's colour, name and count; double-clicking a column books with that doctor. The header legend became the doctor filter (chips, `aria-pressed`; none pressed = everyone; one pressed = that doctor's single column), sharing state with the filter popover. Solo / Duo unchanged (one doctor, no columns). Checked in a browser with sample data (two doctors, chip filter). Not done: chair (room) columns (no rooms data yet), dragging an appointment to another doctor's column (the drop keeps the doctor), week view per doctor (colours only), the "for me / Dr B / both" target selector on calendar blocks.
- **T5.5 done (2026-11-25): validation routed by Allowances.** A chart in the validation queue belongs to its responsible doctor, else the patient's treating doctor (`chart_owner`). In Group, `list_charts_to_validate` drops charts whose owner does not share clinical data with the viewer and marks each row `can_validate` from the owner's clinical change rule (default "me", Q-E); `validate_patient_chart` / `decline_patient_chart` enforce the same rule (`error.access.not_allowed_by_owner`); the sidebar badge counts only what the viewer may validate. The page has a "Mine / All / Other doctor" filter (mine includes charts with no doctor yet) and a Doctor column; rows the viewer may not validate show "Their doctor validates" instead of the buttons. Solo / Duo unchanged. Checked in a browser with sample data. Test: `medoc-practice/tests/validation_routing_tests.rs`. Also fixed: owner stamps (`ownership.rs`) now bump `updated_at`, so devices take the re-sent row (caught by `recorded_write_guard`). Dashboard card: fixed 2026-11-26 (below).
- **T5.6 done, reduced (2026-11-25): statistics per doctor.** `get_statistics_overview` takes an optional `doctorId` (Group). It narrows appointments (`physician_id`), treatments and the doctor-dependent part of diagnoses' source (`responsible_staff_id`), prescriptions (`signed_by_staff_id`, else `physician_id`) and income (`payment.for_staff_id`); patient figures and orders stay practice-wide. Doctors who do not share Statistics with the viewer are left out of every figure and listed in `hidden_doctors` (the page says "Not included, because not shared with you: …"); filtering on such a doctor is refused. Without a filter, `per_doctor` compares the last 12 months (appointments without cancellations / no-shows, treatments, income when finance is readable) for every doctor the viewer may see. Page: a doctor picker next to the period, a "Doctors, last 12 months" table whose names narrow the page. Checked in a browser with sample data. Test: `medoc-practice/tests/statistics_doctor_tests.rs` (it caught a sqlx placeholder trap: a bare `?` is counted from 1 even after `?1`, so the clauses use numbered placeholders; `ScopeFilter::sql` now warns about it). Not done: filters by treatment type and payment method, the "professional charts" redesign, per-doctor series inside the existing charts (one series per doctor), diagnoses from dental findings by doctor (no owner column), the dashboard tiles.
- **T5.7 done (2026-11-26):** signing doctor on prescriptions and certificates. When the source row's `signed_by_staff_id` names a doctor other than the practice clinician, `issue_clinical_document` prints that doctor's block: name, title and their own professional id (ZANR / INPE / RPPS by country), plus the practice BSNR in Germany; never the practice clinician's id (`PracticeProfile::signature_lines_for`). Title and id per doctor live in `app_kv` `documents.doctor_signatures.v1` (`{staffId: {title, professionalId}}`, read by every role, write `ops.system`, synced like other practice settings), edited in Group under Settings → Practice → *Doctors on documents* (shown with two or more doctors). Solo / Duo never stamp a signing doctor, so their PDFs are unchanged. Letterhead stays the practice's (§5.1). Tests: `practice_profile` unit test, `document_registry_tests::second_doctor_signs_the_certificate_they_issued`. Checked in a browser with sample data. Not done: sick-leave notes, issued reports and the "treating dentist" line on invoices (no signer column read there yet); the letterhead's clinical id line still shows the practice clinician's INPE/ZANR when the header table includes it.
- **Sharing choices name the dentist (2026-11-26):** Settings → Sharing no longer says "Everyone" / "the other dentist": each choice names the other dentist(s), e.g. "Dr. Alaoui and the team", "Dr. Alaoui only", "Only me"; change rules "Me and Dr. Alaoui", "Me, Dr. Alaoui and reception", "Me, Dr. Alaoui and the team". The other dentist's read-only column is worded from their side (it names me). Rules are unchanged (`settings.allowances.named.*`). Cabinet+ only, like the Sharing page and the *Doctors on documents* block: neither is in the Essentiel or Cabinet web bundle (checked by grepping the built JS), the allowance commands are compiled out (`cap-allowances`), and the `documents.doctor_signatures.v1` setting is refused without `cap-multi-doctor`.
- **"Busy only" removed (2026-11-26, user decision):** the calendar rule where others see a dentist's appointments as anonymous "busy" blocks is gone everywhere: `ViewRule::BusyOnly` / `Sight::BusyOnly`, the masking in `appointment_allowances.rs`, the hatched calendar block, its strings and the Sharing choice. A dentist's calendar is now shared, shared with the other dentist only, or kept to themself. Never released; a stored `busy_only` rule no longer parses and falls back to the default (shared).
- **Open items closed (2026-11-26):** (1) the dashboard's "to validate" card in Cabinet+ lists only charts the viewer may validate (`can_validate`), like the sidebar badge and `count_charts_to_validate`; the others stay on the validation page under "Other doctor". (2) Period report: `void_numbers` lists unused numbers of every hub's expired blocks reserved in the period (`blocks::void_ranges_between`), in the report, its PDF summary ("Unused numbers (void)") and the balance-sheet page, so no number goes missing silently (§4.4). Older saved reports read it as empty. Tests: `blocks` unit test, `finance_workflow_tests::period_report_uses_money_received_and_real_expenses`. Checked in a browser with sample data.
- **T5.4 finance done (2026-11-26):** Cabinet+ finance list. `Payment` now carries `for_staff_id` and `collected_by`; `list_payments_paged` takes a `doctorId` filter and applies the owner's "Payments for me" view rule (`commands/billing/payment_allowances.rs`: hidden doctors and hidden payments left out, filtering on a hidden doctor refused with `error.access.not_allowed_by_owner`) and returns `hiddenDoctors`. Page (`finance-doctor.tsx`, `finance-doctor-data.ts`): Doctor filter, Doctor column with "Collected by …" when someone else took the money, and "Payments not shown, because not shared with you: …". Orders are hidden while a doctor is picked. Month totals (`payment_finance_kpis`) stay complete: they are the cash book. Essentiel / Cabinet unchanged. Tests: `part_f_tests::payment_list_filters_by_doctor_and_sharing`, `medoc-practice/tests/payment_scope_tests.rs`. Checked in a browser with sample data. Not done: tasks and orders (the rest of T5.4), a "collected by" filter.
- **File-size rule back to green for app code (2026-11-26):** `issue.rs` (signing doctor → `issue/signing_doctor.rs`), `statistics.rs` (doctor scope and per-doctor comparison → `statistics/doctor.rs`), `medoc-lan` `http/sync.rs` (blobs → `sync/blobs.rs`) and `http/mod.rs` (conflict inbox → `http/sync_problems.rs`). The 12 files still over the limit are in `website/` and `sifralabs/`, outside this plan.
- Removed (2026-11-26): leftover debug `fetch` calls to `127.0.0.1:7291` in `apps/practice-host-ui/src/main.tsx` (sent boot events and window error text to a local port on every start).
- Not started: T5.8, T6.1, T7.7.

**P4: Group data and sync**
- T4.1 Hybrid routing: relay log on the primary (mode S), origin-sends + pull by origin vector (mode O), heartbeat mode switch. (L)
- T4.1b Primary catch-up protocol (announce, collect, verify, ready) and join protocol with consistent snapshot. (L)
- T4.2 Actor in signed entries; owner-only tables. (M)
- T4.3 Numbering authority on the primary hub + reserved number blocks for hub B. (M)
- T4.4 Re-pairing and hub replacement procedures + gap check. (M)
- T4.5 Property tests and 5-device e2e. (L)

**P5: Group sharing, workflows, UI**
- T5.1 `allowance_rule`, `record_visibility`, `ScopeFilter` in repos; allowances test matrix. (L)
- T5.2 Settings → Allowances page (both views), per-record "Make private / Hide from", target selector. (L)
- T5.3 Calendar redesign (doctor/chair columns, colours, filters). (L)
- T5.4 Tasks, finance, orders: per-doctor fields and filters. (L)
- T5.5 Validation routed per Allowances. (M)
- T5.6 Analytics: filters and chart redesign. (M)
- T5.7 PDFs: signing doctor resolution and superset signature block (§5.1). (M)
- T5.8 Change records, per-device audit chains, maintenance view, remote log export. (L)

**P6: Specialty layer**
- T6.1 `SpecialtyPack` trait + dental pack behind `specialty-dental`; TS `SpecialtyModule`. (L)

**P7 status (started 2026-11-24, uncommitted)**

- **T7.1 done:** `medoc-core::infrastructure::support_seal` seals to the vendor support key (X25519, `MEDOC_VENDOR_SUPPORT_PUBKEY` baked at build time; ephemeral key agreement → HKDF-SHA256 → XChaCha20-Poly1305, header as associated data, key id in the header). Builds without the key seal to a published dev key and say so (build warning, UI notice). Vendor tool `tools/medoc-support-open` (`keygen`, `open` picking the secret by key id). Release workflow reads the key from the repository variable; `docs/operations/vendor-key-rotation.md` has the procedure. Tests: seal/open, tamper refusal, CLI round trip.
- **T7.2 done:** Help → Support (admins with `ops.system`): description, error code (pre-filled from `?ref=`), logs on/off. `support_bundle_create` zips description, allow-listed facts (version, edition, flavor, OS, device short id), a health summary (DB and audit chain ok, DB size, sync queue and open sync problems) and the redacted logs, seals the zip, saves `medoc-support-<date>[-<ref>].mdsb` to Downloads, writes an audit entry, and the UI opens the mail app (`mailto:` with subject and body). Support address: `MEDOC_SUPPORT_EMAIL` at build time; unset, the mail opens with an empty "To". Open: the device signature on the bundle (§11.1) and other devices' logs in Duo/Group.
- **T7.3 done:** `medoc-core::infrastructure::error_reports`. Every error the UI logs with a catalogue code (`log_client_event`, level error) is counted per code, area (first route segment) and day in an encrypted `durable_cache` file, 30 days, at most 500 rows. Allow-list only: `MD-…` / `error.…` codes, route names; anything else becomes `other`. The events ride in the support file (`errors`). `ReportSink`: `EmailSink` (on, the support file) and `ServerSink` (built, off, refuses). Tests: code/area allow-list, grouping and expiry, sink switch.
- **T7.4 done (built, off):** health summary (`commands/system/health.rs`, `health_summary`, `ops.system`): version, edition, flavor, OS, DB and audit-chain check, DB size, last backup and its age, sync queue and open sync problems, errors per area for 7 days. Shared by the support file and Help → Support ("What the support file says about this computer", with a link to the device network settings when sync problems are open). Remote commands: `medoc-core::application::remote_commands` checks an envelope signed with the vendor Ed25519 key (exact bytes) for practice, device, allow-listed command (`support_bundle`, `health_summary`, `sync_check`, `check_updates`, `schedule_update`), nonce (replays refused), lifetime ≤ 24 h, clock skew 5 min; accepted ones wait in `app_kv` for the admin. `ENABLED = false`: `remote_command_list` returns nothing, `remote_command_decide` refuses (audited when on), the approval list in Help → Support stays hidden. Disk free space added 2026-11-25 (`infrastructure::disk_space`: `statvfs` on Unix, `GetDiskFreeSpaceExW` on Windows; warns under 5 GB in Help → Support). Not done: running an approved command (comes with the server channel). Tests: signature, foreign device, expiry, lifetime, future date, replay, unknown command, queue and off switch.
- **T7.5 done (code and workflow; first signed release not run yet):** `medoc-core::infrastructure::update_manifest`. Each release publishes `latest-<edition>-<flavor>[-early].json`: the Tauri updater manifest plus a `medoc` block (version, kind `feature`/`security`, `minSupported`, `syncProtocol`, `schemaVersion`, edition, flavor, channel, notes in en/de/fr/ar) signed with the vendor Ed25519 key over `medoc-update-v1|…|sha256(notes)`. `scripts/make-update-manifest.mjs` writes and signs it in the release job (`MEDOC_VENDOR_SIGNING_KEY` secret; kind, channel and minimum version from repository variables). The app reads only its own file (`github_updates::manifest_file`, channel from `updates.channel.v1`), refuses unsigned or foreign manifests, offers the update only when it is newer and at least `minSupported`, and checks the vendor signature again before `download_and_install` (Tauri checks the package signature). Settings → About shows the notes in the UI language. Release workflow: 3 OS × 5 edition/flavor builds (`MeDoc-<edition>-<flavor>` assets); macOS produces the updater package when `TAURI_SIGNING_PRIVATE_KEY` is set, Linux and Windows still ship the plain binary (no updater bundle). Vendor tasks before the first release: generate the Tauri updater key pair (`TAURI_SIGNING_PRIVATE_KEY` secret, `TAURI_UPDATER_PUBKEY` variable) and add `MEDOC_VENDOR_SIGNING_KEY` (the seed of `MEDOC_VENDOR_PUBKEY`). Tests: signature, notes and kind are signed, other edition/flavor, unsigned, version mismatch, `minSupported`, and the script's signature verified in Rust.
- **T7.6 done (reduced):** `medoc-core::application::update_rollout` decides when to install: a feature update waits for the admin (Settings → About: *Install* now or *Install after hours*), a security update schedules itself for the next after-hours moment. After hours = outside each opening day's span from `practice.work_hours.v1`, widened by one hour on each side; closed days are free; without stored hours Monday–Saturday 07:00–20:00 count as busy. The schedule lives in `app_kv` (`updates.scheduled.v1`), the main computer checks every 30 minutes (`update_rollout::tick`, first check 10 minutes after start) and installs once due and outside the busy span. Every install (now or scheduled) takes a compressed encrypted backup first; scheduling, cancelling, start, success and a deferred install are audited; Settings → About shows the scheduled install, the last one and that a backup comes first. Commands: `update_rollout_state`, `update_schedule`, `update_schedule_cancel` (`ops.system`). Compatibility pause added 2026-11-25 (`medoc-sync::protocol_compat`): every sync call carries `x-medoc-sync-protocol: <protocol>;min=<oldest>`; a device that cannot talk to the caller answers 426 with its own protocol, the caller pauses ("update needed", `error.sync.update_needed`, shown in Help → Support), keeps its queue and resumes after the first successful call; a call without the header is protocol 1. Not done: a notice outside Settings before and after a security install (it is in the audit log and Settings → About), and replicas installing after the main computer (T7.7). The guest-inbox check from §11.6 step 4 is not needed: a manifest names its own edition, so an update never changes it. Sync needs no pause before a restart: entries stay pending until confirmed and receivers drop duplicates. Tests: busy span and margins, closed days, fallback hours, plans per kind and choice, due time.

**P7: Operations (can run in parallel from P1)**
- T7.1 Vendor support key, sealing format, `tools/medoc-support-open`, key-rotation doc. (M)
- T7.2 Support bundle + Help → Send to support (mail app flow), error-ref pre-fill. (M)
- T7.3 Error event queue and `ReportSink` (`EmailSink` on, `ServerSink` built but off). (M)
- T7.4 Health summary + maintenance view link; remote commands envelope and approval UI (off). (L)
- T7.5 Signed manifests per edition × flavor on GitHub Releases, channels, updater on. (M)
- T7.6 Rollout: approve/schedule, security auto after hours, pre-update backup, compatibility pause. (L)
- T7.7 Main shares packages with replicas; offline `.mdupd` USB package. (M)

**Later (not planned now):** `units` capability for two legal entities; MeDoc company server as live channel for
reports, health and commands.

Order: P0 → P1 → P2 and P3 in parallel → P4 → P5 → P6 (P6 can start after P1).

---

## 9. Open questions

None blocking implementation.

All product questions answered (§0.1); Q11 researched (§5.1, two points still to confirm with a professional body).

Still open:
- Small vendor choices in §11.8 (remote screen tool, support address, support key pair).
- **Legal confirmations** (not blocking, the superset rule covers them): Moroccan ordonnance fields; whether German
  GOZ invoices must name the treating dentist.

## 10. What this plan deliberately does not do

- No separate schema per edition (one schema, upgrades in place).
- No CRDT library; per-table merge strategies on the existing outbox/HLC engine.
- No run-time edition switch inside one binary beyond "lower licence on higher binary".
- No two-legal-entity support yet (`units` postponed, Q3).
- No per-device data withholding in Group (one entity, shared by default); "not shared" is enforced in queries.
- No second specialty implemented; only the seam.
- No changes to `website/`.

---

## 11. Operations: logs, error reports, online maintenance, updates and patches

Decisions (user, 2026-11-24): error reports **built but switched off**; logs reach support **by e-mail for now**,
through the practice's own mail app, **encrypted to the vendor key**; the MeDoc company server is the later channel
and the code is shaped for it. Updates: **admin approves, main first**; **security patches install automatically
after hours**, admin told. Online maintenance: **opt-in health report**, **remote screen on request** (third-party
tool) and **remote commands** (built, off until the server channel exists). Delivery: **signed updates**, the main
computer **shares packages with replicas**, **offline USB package**, **GitHub Releases now, MeDoc server later**.

### 11.1 One shape for everything that leaves the practice

```
Producer (support bundle | error report | health report)
   → Payload builder: allow-listed fields only, no patient data, existing redaction on log text
   → Seal: encrypted to the vendor support key (11.2), signed by this device's key
   → Sink (strategy):  EmailSink  (now: file + mail app)
                       ServerSink (later: HTTPS to the company server; present, disabled)
   → Audit entry: what was sent, when, by whom, size, sink
```

Every producer and sink is a module behind a capability-free runtime switch; `ServerSink` and automatic sending are
off by default and hidden in the UI until the server channel is released. Nothing is sent without an admin action,
except opt-in automatic reports once enabled.

### 11.2 Encryption to the vendor key

- A **vendor support encryption key** (X25519 public key) is baked into the binary at build time, next to the
  existing `MEDOC_VENDOR_PUBKEY` (Ed25519, used for licences and signatures), as `MEDOC_VENDOR_SUPPORT_PUBKEY`.
  Separate from the signing key on purpose: one key per job, so either can be rotated alone.
  (Converting the Ed25519 key to X25519 would work technically but mixes signing and encryption; not recommended.)
- Sealing: ephemeral X25519 key agreement → HKDF → XChaCha20-Poly1305 (the same AEAD the durable cache already
  uses). File header carries the key id, so a rotated key still opens old files. Adds the small `x25519-dalek` crate
  (same family as `ed25519-dalek`); `chacha20poly1305` and `hkdf` are already dependencies.
- The private key stays with the vendor. A small vendor tool `tools/medoc-support-open` decrypts and verifies a
  bundle. Rotation procedure added to `docs/operations/vendor-key-rotation.md`.

### 11.3 Support bundle and e-mail flow (now)

1. Admin opens Help → **Send to support** (also reachable from an error message, which pre-fills the error ref).
2. Picks what to include: description (free text), logs of the last 7 days (redacted, existing export), health
   summary (11.5), screenshots optional. In Duo/Group, the admin computer can include logs of the other devices
   it can reach (maintenance view, `/logs/export`).
3. MeDoc builds `medoc-support-<practice-short>-<date>.mdsb` (sealed, 11.2), saves it to Downloads, and opens the
   practice's mail app with a `mailto:` link: support address, subject `[MeDoc <edition> <version>] <ref>`, body
   with the ticket text and "attach the file saved in Downloads". The user attaches and sends. No mail password is
   stored in MeDoc.
4. Audit: "support bundle created", contents list, size.

### 11.4 Automatic error reports (built, off)

- Each backend error that reaches the UI already logs a ref (`logging.md`). The reporter keeps a small encrypted
  queue (`durable_cache`) of **error events**: code, ref, area, version, edition, flavor, OS, device short id, count,
  first/last seen. Allow-list only: no free text, no names, no ids of patients or staff.
- Grouped and rate-limited (one event per code per day, counts aggregated).
- Today: the queue can be attached to a support bundle. Later: `ServerSink` sends it daily when the practice has
  opted in (Settings → Privacy → "Send anonymous error reports").

### 11.5 Health report (opt-in) and online maintenance

**Health summary** (no patient data): version, edition, flavor, device count and versions, last successful backup
and its age, sync health (queue depth, last success, open sync problems), disk free, DB size, error counts per area
for 7 days, licence status, OS.
- Now: included in the support bundle; also visible to the admin in the maintenance view.
- Later: weekly to the company server when opted in, feeding a vendor support dashboard.

**Remote screen on request.** Nothing built into MeDoc. Help → "Remote support" shows how to start the
third-party tool chosen by the vendor and a session code field for the support log. The practice starts and
ends the session; it is noted in the audit log by the admin ("remote support session with MeDoc, ticket …").
Which tool is listed is a vendor choice (open point, 11.8).

**Remote commands (built, off).** Pulled by the app from the company server (no inbound port, nothing listens).
- Envelope signed with the existing vendor Ed25519 key: practice id, target device, command, nonce, expiry
  (≤ 24 h). Replays and expired or foreign commands are refused.
- Allow-list only: request support bundle, request health summary, run the sync check / reconcile, check for
  updates, schedule an approved update. Never read patient data, never run code, never change access.
- Every command is shown to the admin, who approves or refuses; the result is sent back through the same sealed
  channel; everything is audited.

### 11.6 Update rollout

**Manifest.** One signed manifest per edition × flavor × OS, published as `latest-<edition>-<flavor>.json`:
version, `kind` (`feature` | `security`), `min_supported`, sync protocol version, schema version, notes in fr / ar /
en / de, package URL and Tauri updater signature. Two signatures: the Tauri updater's (minisign) on the package,
and the vendor Ed25519 signature on the manifest (fields already in `infrastructure/update.rs`). Channels:
`stable` and `early`.

**Sources (endpoint list, first that answers wins).** Now: GitHub Releases. Later: MeDoc company server first
(`/updates/manifest` exists), GitHub second. Switching is a config change, not a code change.

**Flow.**
1. The main computer (Solo: the only one; Group: the primary hub) checks daily.
2. **Feature update:** the admin sees the notes and chooses *Install now* or *Schedule after hours* (outside the
   opening hours set in practice planning).
3. **Security update:** installs automatically at the next after-hours window; the admin gets a notice before and
   after.
4. Before installing: encrypted backup (existing backup module), check that no guest changes are pending (Solo, only
   when the edition changes) and that no sync is mid-transfer.
5. Main installs, restarts, runs migrations, reports its new version to the peers.
6. Other devices (Group: hub B next, then replicas) install at their next idle or after-hours moment; the
   package comes from the main computer (11.7) or the internet.
7. **Compatibility.** Handshake carries sync protocol and schema versions. A device one version behind keeps
   syncing if the manifest says compatible; otherwise its sync pauses with "update needed", local work continues and
   queues, and nothing is lost. The maintenance view shows who is behind.
8. **Failure and rollback.** If the new version fails to start, the installer keeps the previous one; migrations
   are forward-only, so rolling back means restoring the pre-update backup (runbook). Patches use the same pipeline
   (full signed package; no binary deltas, which the Tauri updater does not support).

### 11.7 Delivery channels

| Channel | How | When |
|---|---|---|
| Internet | Tauri updater on the signed manifest (GitHub now, MeDoc server later) | default |
| Main shares with replicas | Main keeps the downloaded signed package and serves it on its LAN API (`/updates/package/{version}`, pinned TLS); each device verifies both signatures itself | Duo/Group, saves bandwidth on slow lines |
| Offline USB | Signed `.mdupd` file (package + manifest) installed through the existing `medoc-usb-setup`; in Duo/Group put on the main computer, which then shares it | practices without internet, support visits |
| GitHub Releases | Public release assets, one manifest per edition × flavor | now |

### 11.8 Still open (small)

- Remote screen tool to list in Help (vendor choice; options: RustDesk (open source, can be self-hosted),
  AnyDesk, TeamViewer).
- Support e-mail address and the vendor support key pair to generate (vendor tasks, before release).
