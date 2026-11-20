import { listAbsences } from "@/systems/practice-host/controllers/practice.controller";
import { listAppointmentsInRange } from "@/systems/practice-host/controllers/appointment.controller";
import {
    createInAppNotification,
    dismissUnreadInAppNotificationsByKind,
    listInAppNotifications,
} from "@/systems/practice-host/controllers/in-app-notification.controller";
import type { Patient } from "../models/types";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { localIsoDate } from "@/lib/utils";
import {
    APPOINTMENT_OUTSIDE_HOURS_KIND,
    APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND,
    appointmentComplianceScanRange,
    outsideHoursItemCopy,
    findAppointmentsOutsideWorkHours,
    readDailyComplianceStamp,
    shouldRunDailyComplianceScan,
    writeDailyComplianceStamp,
    type AppointmentHoursViolation,
} from "./appointment-hours-compliance";
import {
    loadPracticeWorkHoursConfig,
    practiceSlotMinutes,
    type PracticeWorkHoursConfig,
} from "./practice-planning";
type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

export type WorkHoursComplianceNotifyResult = {
    violations: AppointmentHoursViolation[];
    ran: boolean;
};

function violationSortKey(v: AppointmentHoursViolation): string {
    return `${v.date}T${v.time}`;
}

function appointmentIdFromPayload(payloadJson: string | null | undefined): string | undefined {
    if (!payloadJson) return undefined;
    try {
        const p = JSON.parse(payloadJson) as { appointment_id?: string };
        return typeof p.appointment_id === "string" && p.appointment_id ? p.appointment_id : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Scan upcoming appointments against opening hours, lunch break, special closures,
 * and holidays/absences; flag each conflict in Notifications (plus a summary).
 *
 * Already-read items for the same appointment stay dismissed — the scan only
 * creates notifications for newly seen violations.
 */
export async function notifyAppointmentsOutsideWorkHours(opts: {
    practiceCfg?: PracticeWorkHoursConfig;
    t: TFn;
    tp: TParamsFn;
    horizonDays?: number;
}): Promise<WorkHoursComplianceNotifyResult> {
    const practiceCfg = opts.practiceCfg ?? (await loadPracticeWorkHoursConfig());
    const { from, to } = appointmentComplianceScanRange(opts.horizonDays ?? 180);
    const [appointments, absences, patients, existing] = await Promise.all([
        listAppointmentsInRange(from, to),
        listAbsences().catch(() => []),
        listPatients().catch(() => [] as Patient[]),
        listInAppNotifications().catch(() => []),
    ]);
    const nameById = new Map(patients.map((p) => [p.id, p.name]));
    const violations = findAppointmentsOutsideWorkHours({
        appointments,
        practiceCfg,
        absences,
        defaultDurMin: practiceSlotMinutes(practiceCfg),
    });

    const readCoveredAppointmentIds = new Set<string>();
    for (const n of existing) {
        if (n.kind !== APPOINTMENT_OUTSIDE_HOURS_KIND || !n.read_at) continue;
        const appointmentId = appointmentIdFromPayload(n.payload_json);
        if (appointmentId) readCoveredAppointmentIds.add(appointmentId);
    }

    if (violations.length === 0) {
        // Clear stale unread outside-hours noise when everything is compliant again.
        await dismissUnreadInAppNotificationsByKind([
            APPOINTMENT_OUTSIDE_HOURS_KIND,
            APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND,
        ]).catch(() => undefined);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("medoc-in-app-notifications-refresh"));
        }
        return { violations, ran: true };
    }

    // Skip appointments the user already acknowledged (read). Recreate only the rest.
    const needsUnread = violations.filter((v) => !readCoveredAppointmentIds.has(v.appointmentId));
    if (needsUnread.length === 0) {
        return { violations, ran: true };
    }

    await dismissUnreadInAppNotificationsByKind([
        APPOINTMENT_OUTSIDE_HOURS_KIND,
        APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND,
    ]).catch(() => undefined);

    const createOrder = [...needsUnread].sort((a, b) =>
        violationSortKey(b).localeCompare(violationSortKey(a)),
    );

    for (const v of createOrder) {
        const patientName = nameById.get(v.patientId)?.trim() || v.patientId;
        const copy = outsideHoursItemCopy(patientName, v.date, v.time, v.reason, opts.t, opts.tp);
        await createInAppNotification({
            kind: APPOINTMENT_OUTSIDE_HOURS_KIND,
            title: copy.title,
            body: copy.body,
            payloadJson: JSON.stringify({
                appointment_id: v.appointmentId,
                patient_id: v.patientId,
                patient_name: patientName,
                physician_id: v.physicianId,
                date: v.date,
                time: v.time,
                reason: v.reason,
            }),
            alsoNotifyUserIds: [v.physicianId],
        });
    }

    await createInAppNotification({
        kind: APPOINTMENT_OUTSIDE_HOURS_SUMMARY_KIND,
        title: opts.tp("app.notifications.outside_hours_summary_title", {
            count: violations.length,
        }),
        body: opts.t("app.notifications.outside_hours_summary_body"),
        payloadJson: JSON.stringify({
            count: violations.length,
            appointment_ids: violations.map((v) => v.appointmentId),
            reasons: violations.map((v) => v.reason),
        }),
        alsoNotifyUserIds: [...new Set(violations.map((v) => v.physicianId))],
    });

    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("medoc-in-app-notifications-refresh"));
    }

    return { violations, ran: true };
}

/**
 * Precaution: run the compliance scan at most once per local calendar day.
 * Still considers non-working time (break, special closures, holidays/absences).
 */
export async function runDailyAppointmentHoursComplianceIfDue(opts: {
    practiceCfg?: PracticeWorkHoursConfig;
    t: TFn;
    tp: TParamsFn;
    horizonDays?: number;
    now?: Date;
}): Promise<WorkHoursComplianceNotifyResult> {
    const now = opts.now ?? new Date();
    if (!shouldRunDailyComplianceScan(readDailyComplianceStamp(), now)) {
        return { violations: [], ran: false };
    }
    try {
        const result = await notifyAppointmentsOutsideWorkHours({
            practiceCfg: opts.practiceCfg,
            t: opts.t,
            tp: opts.tp,
            horizonDays: opts.horizonDays,
        });
        writeDailyComplianceStamp(localIsoDate(now));
        return result;
    } catch {
        // Do not stamp on failure so the next interval/visibility pass can retry.
        return { violations: [], ran: false };
    }
}
