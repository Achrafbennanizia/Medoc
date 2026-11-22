# MeDoc — Go-to-market plan (Morocco first, then the Arab world, then Europe)

**Date:** 2026-11-22 · **Status:** draft for the founder. Figures are planning assumptions, not forecasts. Everything marked *verify* needs a local accountant or lawyer before you rely on it.

---

## 0. Summary

| | |
|---|---|
| **Product** | MeDoc: dental practice software that runs on the practice's own computers. Encrypted database, works offline, FR · AR · EN · DE, light/dark. |
| **First market** | Private dental practices in Morocco: Casablanca, Rabat, Marrakech, Tangier, Fès and Agadir first. |
| **Offer** | One-time license (complete base model) plus a monthly service plan (updates, support, backup checks). |
| **Why we win in Morocco** | Patient data stays inside the practice. That is the simplest story to tell under **Loi 09-08**, where moving health data out of the practice or out of Morocco brings extra CNDP formalities. On top of that: French *and* Arabic interfaces, and the software keeps working through internet outages. |
| **Biggest risks** | (1) The product is still built around German rules: GOZ/BEMA catalogs, AMVV prescriptions, € defaults. There is no Moroccan insurance paperwork (AMO/CNSS feuille de soins, NGAP coding). (2) Several safety and security features are switched off in code (2FA, break-glass access, X-ray/DICOM). (3) Recurring revenue is too small to carry the company at the planned prices (see §4). |

### Pricing consistency issue

Your brief gives **2,500–3,500 €** and **25,000–30,000 MAD** as the same range. At ~10.8–11 MAD/€ they are not:

- 25,000–30,000 MAD ≈ **2,300–2,750 €**
- 2,500–3,500 € ≈ **27,000–38,000 MAD**

**Recommendation:** run two price lists.

- **Morocco:** 24,900 MAD (Essentiel), 29,900 MAD (Cabinet), 34,900 MAD (Clinique). All excl. VAT.
- **Europe:** 2,900 € to 3,500 €.

Always state **HT/TTC**. Software sales carry 20 % TVA in Morocco (*verify*). A dentist who sees "27,500" and then gets an invoice for 33,000 will not trust you again.

---

## 1. Market

### 1.1 Size (Morocco)

- There is no recent official count of dentists. The ONMD put the number of practising dentists at **~5,000 in 2015** ([Médias24, 2015](https://medias24.com/2015/02/12/medecine-dentaire-au-maroc-lordre-reclame-plus-de-serieux/)).
- Dental faculties now train **1,500+ dentists a year** across 12 faculties ([TelQuel, 2025](https://telquel.ma/instant-t/2025/06/12/lordre-des-medecins-dentistes-alerte-sur-la-proliferation-des-pratiques-illegales_1937294/)).
- Only ~450 of them work in the public sector ([Aujourd'hui le Maroc](https://aujourdhui.ma/societe/carte-sanitaire-le-maroc-compte-34-173-medecins-dans-le-public-et-le-prive-en-2025)).
- **Working estimate: 8,000–10,000 private practices** (*verify* with the ONMD before you put a number in a pitch).
- **Serviceable target:** practices with a computer at reception and 1–5 staff, roughly 40 %, so ~3,500 practices.
- **Year-2 goal:** 75 practices in the base case, about 2 % of that target. This is realistic for a founder-led sales team.

### 1.2 Competition (scan, *verify* each)

| Type | Examples | Their angle | Our angle against them |
|---|---|---|---|
| French desktop dental software sold in the Maghreb | Julie, Logos, Visiodent | Mature, strong odontogram and imaging | Built for French social security, not Moroccan. Expensive. Rarely in Arabic. |
| Cloud dental SaaS | Dentaly/Veasy and other international SaaS | Nothing to install | Health data leaves the practice, often the country (Loi 09-08 transfer questions). Internet dependency. |
| Moroccan medical/dental software | Cabidoc, Pratisoft (general medical), Dentiz AI, NeuroDental ([search](https://www.telecontact.ma/annonceur/dentiz-ai/9059708/rabat.php)) | Local, priced in MAD, hosted in Morocco | Usually general medical, not dental-specific. Check each for odontogram depth and Arabic support. |
| Paper + Excel + WhatsApp | Most small practices | Free and familiar | **This is the real competitor.** Sell on time saved at reception, fewer missed payments and a professional image. |

**Action:** before launch, spend one week as a mystery shopper. Request a demo and quote from Cabidoc, Dentiz AI, NeuroDental and one French vendor. Record prices, features, contract length and data hosting.

### 1.3 Who buys

| Persona | What they care about | What to show them |
|---|---|---|
| **Dentist-owner (35–55)** | Revenue visibility, image, not losing records, medical secrecy | Finance dashboard, odontogram, chart PDF export, "the receptionist cannot read medical notes" |
| **Young dentist opening a practice (27–35)** | Cost, modern look, fast set-up | Ready in a day, light/dark, Arabic/French, payment in 3 instalments |
| **Receptionist / assistant** | Fast scheduling, payments, phone calls | Calendar drag-and-drop, cash desk, daily close |
| **Multi-chair clinic / group** | Several dentists, network, reporting | **Not ready yet.** The code caps accounts at 1 physician and 4 reception. Do not sell to clinics until that cap is license-based. |

---

## 2. Offer and pricing

### 2.1 Packaging

| | **Essentiel** | **Cabinet** (recommended) | **Clinique** |
|---|---|---|---|
| One-time license (Morocco, HT) | 24,900 MAD | 29,900 MAD | 34,900 MAD |
| One-time license (EU, excl. VAT) | 2,500 € | 2,900 € | 3,500 € |
| Workstations | 1 | Up to 3 (network) | Up to 5 + replica laptop |
| Install + data import + 2 h training | Remote | On-site | On-site + 2nd session |
| Included service plan | 3 months | 6 months | 12 months |

### 2.2 Monthly service plans (after the included period)

| Plan | MAD/month HT | €/month | Contents |
|---|---:|---:|---|
| **Sécurité** | 110 | 10 | Security and legal updates, knowledge base |
| **Confort** | 290 | 25 | + feature updates, support by phone/WhatsApp in business hours, monthly remote backup check |
| **Premium** | 540 | 50 | + priority support (4 h), annual on-site visit, staff re-training, help with the CNDP file |

### 2.3 Payment terms (Moroccan practice)

- 3 instalments: 40 % at signature, 30 % at install, 30 % after 30 days. Cheques, transfer or card.
- **Annual service plan paid up front at a 2-month discount.** This fixes the cash problem in §4.
- Write a clear **"no plan" policy:** the license is perpetual, but without a plan the practice gets no updates and no support. Security updates should stay free for 12 months, as a duty of care.

---

## 3. Marketing plan

### 3.1 Positioning line (FR / AR)

- **FR:** *« Le logiciel dentaire qui garde vos dossiers patients dans votre cabinet. »*
- **AR:** *« برنامج طب الأسنان الذي يُبقي ملفات مرضاك داخل عيادتك. »*

### 3.2 Channels, in order of expected return

1. **Field sales and demos.** Visit practices in person with a laptop. Run a 20-minute scripted demo: patient → odontogram → appointment → payment → daily close.
2. **Dental congresses and continuing-education days.** Look at ONMD regional councils, faculty events and the national dental congresses. Have a stand, a live demo and a show discount.
3. **Dental suppliers and depots.** Partner with equipment and consumables distributors who visit practices every week. Pay 10 % commission on the license.
4. **Referral programme.** One free month of Confort for each referred practice that signs.
5. **Faculty programme for new graduates.** "Installation pack": Essentiel at -20 % in the first year of practice. This catches the 1,500+ new dentists a year at the moment they open a practice.
6. **Digital.**
   - Website (FR/AR/EN/DE).
   - Google Business profile.
   - Short Arabic/French videos on Instagram, Facebook and YouTube.
   - LinkedIn posts aimed at practice owners.
   - Google Ads on "logiciel cabinet dentaire Maroc", "برنامج عيادة أسنان", "logiciel dentiste Casablanca".
7. **WhatsApp Business** as the main inbound channel. Put the button on every page of the website.

### 3.3 Funnel targets (base case)

| Step | Per month (from month 4) |
|---|---:|
| Website visits | 1,500 |
| Demo requests (web + WhatsApp + events) | 25 |
| Demos done | 15 |
| Signed | 2–3 |

### 3.4 Trust assets to produce before launch

- 3 pilot practices (50 % price) with written testimonials and photos. You need their written consent.
- A 2-page **"MeDoc et la loi 09-08"** document. It explains what the software does (encryption, roles, export/erase, audit log) and what the practice must still do (CNDP declaration/authorisation, signage, contracts).
- A demo video in French and in Moroccan Arabic (Darija voice-over).
- Real product screenshots. **The ones in the repo today are blank** (see the gaps document).

---

## 4. Cash flow (24 months, MAD, before tax and founder salary)

**Assumptions:**

- Average license 27,500 MAD HT, 50 % discount for the first 3 months of pilots.
- Paid 40/30/30 over 3 months.
- 80 % of practices take a 270 MAD/month plan.
- Set-up costs of 60,000 MAD in month 1: company, lawyer for EULA/DPA/CGV, code-signing certificates, professional liability insurance, demo laptop.
- Marketing 6,000/month and tools 2,500/month.
- First hire (sales/support) from month 4 at 10,000/month. Second hire (dev/support) from month 13 at 9,000/month.
- 4 congress stands at 35,000 each.
- 5 % commission and fees.

#### Conservative (1 → 2 → 3 new practices/month)

| Month | New | Installed | License in | Support in | Costs | Net | Cumulative |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 5,500 | 0 | 69,188 | -63,688 | -63,688 |
| 6 | 1 | 6 | 27,500 | 1,296 | 19,875 | 8,921 | -78,868 |
| 12 | 2 | 18 | 55,000 | 3,888 | 21,250 | 37,638 | 80,730 |
| 24 | 3 | 54 | 82,500 | 11,664 | 31,625 | 62,539 | 693,680 |

Lowest cash point **≈ -88,000 MAD**. 54 practices after 24 months.

#### Base (1 → 2 → 3 → 4 new practices/month)

| Month | New | Installed | License in | Support in | Costs | Net | Cumulative |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 5,500 | 0 | 69,188 | -63,688 | -63,688 |
| 6 | 2 | 9 | 55,000 | 1,944 | 21,250 | 35,694 | -23,946 |
| 12 | 3 | 27 | 82,500 | 5,832 | 22,625 | 65,707 | 300,826 |
| 24 | 4 | 75 | 110,000 | 16,200 | 33,000 | 93,200 | 1,267,452 |

Year 1 cash in ≈ **658,000 MAD**. Year 2 ≈ **1.43 M MAD**. Lowest point ≈ **-64,000 MAD**.

#### Ambitious (2 → 3 → 5 → 7 new practices/month)

Year 1 cash in ≈ **1.08 M MAD**. Year 2 ≈ **2.5 M MAD**. 129 practices at month 24.

### 4.1 What the model tells you

1. **You need ~100,000 MAD of starting capital.** That covers the worst dip of -88k plus a buffer. It does not include your own salary. Add 6–12 months of personal living costs on top.
2. **Recurring revenue is too thin.** At 270 MAD/month, 75 practices bring in 16,200 MAD/month. That does not cover one employee plus marketing. The company only survives while new licenses keep selling. Fixes, from strongest to weakest:
   - (a) Make the plan **mandatory for year 1** and bill it **annually up front**.
   - (b) Set the default plan at 290–540 MAD, not 110.
   - (c) Add paid extras: SMS/WhatsApp reminders per message, data migration from old software (3,000–6,000 MAD), extra workstation licenses, and training days.
3. **The pilot discount in months 1–3 costs little.** It buys the testimonials that make everything later cheaper. Keep it.
4. **Price VAT, corporate tax (IS) and social charges with an accountant.** The model is pre-tax.

---

## 5. Company set-up in Morocco (checklist, *verify each with an accountant*)

- [ ] Legal form: **SARL AU** (single shareholder). The auto-entrepreneur status has a turnover ceiling far below this business.
- [ ] Get your company identifiers: RC, IF, ICE, Taxe professionnelle and CNSS. They must appear on every invoice you issue.
- [ ] **E-invoicing:** DGI e-invoicing (UBL format, clearance model) is being introduced from 2026, with dates set by decree ([Le360](https://fr.le360.ma/economie/facturation-electronique-le-detail-du-calendrier-de-mise-en-place_2EQSNG2DTVB6PGBBHQ6OCFT6CY/), [EDICOM](https://edicomgroup.com/fr/blog/maroc-obligation-facturation-electronique)). Your own invoicing must comply. **MeDoc's patient invoices will eventually need to as well:** that is a product roadmap item and a selling point.
- [ ] Professional liability insurance (RC professionnelle / RC éditeur). It is essential in the medical field.
- [ ] Contracts, reviewed by a Moroccan lawyer:
  - EULA (license terms)
  - CGV (terms of sale)
  - SLA (support plan)
  - DPA (*contrat de sous-traitance* under Loi 09-08 art. 23–24). Needed whenever your support staff can see patient data, e.g. remote support or backup help.
- [ ] Register the **MeDoc** trademark with the **OMPIC** (Morocco). Later, register it with WIPO (Madrid system) for the EU and the GCC.
- [ ] Register a `.ma` domain plus `.com`.
- [ ] Open a business bank account and sign up with a card-payment provider (CMI) for online plan payments.

---

## 6. International roadmap

| Phase | When | Markets | Product work required first |
|---|---|---|---|
| **1** | Months 0–18 | Morocco | Moroccan pack: MAD defaults, ICE/IF/RC on invoices, NGAP dental acts + AMO/CNSS/CNOPS/mutual-insurance feuille de soins, Darija-friendly Arabic, French manual, 2FA on, multi-physician license |
| **2** | Months 12–30 | **Tunisia, Algeria** (francophone Maghreb), then **Egypt, Jordan** | Tunisia: INPDP (Loi organique 2004-63). Algeria: ANPDP (Loi 18-07). Egypt: PDPL 151/2020. Local insurance forms. Resellers in each country. |
| **3** | Months 24–42 | **Gulf: UAE, Saudi Arabia** | Much stricter. KSA: PDPL + NPHIES e-claims + Arabic-first UI. UAE: ICT Health Law (Federal Law 2/2019), which keeps health data in-country, plus emirate rules (DHA, DoH, Malaffi). Needs a local partner and probably a local legal entity. |
| **4** | Months 30+ | **Europe: France, Belgium, Germany** | GDPR, an MDR classification decision (see the gaps document), and certified billing for each country: German KZBV/BEMA certification, French SESAM-Vitale approval. These are each 6–18 month projects. Start with a niche (e.g. francophone private clinics in Belgium) or partner with a local distributor. |

**Rule:** do not enter a country until (a) a local lawyer has checked the data and health-software rules, (b) the insurance/billing format for that country works in the product, and (c) a reseller or support partner is signed.

---

## 7. 90-day launch plan

| Weeks | Do |
|---|---|
| 1–2 | Company set-up started. Mystery-shop the competitors. Fix pricing (HT/TTC, two price lists). Brief a lawyer on EULA/CGV/DPA. |
| 2–6 | **Product, Moroccan pack:** MAD default, ICE/IF/RC fields, NGAP catalog, French feuille de soins print, 2FA enabled, physician cap tied to the license. Re-capture real screenshots. |
| 3–6 | Website live (FR/AR/EN/DE, light/dark), WhatsApp Business, Google Business profile, demo video. |
| 6–10 | 3 pilot practices installed and visited weekly. Fix what they report. |
| 10–13 | Testimonials. Book a congress stand. Hire the first sales/support person. Price list v1 public. |
