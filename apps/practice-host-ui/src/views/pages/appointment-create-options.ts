/** Appointment form options and chief-complaint tag parsing. */
import { parseToothacheTeethFromChiefComplaintPart, sortFdiTeeth, splitChiefComplaintParts } from "@/lib/dental";
import { APPOINTMENT_KIND_VALUES, APPOINTMENT_STATUS_VALUES, type AppointmentKind, type AppointmentStatus } from "../../models/types";

export const TREATMENT_OPTION_KEYS = [
    { value: "CHECKUP", labelKey: "appointment.create.kind.CHECKUP" },
    { value: "TREATMENT", labelKey: "appointment.create.kind.TREATMENT" },
    { value: "EXAMINATION", labelKey: "appointment.create.kind.EXAMINATION" },
    { value: "CONSULTATION", labelKey: "appointment.create.kind.CONSULTATION" },
    { value: "FIRST_VISIT", labelKey: "appointment.create.kind.FIRST_VISIT" },
] as const;

export const STATUS_OPTION_KEYS = [
    { value: "PLANNED", labelKey: "appointment.create.status.PLANNED" },
    { value: "CONFIRMED", labelKey: "appointment.create.status.CONFIRMED" },
] as const;

export const CHIEF_COMPLAINT_SUG_KEYS = [
    "appointment.create.chief_complaint.TOOTHACHE",
    "appointment.create.chief_complaint.TMJ",
    "appointment.create.chief_complaint.BLEEDING",
    "appointment.create.chief_complaint.SENSITIVITY",
    "appointment.create.chief_complaint.EMERGENCY",
    "appointment.create.chief_complaint.CHECKUP",
    "appointment.create.chief_complaint.AESTHETICS",
] as const;
export const TOOTHACHE_TAG = "Toothache";
export const TOOTHACHE_TAG_LEGACY = "Zahnschmerzen";

export function normalizeChiefComplaintTagsFromStored(raw: string): { tags: string[]; teeth: string[] } {
    const parts = splitChiefComplaintParts(raw);
    let teeth: string[] = [];
    const tags: string[] = [];
    for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        const z = parseToothacheTeethFromChiefComplaintPart(p);
        if (z) {
            teeth = z;
            if (!tags.includes(TOOTHACHE_TAG)) tags.push(TOOTHACHE_TAG);
            continue;
        }
        if (p === TOOTHACHE_TAG || p === TOOTHACHE_TAG_LEGACY) {
            if (!tags.includes(TOOTHACHE_TAG)) tags.push(TOOTHACHE_TAG);
            continue;
        }
        tags.push(p);
    }
    return { tags, teeth };
}

export function buildChiefComplaintPayload(tags: string[], toothacheTeeth: string[]): string {
    const zSorted = sortFdiTeeth(toothacheTeeth);
    return tags
        .map((t) => {
            if (t !== TOOTHACHE_TAG && t !== TOOTHACHE_TAG_LEGACY) return t;
            if (zSorted.length === 0) return TOOTHACHE_TAG;
            if (zSorted.length === 1) return `${TOOTHACHE_TAG} (tooth ${zSorted[0]})`;
            return `${TOOTHACHE_TAG} (teeth ${zSorted.join(", ")})`;
        })
        .join("; ");
}

export function normalizeKind(raw: string | null): AppointmentKind {
    if (!raw) return "CHECKUP";
    if (raw === "NOTFALL" || raw === "EMERGENCY") return "TREATMENT";
    if (raw === "ROUTINE") return "CHECKUP";
    const allowed = APPOINTMENT_KIND_VALUES as readonly string[];
    if (allowed.includes(raw)) return raw as AppointmentKind;
    return "CHECKUP";
}

export function normalizeStatus(raw: string | null | undefined): AppointmentStatus {
    if (raw && (APPOINTMENT_STATUS_VALUES as readonly string[]).includes(raw)) {
        return raw as AppointmentStatus;
    }
    return "PLANNED";
}
