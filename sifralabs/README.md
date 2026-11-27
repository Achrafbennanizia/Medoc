# sifralabs.com

Company website for **Sifra Labs**. Static, English, no cookies, no third-party requests. Brand rules: [`../docs/brand/brand-strategy.md`](../docs/brand/brand-strategy.md).

## Run

```bash
cd sifralabs
npm ci
npm run dev      # http://127.0.0.1:4180
npm run build      # company site only: type-check + build → dist/
npm run build:all  # company site + MeDoc Dentist in dist/products/medoc-dentist/ (what deploys)
```

## Edit

| What | Where |
|---|---|
| Pages | One page per goal. `index.html` is the company home (who we are, what we build); `digitalization/` the Digitalization Pack (“Go digital”); `services/` what we build; `work/` case studies; `medoc/` the MeDoc series; `news/`, `security/`, `about/`, `contact/`, `legal/…`, `404.html`. Hard product marketing lives on the MeDoc Dentist site. New page: add it to `pages` in `vite.config.ts`, `PAGES` in `i18n/build.mjs` and `public/sitemap.xml` |
| Translations | `i18n/{fr,ar,de}.json`, keyed by the English text. `npm run build` warns about any string without a translation |
| Photos | `public/img/*.webp` (900 and 1600 px). Unsplash: Cherrydeck (team-laptop), Compagnons (code-screens), BaljkanN4 (support), Vitaly Gariev (doctor-phone, team-office), Quang Tri NGUYEN (dental-scan), plus earlier set. Pexels: Ivan S (business-laptop), Iram Shehzad (office-desk), plus paper/clinic set. No AI-generated images |
| Shared header, footer, contact block, core diagram | `partials/*.html`, pulled in with `<!-- @include name -->` |
| Colours, type, layout | `src/styles/*.css`, one file per area (tokens in `01-tokens-base-nav.css`, dark mode redefines them; blocks from the 2026-11 rebuild in 09-11), imported in order by `src/main.ts`; each file stays under 400 lines |
| Logo, icons | `public/sifra-mark*.svg`, `public/favicon.svg`. PNGs (`favicon-32`, `apple-touch-icon`, `icon-512`, `og`) are rendered from `brand-src/*.html` with headless Chrome |
| Security contact | `public/.well-known/security.txt`. **Renew `Expires` before 2027-11-01** |
| Response headers (CSP, HSTS…) | `public/_headers` (Cloudflare Pages format). If you add analytics or any outside script, add its origin to the CSP |
| Legal notice | `legal/notice/index.html`. **Fill every `[…]` once the company is registered** |

| Command menu (⌘K / Ctrl+K or "/") | `partials/cmdk.html` (entries), `src/main.ts` (behaviour) |
| Statistics on the home page | `index.html` "By the numbers"; every outside figure has a numbered source under it. Update the IBM figure each summer when the new report comes out |
| Page prerendering | Speculation rules in `partials/head.html`; the CSP in `public/_headers` allows them with `'inline-speculation-rules'` |
| Links to MeDoc Dentist | Root-relative `/products/medoc-dentist/` (`PRODUCT_SITE` in `i18n/build.mjs`). `scripts/build-product.mjs` builds `../website` into that folder. The old `/dentist/` path redirects there (`public/_redirects`, plus `public/dentist/` for GitHub Pages) |

Art direction: blueprint grid and dot-matrix texture on a Swiss editorial layout (`src/styles/05-paths-cta-photo.css`, "Art direction"). Keep it to those two textures.

Claims must stay true to the current release: anything not shipped is labelled "planned" or "research".

## Deploy (Cloudflare = official company site; GitHub Pages = MeDoc Dentist)

**GitHub Pages** (`.github/workflows/website.yml`) runs `npm run build:all` with `SITE_BASE=/Medoc`: **Sifra Labs** at `https://achrafbennanizia.github.io/Medoc/` and **MeDoc Dentist** at `https://achrafbennanizia.github.io/Medoc/products/medoc-dentist/`.

**Cloudflare Worker** (`.github/workflows/sifralabs.yml`) deploys this company site to Worker **`sifralabs-site`** (must match `name` in `wrangler.jsonc` and the CF project) when these exist:

- `CLOUDFLARE_API_TOKEN` — secret (Workers edit + Account; limit to this account / `sifralabs.com` zone)
- `CLOUDFLARE_ACCOUNT_ID` — **repository variable** (not a secret); the workflow reads `vars.CLOUDFLARE_ACCOUNT_ID`

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh variable set CLOUDFLARE_ACCOUNT_ID --body "<your-account-id>"
```

Until those are set, the Cloudflare deploy job is skipped; Pages still ships the site from git.

### First Cloudflare setup

1. Create KV for confirm tokens, then paste the id into `wrangler.jsonc` → `kv_namespaces[0].id` (and `preview_id`):

   ```bash
   cd sifralabs && npx wrangler kv namespace create CONTACT_PENDING
   ```

2. Push or run `gh workflow run sifralabs.yml` to create/deploy Worker **`sifralabs-site`**.
3. **Turnstile secret** (never commit): Workers & Pages → `sifralabs-site` → Settings → Variables → Secret `TURNSTILE_SECRET_KEY`. Until set, the Worker skips Turnstile verification.
4. Domains & Routes → custom domains `sifralabs.com` and `www.sifralabs.com`.
5. Email → Email Sending: onboard `sifralabs.com`; sender `website@sifralabs.com` (also allow `welcome@` in the binding). Inbox: `contact@sifralabs.com`.

Public Turnstile **site** key is baked into builds (`0x4AAAAAAGWRuo3Zp4ZVJq6h`). CSP in `public/_headers` allows `challenges.cloudflare.com` (script, frame, connect) plus `style-src 'unsafe-inline'` for the widget.

**Contact forms** (company + MeDoc Dentist) both `POST` to `https://sifralabs.com/api/contact` → Turnstile → confirm e-mail → after the link, Email Sending → `contact@sifralabs.com`. Mailto is only the offline fallback.

**Local contact API** (stub; production uses Cloudflare Email Sending):

```bash
cd sifralabs && npm run contact:dev   # http://127.0.0.1:8787/api/contact
CONTACT_API=http://127.0.0.1:8787/api/contact npm run build   # bake local API into the company form
cd website && VITE_CONTACT_API=http://127.0.0.1:8787/api/contact npm run build && npm run preview
```

## MeDoc Dentist on the company domain

MeDoc Dentist is part of this site: `https://sifralabs.com/products/medoc-dentist/` on Cloudflare, `/Medoc/products/medoc-dentist/` on GitHub Pages. `npm run build:all` builds it with `PRODUCT_BASE=<SITE_BASE>/products/medoc-dentist/` and copies `../website/dist` there. The product derives the company link from that base, so no host is hard-coded. The CSP in `public/_headers` covers both sites.
