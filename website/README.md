# MeDoc product website

Standalone marketing site for **MeDoc**. It is **not** in the root npm workspace (so `npm test` / CI stay on the desktop app).

## Run

```bash
# from the repo root
npm run dev:website          # http://127.0.0.1:4173

# or
cd website && npm run dev
```

## What this is

- Single-page site: hero → problem → how it works → features (interactive mockups) → backends → RBAC table → compliance mechanisms → walkthrough CTA.
- Visual language from `apps/practice-host-ui/src/index.css` (accent `#0EA07E`, Inter, light/dark).
- Claims constrained by `website/AUDIT.md`. No invented metrics or cloud regions.

## Sitemap

1. `#top` Hero  
2. `#problem` Field problem  
3. `#how` Solution bridge  
4. `#features` Dashboard, calendar (drag), chart, tasks, finance  
5. `#backends` Desktop / LAN / peer / company portal  
6. `#security` PHYSICIAN vs RECEPTION  
7. `#compliance` Mechanism list  
8. `#contact` Mailto walkthrough request  

## Intentionally not claimed

Managed EU patient hosting, MDR CE mark, live TAX_ADVISOR role, company portal as production billing SaaS, hours-saved statistics.
