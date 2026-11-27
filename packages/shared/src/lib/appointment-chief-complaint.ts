/**
 * Chief complaint of an appointment as tags, with the teeth of a toothache. Moved out of the
 * booking page (appointment-create.tsx) unchanged.
 */
import { parseToothacheTeethFromChiefComplaintPart, sortFdiTeeth, splitChiefComplaintParts } from "./dental";

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
