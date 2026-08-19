/**
 * Visibility of sensitive practice lines for preview, export and invoice PDF.
 * Stored in localStorage (like master data) — applies immediately to new prints/exports.
 */

export type PracticeHeaderPrivacyKey =
    | "tel"
    | "fax"
    | "email"
    | "web"
    | "kv"
    | "ust"
    | "steuer"
    | "oz"
    | "clinician"
    | "zanr"
    | "bsnr"
    | "bank";

export type PracticeHeaderPrivacyV1 = Record<PracticeHeaderPrivacyKey, boolean>;

export const DEFAULT_PRACTICE_HEADER_PRIVACY: PracticeHeaderPrivacyV1 = {
    tel: true,
    fax: true,
    email: true,
    web: true,
    kv: true,
    ust: true,
    steuer: true,
    oz: true,
    clinician: true,
    zanr: true,
    bsnr: true,
    bank: true,
};

const LS_KEY = "medoc-practice-header-privacy-v1";

/** Replaces plaintext with same-length placeholders (PDF / preview). */
export function maskPracticeExportToken(raw: string): string {
    const n = Math.min(Math.max(raw.trim().length, 5), 28);
    return "·".repeat(n);
}

export function loadPracticeHeaderPrivacy(): PracticeHeaderPrivacyV1 {
    if (typeof globalThis.window === "undefined" || globalThis.localStorage == null) {
        return { ...DEFAULT_PRACTICE_HEADER_PRIVACY };
    }
    try {
        const raw = globalThis.localStorage.getItem(LS_KEY);
        if (!raw?.trim()) return { ...DEFAULT_PRACTICE_HEADER_PRIVACY };
        const j = JSON.parse(raw) as Partial<PracticeHeaderPrivacyV1>;
        return { ...DEFAULT_PRACTICE_HEADER_PRIVACY, ...j };
    } catch {
        return { ...DEFAULT_PRACTICE_HEADER_PRIVACY };
    }
}

export function savePracticeHeaderPrivacy(p: PracticeHeaderPrivacyV1): void {
    if (typeof globalThis.window === "undefined" || globalThis.localStorage == null) return;
    try {
        globalThis.localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
        /* ignore quota */
    }
}
