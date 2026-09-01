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
    | "vat"
    | "tax"
    | "hours"
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
    vat: true,
    tax: true,
    hours: true,
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

export function parsePracticeHeaderPrivacyJson(j: Record<string, unknown>): PracticeHeaderPrivacyV1 {
    const out: PracticeHeaderPrivacyV1 = { ...DEFAULT_PRACTICE_HEADER_PRIVACY };
    (Object.keys(DEFAULT_PRACTICE_HEADER_PRIVACY) as PracticeHeaderPrivacyKey[]).forEach((key) => {
        const english = j[key];
        if (typeof english === "boolean") out[key] = english;
    });
    return out;
}

export function loadPracticeHeaderPrivacy(): PracticeHeaderPrivacyV1 {
    if (typeof globalThis.window === "undefined" || globalThis.localStorage == null) {
        return { ...DEFAULT_PRACTICE_HEADER_PRIVACY };
    }
    try {
        const raw = globalThis.localStorage.getItem(LS_KEY);
        if (!raw?.trim()) return { ...DEFAULT_PRACTICE_HEADER_PRIVACY };
        return parsePracticeHeaderPrivacyJson(JSON.parse(raw) as Record<string, unknown>);
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
