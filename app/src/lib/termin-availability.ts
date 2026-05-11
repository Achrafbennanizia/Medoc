import type { Abwesenheit, Termin } from "../models/types";
import type { PraxisArbeitszeitenConfig } from "./praxis-planning";
import { isAppointmentSpanBlockedByPraxisConfig, resolveEffectiveArbeitszeitenForArzt } from "./praxis-planning";

/** Parse "HH:mm" or "HH:mm:ss" to minutes from midnight. */
export function uhrzeitToMinutes(u: string): number {
    const p = u.slice(0, 5).split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60;
    return h * 60 + m;
}

function hmStringToMinutes(s: string | null | undefined): number | null {
    if (!s?.trim()) return null;
    const t = s.trim();
    if (!/^\d{1,2}:\d{2}/.test(t)) return null;
    return uhrzeitToMinutes(t);
}

function isoDateInAbwRange(iso: string, vonTag: string, bisTag: string): boolean {
    return iso >= vonTag && iso <= bisTag;
}

/** True if [startMin, endMin) overlaps a practice absence window on `isoDate`. */
export function isAppointmentSpanBlockedByAbwesenheiten(
    rows: Abwesenheit[],
    isoDate: string,
    startMin: number,
    endMin: number,
): boolean {
    if (endMin <= startMin) return true;
    for (const a of rows) {
        if (!isoDateInAbwRange(isoDate, a.von_tag, a.bis_tag)) continue;
        const rawV = a.von_uhrzeit?.trim();
        const rawB = a.bis_uhrzeit?.trim();
        if (!rawV || !rawB) {
            return true;
        }
        const v0 = hmStringToMinutes(rawV);
        const v1 = hmStringToMinutes(rawB);
        if (v0 == null || v1 == null) {
            return true;
        }
        if (startMin < v1 && v0 < endMin) return true;
    }
    return false;
}

export function terminSchedulingBlockReason(
    praxisCfg: PraxisArbeitszeitenConfig,
    abwesenheiten: Abwesenheit[],
    isoDate: string,
    startMin: number,
    endMin: number,
): string | undefined {
    if (isAppointmentSpanBlockedByPraxisConfig(praxisCfg, isoDate, startMin, endMin)) {
        return "Dieser Zeitraum liegt außerhalb der Sprechzeiten, in der Pause oder in einer Sperrzeit.";
    }
    if (isAppointmentSpanBlockedByAbwesenheiten(abwesenheiten, isoDate, startMin, endMin)) {
        return "Dieser Zeitraum fällt in eine Abwesenheit/Urlaub.";
    }
    return undefined;
}

/** After a drag/pack proposal, ensure every affected slot is still erlaubt (Arbeitszeiten, Sperren, Abwesenheiten). */
export function validateTerminSchedulingUpdates(
    termine: Termin[],
    updates: { id: string; data: Record<string, unknown> }[],
    slotDurMin: number,
    praxisCfg: PraxisArbeitszeitenConfig,
    abwesenheiten: Abwesenheit[],
): string | undefined {
    for (const u of updates) {
        const t = termine.find((x) => x.id === u.id);
        if (!t) continue;
        const datum = (typeof u.data.datum === "string" ? u.data.datum : undefined) ?? t.datum;
        const uhrzeitRaw = (typeof u.data.uhrzeit === "string" ? u.data.uhrzeit : undefined) ?? t.uhrzeit;
        const startMin = uhrzeitToMinutes(uhrzeitRaw);
        const endMin = startMin + slotDurMin;
        const arztId =
            (typeof u.data.arzt_id === "string" && u.data.arzt_id.trim() ? u.data.arzt_id.trim() : undefined)
            ?? t.arzt_id;
        const eff = resolveEffectiveArbeitszeitenForArzt(praxisCfg, arztId);
        const reason = terminSchedulingBlockReason(eff, abwesenheiten, datum, startMin, endMin);
        if (reason) return reason;
    }
    return undefined;
}
