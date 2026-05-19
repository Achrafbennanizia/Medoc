/**
 * Sichtbarkeit sensibler Praxis-Zeilen für Vorschau, Export und Rechnungs-PDF.
 * Gespeichert in localStorage (wie Stammdaten) — wirkt sofort auf neue Drucke/Exporte.
 */

export type PraxisHeaderPrivacyKey = "tel" | "fax" | "email" | "web" | "kv" | "ust" | "steuer" | "oz";

export type PraxisHeaderPrivacyV1 = Record<PraxisHeaderPrivacyKey, boolean>;

export const DEFAULT_PRAXIS_HEADER_PRIVACY: PraxisHeaderPrivacyV1 = {
    tel: true,
    fax: true,
    email: true,
    web: true,
    kv: true,
    ust: true,
    steuer: true,
    oz: true,
};

const LS_KEY = "medoc-praxis-header-privacy-v1";

/** Ersetzt den Klartext durch Platzhalter gleicher Länge (PDF / Vorschau). */
export function maskPraxisExportToken(raw: string): string {
    const n = Math.min(Math.max(raw.trim().length, 5), 28);
    return "·".repeat(n);
}

export function loadPraxisHeaderPrivacy(): PraxisHeaderPrivacyV1 {
    if (typeof globalThis.window === "undefined" || globalThis.localStorage == null) {
        return { ...DEFAULT_PRAXIS_HEADER_PRIVACY };
    }
    try {
        const raw = globalThis.localStorage.getItem(LS_KEY);
        if (!raw?.trim()) return { ...DEFAULT_PRAXIS_HEADER_PRIVACY };
        const j = JSON.parse(raw) as Partial<PraxisHeaderPrivacyV1>;
        return { ...DEFAULT_PRAXIS_HEADER_PRIVACY, ...j };
    } catch {
        return { ...DEFAULT_PRAXIS_HEADER_PRIVACY };
    }
}

export function savePraxisHeaderPrivacy(p: PraxisHeaderPrivacyV1): void {
    if (typeof globalThis.window === "undefined" || globalThis.localStorage == null) return;
    try {
        globalThis.localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
        /* ignore quota */
    }
}
