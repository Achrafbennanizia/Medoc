import type { Termin } from "@/models/types";

/** Embedded in `termin.notizen` when “Notfall” was chosen in the Kalender flow. */
export const TERMIN_NOTFALL_NOTIZ_MARKER = "Priorität: Notfall (über Kalender markiert)";

/** Cal-notfall slots are persisted as `BEHANDLUNG` plus this marker in notes. */
export function terminIstNotfallMarkiert(t: Pick<Termin, "art" | "notizen">): boolean {
    return t.art === "BEHANDLUNG" && Boolean(t.notizen?.includes(TERMIN_NOTFALL_NOTIZ_MARKER));
}
