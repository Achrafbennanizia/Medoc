import { deleteAppKvRaw, getAppKvRaw, setAppKvRaw } from "@/systems/practice-host/controllers/app-kv.controller";

/** SQLite `app_kv` key — mirrors `app_kv_policy::APPOINTMENT_DRAFT_PREFIX`. */
export const APPOINTMENT_DRAFT_KV_PREFIX = "appointment.draft.v1." as const;

const LEGACY_LS_PREFIX = "medoc-appointment-draft-";

export type AppointmentDraft = {
    date: string;
    time: string;
    patientId: string;
    patientQuery: string;
    physicianId: string;
    kind: string;
    chiefComplaintTags: string[];
    toothacheTeeth?: string[];
    toothacheTooth?: string | null;
    notes: string;
    durationMin: string;
    statusPreference: string;
};

export function appointmentDraftKvKey(draftId: string): string {
    return `${APPOINTMENT_DRAFT_KV_PREFIX}${draftId.trim()}`;
}

function legacyLsKey(draftId: string): string {
    return `${LEGACY_LS_PREFIX}${draftId}`;
}

function parseDraft(raw: string | null): AppointmentDraft | null {
    if (!raw) return null;
    try {
        const d = JSON.parse(raw) as Partial<AppointmentDraft>;
        if (!d || typeof d !== "object") return null;
        return {
            date: typeof d.date === "string" ? d.date : "",
            time: typeof d.time === "string" ? d.time : "",
            patientId: typeof d.patientId === "string" ? d.patientId : "",
            patientQuery: typeof d.patientQuery === "string" ? d.patientQuery : "",
            physicianId: typeof d.physicianId === "string" ? d.physicianId : "",
            kind: typeof d.kind === "string" ? d.kind : "",
            chiefComplaintTags: Array.isArray(d.chiefComplaintTags)
                ? d.chiefComplaintTags.filter((x): x is string => typeof x === "string")
                : [],
            toothacheTeeth: Array.isArray(d.toothacheTeeth)
                ? d.toothacheTeeth.filter((x): x is string => typeof x === "string")
                : undefined,
            toothacheTooth: typeof d.toothacheTooth === "string"
                ? d.toothacheTooth
                : undefined,
            notes: typeof d.notes === "string" ? d.notes : "",
            durationMin: typeof d.durationMin === "string" ? d.durationMin : "",
            statusPreference: typeof d.statusPreference === "string"
                ? d.statusPreference
                : "",
        };
    } catch {
        return null;
    }
}

function loadLegacyDraftFromLocalStorage(draftId: string): AppointmentDraft | null {
    if (typeof window === "undefined" || !draftId) return null;
    try {
        return parseDraft(window.localStorage.getItem(legacyLsKey(draftId)));
    } catch {
        return null;
    }
}

export function stripLegacyAppointmentDraftLocalStorage(draftId: string): void {
    if (!draftId || typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(legacyLsKey(draftId));
    } catch {
        /* ignore */
    }
}

export async function getAppointmentDraftFromBackend(draftId: string): Promise<AppointmentDraft | null> {
    const id = draftId.trim();
    if (!id) return null;
    const raw = await getAppKvRaw(appointmentDraftKvKey(id));
    return parseDraft(raw);
}

export async function persistAppointmentDraftToBackend(draftId: string, snap: AppointmentDraft): Promise<void> {
    const id = draftId.trim();
    if (!id) return;
    await setAppKvRaw(appointmentDraftKvKey(id), JSON.stringify(snap));
}

export async function clearAppointmentDraftFromBackend(draftId: string): Promise<void> {
    const id = draftId.trim();
    if (!id) return;
    try {
        await deleteAppKvRaw(appointmentDraftKvKey(id));
    } catch {
        /* ignore */
    }
}

/** Load from `app_kv`, migrating legacy `localStorage` once when the row is empty. */
export async function loadAppointmentDraftWithMigration(draftId: string): Promise<AppointmentDraft | null> {
    const id = draftId.trim();
    if (!id) return null;
    const fromDb = await getAppointmentDraftFromBackend(id);
    if (fromDb) {
        return fromDb;
    }
    const legacy = loadLegacyDraftFromLocalStorage(id);
    if (legacy) {
        await persistAppointmentDraftToBackend(id, legacy);
        stripLegacyAppointmentDraftLocalStorage(id);
        return legacy;
    }
    return null;
}
