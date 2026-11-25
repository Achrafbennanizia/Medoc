# MeDoc product website

Marketing site for **MeDoc**, aimed first at dental practices in Morocco.

- 4 languages: FR (default), AR (right-to-left), EN, DE. `?lang=ar` deep-links a language.
- Country selector (Morocco, France, Germany, EU): defaults from the browser's time zone and language, no location prompt. It picks the documents shown, the country section, the price currency and number format. `?country=FR` deep-links a country.
- Light/dark theme: follows the system.
- Interactive odontogram (FDI, combined statuses) in the hero, What's new, a tour of the real app, a gallery of real PDFs per country, set-ups, prices in MAD or €, FAQ, demo form (opens the visitor's e-mail app; nothing is stored), legal pages per language at `#/legal/<doc>`.
- Cookies: only four first-party, strictly necessary ones, written when the visitor makes a choice (`src/prefs.ts`). Keep that list and the legal pages in step.

## Run

```bash
cd website
npm ci --workspaces=false
npm run dev        # http://127.0.0.1:4173
npm run build      # type-check + production build → dist/
```

## Edit

| What | Where |
|---|---|
| All copy, 4 languages | `src/i18n.ts` (FR/AR/DE are typed against EN, so a missing key fails the build) |
| E-mail, WhatsApp number, prices | `src/config.ts` — **set the real e-mail and WhatsApp before publishing** |
| Odontogram data | `src/Odontogram.tsx` (`FINDINGS`) |
| What's new, documents gallery, legal page labels | `src/site-copy.ts` |
| Country selector, country sections, cookie notice | `src/country-copy.ts`, `src/prefs.ts` |
| Legal texts (EN → EU, DE → Germany, FR → France, AR → Morocco) | `src/legal/*.ts`; company details in `src/legal/entity.ts` — **fill every `[…]` before publishing** |
| Product tour text + screenshot list | `src/product-copy.ts` (sections, captions) and `src/product-points.ts` (detail bullets) |
| Colours, type, layout | `src/styles.css` (tokens at the top; dark mode redefines the same tokens) |
| Pages (Home, Features, Security) and their routes | `src/route.ts` (`#/features`, `#/features/<section>`, `#/security`, `#/legal/<doc>`; any other hash is a home section), `src/Pages.tsx` |
| Copy for nav, home highlights, privacy band and the Security page, 4 languages | `src/pages-copy.ts` |
| Photos | `public/photos/*.webp` (900 and 1600 px). Real photos from Unsplash under the Unsplash License: D Dental Office (dentist and patient), Quang Tri NGUYEN (tablet consultation), Jonathan Borba (X-ray review), Benyamin Bohlouli (clinic room), Cdn Pages (dental team). No AI-generated images |
| Link to the company site, contact e-mail | `src/config.ts` (`COMPANY_URL`, `CONTACT_EMAIL`). The company site itself is `../sifralabs/` |

Design rationale: `docs/launch/03-website-design-plan.md`. Claims must stay within what the app does today: features not shipped yet are listed under "En préparation".

## Screenshots and documents

`public/product/*.webp` are real captures of the desktop app (French UI, demo practice in MAD), at 1800 and 1000 px. `public/documents/` holds PDFs issued by the app's own sample tests (`crates/shared/medoc-core/tests/{moroccan_invoice_samples,country_document_samples,official_pdf_samples}.rs`, written to `$MEDOC_PDF_SAMPLE_DIR`), rendered to WebP. Patients and practices are fictitious.

To re-capture the app: run it with `MEDOC_DEV_SEED=1`, sign in with the demo accounts and use the dev capture bridge (dev builds only). Wait for the page fade-in before each capture, or the content area comes out blank. Check every file by eye before publishing.

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/website.yml`).
