import type { Termin as TCalRow } from "@/models/types";

/** Embedded in `termin.notizen` when “Notfall” was chosen in the Kalender flow. */
export const TERMIN_NOTFALL_NOTIZ_MARKER = "Priorität: Notfall (über Kalender markiert)";

/** Cal-notfall slots are persisted as `BEHANDLUNG` plus this marker in notes. */
type TerminArtNotizen = Pick<TCalRow, "art" | "notizen">;
export type { TerminArtNotizen };
export function terminIstNotfallMarkiert(t: TerminArtNotizen): boolean {
    return t.art === "BEHANDLUNG" && Boolean(t.notizen?.includes(TERMIN_NOTFALL_NOTIZ_MARKER));
}

const TERMIN_DURATION_RE = /Dauer:\s*(\d+)\s*min/i;

/** Reads duration from `termin.notizen` (`Dauer: N min`); falls back when missing. */
export function parseTerminDurationMin(notizen: string | null | undefined, fallback = 30): number {
    const m = TERMIN_DURATION_RE.exec(notizen ?? "");
    const n = m ? Number(m[1]) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
