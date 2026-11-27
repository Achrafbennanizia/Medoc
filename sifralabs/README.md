# sifralabs.com

Company website for **Sifra Labs**. Static, English, no cookies, no third-party requests. Brand rules: [`../docs/brand/brand-strategy.md`](../docs/brand/brand-strategy.md).

## Run

```bash
cd sifralabs
npm ci
npm run dev      # http://127.0.0.1:4180
npm run build    # type-check + build → dist/
```

## Edit

| What | Where |
|---|---|
| Pages | One page per goal. `index.html` is the **Digitalization Pack** (main page / “Go digital”); `services/` what we build; `work/` case studies; `medoc/` the MeDoc series; `news/`, `security/`, `about/`, `contact/`, `legal/…`, `404.html`. Hard product marketing lives on the MeDoc Dentist site. New page: add it to `pages` in `vite.config.ts`, `PAGES` in `i18n/build.mjs` and `public/sitemap.xml` |
| Translations | `i18n/{fr,ar,de}.json`, keyed by the English text. `npm run build` warns about any string without a translation |
| Photos | `public/img/*.webp` (900 and 1600 px). Real photos under the Unsplash License: Cherrydeck (team-laptop), Compagnons (code-screens), BaljkanN4 (support), Vitaly Gariev (doctor-phone, team-office), Quang Tri NGUYEN (dental-scan), plus the earlier set. No AI-generated images |
| Shared header, footer, contact block, core diagram | `partials/*.html`, pulled in with `<!-- @include name -->` |
| Colours, type, layout | `src/styles/*.css`, one file per area (tokens in `01-tokens-base-nav.css`, dark mode redefines them; blocks from the 2026-11 rebuild in 09-11), imported in order by `src/main.ts`; each file stays under 400 lines |
| Logo, icons | `public/sifra-mark*.svg`, `public/favicon.svg`. PNGs (`favicon-32`, `apple-touch-icon`, `icon-512`, `og`) are rendered from `brand-src/*.html` with headless Chrome |
| Security contact | `public/.well-known/security.txt`. **Renew `Expires` before 2027-11-01** |
| Response headers (CSP, HSTS…) | `public/_headers` (Cloudflare Pages format). If you add analytics or any outside script, add its origin to the CSP |
| Legal notice | `legal/notice/index.html`. **Fill every `[…]` once the company is registered** |

| Command menu (⌘K / Ctrl+K or "/") | `partials/cmdk.html` (entries), `src/main.ts` (behaviour) |
| Statistics on the home page | `index.html` "By the numbers"; every outside figure has a numbered source under it. Update the IBM figure each summer when the new report comes out |
| Page prerendering | Speculation rules in `partials/head.html`; the CSP in `public/_headers` allows them with `'inline-speculation-rules'` |
| Links to MeDoc Dentist | `https://achrafbennanizia.github.io/Medoc/` on GitHub Pages. Switch to `https://medoc.sifralabs.com/` once that domain is set up (see below) |

Art direction: blueprint grid and dot-matrix texture on a Swiss editorial layout (`src/styles/05-paths-cta-photo.css`, "Art direction"). Keep it to those two textures.

Claims must stay true to the current release: anything not shipped is labelled "planned" or "research".

## Deploy (Cloudflare = official company site; GitHub Pages = MeDoc Dentist)

**GitHub Pages** (`.github/workflows/website.yml`) publishes **MeDoc Dentist** at `https://achrafbennanizia.github.io/Medoc/`.

**Cloudflare Worker** (`.github/workflows/sifralabs.yml`) deploys this company site to Worker **`sifralabs-site`** (must match `name` in `wrangler.jsonc` and the CF project) when these exist:

- `CLOUDFLARE_API_TOKEN` — Workers edit permission for this account
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account id (repo variable)

Until those are set, the Cloudflare deploy job is skipped; Pages still ships the site from git.

Manual / first-time Cloudflare path:

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick the repo.
2. Settings:
   - Project name: **`sifralabs-site`** (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Root directory: `sifralabs`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   (`.node-version` pins Node 22.)
3. After the first deploy: **Settings → Domains & Routes → Add → Custom domain** → `sifralabs.com`, then `www.sifralabs.com`.
4. **Email Sending** (dashboard → Email → Email Sending): onboard `sifralabs.com`, then ensure `website@sifralabs.com` can send. The Worker uses the `EMAIL` `send_email` binding to deliver to `contact@sifralabs.com`.

**Contact forms** (company + MeDoc Dentist) both `POST` to the Worker at `https://sifralabs.com/api/contact` (Cloudflare Email Sending → `contact@sifralabs.com`). Override at build time with `CONTACT_API` (sifralabs) or `VITE_CONTACT_API` (website). Mailto is only the offline fallback.

**Local contact API** (stub; production uses Cloudflare Email Sending):

```bash
cd sifralabs && npm run contact:dev   # http://127.0.0.1:8787/api/contact
CONTACT_API=http://127.0.0.1:8787/api/contact npm run build   # bake local API into the company form
cd website && VITE_CONTACT_API=http://127.0.0.1:8787/api/contact npm run build && npm run preview
```

## MeDoc Dentist at medoc.sifralabs.com (not set up yet)

Until that domain is live, product links use `https://achrafbennanizia.github.io/Medoc/`. To cut over:

1. Cloudflare DNS → add `CNAME` `medoc` → `<your-github-user>.github.io`, **DNS only** (grey cloud).
2. GitHub repo → **Settings → Pages → Custom domain** → `medoc.sifralabs.com` → Save, then tick **Enforce HTTPS** when offered.
3. Point product `base` and `PRODUCT_SITE_ORIGIN` at the new host; update links in this site.
