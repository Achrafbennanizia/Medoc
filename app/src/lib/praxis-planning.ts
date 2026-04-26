import { getAppKv, setAppKv } from "../controllers/app-kv.controller";

/**
 * Browser-side cache key. The authoritative store is the backend `app_kv`
 * table under the same key (see `praxis.arbeitszeiten.v1` in
 * {@link app-kv.controller.ts}); localStorage is only a synchronous fast-path
 * so existing components can keep their sync `read…` helpers.
 */
export const PRAXIS_ARBEITSZEITEN_LS_KEY = "medoc-praxis-arbeitszeiten-v1";
const PRAXIS_KV_KEY = "praxis.arbeitszeiten.v1" as const;

export const PRAXIS_DAY_KEYS = ["mo", "di", "mi", "do", "fr", "sa", "so"] as const;
export type PraxisDayKey = (typeof PRAXIS_DAY_KEYS)[number];

export type PraxisDayPlan = {
    aktiv: boolean;
    /** Multiple working windows per day (e.g. 08:00-12:00 + 14:00-18:00). */
    segments: Array<{ from: string; to: string }>;
};

export type PraxisClosureMode = "FULL_DAY" | "CUSTOM";

export type PraxisClosureRule = {
    id: string;
    date: string; // yyyy-MM-dd
    mode: PraxisClosureMode;
    /** For CUSTOM mode: one or more blocked periods within the day. */
    periods?: Array<{ from: string; to: string }>;
    reason?: string;
};

export type PraxisArbeitszeitenConfig = {
    plan: Record<PraxisDayKey, PraxisDayPlan>;
    pauseVon: string;
    pauseBis: string;
    slotMin: string;
    closures: PraxisClosureRule[];
};

const DEFAULT_PLAN: Record<PraxisDayKey, PraxisDayPlan> = {
    mo: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    di: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    mi: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    do: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    fr: { aktiv: true, segments: [{ from: "08:00", to: "15:00" }] },
    sa: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
    so: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
};

const DEFAULT_CFG: PraxisArbeitszeitenConfig = {
    plan: DEFAULT_PLAN,
    pauseVon: "12:30",
    pauseBis: "13:30",
    slotMin: "30",
    closures: [],
};

function parseConfigBlob(raw: string | null | undefined): PraxisArbeitszeitenConfig {
    try {
        if (!raw) return DEFAULT_CFG;
        const parsed = JSON.parse(raw) as {
            plan?: Record<string, { aktiv?: boolean; von?: string; bis?: string; segments?: Array<{ from: string; to: string }> }>;
            pauseVon?: string;
            pauseBis?: string;
            slotMin?: string;
            closures?: Array<{
                id: string;
                date: string;
                mode?: string;
                periods?: Array<{ from: string; to: string }>;
                from?: string;
                to?: string;
                reason?: string;
            }>;
        };
        const mergedPlan = { ...DEFAULT_PLAN } as Record<PraxisDayKey, PraxisDayPlan>;
        for (const key of PRAXIS_DAY_KEYS) {
            const p = parsed.plan?.[key];
            if (!p) continue;
            const legacySeg =
                p.von && p.bis
                    ? [{ from: p.von, to: p.bis }]
                    : undefined;
            mergedPlan[key] = {
                aktiv: p.aktiv ?? mergedPlan[key].aktiv,
                segments: (p.segments && p.segments.length ? p.segments : legacySeg ?? mergedPlan[key].segments)
                    .filter((s) => s.from && s.to && s.from < s.to),
            };
        }
        const closures = (parsed.closures ?? []).map((c) => {
            if (c.mode === "FULL_DAY") return { ...c, mode: "FULL_DAY" as const, periods: [] };
            if (c.mode === "CUSTOM") {
                const periods =
                    c.periods && c.periods.length
                        ? c.periods
                        : (c.from && c.to ? [{ from: c.from, to: c.to }] : []);
                return { ...c, mode: "CUSTOM" as const, periods: periods.filter((p) => p.from && p.to && p.from < p.to) };
            }
            // legacy MORNING / EVENING fallback
            if (c.mode === "MORNING") return { ...c, mode: "CUSTOM" as const, periods: [{ from: "00:00", to: "12:00" }] };
            if (c.mode === "EVENING") return { ...c, mode: "CUSTOM" as const, periods: [{ from: "12:00", to: "23:59" }] };
            return { ...c, mode: "FULL_DAY" as const, periods: [] };
        });
        return {
            plan: mergedPlan,
            pauseVon: parsed.pauseVon ?? DEFAULT_CFG.pauseVon,
            pauseBis: parsed.pauseBis ?? DEFAULT_CFG.pauseBis,
            slotMin: parsed.slotMin ?? DEFAULT_CFG.slotMin,
            closures,
        };
    } catch {
        return DEFAULT_CFG;
    }
}

/**
 * Synchronous reader backed by `localStorage` (fast UX). Refreshed by
 * {@link loadPraxisArbeitszeitenConfig} when the page mounts so the cache
 * stays in sync with the SQLite source of truth.
 */
export function readPraxisArbeitszeitenConfig(): PraxisArbeitszeitenConfig {
    try {
        return parseConfigBlob(localStorage.getItem(PRAXIS_ARBEITSZEITEN_LS_KEY));
    } catch {
        return DEFAULT_CFG;
    }
}

/**
 * Authoritative read from the backend `app_kv` row; falls back to the
 * localStorage cache (and finally the defaults) when the backend is
 * unreachable. Updates the localStorage cache so subsequent synchronous
 * reads return the freshest config.
 */
export async function loadPraxisArbeitszeitenConfig(): Promise<PraxisArbeitszeitenConfig> {
    try {
        const raw = await getAppKv(PRAXIS_KV_KEY);
        if (raw) {
            try { localStorage.setItem(PRAXIS_ARBEITSZEITEN_LS_KEY, raw); } catch { /* ignore */ }
            return parseConfigBlob(raw);
        }
    } catch {
        // backend unreachable — fall through to cache
    }
    return readPraxisArbeitszeitenConfig();
}

/**
 * Persist the config in SQLite (authoritative) and refresh the localStorage
 * cache so existing synchronous readers see the change immediately.
 */
export async function savePraxisArbeitszeitenConfig(cfg: PraxisArbeitszeitenConfig): Promise<void> {
    const blob = JSON.stringify(cfg);
    try { localStorage.setItem(PRAXIS_ARBEITSZEITEN_LS_KEY, blob); } catch { /* ignore */ }
    await setAppKv(PRAXIS_KV_KEY, blob);
}

function hmToMinutes(hm: string): number {
    const [h, m] = hm.split(":").map((n) => Number(n));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function dayKeyFromIsoDate(iso: string): PraxisDayKey {
    const d = new Date(`${iso}T00:00:00`);
    const js = d.getDay(); // 0..6 Sun..Sat
    const map: PraxisDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];
    return map[js] ?? "mo";
}

function inRange(hm: string, from: string, to: string): boolean {
    const v = hmToMinutes(hm);
    return v >= hmToMinutes(from) && v < hmToMinutes(to);
}

export function isSlotBlockedByPraxisConfig(cfg: PraxisArbeitszeitenConfig, isoDate: string, hm: string): boolean {
    const day = cfg.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.aktiv) return true;
    const inAnyWorkSegment = (day.segments ?? []).some((s) => inRange(hm, s.from, s.to));
    if (!inAnyWorkSegment) return true;
    if (cfg.pauseVon && cfg.pauseBis && inRange(hm, cfg.pauseVon, cfg.pauseBis)) return true;

    const rules = cfg.closures.filter((r) => r.date === isoDate);
    for (const r of rules) {
        if (r.mode === "FULL_DAY") return true;
        if (r.mode === "CUSTOM" && (r.periods ?? []).some((p) => inRange(hm, p.from, p.to))) return true;
    }
    return false;
}

export function hasAnyAvailableSlot(cfg: PraxisArbeitszeitenConfig, isoDate: string): boolean {
    const step = Math.max(5, Number(cfg.slotMin) || 30);
    for (let h = 6; h <= 21; h += 1) {
        for (let m = 0; m < 60; m += step) {
            if (h === 21 && m > 0) break;
            const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            if (!isSlotBlockedByPraxisConfig(cfg, isoDate, hm)) return true;
        }
    }
    return false;
}
