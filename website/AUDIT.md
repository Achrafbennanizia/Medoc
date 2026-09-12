# MeDoc product website — Step 1 inventory

**Audit date:** 2026-09-12  
**Sources:** this monorepo (not a marketing brief). Stale docs are called out.

Filled placeholders used for the site:

| Placeholder | Value used | Evidence |
|---|---|---|
| Product | **MeDoc** — local dental practice management (PVS) for patient records, appointments, clinical documentation, prescriptions/certificates, billing, staff, inventory, and compliance audit trails | `README.md` L1–10 |
| Audience | Licensed dental staff: physician and reception (active RBAC roles). Practice owners/admins for license, backup, GDPR ops | `config/rbac.yaml`; `README.md` intended use |
| Field / legacy process | German/EU dental practice administration replacing paper charts, spreadsheets, and disconnected PVS tools; WAAD intake + Pflichtenheft | `docs/requirements-engineering/01-sammeln.md`, `01a-waad-anforderungen.md` |
| CTA | Request a practice walkthrough (no public self-serve signup exists in the app) | Onboarding is license/pairing/login, not a web signup |
| Design | Product CSS tokens in `apps/practice-host-ui/src/index.css`; `@medoc/ui` primitives; Figma binary **not** in repo (`docs/ui/figma-exports/README.md`) | |

---

## 1. Feature list (from routes + sidebar)

Sidebar SoT: `packages/shared/src/lib/nav-sections.ts`. Routes: `apps/practice-host-ui/src/App.tsx`.

| Feature | Screen / route | What it does mechanically |
|---|---|---|
| Dashboard | `/` | Loads practice KPIs, upcoming appointments, chart-validation / next-appointment hints, purchase-order snippets (`dashboard.tsx`) |
| Appointments | `/appointments`, `/appointments/new` | Calendar scheduling; drag-snap / overlap helpers in shared `appointment-*` libs |
| Patients | `/patients`, `/patients/new`, `/patients/:id` | Master data list/create/detail; chart tabs (anamnesis, odontogram, treatments, documents, finance) |
| Chart validation | `/charts/to-validate` | Physician queue to validate chart sections (`patient.read_medical`) |
| Practice tickets / tasks | `/tickets` (+ `/inbox` redirects to tickets) | Reception ↔ physician task inbox (`practice_task`); status machine; optional inbox flag |
| Prescriptions | `/prescriptions`, nested create/edit on patient | AMVV-oriented prescription records + PDF/print path |
| Certificates | `/certificates`, sick-leave form under administration | Certificate templates/forms |
| Statistics | `/statistics` | Practice statistics (`statistics.read` = physician only) |
| Finance | `/finance`, `/finance/cash`, `/finance/new` | Open bookings, payments; cash desk (`finance.reception.view` for reception cash) |
| Purchase orders | `/purchase-orders` | Order list/create/detail |
| Balance sheet | `/balance-sheet` | Physician-only financial statement UI |
| Services catalog | `/services` | Billable services (capability-flagged in nav) |
| Products / inventory | `/products`, administration inventory | Product catalog + inventory/ordering |
| Staff | `/staff`, work-plan, work-time | Staff records; self clock-in vs team work-time |
| Administration | `/administration/*` | Team, work days, planning, blocked times, templates, catalogs, day-close, contracts, order master |
| Settings | `/settings` | Locale, appearance (light/dark/system), license, company portal, deployment/sync |
| Audit | `/audit` | User-action audit log list |
| Privacy | `/privacy` | GDPR export/erase self-service (needs `patient.read` **and** `ops.dsgvo`) |
| Compliance | `/compliance` | VVT / DPIA generation surfaces |
| Ops | `/ops` | Backup/restore, system ops |
| Logs | `/logs` | Operational logging UI |
| Migration | `/migration` | Data migration wizard |
| Help / feedback | `/help`, `/feedback` | In-app help and feedback |
| Onboarding / login | `/onboarding/*`, `/login` | License v2 or replica pairing, then account/login |
| LAN web client | `apps/lan-web-client` :1421 | Browser UI against LAN HTTPS (no local SQLite) |

Capability flags can hide inbox, services menu, prescriptions menu (`inbox-config`, `catalog-menu-flags`).

---

## 2. Backend inventory

Three independently runnable systems (`README.md`, `docs/architecture/deployment-topologies.md`).

| Option | Stack | Customer profile | Gain | Give up |
|---|---|---|---|---|
| **Practice desktop** (`practice_desktop`) | Tauri 2 + React 19 + Rust; SQLCipher `medoc.db` on device | Single workstation / owner PC | Data stays on the machine; Tauri IPC; works without a server process | Other chairs need another topology |
| **LAN host + thin clients** (`lan_client`) | `medoc-lan-server` HTTPS (self-signed TLS, default :8787); clients use `HttpPracticeAdapter` | Multi-device practice with a dedicated host | One DB on the host; clients hold no patient SQLite | Host must be up; TLS is practice-LAN self-signed, not a public CA |
| **Serverless peer** (`serverless_peer`) | Local DB + `medoc-sync` outbox; MASTER/REPLICA; `mt2.` activation tokens | Multi-device without a 24/7 dedicated server role | Replica works from local DB when online-sync later | Last-write-wins conflicts; pairing required; sync limited to `SYNCED_TABLES` |
| **Company server** | `medoc-company-server` + `company.db` HTTP :9797 `/v1/*` | Vendor/admin portal (subscription metrics, flags) | Separate from clinical DB | **Demo/stub routes** (`"_demo": true`); not a patient-data cloud |

There is **no** managed EU patient-cloud product in this repo. Optional “DSGVO-konforme Cloud” is NICE-TO-HAVE (`NFA-SEC-06`), not a shipping backend.

---

## 3. Security and roles

**Auth:** session after login; passwords Argon2 (legacy bcrypt rehashed on login — `crypto_tests.rs`). Desktop gated by `LicenseAndPairingGate` (license.v2 or replica pairing). LAN: JWT plus activation-token scope on sync/pairing paths only.

**Active roles** (`config/rbac.yaml`): `PHYSICIAN`, `RECEPTION`. `TAX_ADVISOR` and `PHARMA_CONSULTANT` are **commented deferred** — `docs/rbac-matrix.md` still lists them; **do not market them as live**.

Physician-only examples: medical chart read/write, finance.read, staff, templates, audit, ops.*, statistics, administration.read, day-close.

Reception: patient non-medical read/write, appointments, cash desk view, inventory read, work_time.self, dashboard. **Cannot** read medical chart (`patient.read_medical`), GDPR ops, audit, staff HR, statistics.

Frontend mirrors `allowed()` via `packages/shared/src/lib/rbac.ts` + `RoleRoute`; Rust IPC `require()` is the enforcement.

---

## 4. Compliance (mechanisms, not slogans)

| Topic | Mechanism in code/docs | Do not claim |
|---|---|---|
| Data residency | Clinical data in on-device / practice-LAN `medoc.db`; company portal is a separate vendor DB | “Hosted in EU region X” |
| Encryption at rest | SQLCipher (`bundled-sqlcipher`); key from OS keychain / wrap / `MEDOC_DB_KEY` | Named certification (SOC2, ISO 27001 **certificate**) |
| Encryption in transit | LAN HTTPS self-signed `lan-tls.{crt,key}`; fingerprint for pinning | Public CA / mTLS to the internet |
| Audit | `audit_log` HMAC-SHA256 chain (`MEDOC_AUDIT_KEY`); verify/repair IPC | Tamper-proof against a holder of the HMAC key |
| GDPR export Art. 20 | `export_patient` → JSON (`crates/shared/medoc-core/src/infrastructure/gdpr.rs`); UI `/privacy` | Automatic delivery to a third-party portal |
| GDPR erase Art. 17 | `erase_patient`: deletes related rows, keeps anonymised stub, redacts backups/logs; logs `DSGVO_ERASURE` | Instant full physical wipe of all backups if some copies are offline |
| Retention | Comments cite § 630f BGB; erase keeps audit stub | Automatic 10-year job (not observed as a scheduler) |
| RoPA Art. 30 | Template `docs/datenschutz/verarbeitungsverzeichnis.md`; runtime VVT text `vvt.rs` / `/compliance` | That the generated VVT is a complete legal filing |
| DPIA | `dpia.rs` + compliance page | Completed DPIA for a named practice |
| Consent UI | **Not** found as a first-class patient-consent capture module in this audit | Cookie/consent banners as product feature |
| MDR | README: **not** an MDR medical device (`docs/benutzerhandbuch.md`) | CE-MDR device claims |

---

## 5. Problem framing (from requirements, not invented metrics)

WAAD / Pflichtenheft describe German dental practices that must keep treatment documentation (§ 630f BGB), coordinate physician vs reception without exposing medical data to the wrong role, bill GOZ-style services, and keep data under the practice’s control (DSGVO Art. 9 health data). Legacy pattern in the docs: disconnected tools, paper/PDF charts, and cloud PVS that move health data off-site.

**No product telemetry in-repo gives “hours saved” or “error rate %”.** Site copy uses mechanism-level before/after only.

---

## Open questions (do not fill in)

1. Public contact email / demo booking URL for the CTA?
2. Commercial model to advertise (Pflichtenheft mentions subscription; runtime is device-bound **license.v2** perpetual-style crypto — tension)?
3. Should TAX_ADVISOR / PHARMA_CONSULTANT appear as “coming later”?
4. Real Figma file URL? `docs/ui/figma-exports/` is a placeholder folder.
5. Any approved customer names or case studies? (none in repo)
6. Inbox vs tickets: market as one workflow (`/inbox` → `/tickets`)?
7. Company portal: hide from marketing until non-demo?
