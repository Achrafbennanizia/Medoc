import type { Absence, Appointment } from "../models/types";
import { addCalendarDays, formatDate, localIsoDate, minutesToTime } from "@/lib/utils";
import { appointmentCountsAsPlanned, parseAppointmentDurationMin } from "./appointment-domain";
import {
    isAppointmentSpanBlockedByAbsences,
    timeToMinutes,
} from "./appointment-availability";
import {
    dayKeyFromIsoDate,
    hmToMinutes,
    resolveBookingWorkHoursForPhysician,
    type PracticeWorkHoursConfig,
} from "./practice-planning";

export const APPOINTMENT_OUTSIDE_HOURS_KIND = "APPOINTMENT_OUTSIDE_HOURS";
export const APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND = "APPOINTMENT_OUTSIDE_HOURS_SUMMARY";

/** localStorage stamp so the precaution scan runs at most once per local calendar day. */
export const APPOINTMENT_HOURS_COMPLIANCE_DAY_LS_KEY = "medoc.appointment_hours_compliance.day.v1";

export type AppointmentHoursBlockReason = "absence" | "closure" | "break" | "outside_hours";

export function outsideHoursReasonLabel(reason: string, t: (key: string) => string): string {
    switch (reason) {
        case "absence":
            return t("app.notifications.outside_hours_reason.absence");
        case "closure":
            return t("app.notifications.outside_hours_reason.closure");
        case "break":
            return t("app.notifications.outside_hours_reason.break");
        default:
            return t("app.notifications.outside_hours_reason.outside_hours");
    }
}

export function outsideHoursItemCopy(
    patient: string,
    date: string,
    time: string,
    reason: string,
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { title: string; body: string } {
    const clock = time.length >= 5 ? time.slice(0, 5) : time;
    return {
        title: tp("app.notifications.outside_hours_item_title", { patient }),
        body: tp("app.notifications.outside_hours_item_body_reason", {
            date: formatDate(date),
            time: clock,
            reason: outsideHoursReasonLabel(reason, t),
        }),
    };
}

export type AppointmentHoursViolation = {
    appointmentId: string;
    patientId: string;
    physicianId: string;
    date: string;
    time: string;
    kind: string;
    /** Why the span is not working time (opening hours, break, closure, or holiday/absence). */
    reason: AppointmentHoursBlockReason;
};

function inHmRange(hm: string, from: string, to: string): boolean {
    const v = hmToMinutes(hm);
    return v >= hmToMinutes(from) && v < hmToMinutes(to);
}

/**
 * Classify non-working overlap: holiday/absence, special closure, lunch break,
 * or outside opening segments / inactive day.
 */
export function classifyAppointmentHoursBlock(
    practiceCfg: PracticeWorkHoursConfig,
    absences: Absence[],
    isoDate: string,
    startMin: number,
    endMin: number,
): AppointmentHoursBlockReason | null {
    if (endMin <= startMin) return "outside_hours";
    if (isAppointmentSpanBlockedByAbsences(absences, isoDate, startMin, endMin)) {
        return "absence";
    }
    const day = practiceCfg.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.active) return "outside_hours";

    for (let m = startMin; m < endMin; m += 1) {
        const hm = minutesToTime(m);
        for (const rule of practiceCfg.closures) {
            if (rule.date !== isoDate) continue;
            if (rule.mode === "FULL_DAY") return "closure";
            if (rule.mode === "CUSTOM" && (rule.periods ?? []).some((p) => inHmRange(hm, p.from, p.to))) {
                return "closure";
            }
        }
        if (
            practiceCfg.breakFrom
            && practiceCfg.breakUntil
            && inHmRange(hm, practiceCfg.breakFrom, practiceCfg.breakUntil)
        ) {
            return "break";
        }
        const inSeg = (day.segments ?? []).some((s) => inHmRange(hm, s.from, s.to));
        if (!inSeg) return "outside_hours";
    }
    return null;
}

/**
 * Appointments whose span falls outside practice/doctor hours, break, closures, or absences.
 */
export function findAppointmentsOutsideWorkHours(opts: {
    appointments: Appointment[];
    practiceCfg: PracticeWorkHoursConfig;
    absences: Absence[];
    defaultDurMin?: number;
}): AppointmentHoursViolation[] {
    const defaultDur = Math.max(5, opts.defaultDurMin ?? 30);
    const out: AppointmentHoursViolation[] = [];
    for (const row of opts.appointments) {
        if (!appointmentCountsAsPlanned(row)) continue;
        const startMin = timeToMinutes(row.time);
        const durMin = Math.max(5, parseAppointmentDurationMin(row.notes, defaultDur));
        const endMin = startMin + durMin;
        const eff = resolveBookingWorkHoursForPhysician(
            opts.practiceCfg,
            row.physician_id,
            row.date,
        );
        const reason = classifyAppointmentHoursBlock(eff, opts.absences, row.date, startMin, endMin);
        if (!reason) continue;
        out.push({
            appointmentId: row.id,
            patientId: row.patient_id,
            physicianId: row.physician_id,
            date: row.date,
            time: row.time.length >= 5 ? row.time.slice(0, 5) : row.time,
            kind: row.kind,
            reason,
        });
    }
    return out;
}

export function shouldRunDailyComplianceScan(lastIso: string | null | undefined, now = new Date()): boolean {
    return (lastIso ?? "") !== localIsoDate(now);
}

export function readDailyComplianceStamp(): string | null {
    if (typeof localStorage === "undefined") return null;
    try {
        const v = localStorage.getItem(APPOINTMENT_HOURS_COMPLIANCE_DAY_LS_KEY);
        return v?.trim() || null;
    } catch {
        return null;
    }
}

export function writeDailyComplianceStamp(iso = localIsoDate(new Date())): void {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(APPOINTMENT_HOURS_COMPLIANCE_DAY_LS_KEY, iso);
    } catch {
        /* ignore quota / private mode */
    }
}

/** Inclusive ISO date window starting today (local) for compliance scans. */
export function appointmentComplianceScanRange(horizonDays = 180): { from: string; to: string } {
    const from = localIsoDate(new Date());
    return { from, to: addCalendarDays(from, Math.max(1, horizonDays)) };
}
