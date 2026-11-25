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
| Pages | `index.html`, `products/`, `security/`, `company/`, `contact/`, `legal/notice/`, `legal/privacy/`, `404.html`. New page: add it to `pages` in `vite.config.ts` and to `public/sitemap.xml` |
| Shared header, footer, contact block, core diagram | `partials/*.html`, pulled in with `<!-- @include name -->` |
| Colours, type, layout | `src/site.css` (tokens at the top, dark mode redefines them) |
| Logo, icons | `public/sifra-mark*.svg`, `public/favicon.svg`. PNGs (`favicon-32`, `apple-touch-icon`, `icon-512`, `og`) are rendered from `brand-src/*.html` with headless Chrome |
| Security contact | `public/.well-known/security.txt`. **Renew `Expires` before 2027-11-01** |
| Response headers (CSP, HSTS…) | `public/_headers` (Cloudflare Pages format). If you add analytics or any outside script, add its origin to the CSP |
| Legal notice | `legal/notice/index.html`. **Fill every `[…]` once the company is registered** |

| Command menu (⌘K / Ctrl+K or "/") | `partials/cmdk.html` (entries), `src/main.ts` (behaviour) |
| Statistics on the home page | `index.html` "By the numbers"; every outside figure has a numbered source under it. Update the IBM figure each summer when the new report comes out |
| Page prerendering | Speculation rules in `partials/head.html`; the CSP in `public/_headers` allows them with `'inline-speculation-rules'` |
| Links to MeDoc | `https://achrafbennanizia.github.io/Medoc/` (its live address). Switch to `https://medoc.sifralabs.com/` once that domain is set up (see below) |

Art direction: blueprint grid and dot-matrix texture on a Swiss editorial layout (`src/site.css`, "Art direction"). Keep it to those two textures.

Claims must stay true to the current release: anything not shipped is labelled "planned" or "research".

## Deploy on Cloudflare (free)

The site deploys as a Worker with static assets; `wrangler.jsonc` holds the config, `public/_headers` the security headers.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick the repo.
2. Settings:
   - Project name: `sifralabs` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Root directory: `sifralabs`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
   (`.node-version` pins Node 22.)
3. After the first deploy: **Settings → Domains & Routes → Add → Custom domain** → `sifralabs.com`, then `www.sifralabs.com`.

## MeDoc at medoc.sifralabs.com

The site links to `https://medoc.sifralabs.com/`. The MeDoc site (`../website`) is on GitHub Pages; to move it there:

1. Cloudflare DNS → add `CNAME` `medoc` → `<your-github-user>.github.io`, **DNS only** (grey cloud).
2. GitHub repo → **Settings → Pages → Custom domain** → `medoc.sifralabs.com` → Save, then tick **Enforce HTTPS** when offered.
3. In `../website/vite.config.ts`, change `base` to `"/"` (the site no longer lives under `/Medoc/`), commit and push.
