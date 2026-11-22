import { DENTAL_STATUS_KEYS, type DentalStatusKey } from "@/lib/dental";

const STACK: DentalStatusKey[] = ["caries", "filling", "crown", "root", "implant", "planned"];

export type DentalEffectRow = { id: string; marks: DentalStatusKey[] };

/** One row per status, then every pair that can sit on the same tooth. Missing and healthy do not stack. */
export function dentalEffectRows(): DentalEffectRow[] {
    const singles: DentalEffectRow[] = DENTAL_STATUS_KEYS.map((key) => ({ id: key, marks: [key] }));
    const pairs: DentalEffectRow[] = [];
    for (let i = 0; i < STACK.length; i++) {
        for (let j = i + 1; j < STACK.length; j++) {
            const a = STACK[i]!;
            const b = STACK[j]!;
            pairs.push({ id: `${a}+${b}`, marks: [a, b] });
        }
    }
    return [...singles, ...pairs];
}
