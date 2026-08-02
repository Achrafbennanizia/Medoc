import type { Abwesenheit, Termin } from "../models/types";
import type { PraxisArbeitszeitenConfig } from "./praxis-planning";
import {
    isAppointmentSpanBlockedByPraxisConfig,
    isSlotBlockedByPraxisConfig,
    resolveBookingArbeitszeitenForArzt,
    resolveEffectiveArbeitszeitenForArzt,
} from "./praxis-planning";

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

/** Parse "HH:mm" or "HH:mm:ss" to minutes from midnight. */
export function uhrzeitToMinutes(u: string): number {
    const p = u.slice(0, 5).split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60;
    return h * 60 + m;
}

export function minutesToUhrzeit(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
    t: TFn,
): string | undefined {
    if (isAppointmentSpanBlockedByPraxisConfig(praxisCfg, isoDate, startMin, endMin)) {
        return t("termine.scheduling.outside_hours");
    }
    if (isAppointmentSpanBlockedByAbwesenheiten(abwesenheiten, isoDate, startMin, endMin)) {
        return t("termine.scheduling.absence");
    }
    return undefined;
}

/** Boolean guard for slot grids (no i18n). */
export function isTerminSpanSchedulable(
    praxisCfg: PraxisArbeitszeitenConfig,
    abwesenheiten: Abwesenheit[],
    isoDate: string,
    startMin: number,
    endMin: number,
): boolean {
    return (
        !isAppointmentSpanBlockedByPraxisConfig(praxisCfg, isoDate, startMin, endMin)
        && !isAppointmentSpanBlockedByAbwesenheiten(abwesenheiten, isoDate, startMin, endMin)
    );
}

/** After a drag/pack proposal, ensure every affected slot is still erlaubt (Arbeitszeiten, Sperren, Abwesenheiten). */
export function validateTerminSchedulingUpdates(
    termine: Termin[],
    updates: { id: string; data: Record<string, unknown> }[],
    slotDurMin: number,
    praxisCfg: PraxisArbeitszeitenConfig,
    abwesenheiten: Abwesenheit[],
    t: TFn,
): string | undefined {
    for (const u of updates) {
        const termin = termine.find((x) => x.id === u.id);
        if (!termin) continue;
        const datum = (typeof u.data.datum === "string" ? u.data.datum : undefined) ?? termin.datum;
        const uhrzeitRaw = (typeof u.data.uhrzeit === "string" ? u.data.uhrzeit : undefined) ?? termin.uhrzeit;
        const startMin = uhrzeitToMinutes(uhrzeitRaw);
        const endMin = startMin + slotDurMin;
        const arztId =
            (typeof u.data.arzt_id === "string" && u.data.arzt_id.trim() ? u.data.arzt_id.trim() : undefined)
            ?? termin.arzt_id;
        const eff = resolveBookingArbeitszeitenForArzt(praxisCfg, arztId);
        const reason = terminSchedulingBlockReason(eff, abwesenheiten, datum, startMin, endMin, t);
        if (reason) return reason;
    }
    return undefined;
}

function normUhrzeitHm(u: string): string {
    return u.length >= 5 ? u.slice(0, 5) : u;
}

function busySlotKey(datum: string, uhrzeit: string): string {
    return `${datum}|${normUhrzeitHm(uhrzeit)}`;
}

/** True when backend would reject create/update (same Arzt, date, time; excludes ABGESAGT). */
export function hasArztSlotConflict(
    termine: Termin[],
    datum: string,
    uhrzeit: string,
    arztId: string,
    excludeTerminId?: string,
): boolean {
    const key = busySlotKey(datum, uhrzeit);
    for (const t of termine) {
        if (excludeTerminId && t.id === excludeTerminId) continue;
        if (t.status === "ABGESAGT") continue;
        if (t.datum !== datum || t.arzt_id !== arztId) continue;
        if (busySlotKey(t.datum, t.uhrzeit) === key) return true;
    }
    return false;
}

export function isTerminConflictErrorMessage(msg: string): boolean {
    const m = msg.toLowerCase();
    // English (current IPC) + legacy German phrases from older builds.
    return (
        m.includes("appointment conflict") ||
        m.includes("already has an appointment") ||
        m.includes("terminkonflikt") ||
        m.includes("bereits einen termin")
    );
}

/**
 * WAAD 1.2.4 — alternative Uhrzeiten am selben Tag (UI; authoritative check remains backend).
 */
export function suggestAlternativeTerminSlots(opts: {
    datum: string;
    arztId: string;
    preferredUhrzeit: string;
    durMin: number;
    slotStep: number;
    termine: Termin[];
    praxisCfg: PraxisArbeitszeitenConfig;
    abwesenheiten: Abwesenheit[];
    excludeTerminId?: string;
    max?: number;
    t: TFn;
}): string[] {
    const max = opts.max ?? 5;
    const eff = resolveBookingArbeitszeitenForArzt(opts.praxisCfg, opts.arztId);
    const step = Math.max(5, opts.slotStep);
    const prefMin = uhrzeitToMinutes(normUhrzeitHm(opts.preferredUhrzeit));
    const offsets: number[] = [0];
    for (let i = 1; i <= 32; i++) {
        offsets.push(i * step, -i * step);
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const off of offsets) {
        const startMin = prefMin + off;
        if (startMin < 6 * 60 || startMin > 21 * 60) continue;
        const hm = minutesToUhrzeit(startMin);
        if (seen.has(hm)) continue;
        seen.add(hm);
        if (isSlotBlockedByPraxisConfig(eff, opts.datum, hm)) continue;
        const block = terminSchedulingBlockReason(eff, opts.abwesenheiten, opts.datum, startMin, startMin + opts.durMin, opts.t);
        if (block) continue;
        if (hasArztSlotConflict(opts.termine, opts.datum, hm, opts.arztId, opts.excludeTerminId)) continue;
        out.push(hm);
        if (out.length >= max) break;
    }
    return out;
}

export function formatAlternativeSlots(slots: string[], tp: TParamsFn): string {
    if (slots.length === 0) return "";
    return slots.map((s) => tp("termine.scheduling.time_oclock", { time: s })).join(", ");
}

/** @deprecated Use formatAlternativeSlots(slots, tp) */
export function formatAlternativeSlotsDe(slots: string[]): string {
    return formatAlternativeSlots(slots, (key, params) =>
        key === "termine.scheduling.time_oclock" ? `${params.time} Uhr` : String(params.time),
    );
}
