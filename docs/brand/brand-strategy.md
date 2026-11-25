# Sifra Labs: brand strategy

**Date:** 2026-11-25 · **Status:** proposal for the founder · **Site:** `website/company/` (served at `/company/` next to the MeDoc site)

Sifra Labs is the company. MeDoc is its first product line. This document says why, what the brand stands on, how it looks, and what is still missing before it can be sold under.

---

## 1. What the docs and code say we focused on

Read from `README.md`, `docs/launch/*`, `docs/iso-standards/*`, `docs/architecture/*`, `config/editions.yaml` and the other working sessions.

| Focus | Evidence |
|---|---|
| **Confidentiality** | SQLCipher-encrypted database on the practice's own machines; medical reads are physician-only, enforced in Rust; HMAC-chained audit log |
| **Local-first, works offline** | Desktop, LAN and serverless-peer modes; no hosting bill, no data leaving the practice |
| **Engineering discipline** | V-model docs, IEC 62304 / ISO 14971 / IEC 82304 / ISO 27001 mapping, SOUP list, SBOM, post-market and CAPA folders |
| **Usability** | Four languages incl. RTL Arabic, light/dark, page-layout standard, Nielsen review, editions that hide what a practice does not need |
| **Honesty in sales** | Website lists unshipped features as "in preparation"; MAD/€ pricing with HT stated |
| **Morocco first, then Arab world, then Europe** | `docs/launch/01-business-plan-morocco-first.md` |

That is a brand already: **careful engineering for confidential data, built to last**. It just has no name, no face and no company behind it yet.

## 2. What is missing to build a brand

Ordered by how much each one blocks selling.

| # | Gap | Why it matters | Fix |
|---|---|---|---|
| 1 | **No company name or legal entity.** `website/src/legal/entity.ts` is all `[…]` placeholders. | A legal notice with placeholders is invalid; nobody signs a contract with a placeholder. | Register Sifra Labs (SARL AU, Morocco), fill `entity.ts`. |
| 2 | **No trademark** for company or product. | Without it you cannot stop a copy, and a prior owner can stop you. | OMPIC filing, then WIPO Madrid (§3.4). |
| 3 | **The product name "MeDoc" carries two risks.** *M.E.Doc* is the Ukrainian accounting software whose update server spread the NotPetya malware in 2017, the most expensive cyber-attack on record. *Médoc* is a protected Bordeaux wine appellation in the EU. | A security-first brand should not share a name with a famous supply-chain attack, and EU marks that evoke a protected appellation can be opposed. | Keep MeDoc for the Morocco launch, run a clearance search before EU entry, and let the masterbrand carry trust so a later product rename is cheap. |
| 4 | **No real contact channel.** Site uses `demo@example.com`, WhatsApp empty. | Every call to action is dead. | Buy the domain, set up `hello@` and `contact@`, fill `website/src/config.ts`. |
| 5 | **Unsigned installers.** | Gatekeeper and SmartScreen warnings are the first brand impression at install, and they say "untrusted". | Apple Developer ID + notarization, Windows Authenticode certificate in the company's name. |
| 6 | **No trust centre.** No `security.txt`, vulnerability-disclosure policy, incident-response page or status page. | For a security brand these *are* the marketing. EU CRA will require vulnerability handling anyway. | `/.well-known/security.txt`, a disclosure page, a security whitepaper (Loi 09-08 / GDPR one-pager already planned). |
| 7 | **MDR classification contradicts itself** (README "not a medical device" vs PMS "Class I"). | A brand built on accountability cannot publish two answers. | Decide, document, align every page (see SWOT G-01). |
| 8 | **No proof from customers.** No pilots, testimonials or case studies. | Healthcare buys on peer trust. | Three pilot practices with written consent (business plan §3.4). |
| 9 | **No brand architecture for expansion.** "MeDoc-Dentist" naming has no rule for general medicine, pharmacy or booking. | Each new product would invent its own name and look. | §4 below. |
| 10 | **No founder story or company presence.** No LinkedIn page, no "about", no press kit. | Distributors, partners and hires look for the company, not the product. | The `/company/` site, a LinkedIn page, a one-page press kit with mark files. |
| 11 | **One-person risk is visible.** | Buyers ask "what if you disappear?" | Publish a continuity promise: escrow of source and keys with a notary, data export in open formats. Turn the weakness into a trust feature. |

## 3. The name: Sifra Labs

### 3.1 Meaning

**صِفر (ṣifr)** is Arabic for *zero, the empty place*. Leonardo of Pisa (Fibonacci) learned the Hindu–Arabic numerals in Béjaïa, on the Maghreb coast, and brought them into Europe around 1200. The word travelled with them:

| Language | Word | Meaning |
|---|---|---|
| Arabic | ṣifr | zero, empty |
| Medieval Latin | cifra | digit |
| French | chiffre | number; *chiffrer* = to encrypt |
| German | Ziffer | digit |
| Spanish / Italian | cifra | number, figure |
| English | cipher | zero, then secret writing |

One word that already means **numbers, computing and encryption** in every target market, and that tells the true story of the company: from the Maghreb, for the world.

"Labs" says engineering and research, which covers software, AI, security and cloud without tying the company to one field.

### 3.2 Against the criteria

| Criterion | Sifra Labs | Notes |
|---|---|---|
| Easy to remember | ✅ | Two syllables, one story |
| Easy to pronounce and spell | ✅ | SIF-ra. Same in FR, EN, DE, ES, IT. Arabic wordmark: سيفرا |
| Distinctive and sticky | ✅ | No software company owns it; the etymology is a story people repeat |
| Visual potential | ✅ | The dotted zero (§6.1): a mark that comes out of the name itself |
| Room to grow | ✅ | Nothing medical in the name; fits AI, cloud, booking, pharmacy, a shop |
| Cross-cultural safety | ⚠️ low risk | *Sifra* is also the title of a classical Hebrew legal commentary and a given name; neither is negative. Do not write it صفرا in Arabic (reads *safra*, "yellow"); use سيفرا or the Latin wordmark |
| Trademark | ⚠️ search needed | Nearest marks found: "SIFRICH" (Sifra Life Sciences, India, class 5 pharma) and "SIFR" (Cryptobiotix, research services). Neither is in software (9/42), but run a full search before filing |
| Domain and handles | ✅ | `sifralabs.com` free on 2026-11-25. GitHub `sifralabs` and X `@sifralabs` free. `sifra.com` is registered (parked) |
| SEO | ✅ | "Sifra" has no dominant result today; "Sifra Labs" is empty |
| Related to the plans | ✅ | Encryption (cipher), numbers (economic analysis), zero (zero-trust, zero defects), engineering |

### 3.3 Names considered and dropped

| Name | Why not |
|---|---|
| Igoudar (Amazigh collective granary) | Beautiful metaphor, hard to spell outside Morocco |
| Tessera, Stela, Vellum, Alveo, Hexis | Existing tech or medical trademarks (Vellum AI, AMD Alveo, Hexis films) or bad associations (stela = gravestone) |
| Everkept, Lightkeep, Keelstone | Domains taken; Everkept is a waste-services brand |
| Coined 5–6 letter names (Veyra, Orvel, Kalvo, Tesera…) | All `.com` registered, no meaning to defend |

### 3.4 Secure it (owner actions)

1. **Domains:** register `sifralabs.com` now (primary). Defensive: `sifralabs.ma`, `sifra.ma`, `sifra.eu`, `sifra.health` (all showed no DNS on 2026-11-25; confirm at the registrar). Later, try to buy `sifra.com`.
2. **Handles:** `sifralabs` on GitHub, X, LinkedIn, Instagram, YouTube. Check LinkedIn and Instagram by hand.
3. **Trademark:** full search on TMview, WIPO Global Brand Database and OMPIC first. Then file **Sifra Labs** (word + mark) at OMPIC in Nice classes **9** (software), **42** (SaaS, software development, IT security), **35** (the future in-app shop), **44** (only if you ever offer health services). Extend through the Madrid system to the EU, UK, Saudi Arabia, UAE and Egypt as you enter them.
4. **E-mail:** `hello@sifralabs.com`, `contact@sifralabs.com`, `security@sifralabs.com`. Set up SPF, DKIM and DMARC on day one: a security brand whose mail lands in spam is not one.

## 4. Brand architecture

**Endorsed brands:** one company, products with their own names, always signed "by Sifra Labs".

```
Sifra Labs                      company, trust, engineering, the core
├── MeDoc Dentist                available
├── MeDoc General               general medicine
├── MeDoc Mobile                iPad / Android companion
├── Sifra Booking               patient-facing booking (a consumer name may come later)
├── Sifra Pharmacy              pharmacy systems
├── Sifra Assist                AI assistance (opt-in, auditable)
└── Sifra Core                  shared security, sync, audit, licensing (internal + partner SDK)
```

Rules:

- **Clinical practice software = MeDoc + field** (Dental, General, Ortho, Pediatrics…). Practitioners learn one name.
- **Platform and cross-field services = Sifra + function.** They serve more than one product.
- **Every product page and installer carries "by Sifra Labs"** and links to `/company/`.
- **Each product has one accent colour**; the masterbrand keeps ink + Majorelle (§6.2).

## 5. Strategy

### 5.1 Purpose
Give medical practices software they can trust with their patients' secrets for a decade.

### 5.2 Positioning
For medical practices that hold confidential patient data, Sifra Labs makes practice software that **keeps the data on the practice's own machines, records every access, and is maintained for years**. Unlike cloud suites that move records off-site, or old desktop software that stops improving, Sifra products are local-first, auditable and improved in small, regular releases.

### 5.3 Promise: *Precise. Private. Kept.*

| Pillar | Means | Proof today |
|---|---|---|
| **Precise** | Engineering that does exactly what it says; standards-mapped; numbers you can check | V-model, IEC 62304 / ISO 14971 mapping, HMAC audit chain, tests |
| **Private** | The data stays where it is created; least privilege by default | SQLCipher, reception cannot read charts, offline by default |
| **Kept** | Maintained for years; promises kept; mistakes fixed in the open | Incremental delivery, changelog, service plans, honest "planned" labels |

"Kept" carries three meanings on purpose: *kept safe*, *kept up to date*, *a promise kept*.

### 5.4 Personality and voice

| We are | We are not |
|---|---|
| Calm, exact, plain-spoken | Hype, "revolutionary", "AI-powered" as a headline |
| Specific: names the standard, the number, the file | Vague: "enterprise-grade security" |
| Honest about limits ("planned", "no certification yet") | Selling what does not exist |
| Warm toward practitioners; the receptionist matters as much as the dentist | Talking to engineers when the reader is a dentist |

Write in short sentences. Lead with what the reader gets, then the proof. Every claim must be traceable to code or a document; that rule already exists for the MeDoc site and now covers the whole company.

### 5.5 Messages per audience

| Audience | Message | Proof to show |
|---|---|---|
| Practice owners | Your records stay in your practice and only the right people see them | Reception vs dentist view, audit log, offline demo |
| Distributors and hardware partners | A disciplined, standards-mapped partner with an Arabic-first platform | Standards list, architecture, roadmap |
| Regulators and DPOs | Privacy by design that we can document | Loi 09-08 / GDPR one-pager, VVT and DPIA generators |
| Future hires | Real engineering on a product meant to last | Repo practices, V-model, open roadmap |
| Investors | One core, many fields: each new product reuses the security already proven | §4 architecture, Morocco traction, cash model |

## 6. Visual identity

Built with the ui-references benchmarks: **Pentagram** for type restraint (one superfamily, few sizes, hierarchy by weight and space), **Stripe** for the landing rhythm (one-sentence hero, real product visual, structure you can see).

### 6.1 Mark: the dotted zero

Files: `website/public/brand/sifra-mark.svg`, `sifra-mark-reversed.svg`, `sifra-app-icon.svg`, `favicon.svg`.

- **Oval ring** = the zero Europe writes.
- **Dot** = the zero written in Arabic (٠).
- **Together** = the dotted zero engineers use so 0 cannot be mistaken for O. Precision where a mistake is not an option.

Construction (64-unit grid): ellipse rx 16.5, ry 23, stroke 7; dot r 5, centred. The dot is always Majorelle; the ring is ink (or paper when reversed). Clear space = the ring's stroke width × 2 on all sides. Minimum size 16 px. Don't rotate, outline, add gradients or put the dot off-centre. The mark may also read as an eye; that is welcome (vigilance, Face ID).

**Wordmark:** "Sifra Labs" in IBM Plex Sans SemiBold, −0.01em, beside the mark at the cap height. Have a designer outline it as SVG before printing anything.

### 6.2 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#10162B` | `#E8EAF0` | Text, ring, primary buttons. Deep blue-black: the ink of a written record |
| `--paper` | `#F6F5F1` | `#0D111D` | Page. Warm off-white, like archive paper |
| `--panel` | `#FFFFFF` | `#141A2A` | Cards, tables |
| `--majorelle` | `#3346C8` | `#9AA6FF` | The dot, links, section numbers. Shared with MeDoc as its highlight colour: the family link |
| `--line` | `#DDDBD3` | `#262E42` | Rules and borders |
| Product accent: MeDoc | `#0B7F63` | `#3CCB9F` | Only on MeDoc |

No gradients, no glows. One accent per surface.

### 6.3 Typography

One superfamily, IBM Plex (open licence, Latin and Arabic, engineering heritage):

| Role | Face | Use |
|---|---|---|
| Display | **IBM Plex Serif Light / Regular** | Headlines, the promise. A serif gives the gravity of law and record-keeping |
| Text | **IBM Plex Sans** 400/500/600 | Everything you read |
| Arabic | **IBM Plex Sans Arabic** | Same design as the Latin text, so FR and AR pages look like one brand |
| Data | **IBM Plex Mono** | Section numbers, evidence lines, status labels, standards: the "specification document" voice |

Scale: 13 / 15 / 17 / 19 / 24 / 34 / 50 / 88 px. Display tracked −0.02 to −0.03em. MeDoc keeps **Bricolage Grotesque** as its product display face: the warm product voice on top of the same Plex text.

### 6.4 Imagery

- **Product first.** Real screenshots of the real app, demo data only, in a thin border with a soft shadow. Never a mock-up that does more than the product.
- **Photography now:** real, licensed stock photos (Unsplash License, credited on the legal notice) of clinicians using technology, clinics and engineering teams. No AI-generated images. Replace with commissioned photos once pilots run.
- **Photography (to commission):** real practices in Moroccan daylight; hands at work (a receptionist at the desk, a dentist's gloved hands, a tablet on a tray); natural colour, no blue tint. With signed consent from everyone shown. No stock smiles, no glowing brains, no padlocks on circuit boards, no "AI" robots.
- **Diagrams** drawn in the brand tokens (like the core/products stack on `/company/`), never clip art.
- **Texture:** none. Structure comes from thin rules and the Mono numbers.

### 6.5 Motion
One moment per page. On `/company/` the dot settles into the zero once on load (700 ms, ease-out); `prefers-reduced-motion` shows it at rest.

## 7. The company website

| | |
|---|---|
| **Code** | `sifralabs/` (standalone Vite site; see its README for run, edit and deploy) |
| **Pages** | Home · Products (MeDoc + family + roadmap) · Security (how data is protected, what's not done yet, standards, vulnerability disclosure) · Company (how we work, markets, the name, the mark) · Contact · Legal notice · Privacy · 404 |
| **Trust files** | `/.well-known/security.txt`, strict security headers in `public/_headers` (CSP, HSTS), no cookies, no third-party requests |
| **Logo files** | SVG mark, reversed mark, app icon; PNG favicon, Apple touch icon, 512 px icon and 1200×630 share image |
| **Connection to MeDoc** | MeDoc's footer says "A Sifra Labs product" in four languages and links to `https://sifralabs.com/` (`website/src/config.ts`). The company site links to MeDoc at `https://medoc.sifralabs.com/` |
| **Language** | English (international audience). FR and AR versions are a follow-up |
| **Hosting** | Cloudflare Pages for `sifralabs.com`; MeDoc on GitHub Pages under `medoc.sifralabs.com` |

## 8. Next 90 days

1. Buy `sifralabs.com` + defensive domains; claim the handles (this week).
2. Trademark search, then OMPIC filing (month 1).
3. Register the company; fill `entity.ts` and `config.ts`; set up mail with DMARC (month 1).
4. Code-signing certificates in the company's name (month 1–2).
5. Trust centre: `security.txt`, disclosure policy, Loi 09-08 one-pager (month 2).
6. Resolve the MDR wording contradiction (month 2).
7. Three pilot practices, photographed with consent (month 2–3).
8. FR and AR versions of `/company/`; LinkedIn company page; press kit (month 3).
9. Clearance search on "MeDoc" for the EU before any EU marketing (before Europe).
