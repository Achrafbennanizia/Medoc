import type { Absence, Appointment } from "../models/types";
import type { PracticeWorkHoursConfig } from "./practice-planning";
import {
    isAppointmentSpanBlockedByPracticeConfig,
    isSlotBlockedByPracticeConfig,
    resolveBookingWorkHoursForPhysician,
    resolveEffectiveWorkHoursForPhysician,
} from "./practice-planning";

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

/** Parse "HH:mm" or "HH:mm:ss" to minutes from midnight. */
export function timeToMinutes(u: string): number {
    const p = u.slice(0, 5).split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60;
    return h * 60 + m;
}

export function minutesToTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hmStringToMinutes(s: string | null | undefined): number | null {
    if (!s?.trim()) return null;
    const t = s.trim();
    if (!/^\d{1,2}:\d{2}/.test(t)) return null;
    return timeToMinutes(t);
}

function isoDateInAbwRange(iso: string, fromDay: string, toDay: string): boolean {
    return iso >= fromDay && iso <= toDay;
}

/** True if [startMin, endMin) overlaps a practice absence window on `isoDate`. */
export function isAppointmentSpanBlockedByAbsences(
    rows: Absence[],
    isoDate: string,
    startMin: number,
    endMin: number,
): boolean {
    if (endMin <= startMin) return true;
    for (const a of rows) {
        if (!isoDateInAbwRange(isoDate, a.from_day, a.to_day)) continue;
        const rawV = a.from_time?.trim();
        const rawB = a.to_time?.trim();
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

export function appointmentSchedulingBlockReason(
    practiceCfg: PracticeWorkHoursConfig,
    absences: Absence[],
    isoDate: string,
    startMin: number,
    endMin: number,
    t: TFn,
): string | undefined {
    if (isAppointmentSpanBlockedByPracticeConfig(practiceCfg, isoDate, startMin, endMin)) {
        return t("appointments.scheduling.outside_hours");
    }
    if (isAppointmentSpanBlockedByAbsences(absences, isoDate, startMin, endMin)) {
        return t("appointments.scheduling.absence");
    }
    return undefined;
}

/** Boolean guard for slot grids (no i18n). */
export function isAppointmentSpanSchedulable(
    practiceCfg: PracticeWorkHoursConfig,
    absences: Absence[],
    isoDate: string,
    startMin: number,
    endMin: number,
): boolean {
    return (
        !isAppointmentSpanBlockedByPracticeConfig(practiceCfg, isoDate, startMin, endMin)
        && !isAppointmentSpanBlockedByAbsences(absences, isoDate, startMin, endMin)
    );
}

/** After a drag/pack proposal, ensure every affected slot is still erlaubt (Arbeitszeiten, Sperren, Abwesenheiten). */
export function validateAppointmentSchedulingUpdates(
    appointments: Appointment[],
    updates: { id: string; data: Record<string, unknown> }[],
    slotDurMin: number,
    practiceCfg: PracticeWorkHoursConfig,
    absences: Absence[],
    t: TFn,
): string | undefined {
    for (const u of updates) {
        const appointment = appointments.find((x) => x.id === u.id);
        if (!appointment) continue;
        const date = (typeof u.data.date === "string" ? u.data.date : undefined) ?? appointment.date;
        const timeRaw = (typeof u.data.time === "string" ? u.data.time : undefined) ?? appointment.time;
        const startMin = timeToMinutes(timeRaw);
        const endMin = startMin + slotDurMin;
        const physicianId =
            (typeof u.data.physician_id === "string" && u.data.physician_id.trim() ? u.data.physician_id.trim() : undefined)
            ?? appointment.physician_id;
        const eff = resolveBookingWorkHoursForPhysician(practiceCfg, physicianId);
        const reason = appointmentSchedulingBlockReason(eff, absences, date, startMin, endMin, t);
        if (reason) return reason;
    }
    return undefined;
}

function normTimeHm(u: string): string {
    return u.length >= 5 ? u.slice(0, 5) : u;
}

function busySlotKey(date: string, time: string): string {
    return `${date}|${normTimeHm(time)}`;
}

/** True when backend would reject create/update (same Physician, date, time; excludes CANCELLED). */
export function hasPhysicianSlotConflict(
    appointments: Appointment[],
    date: string,
    time: string,
    physicianId: string,
    excludeAppointmentId?: string,
): boolean {
    const key = busySlotKey(date, time);
    for (const t of appointments) {
        if (excludeAppointmentId && t.id === excludeAppointmentId) continue;
        if (t.status === "CANCELLED") continue;
        if (t.date !== date || t.physician_id !== physicianId) continue;
        if (busySlotKey(t.date, t.time) === key) return true;
    }
    return false;
}

export function isAppointmentConflictErrorMessage(msg: string): boolean {
    const m = msg.toLowerCase();
    // English (current IPC) + legacy German phrases from older builds.
    return (
        m.includes("appointment conflict") ||
        m.includes("already has an appointment") ||
        m.includes("terminkonflikt") ||
        m.includes("bereits einen appointment")
    );
}

/**
 * WAAD 1.2.4 — suggest alternative times on the same day (UI; authoritative check remains backend).
 */
export function suggestAlternativeAppointmentSlots(opts: {
    date: string;
    physicianId: string;
    preferredTime: string;
    durMin: number;
    slotStep: number;
    appointments: Appointment[];
    practiceCfg: PracticeWorkHoursConfig;
    absences: Absence[];
    excludeAppointmentId?: string;
    max?: number;
    t: TFn;
}): string[] {
    const max = opts.max ?? 5;
    const eff = resolveBookingWorkHoursForPhysician(opts.practiceCfg, opts.physicianId);
    const step = Math.max(5, opts.slotStep);
    const prefMin = timeToMinutes(normTimeHm(opts.preferredTime));
    const offsets: number[] = [0];
    for (let i = 1; i <= 32; i++) {
        offsets.push(i * step, -i * step);
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const off of offsets) {
        const startMin = prefMin + off;
        if (startMin < 6 * 60 || startMin > 21 * 60) continue;
        const hm = minutesToTime(startMin);
        if (seen.has(hm)) continue;
        seen.add(hm);
        if (isSlotBlockedByPracticeConfig(eff, opts.date, hm)) continue;
        const block = appointmentSchedulingBlockReason(eff, opts.absences, opts.date, startMin, startMin + opts.durMin, opts.t);
        if (block) continue;
        if (hasPhysicianSlotConflict(opts.appointments, opts.date, hm, opts.physicianId, opts.excludeAppointmentId)) continue;
        out.push(hm);
        if (out.length >= max) break;
    }
    return out;
}

export function formatAlternativeSlots(slots: string[], tp: TParamsFn): string {
    if (slots.length === 0) return "";
    return slots.map((s) => tp("appointments.scheduling.time_oclock", { time: s })).join(", ");
}

/** @deprecated Use formatAlternativeSlots(slots, tp) */
export function formatAlternativeSlotsDe(slots: string[]): string {
    return formatAlternativeSlots(slots, (key, params) =>
        key === "appointments.scheduling.time_oclock" ? `${params.time} Uhr` : String(params.time),
    );
}
