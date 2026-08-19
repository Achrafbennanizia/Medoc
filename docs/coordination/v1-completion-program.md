# MeDoc v1 Completion Program

**Status:** active · **Decision 1:** HTTP serverless pairing for v1 (Geräteverbund stays flagged for v1.1).

**Standing rules:** One wave at a time; tests green before close; separate commits per activity; hide-don't-break via flags; update [`validation.md`](validation.md), [`actions.md`](actions.md), [`phase-handoff.md`](phase-handoff.md) after each wave.

## Waves

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Bootstrap this doc + actions Now | Done |
| 1 | Zero broken surfaces (flags + hide stubs) | Done |
| 2 | HTTP pairing + owner-only CA | Done |
| 3 | i18n DE/EN/FR/AR + RTL | Done |
| 4 | Arbeitszeit + Krankenbescheinigung | Done (MVP) |
| 5 | UI correctness (tables, calendar, NEW, PDF) | Partial — **Wave 3 owns calendar RTL/logical CSS**; Wave 5 content/compression only |
| 6 | Auth polish + update channel | Done (config) |
| 7 | Ship gate | Partial — tests green; live two-device NOT RUN |

## Already landed (do not re-do)

- MVP security: Break-Glass off, 2FA off, staff cap 1 PHYSICIAN + 4 RECEPTION — [`todos-deferred-security-features.md`](todos-deferred-security-features.md)

## Flag modules

- [`packages/shared/src/lib/v1-ui-flags.ts`](../../packages/shared/src/lib/v1-ui-flags.ts) — v1 surface blinds
- [`packages/shared/src/lib/settings-ui-flags.ts`](../../packages/shared/src/lib/settings-ui-flags.ts) — settings nav panels
- [`packages/shared/src/lib/integration-capabilities.ts`](../../packages/shared/src/lib/integration-capabilities.ts) — connector truth

## Re-enable checklists

- [`todos-deferred-v1-surfaces.md`](todos-deferred-v1-surfaces.md)
