# MeDoc — SWOT, regulatory norms and gap report

**Date:** 2026-11-22 · **Scope:** the code in this repository (v0.1.5), its docs, and the markets in the launch plan. Every gap cites the file where the evidence lives.

> I am not a lawyer. Rows marked **verify** need a Moroccan lawyer (data protection, health law) and, for the EU, a regulatory consultant before you sell.

---

## 1. SWOT

### Strengths
- **Local-first architecture.** Clinical data lives in an encrypted SQLCipher database on the practice's machines (`crates/shared/medoc-core/src/infrastructure/database/sqlcipher.rs`). This is the strongest answer to "where is my patients' data?", and it means no hosting bill for you.
- **Real role separation.** Reception cannot read the medical chart. `patient.read_medical` is physician-only (`config/rbac.yaml`), it is enforced in Rust, not only in the UI, and medical reads write an audit row (`application/authorize.rs`).
- **Audit trail with an HMAC chain** that can be verified and repaired (`MEDOC_AUDIT_KEY`).
- **GDPR-style export and erasure already built:** `gdpr.rs`, the `/privacy` page, processing-register (VVT) and DPIA generators (`vvt.rs`, `dpia.rs`). These map almost one-to-one onto Loi 09-08 rights (access, rectification, opposition).
- **4 languages including RTL Arabic,** plus light/dark themes. Rare among dental software sold in the Maghreb.
- **Works offline;** multi-device sync without a server; LAN mode for multi-chair practices.
- **Broad feature set:** odontogram (FDI numbering), appointments, prescriptions, certificates, finance/cash desk/daily close, purchase orders, inventory, staff time, statistics.
- **Unusual engineering discipline for a startup:** V-model docs, ISO mapping, SOUP list, post-market surveillance and CAPA folders.

### Weaknesses
- **Built for Germany, not Morocco.** GOZ/BEMA catalogs, AMVV prescriptions, € default currency, German-law text inside generated PDFs. There are no Moroccan insurance forms and no NGAP coding.
- **Key safety and security features are off in code** (`crates/shared/medoc-core/src/mvp_security.rs`): 2FA, break-glass emergency access, DICOM/scanner/GDT imaging, e-prescription.
- **Hard cap of 1 physician + 4 reception accounts** (same file). You cannot sell to clinics with several dentists.
- **Only 2 roles.** No assistant/hygienist, practice manager, accountant or IT-admin role.
- **Sync conflicts are resolved by last-write-wins** (`crates/shared/medoc-sync/src/merge.rs`). Two offline edits to the same chart row means one is silently lost.
- **Installers are not code-signed or notarized.** macOS Gatekeeper and Windows SmartScreen will warn a non-technical dentist, which kills trust at install.
- **Sales assets are unusable today.** Every app screenshot in `website/img` and `website/public/product` is a blank page with only the sidebar, and several are mislabeled duplicates (e.g. `odontogram.jpg` is the reception overview).
- **One-person company risk:** support, updates, security patches and sales all depend on the founder.

### Opportunities
- **Loi 09-08 and CNDP awareness is rising,** and cloud tools that send health data abroad face transfer formalities. "Your data stays in your practice" is easy to explain.
- **DGI e-invoicing (2026+).** Practices will need compliant invoices. Adding it to MeDoc gives a reason to buy *now* and a reason to keep the service plan.
- **AMO generalisation** means more insured patients, more feuilles de soins and more paperwork at reception. Automating it is a strong selling point.
- **1,500+ new dentists graduate each year** and open practices. Catch them at installation.
- **Arabic-first markets** (Gulf, Egypt) are underserved by Western dental software.
- **Add-on revenue:** WhatsApp/SMS reminders, data migration, imaging integration, extra workstations, training.

### Threats
- **Liability when something goes wrong.** Lost records, a wrong prescription, a data leak or a sync conflict could all lead to legal action or damaged reputation. Medical secrecy is protected by criminal law in Morocco (Penal Code art. 446).
- **Established French vendors** with mature imaging and odontograms. Local Moroccan entrants priced in MAD.
- **Regulation can reclassify you.** In the EU, MDR Rule 11 can make record software with clinical decision features a medical device. The repo contradicts itself on this (see G-01).
- **Hardware and IT reality in practices:** old Windows PCs, no backups, shared passwords, ransomware.
- **Price pressure and piracy** of desktop software. The license crypto helps (Ed25519, device-bound).
- **Currency and payment risk** when selling abroad.

---

## 2. Norms and rules: what applies, and where MeDoc stands

Legend: ✅ in place · ⚠️ partial · ❌ missing · 📝 your (company) obligation, not code

### 2.1 Morocco

| Norm / rule | What it requires (short) | Status | Evidence / gap |
|---|---|:-:|---|
| **Loi 09-08** (personal data) and the **CNDP** | Health data is *sensitive*. Processing it needs prior CNDP authorisation (the **practice** files this). Security measures are required (art. 23). Processors must work under a contract (art. 24). Patients have rights of information, access, rectification and opposition. Transfers abroad are restricted (art. 43–44). | ⚠️ | Encryption, RBAC, audit, export and erase exist. **Missing:** a Moroccan template for the CNDP file (current VVT/DPIA are GDPR/German), a patient information notice in FR/AR, a consent record, and **your** DPA (sous-traitance) template. **Verify** the exact formalities with the CNDP. |
| **Medical secrecy:** Penal Code art. 446; dental code of ethics | Only authorised people may see clinical data. | ✅/⚠️ | Role separation is real. **Gap:** no emergency access (break-glass is off), and medical reads are audited but there is no report a practice can easily review. |
| **Informed consent** for treatment (Loi 131-13 and the ethics code; dental practice under the ONMD) | Treatment plans and quotes (devis) with patient acknowledgement. | ❌ | No consent or quote-signature module. `domain/access.rs` only stores "consent flags". Add treatment-plan/devis + signed consent PDF in FR/AR. |
| **Medical record retention** | No single dental-specific period in law. Practice is ~10+ years. Accounting records: 10 years (Code de commerce). | ⚠️ | PDFs and comments cite **§ 630f BGB (German law)** even in the French/Arabic output (`application/chart/pdf_export.rs:108`). Make the legal text configurable per country. **Verify** the retention period. |
| **AMO / CNSS / CNOPS / private mutuals; NGAP dental nomenclature (key "D") and TNR fees** | Feuille de soins dentaires; prior approval (entente préalable) for prosthetics and orthodontics; NGAP act codes. | ❌ | Not present. GOZ/BEMA (German) only. **This is the #1 product gap for Morocco.** |
| **Invoices: ICE, IF, RC, Patente; TVA rules; DGI e-invoicing (2026+)** | Mandatory identifiers on invoices. Medical acts are generally VAT-exempt (**verify**). UBL e-invoices through the DGI platform once the decree applies. | ❌/⚠️ | The practice profile has a `vat_id` field only (`application/documents/practice_profile.rs:57`). Add ICE/IF/RC/INPE fields and plan UBL export. |
| **Loi 43-20** (electronic signature / trust services) | Needed if prescriptions or certificates are signed digitally. | ❌ | Not used. Paper signature is fine for now. Don't claim "signed electronically". |
| **Loi 05-20** (cybersecurity), DGSSI guidance | Mainly state and critical infrastructure. DGSSI guidance is good practice. | 📝 | Use as a hardening checklist. |
| **Consumer/commercial law** (Loi 31-08 consumer protection) and contracts | Clear sale terms, warranties, after-sales. | 📝 | You need CGV, EULA, SLA and the DPA (see the business plan §5). |
| **Moroccan payment norms** (CMI), bounced cheques | — | 📝 | Commercial. Matters for cash flow. |

### 2.2 Industry standards (health software best practice, required in the EU)

| Standard | Status | Evidence / gap |
|---|:-:|---|
| **IEC 62304** software lifecycle | ⚠️ | Plan and V-model exist. **System tests "outstanding"** (`docs/iso-standards/08-anforderungen-iso-mapping.md`). Formal release records per version are missing. |
| **ISO 14971** risk management | ⚠️ | Risk analysis started (`02-iso-14971.md`). Not updated for the risks now known: sync conflicts, disabled 2FA, LAN self-signed TLS. No risk-management report. |
| **IEC 82304-1** health software product safety | ⚠️ | Intended use is not written as a formal statement with explicit limits. Validation before release is "outstanding". The update mechanism is not documented for customers. |
| **ISO 27001 / 27799** information security | ⚠️ | Many technical controls exist. **Missing:** 2FA, account lockout policy review, a vulnerability-disclosure policy, an incident-response plan, tested restores, and dev activation fixtures committed to git (G-03). |
| **ISO 22600** access control | ⚠️ | RBAC is good but coarse (2 roles). No break-glass. |
| **ISO 9241 / WCAG 2.2 AA** usability and accessibility | ⚠️ | Nielsen score 74 % against an 80 % target. Formal user tests "outstanding". |
| **HL7 FHIR / DICOM** interoperability | ❌ | DICOM is behind a disabled flag. No FHIR export. Not required in Morocco today, but expected in the Gulf (NPHIES) and the EU. |
| **Code signing:** Apple notarization, Windows Authenticode | ❌ | Not configured (`apps/practice-host/tauri.conf.json`; README §8). |
| **SBOM / dependency audit** | ✅ | `scripts/generate-sbom.sh`, `cargo-audit`, SOUP list. |

### 2.3 EU (later phase)

| Rule | Status | Gap |
|---|:-:|---|
| **GDPR** (art. 9, 30, 32, 35) | ⚠️ | Mechanisms exist. Morocco has **no EU adequacy decision**, so your Moroccan support team accessing EU patient data needs SCCs + a transfer impact assessment. |
| **MDR 2017/745** classification | ❌ **contradiction** | `README.md` says "not an MDR medical device". `docs/post-market/2026-Q2-pms.md` says "MDR Class I". Pick one, document the reasoning (MDCG 2019-11 / Rule 11) and align every document **before** you sell in the EU. |
| **Country billing certification** (DE: KZBV/BEMA; FR: SESAM-Vitale) | ❌ | Long certification projects. Plan for them. |
| **NIS2 / EU Cyber Resilience Act** (products with digital elements, vulnerability handling) | ❌ | CRA obligations start phasing in from 2026–2027. You need a vulnerability-handling process and a security-update commitment period. |

---

## 3. Gap list, prioritised

**P0 = fix before the first paying customer. P1 = within the first 6 months. P2 = before international expansion.**

| ID | Pri | Gap | Why it matters when "something goes wrong" | Fix |
|---|:-:|---|---|---|
| G-01 | P0 | MDR status contradicts itself across docs | A regulator or a lawyer will use the inconsistency against you | Write one intended-use statement. Align README, handbook and PMS. |
| G-02 | P0 | **2FA off** (`TOTP_2FA_ENABLED = false`) | Shared or stolen passwords give access to the medical record | Finish TOTP and turn it on for physicians by default |
| G-03 | P1 | **`.dev-activation/pw.txt`, `activation.json` and `license.code` were committed to git.** Untracked on `main` since commit 0605c37 (2026-11), but they remain in the history of a **public** repository. | The dev passphrase and license material are readable by anyone who clones the repo. | Treat them as burned: change any password that matches, never reuse that license material, and rewrite history (e.g. `git filter-repo`) if real material was ever in them. |
| G-04 | P0 | Moroccan billing: **invoices done** (2026-11-22: MAD practices get a CGI art. 145 invoice in FR/AR with ICE, IF, TP, RC, CNSS, INPE, total in words and the art. 91 VAT exemption; ICE and IF are mandatory). **Still missing:** NGAP act catalogue, AMO/CNSS/CNOPS/mutual feuille de soins, DGI e-invoicing (UBL) | Dentists cannot do insurance paperwork in MeDoc yet | NGAP catalogue + feuille de soins print, then UBL export when the DGI decree applies |
| G-05 | ✅ done | German law printed on French/Arabic documents | — | Done 2026-11-22: the practice country (Morocco, France, Germany, EU) sets legal lines, ids, date format and number prefixes on every document. |
| G-06 | P0 | Installers not signed or notarized | Security warnings at install. Practices get told to "bypass security". | Apple Developer ID + notarization; Authenticode (OV/EV) certificate |
| G-07 | ✅ done | Website screenshots were blank or mislabeled | — | Done 2026-11-22: 26 real captures and 11 real sample PDFs on the live site. |
| G-08 | P0 | No EULA / CGV / SLA / DPA, no professional liability insurance | Unlimited liability if data is lost | Lawyer-drafted contracts with a liability cap; insurance policy |
| G-09 | P1 | Last-write-wins sync on clinical rows | Silent loss of clinical notes when two devices edit the same row offline | Field-level merge or a "conflict to review" queue for clinical tables. Never drop a clinical note silently. |
| G-10 | P1 | Physician cap of 1 and only 2 roles | You can't sell to clinics; staff share accounts (bad for the audit trail) | License-based seat limits; add Assistant and Practice-manager roles |
| G-11 | P1 | Break-glass emergency access off | In an emergency the only physician account may be unavailable | Enable break-glass with mandatory reason + audit + owner alert |
| G-12 | P1 | No consent / treatment-plan (devis) signature | Disputes over what the patient agreed to and the price | Devis + consent PDF (FR/AR), signature on tablet, stored in the chart |
| G-13 | P1 | Restore not tested end-to-end; no off-site backup guidance | Ransomware or a dead disk means total loss | Scheduled encrypted backup to an external disk/NAS, monthly automatic restore test, alert when the last backup is more than 48 h old |
| G-14 | P1 | No Moroccan CNDP pack | Practices can't complete their CNDP formalities | FR/AR patient information notice, register template, DPA template, guide |
| G-15 | P1 | Imaging (RVG/DICOM) off | Moroccan dentists use digital X-ray sensors daily; a key buying criterion | Turn on DICOM import/view for the common sensors (bridge to the vendor software) |
| G-16 | P1 | Patient reminders: SMS delivery is off (`notifications_patient_sms_delivery: false`) and there is no WhatsApp | No-shows are expensive; WhatsApp is the norm in Morocco | WhatsApp Business API / SMS provider as a paid add-on |
| G-17 | P1 | No incident-response or vulnerability-disclosure process for customers | You must tell practices quickly after a breach (they must notify the CNDP / GDPR authority) | 1-page incident playbook, `security@` address, patch SLA |
| G-18 | P2 | System validation and user tests "outstanding" (IEC 62304 / 82304 / 9241) | Required for the EU; a strong argument everywhere | Run the system test campaign; record results per release |
| G-19 | P2 | No FHIR/HL7 export; DGI UBL e-invoice | Interoperability; e-invoicing obligations | UBL export first (Morocco), FHIR later (Gulf/EU) |
| G-20 | P2 | LAN uses self-signed TLS | Acceptable on a private LAN, but must be documented | Document fingerprint pinning; optional practice CA |
| G-21 | P2 | User handbook mostly in German; docs tension on updates | Practices need FR/AR documentation | FR/AR handbook + quick-start videos |
| G-22 | P1 | **Patient attachments are stored unencrypted** (`chart_attachment` files sit as plain files under the app data folder; only the database is SQLCipher) | Radiographs, consents and lab results are health data. A stolen laptop or copied folder exposes them even though the database is encrypted. | Encrypt attachment files at rest with a key from the same key store, or keep them inside the encrypted database. |
| G-23 | ✅ done | `/patients/:id/prescription/new` crashed with "Maximum update depth exceeded" | — | Fixed 2026-11-22: the medication catalog snapshot is cached, so the store no longer re-renders in a loop; covered by a unit test. |
| G-24 | P2 | Demo seed data mixes English and German text into French/Arabic screens (complaint chips like "Chewing pain", preset names, notes) | Sales demos look unfinished in French or Arabic. | Translate the demo seed, or seed per practice language. |

---

## 4. "When something goes wrong" playbook (minimum before launch)

1. **Data loss:** daily encrypted backup to a second disk, weekly off-site copy, restore drill at installation. Include it in the install checklist the dentist signs.
2. **Wrong data or software bug that affects care:** issue a hotfix through the signed updater, warn the affected practices the same day, open a CAPA (`docs/post-market/capa-tracking.md`), and record it in a customer-visible changelog.
3. **Breach or suspected unauthorised access:** run the audit-log export (`/audit`), lock the accounts, help the practice notify the CNDP (GDPR: 72 h), and write a post-mortem.
4. **Contract and insurance:** liability capped at 12 months of fees (lawyer to confirm it is enforceable in Morocco), professional liability insurance, and a written statement that MeDoc is not a diagnostic tool.

Sources used for market and regulation facts are listed in `01-business-plan-morocco-first.md`.
