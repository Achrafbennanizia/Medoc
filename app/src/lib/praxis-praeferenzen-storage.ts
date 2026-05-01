/**
 * Termin-Puffer / Reminder / No-Show — authoritative copy in SQLite `app_kv`
 * (`praxis.preferences.v1`, field `terminPlanning`), same blob as Bestätigungs-Dialoge.
 * `localStorage` is a synchronous cache (aligned with {@link praxis-planning.ts}).
 */

import { getAppKv, setAppKv } from "@/controllers/app-kv.controller";
import {
    parsePraxisPreferencesV1,
    PRAXIS_PREFERENCES_KV_KEY,
} from "@/lib/confirmation-preferences";

export const PRAXIS_PRAEFERENZEN_LS_KEY = "medoc-praxis-praeferenzen-v1";

export type PraxisPraeferenzen = {
    pufferMin: string;
    notfallPuffer: string;
    reminder: string;
    noShow: string;
};

export const DEFAULT_PRAXIS_PRAEFERENZEN: PraxisPraeferenzen = {
    pufferMin: "5",
    notfallPuffer: "8",
    reminder: "24",
    noShow: "warn",
};

function clampNonNegativeIntString(raw: string | undefined, fallback: string): string {
    if (raw == null || raw === "") return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return String(n);
}

function normalizePartial(p: Partial<PraxisPraeferenzen> | undefined): PraxisPraeferenzen {
    return {
        pufferMin: clampNonNegativeIntString(
            p?.pufferMin != null ? String(p.pufferMin) : undefined,
            DEFAULT_PRAXIS_PRAEFERENZEN.pufferMin,
        ),
        notfallPuffer: clampNonNegativeIntString(
            p?.notfallPuffer != null ? String(p.notfallPuffer) : undefined,
            DEFAULT_PRAXIS_PRAEFERENZEN.notfallPuffer,
        ),
        reminder: p?.reminder != null && String(p.reminder).trim() !== ""
            ? String(p.reminder)
            : DEFAULT_PRAXIS_PRAEFERENZEN.reminder,
        noShow: p?.noShow != null && String(p.noShow).trim() !== ""
            ? String(p.noShow)
            : DEFAULT_PRAXIS_PRAEFERENZEN.noShow,
    };
}

/** Synchronous read from the local cache (defaults when missing). */
export function loadPraxisPraeferenzen(): PraxisPraeferenzen {
    try {
        const raw = localStorage.getItem(PRAXIS_PRAEFERENZEN_LS_KEY);
        if (!raw) return { ...DEFAULT_PRAXIS_PRAEFERENZEN };
        const p = JSON.parse(raw) as Partial<PraxisPraeferenzen>;
        return normalizePartial(p);
    } catch {
        return { ...DEFAULT_PRAXIS_PRAEFERENZEN };
    }
}

function writeLsCache(next: PraxisPraeferenzen): void {
    try {
        localStorage.setItem(PRAXIS_PRAEFERENZEN_LS_KEY, JSON.stringify(next));
    } catch {
        /* quota */
    }
}

async function writeKv(next: PraxisPraeferenzen): Promise<void> {
    const raw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
    const base = parsePraxisPreferencesV1(raw);
    await setAppKv(
        PRAXIS_PREFERENCES_KV_KEY,
        JSON.stringify({
            ...base,
            version: 1,
            terminPlanning: {
                pufferMin: next.pufferMin,
                notfallPuffer: next.notfallPuffer,
                reminder: next.reminder,
                noShow: next.noShow,
            },
        }),
    );
}

/**
 * Refresh cache from SQLite and persist legacy-only localStorage into KV once
 * when KV has no `terminPlanning` yet.
 */
export async function hydratePraxisPraeferenzenFromKv(): Promise<PraxisPraeferenzen> {
    try {
        const raw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
        const base = parsePraxisPreferencesV1(raw);
        const tp = base.terminPlanning;
        if (tp && (tp.pufferMin != null || tp.notfallPuffer != null || tp.reminder != null || tp.noShow != null)) {
            const merged = normalizePartial(tp as Partial<PraxisPraeferenzen>);
            writeLsCache(merged);
            return merged;
        }
    } catch {
        /* offline */
    }

    const legacy = loadPraxisPraeferenzen();
    try {
        await writeKv(legacy);
    } catch {
        /* offline — LS still holds values */
    }
    return legacy;
}

/** Updates LS immediately and persists to SQLite (awaits KV when online). */
export async function savePraxisPraeferenzen(next: PraxisPraeferenzen): Promise<void> {
    const normalized = normalizePartial(next);
    writeLsCache(normalized);
    await writeKv(normalized);
}
