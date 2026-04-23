# Changelog

All notable changes to MeDoc are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — Unreleased

### Added
- **Patient management** — full CRUD with soft-delete, bulk import (CSV) and
  DSGVO export/erase (Art. 15/17/20).
- **Appointments (Termine)** — calendar view, conflict detection, reminders.
- **Electronic patient record (Akte)** — chronological entries, diagnosis
  ICD-10 codes, attachments.
- **Treatments (Leistungen)** — BEMA/GOZ catalogue, billing per session.
- **Payments (Zahlungen)** — invoicing, partial payments, refund/cancel,
  PDF invoice generation (`render_invoice_pdf`).
- **Prescriptions (Rezepte)** & **Certificates (Atteste)** — per-patient
  list/create/print, browser print pipeline.
- **Personal & RBAC** — roles ARZT / REZEPTION / STEUERBERATER /
  PHARMABERATER, BREAK-GLASS escalation with audit trail.
- **Statistics** — KPIs and trends (turnover, patients, appointments).
- **Bilanz** — monthly turnover dashboard with 12-month sparkline.
- **Audit log** — append-only HMAC hash chain, tamper-evident export.
- **System logs** — structured JSON logs with rotation.
- **Operations page** — encrypted backup/restore, CSV import, system health.
- **Compliance page** — PMS evidence overview, MDR/IVDR risk register.
- **Datenschutz page** — DSGVO Art. 15/17/20 self-service workflow.
- **Settings (Einstellungen)** — profile, password change, license token,
  update channel.
- **Subscription portal** — vendor-hosted billing (no card data on device).
- **Integrations** — KIM messaging, e-prescription validation/submit.
- **i18n** — German + English UI strings.

### Security
- All passwords hashed with Argon2id, min 8 chars, breach lockout.
- SQLite (`medoc.db`) at rest **without SQLCipher PRAGMA key yet** — NFA-SEC-08 (full-DB encryption) is backlog; rely on OS full-disk encryption until shipped.
- Audit log signed with per-installation HMAC key.
- No payment card data ever stored locally (PCI-DSS scope reduction).

### Compliance
- MDR Class I self-declaration draft prepared.
- DSGVO records of processing (RoPA) drafted under `docs/dsgvo/`.
- CAPA workflow scaffolded under `docs/post-market/capa-tracking.md`.
- SBOM generation script (`scripts/generate-sbom.sh`).

### Known limitations
- Subscription / billing endpoints are stubs pending vendor backend.
- Updater channel selector currently surfaces metadata only.
- E-prescription submit goes through a sandbox endpoint until KBV signs off.
