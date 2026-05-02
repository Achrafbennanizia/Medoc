import { tauriInvoke } from "@/services/tauri.service";
import type { VertragItem } from "@/lib/vertrag-domain";

export type VertragDto = {
    id: string;
    bezeichnung: string;
    partner: string;
    betrag: number;
    intervall: string;
    unbefristet: boolean;
    periode_von: string | null;
    periode_bis: string | null;
    created_at: string;
};

function dtoToItem(d: VertragDto): VertragItem {
    return {
        id: d.id,
        bezeichnung: d.bezeichnung,
        partner: d.partner,
        betrag: d.betrag,
        intervall: d.intervall as VertragItem["intervall"],
        unbefristet: d.unbefristet,
        periodeVon: d.periode_von,
        periodeBis: d.periode_bis,
        createdAt: d.created_at,
    };
}

function itemToDto(v: VertragItem): VertragDto {
    return {
        id: v.id,
        bezeichnung: v.bezeichnung,
        partner: v.partner,
        betrag: v.betrag,
        intervall: v.intervall,
        unbefristet: v.unbefristet,
        periode_von: v.periodeVon,
        periode_bis: v.periodeBis,
        created_at: v.createdAt,
    };
}

export async function listVertraegeFromBackend(): Promise<VertragItem[]> {
    const rows = await tauriInvoke<VertragDto[]>("list_vertraege");
    return rows.map(dtoToItem);
}

export async function upsertVertragOnBackend(v: VertragItem): Promise<void> {
    await tauriInvoke<void>("upsert_vertrag", { data: itemToDto(v) });
}

export async function deleteVertragOnBackend(id: string): Promise<void> {
    await tauriInvoke<void>("delete_vertrag", { id });
}

const LEGACY_LS_KEY = "medoc-vertraege-v1";

/** One-time migration from local demo storage. */
export async function migrateLegacyVertraegeFromLocalStorageOnce(): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage) return;
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(LEGACY_LS_KEY);
    } catch {
        return;
    }
    if (!raw?.trim()) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    const backend = await listVertraegeFromBackend();
    if (backend.length > 0) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    for (const x of parsed) {
        if (x == null || typeof x !== "object") continue;
        const o = x as Record<string, unknown>;
        if (typeof o.id !== "string" || typeof o.bezeichnung !== "string") continue;
        const item: VertragItem = {
            id: o.id,
            bezeichnung: o.bezeichnung,
            partner: typeof o.partner === "string" ? o.partner : "",
            betrag: typeof o.betrag === "number" ? o.betrag : 0,
            intervall: (typeof o.intervall === "string" ? o.intervall : "MONAT") as VertragItem["intervall"],
            unbefristet: Boolean(o.unbefristet),
            periodeVon: typeof o.periodeVon === "string" ? o.periodeVon : null,
            periodeBis: typeof o.periodeBis === "string" ? o.periodeBis : null,
            createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
        };
        try {
            await upsertVertragOnBackend(item);
        } catch {
            return;
        }
    }
    try {
        localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
        /* ignore */
    }
}

export function stripLegacyVertraegeLocalStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
        localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
        /* ignore */
    }
}
