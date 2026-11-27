# Site architecture: company, series, product, app

**Date:** 2026-11-26 · **Applies to:** `sifralabs/` (company site) and `website/` (MeDoc Dentist site).
**Market:** Morocco only. **Languages:** English, French, Arabic (no German). France, Germany and the EU appear on one "Europe: coming soon" page and nowhere else.
Statistics from other countries may be cited to support an advantage, always with their source.

Every sentence on either site belongs to exactly one of four levels. Before writing copy, decide its level.
If it belongs to another level, link there instead of repeating it.

| Level | What it is | Lives on | Marketing |
|---|---|---|---|
| **1. Sifra Labs** | An IT company: builds software, apps, AI and data systems for clients, and stays to support them | `sifralabs.com` | Soft (≈70 % soft, 30 % hard) |
| **2. MeDoc series** | A family of practice programs Sifra Labs makes and sells, to help doctors go digital and accompany them | `sifralabs.com/medoc/` | Soft, a little harder |
| **3. MeDoc Dentist** | The dental product of the series, for sale now, in three editions: Essentiel, Cabinet, Cabinet+ | MeDoc Dentist site | Hard (≈40 % soft, 60 % hard) |
| **4. The app** | What the program does on the practice's computers: its features, rules and system security | MeDoc Dentist site, Features and Security pages | Benefit first, then the feature |

## The same word at four levels

| Topic | 1. Sifra Labs (company) | 2. MeDoc series | 3. MeDoc Dentist (product) | 4. The app (system) |
|---|---|---|---|---|
| **Goal** | Build technology that helps businesses work smarter; be a long-term technical partner | Help doctors digitise their practice and accompany them through it (Morocco 2030) | Give a dental practice one program for patients, chart, calendar, documents and money | Make each task faster and safer: fewer clicks, fewer errors, nothing lost |
| **Services / features** | Services sold to clients: AI & automation, custom software & web, data engineering, IoT & embedded, quality/security/optimization, UI/UX & consulting, digitalisation, support | Shared by every MeDoc product: Digitalization Pack (accompaniment, company home), one secure core, local data, four languages | Editions and what each includes: devices, accounts, doctors, service months | Features: validation policy, daily close, drag-and-drop calendar, flags, statistics, tasks, orders and spending, shortcuts, backups, tooth chart |
| **Principles** | Collaboration principles and six values (Integrity, Purpose, Excellence, Transparency, Partnership, Evolution) | Series principles: data stays in the practice, built per specialty, sold only when ready | Product promises: one licence yours for good, service plan you choose, Moroccan documents | Rules built into the app: reception drafts and the doctor validates, every medical read is logged, backups are automatic |
| **Security** | Company precautions: NDA, confidentiality, least access to client data, vulnerability disclosure, security.txt. **And** security as a service sold to clients (security reviews, testing) | Secure core shared by all MeDoc products: encryption at rest, roles enforced in the core, audit chain, sync | Where MeDoc Dentist data lives, who can see it, Law 09-08 / CNDP readiness | System details: SQLCipher AES-256, reception never sees the medical chart, HMAC audit chain, encrypted daily backups |
| **Proof** | Case studies of projects built | The first product and its pilot practices | Pilot practices, screenshots, Moroccan documents | Real screens, release notes |
| **Call to action** | "Book a free call", "See our work" | "Discover MeDoc Dentist" | "Book a free demo", "See prices", "Compare editions" | "See it in a demo" |

## Company site (`sifralabs/`)

Soft on the home page, a little harder on Services. No prices for services yet (the company is not registered):
packages say "Fixed quote after a free call".

| Page | Purpose | Key sections |
|---|---|---|
| `/` Home | **Digitalization Pack** (main page): from paper to screen | Hero · why the pack exists · four steps · before/after · commitment · MeDoc link · final call to action. Old `/digitalization/` redirects here. Company services live under `/services/` |
| `/services/` | What we sell to clients | Six pillars with who each is for · digitalisation service · support & maintenance · packages · guarantees · FAQ link |
| `/work/` + one page per project | Credibility | Only work in this repository, labelled honestly as our own: MeDoc Dentist (practice software), the MeDoc Dentist website, sifralabs.com and its contact service. Client type, problem, solution, stack, result, screenshots |
| `/process/` | Remove fear of the unknown | Discovery → Proposal → Design → Development → Testing → Launch → Support; what happens before, during and after |
| `/medoc/` | The MeDoc series (level 2) | Short hub: series principles, MeDoc Dentist (first, for sale) with deep links into the product site, more products in development (not named), Europe coming soon. Pack detail is the company home; Morocco figures and product security live on the MeDoc Dentist site |
| `/about/` | Who we are | Story and the name, goals, six values, collaboration principles, before/during/after, partners and professionals, the future |
| `/insights/` + articles | Expertise, SEO | Articles; company news |
| `/security/` | Company security precautions (level 1) | How we handle client data, NDA, access, disclosure policy, links to the security service and to the MeDoc series core |
| `/faq/` | Objections | Timelines, code ownership, payment, support, NDA, data protection |
| `/contact/` | Start a project | Free 30-minute call, form, what happens next ("we reply within 24 hours on working days") |
| `/legal/notice/`, `/legal/privacy/` | Legal | Achraf Bennani Ziatni, auto-entrepreneur under Law No. 114-13, trade name Sifra Labs; privacy with the operator as controller. Do not invent IF/ICE/RC numbers |

Testimonials: none until real ones exist. Numbers: only true ones. Urgency: never invented.

## MeDoc Dentist site (`website/`)

Hard marketing, Morocco only, MAD only, Moroccan legal texts in English, French and Arabic.

| Route | Purpose |
|---|---|
| Home | Sell: hero, product ways, everything-in-one, editions preview, privacy, Morocco figures strip, series band, pilot, final call to action |
| `#/features` | The app (level 4): each feature as a benefit, real screens, Moroccan documents |
| `#/editions` | Compare Essentiel, Cabinet, Cabinet+ (limits from `config/editions.yaml`) |
| `#/editions/essentiel`, `#/editions/cabinet`, `#/editions/cabinet-plus` | One article per edition: who it is for, what it changes, what is included, price, call to action |
| `#/pricing` | Licences and service plans in MAD |
| `#/morocco` | Digital Morocco 2030, Bill 52-26, Law 09-08 / CNDP and how MeDoc Dentist gets a practice ready |
| `#/europe` | Coming soon |
| `#/security` | Security of the MeDoc Dentist system (level 4) |
| `#/faq`, `#/demo`, `#/legal/<doc>` | Objections, demo request, Moroccan legal texts |

## Editions (source of truth: `config/editions.yaml`)

| | Essentiel | Cabinet | Cabinet+ |
|---|---|---|---|
| Computers | 1 | up to 3 | up to 5 |
| Admins | 1 | 1 | 2 |
| Accounts | 2 (admin + guest) | 3 | up to 20 |
| Doctors | 1 | 1 | up to 4 |
| Capabilities | guest inbox | network, staff, tasks, work time, validation, tablet/browser client, maintenance, day close | everything in Cabinet + several doctors, two admins, Allowances |

Marketing names are Essentiel, Cabinet, Cabinet+. Never "Clinique".
