# MeDoc Dentist product website

Marketing site for **MeDoc Dentist by Sifra Labs**, dental practice software for practices in Morocco. Morocco is the only market: prices in MAD, Moroccan documents and Moroccan legal texts. Europe has one "coming soon" page (`#/europe`).

The product name is **MeDoc Dentist** in every language and on every page (never "MeDoc", "MeDoc Dental" or a translated name). Live at https://achrafbennanizia.github.io/Medoc/.

- 3 languages: FR (default), AR (right-to-left), EN. `?lang=ar` deep-links a language. Numbers and dates use the Moroccan format (`fr-MA`, `ar-MA`).
- Light/dark theme: follows the system.
- Interactive odontogram (FDI order, combined statuses) in the hero, What's new, a tour of the real app, a gallery of real Moroccan PDFs (French and Arabic), set-ups, prices in MAD, FAQ, demo form (sends to the sifralabs.com contact service, or opens the visitor's e-mail app; the site stores nothing), legal pages per language at `#/legal/<doc>`.
- Editions: Essentiel, Cabinet, Cabinet+ (source of truth: `config/editions.yaml`). Every feature that is not in all three editions names its editions.
- Cookies: only three first-party, strictly necessary ones (`medoc_lang`, `medoc_theme`, `medoc_cookie_notice`), written when the visitor makes a choice (`src/prefs.ts`). Keep that list and the legal pages in step.

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
| All copy, 3 languages | `src/i18n.ts` (FR/AR are typed against EN, so a missing key fails the build) |
| E-mail, WhatsApp number, prices (MAD, per edition) | `src/config.ts` — **set the real e-mail and WhatsApp before publishing** |
| Odontogram data | `src/Odontogram.tsx` (`FINDINGS`) |
| What's new, documents gallery, legal page labels, cookie notice | `src/site-copy.ts`; cookie names in `src/prefs.ts` |
| Morocco page (Digital Morocco 2030, Bill 52-26, Law 09-08), advantages, Digitalization Pack | `src/digital-copy.ts`; every figure comes from `docs/brand/site-facts.md` with its source |
| Legal texts, all written under Moroccan law (EN, FR, AR) | `src/legal/*.ts`; company details in `src/legal/entity.ts` — **fill every `[…]` before publishing** |
| Product tour text + screenshot list | `src/product-copy.ts` (sections, captions) and `src/product-points.ts` (detail bullets) |
| Colours, type, layout | `src/styles.css` (tokens at the top; dark mode redefines the same tokens) |
| Pages and their routes, one page per goal | `src/route.ts`: home (sells the product), `#/features`, `#/editions` (and `#/editions/<edition>`), `#/digitalization`, `#/pricing`, `#/morocco`, `#/europe`, `#/security`, `#/faq`, `#/demo`, `#/legal/<doc>`; each takes an optional `/<section>`. Old links (`#/country`, `#contact`, `#prices`, `#stories`, `#digital-health`, `#faq`) open the page that now holds them, so outside links keep working. Page heads and the home's "digitize everything", explorer and closing call to action: `src/Routes.tsx`, copy in `src/routes-copy.ts` |
| Copy for nav, home highlights, privacy band and the Security page, 3 languages | `src/pages-copy.ts` |
| Photos | `public/photos/*.webp` (900 and 1600 px). Real photos from Unsplash under the Unsplash License: D Dental Office (dentist and patient), Quang Tri NGUYEN (tablet consultation), Jonathan Borba (X-ray review), Benyamin Bohlouli (clinic room), Cdn Pages (dental team), Quang Tri NGUYEN (dental scan, also used on sifralabs.com). No AI-generated images |
| Link to the company site, contact e-mail | `src/config.ts` (`COMPANY_URL`, `CONTACT_EMAIL`). The company site itself is `../sifralabs/` |

Design rationale: `docs/launch/03-website-design-plan.md`. Claims must stay within what the app does today: features not shipped yet are listed under "En préparation".

## Screenshots and documents

`public/product/*.webp` are real captures of the desktop app (French UI, demo practice in MAD), at 1800 and 1000 px. `public/documents/` holds the Moroccan PDFs (French and Arabic) issued by the app's own sample tests (`crates/shared/medoc-core/tests/moroccan_invoice_samples.rs`, written to `$MEDOC_PDF_SAMPLE_DIR`), rendered to WebP. Patients and practices are fictitious.

To re-capture the app: run it with `MEDOC_DEV_SEED=1`, sign in with the demo accounts and use the dev capture bridge (dev builds only). Wait for the page fade-in before each capture, or the content area comes out blank. Check every file by eye before publishing.

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/website.yml`).
