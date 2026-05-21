import { deleteAppKvRaw, getAppKvRaw, setAppKvRaw } from "@/controllers/app-kv.controller";

/** SQLite `app_kv` key — mirrors `app_kv_policy::TERMIN_DRAFT_PREFIX`. */
export const TERMIN_DRAFT_KV_PREFIX = "termin.draft.v1." as const;

const LEGACY_LS_PREFIX = "medoc-termin-draft-";

export type TerminDraft = {
    datum: string;
    uhrzeit: string;
    patientId: string;
    patientQuery: string;
    arztId: string;
    art: string;
    beschwerdenTags: string[];
    zahnschmerzenTeeth?: string[];
    /** @deprecated Draft key — migrated to zahnschmerzenTeeth */
    zahnschmerzenTooth?: string | null;
    notizen: string;
    dauerMin: string;
    statusWunsch: string;
};

export function terminDraftKvKey(draftId: string): string {
    return `${TERMIN_DRAFT_KV_PREFIX}${draftId.trim()}`;
}

function legacyLsKey(draftId: string): string {
    return `${LEGACY_LS_PREFIX}${draftId}`;
}

function parseDraft(raw: string | null): TerminDraft | null {
    if (!raw) return null;
    try {
        const d = JSON.parse(raw) as Partial<TerminDraft>;
        if (!d || typeof d !== "object") return null;
        return {
            datum: typeof d.datum === "string" ? d.datum : "",
            uhrzeit: typeof d.uhrzeit === "string" ? d.uhrzeit : "",
            patientId: typeof d.patientId === "string" ? d.patientId : "",
            patientQuery: typeof d.patientQuery === "string" ? d.patientQuery : "",
            arztId: typeof d.arztId === "string" ? d.arztId : "",
            art: typeof d.art === "string" ? d.art : "",
            beschwerdenTags: Array.isArray(d.beschwerdenTags)
                ? d.beschwerdenTags.filter((x): x is string => typeof x === "string")
                : [],
            zahnschmerzenTeeth: Array.isArray(d.zahnschmerzenTeeth)
                ? d.zahnschmerzenTeeth.filter((x): x is string => typeof x === "string")
                : undefined,
            zahnschmerzenTooth: typeof d.zahnschmerzenTooth === "string" ? d.zahnschmerzenTooth : undefined,
            notizen: typeof d.notizen === "string" ? d.notizen : "",
            dauerMin: typeof d.dauerMin === "string" ? d.dauerMin : "",
            statusWunsch: typeof d.statusWunsch === "string" ? d.statusWunsch : "",
        };
    } catch {
        return null;
    }
}

function loadLegacyDraftFromLocalStorage(draftId: string): TerminDraft | null {
    if (typeof window === "undefined" || !draftId) return null;
    try {
        return parseDraft(window.localStorage.getItem(legacyLsKey(draftId)));
    } catch {
        return null;
    }
}

export function stripLegacyTerminDraftLocalStorage(draftId: string): void {
    if (!draftId || typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(legacyLsKey(draftId));
    } catch {
        /* ignore */
    }
}

export async function getTerminDraftFromBackend(draftId: string): Promise<TerminDraft | null> {
    const id = draftId.trim();
    if (!id) return null;
    const raw = await getAppKvRaw(terminDraftKvKey(id));
    return parseDraft(raw);
}

export async function persistTerminDraftToBackend(draftId: string, snap: TerminDraft): Promise<void> {
    const id = draftId.trim();
    if (!id) return;
    await setAppKvRaw(terminDraftKvKey(id), JSON.stringify(snap));
}

export async function clearTerminDraftFromBackend(draftId: string): Promise<void> {
    const id = draftId.trim();
    if (!id) return;
    try {
        await deleteAppKvRaw(terminDraftKvKey(id));
    } catch {
        /* ignore */
    }
}

/** Load from `app_kv`, migrating legacy `localStorage` once when the row is empty. */
export async function loadTerminDraftWithMigration(draftId: string): Promise<TerminDraft | null> {
    const id = draftId.trim();
    if (!id) return null;
    const fromDb = await getTerminDraftFromBackend(id);
    if (fromDb) {
        return fromDb;
    }
    const legacy = loadLegacyDraftFromLocalStorage(id);
    if (legacy) {
        await persistTerminDraftToBackend(id, legacy);
        stripLegacyTerminDraftLocalStorage(id);
        return legacy;
    }
    return null;
}
