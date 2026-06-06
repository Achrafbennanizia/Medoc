import type { PraxisDayKey, PraxisDayPlan } from "./praxis-planning";
import { PRAXIS_DAY_KEYS } from "./praxis-planning";

export type PlanValidationIssue =
    | { code: "segment_required"; day: PraxisDayKey }
    | { code: "invalid_time"; day: PraxisDayKey }
    | { code: "segment_order"; day: PraxisDayKey }
    | { code: "overlap"; day: PraxisDayKey };

export function timeToMinutes(t: string): number {
    const parts = t.split(":");
    const h = parseInt(parts[0] ?? "", 10);
    const m = parseInt(parts[1] ?? "", 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
    return h * 60 + m;
}

/** Validates active-day segments: non-empty, valid order (start before end), no overlaps. Inactive days are skipped. */
export function validatePraxisArbeitsplan(plan: Record<PraxisDayKey, PraxisDayPlan>): PlanValidationIssue | null {
    for (const key of PRAXIS_DAY_KEYS) {
        const row = plan[key];
        if (!row.aktiv) continue;
        const segs = row.segments ?? [];
        if (segs.length === 0) return { code: "segment_required", day: key };
        for (const s of segs) {
            const a = timeToMinutes(s.from);
            const b = timeToMinutes(s.to);
            if (Number.isNaN(a) || Number.isNaN(b)) return { code: "invalid_time", day: key };
            if (a >= b) return { code: "segment_order", day: key };
        }
        const sorted = [...segs].sort((x, y) => timeToMinutes(x.from) - timeToMinutes(y.from));
        for (let i = 0; i < sorted.length - 1; i++) {
            if (timeToMinutes(sorted[i].to) > timeToMinutes(sorted[i + 1].from)) {
                return { code: "overlap", day: key };
            }
        }
    }
    return null;
}

/** True when pause start is strictly before end (both parseable as HH:mm). */
export function isValidPauseRange(pauseVon: string, pauseBis: string): boolean {
    const pv = timeToMinutes(pauseVon);
    const pb = timeToMinutes(pauseBis);
    if (Number.isNaN(pv) || Number.isNaN(pb)) return true;
    return pv < pb;
}

export function isValidSlotMinutes(slotMin: string, minimum = 10): boolean {
    const slot = parseInt(slotMin, 10);
    return !Number.isNaN(slot) && slot >= minimum;
}
