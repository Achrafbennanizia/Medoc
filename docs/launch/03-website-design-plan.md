# MeDoc website — design plan

**Date:** 2026-11-22 · **Code:** `website/` (Vite + React + TypeScript, no UI framework)

## 1. What the site must do

1. Make a Moroccan dentist understand in 10 seconds: *dental software, your data stays in your practice, in French and Arabic.*
2. Show the real product: the odontogram, the day at the practice, the privacy split between reception and dentist.
3. Show prices clearly (MAD and €, HT) and get a **demo request**, by form, e-mail or WhatsApp.
4. Be honest. Features that are not shipped yet are labelled "In preparation".

## 2. Audit of the old site (`website/` before this rebuild)

| Finding | Effect |
|---|---|
| All product screenshots are blank: sidebar only, empty content | Visitors see an empty app |
| Several screenshot files are mislabeled duplicates | Wrong captions |
| English only, German-market copy (BEMA/GOZ framing) | Wrong market |
| Technical vocabulary (backends, topologies, RBAC) | Speaks to engineers, not dentists |
| No pricing, no WhatsApp, no Arabic | Missing the 3 things a Moroccan buyer asks first |
| Vite config imported the whole practice app's CSS through aliases | Fragile build, slow |

## 3. Design tokens

### Colour

The brand green is taken from the app accent `#0EA07E` and darkened to pass AA contrast. The second accent is Majorelle blue: a Moroccan reference that is not the zellige cliché.

| Name | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F5F8F7` | `#0C1513` | Page |
| `--panel` | `#FFFFFF` | `#131F1C` | Cards, app mockups |
| `--ink` | `#13221E` | `#E4EEEA` | Text |
| `--ink-2` | `#4A5C57` | `#9DB1AB` | Secondary text |
| `--mint` | `#0B7F63` | `#3CCB9F` | Brand, primary buttons |
| `--majorelle` | `#3346C8` | `#8E9BFF` | Selection and highlight only (selected tooth, active toggle) |
| `--line` | `#D8E2DE` | `#24332F` | Borders |

### Type

- **Bricolage Grotesque** (display): headings, large numbers. Optical size, slightly irregular, warm but precise.
- **IBM Plex Sans + IBM Plex Sans Arabic** (text): the same family covers Latin and Arabic, so FR and AR pages look like one brand.
- Scale (1.25): 14 / 16 / 20 / 25 / 31 / 39 / 61 px. Body line-height 1.6 (1.8 in Arabic). Measure ≤ 68 ch.
- No all-caps labels, no eyebrows above headings, no "→" on buttons.

### Layout

Content is start-aligned: left in LTR, right in Arabic, using CSS logical properties everywhere. 1180 px max width, 16 px gutter on phones.

```
┌ nav: logo · Product · Privacy · Prices · FAQ ·········· FR AR EN DE · ☾ · [Book a demo] ┐
│ HERO  h1 + one sentence + 2 buttons          │  LIVE ODONTOGRAM (click a tooth)        │
│ three short facts (offline · encrypted · 4 languages)                                  │
├ A DAY AT THE PRACTICE: real sequence 08:30 → 19:00, each step with a mini app panel   ┤
├ PRIVACY: same patient, toggle "Reception view / Dentist view"                          ┤
├ WHERE YOUR DATA LIVES: 3 practice set-ups, drawn as small diagrams                     ┤
├ MOROCCO: available now vs in preparation (honest list)                                 ┤
├ PRICES: 3 licenses + 3 service plans, MAD/€ switch, HT stated                          ┤
├ FAQ (details/summary)                                                                  ┤
├ DEMO FORM + WhatsApp + e-mail                                                          ┤
└ footer: legal links, languages                                                         ┘
```

### The one bold element

**The interactive odontogram in the hero.** 32 teeth in FDI numbering. Clicking a tooth shows its status, the way the dentist sees it in MeDoc. It is the most characteristic object in dentistry and it proves the product is real. Everything else stays quiet.

### Motion

One moment only: in the hero, the odontogram teeth that hold findings fade in their status colour after load. Users with reduced motion get the final state immediately. Interaction feedback (toggle, tooth select) uses 150 ms transitions.

## 4. Features

- **4 languages:** FR (default for Morocco), AR (RTL), EN, DE. Chosen from the browser on the first visit, remembered afterwards, reachable by `?lang=ar`. `<html lang dir>` is updated.
- **Light/dark:** follows the system by default; the toggle is remembered. All colours are tokens, so dark mode is complete.
- **Currency switch** in the price section: MAD (default for FR/AR) or €.
- **Accessible:** visible focus, `aria-pressed` on toggles, the odontogram is keyboard-operable (each tooth is a button with a label), `prefers-reduced-motion` respected, AA contrast checked in both themes.

## 5. Before publishing (owner actions)

1. Set the real e-mail and WhatsApp number in `website/src/config.ts`. It currently points to the reserved `example.com`.
2. Have a native speaker review the Arabic and German copy.
3. Write the legal pages (mentions légales, privacy policy, CGV). The footer links point at anchors until then.
4. Re-capture real screenshots (gap G-07). The site uses faithful HTML recreations of the app screens meanwhile.
