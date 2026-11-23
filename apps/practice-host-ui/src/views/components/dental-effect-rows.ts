import { DENTAL_STATUS_KEYS, dentalStatusesCompatible, type DentalStatusKey } from "@/lib/dental";

export type DentalEffectRow = { id: string; marks: DentalStatusKey[] };

/**
 * One row per status, then every pair the chart accepts on one tooth (same rules as a click on
 * the chart: `toggleDentalStatus`). Healthy does not stack; missing pairs only with planned and
 * implant; an implant and a root fracture exclude each other.
 */
export function dentalEffectRows(): DentalEffectRow[] {
    const singles: DentalEffectRow[] = DENTAL_STATUS_KEYS.map((key) => ({ id: key, marks: [key] }));
    const keys = DENTAL_STATUS_KEYS.filter((k) => k !== "healthy");
    const pairs: DentalEffectRow[] = [];
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const marks = [keys[i]!, keys[j]!];
            if (dentalStatusesCompatible(marks)) pairs.push({ id: marks.join("+"), marks });
        }
    }
    return [...singles, ...pairs];
}
