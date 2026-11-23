# Legal review brief: website legal pages and printed documents

For the lawyer(s) reviewing MeDoc before sale. Written 2026-11-23. Nothing here is legal advice; it lists what was drafted, the choices made, and the questions only a lawyer or the owner can settle.

## 1. What to review

| Text | File | Written for | Language |
|---|---|---|---|
| Legal notice, privacy notice, privacy policy, terms of sale | `website/src/legal/fr.ts` | France (RGPD, loi Informatique et Libertés, Code de commerce, Code de la consommation) | French |
| Same four | `website/src/legal/ar.ts` | Morocco (loi 09-08, DOC, loi 31-08, loi 53-05) | Arabic |
| Same four | `website/src/legal/de.ts` | Germany (DSGVO, DDG § 5 Impressum, TDDDG, BGB) | German |
| Same four | `website/src/legal/en.ts` | European Union (GDPR, ePrivacy, Directive 2000/31/EC) | English |
| Legal lines printed on documents | `crates/shared/medoc-core/src/infrastructure/pdf/locales/*.json` (keys with `@fr`, `@ma`, `@eu`; plain = Germany) | Per practice country | 4 languages |

Live site: https://achrafbennanizia.github.io/Medoc/#/legal/legal-notice (switch language for each jurisdiction).

## 2. Company facts still missing (blocks publication)

Every `{token}` in the texts is filled from `website/src/legal/entity.ts`. No company is registered yet (business plan: SARL AU planned). Needed:

company name · legal form · registered address and country · managing director · share capital · trade register and number (RC) · ICE · IF · VAT ID (EU/DE) · contact e-mail and phone · data-protection contact · competent court.

Website host (filled): GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. **Question:** hosting in the US means a transfer outside the EU/Morocco for server logs; is the EU–US Data Privacy Framework (GitHub is certified) enough, and does Morocco's CNDP need a transfer declaration? Alternative: move the site to an EU or Moroccan host.

## 3. Choices made in the drafts (owner decides, lawyer checks)

| Topic | Draft choice | Where |
|---|---|---|
| Customers | Business-to-business only (dentists, practices); consumer rules excluded | terms, all |
| Licence | One-time perpetual licence; service plans monthly, cancellable | terms |
| Payment | Contract formed at signature of the order and payment of a first deposit; late-payment penalties at the ECB refinancing rate plus a margin (France) | terms |
| Warranty | 12 months on conformity, repair or replacement first | terms |
| Liability | Capped at the price paid in the last 12 months, except gross negligence, wilful misconduct, bodily harm and non-excludable cases | terms |
| Data role | The practice is controller for patient data, which stays on its computers. MeDoc only sees it when the practice shares its screen during support or hands over a backup; it then acts as processor (GDPR art. 28) under a data-processing agreement | privacy policy, terms |
| Remote support | Practice-initiated screen sharing; which tool is not named yet | privacy policy |
| Retention (French text) | Prospects: 3 years after last contact; customers: contract + 5 years (art. L.110-4 C. com.); invoices and accounting: 10 years (art. L.123-22 C. com.); site logs: set by the host | privacy policy |
| Server logs | Host logs only, short retention; no analytics | privacy policy |
| Cookies | 4 first-party, strictly necessary cookies (language, theme, country, notice closed), set only on the visitor's choice, 12 months; no consent banner | privacy policy, cookie notice |
| Supervisory authority | CNIL (FR), CNDP (MA), the competent German Land authority (DE), the visitor's EU authority (EN) | privacy policy |

## 4. Questions for the lawyer

1. **Medical device.** The prescription screen flags a drug that matches an allergy already recorded in the patient's history. Does this make MeDoc software with a medical purpose (EU MDR rule 11; Moroccan law 84-12), and what follows for sale in the EU and Morocco?
2. **CNDP.** Health data is sensitive under loi 09-08; each practice must obtain CNDP authorisation. What may MeDoc say on its site and in the terms ("tools for your loi 09-08 obligations", never "CNDP-compliant")?
3. **France, health data.** Does selling to French practices require HDS certification of MeDoc itself, given that data never leaves the practice's computers (no hosting)?
4. **Invoices printed by the software.** Check the mentions per country: Morocco (CGI art. 145, VAT exemption art. 91-VI-1°), France (CGI art. 242 nonies A, VAT exemption art. 261-4-1°, SIRET), Germany (§ 14 UStG, GOZ, § 286 BGB notice), EU (Directive 2006/112/EC art. 226, exemption art. 132).
5. **Prescriptions.** France: prescriber RPPS, patient sex and age (art. R.5132-3 CSP) are printed; the social-security number is not. Morocco: INPE printed, tax ids not. Enough?
6. **Sick leave in France.** MeDoc prints a certificate with a note that the official notice goes through amelipro or the secure Cerfa form. Is that wording correct and sufficient?
7. **Terms per language vs. per country.** The French texts follow French law, but most French-speaking buyers are Moroccan. Do we need a French-language version under Moroccan law?
8. **Consumer protection.** Is excluding consumers enough for a dentist who buys as a sole trader (Morocco loi 31-08, France art. L.221-3 Code de la consommation for small professionals)?

## 5. How to publish the reviewed texts

Edit the `website/src/legal/*.ts` files and `entity.ts`, then push to `main`; the Website workflow deploys in about two minutes. The banner "These texts are a draft…" on each legal page comes from `reviewNote` in each file; remove it only after review.
