import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import {
    emptyPlanNextAppointment,
    type PlanNextAppointmentV2,
} from "@/lib/plan-next-appointment";

const V2_PREFIX = "medoc.chart.plan.v2.";
const V1_PREFIX = "medoc.chart.tipp.v1.";

function legacyKeyV2(patientId: string): string {
    return `${V2_PREFIX}${patientId}`;
}

function loadPlanFromLegacyLocalStorage(patientId: string): PlanNextAppointmentV2 | null {
    if (typeof window === "undefined" || !patientId) return null;
    try {
        const raw = window.localStorage.getItem(legacyKeyV2(patientId));
        if (raw) {
            const p = JSON.parse(raw) as Partial<PlanNextAppointmentV2>;
            if (p && typeof p === "object") {
                return {
                    freeText: typeof p.freeText === "string" ? p.freeText : "",
                    urgency:
                        p.urgency === "bald" || p.urgency === "dringend" || p.urgency === "routine"
                            ? p.urgency
                            : "routine",
                    intervalWeeks: typeof p.intervalWeeks === "string" ? p.intervalWeeks : "",
                    appointmentKindHint: typeof p.appointmentKindHint === "string" ? p.appointmentKindHint : "",
                    durationMin: typeof p.durationMin === "string" ? p.durationMin : "",
                    preferredWeekdays: typeof p.preferredWeekdays === "string" ? p.preferredWeekdays : "",
                    internalNote: typeof p.internalNote === "string" ? p.internalNote : "",
                };
            }
        }
        const legacy = window.localStorage.getItem(`${V1_PREFIX}${patientId}`);
        if (legacy?.trim()) {
            return { ...emptyPlanNextAppointment(), freeText: legacy };
        }
    } catch {
        /* ignore */
    }
    return null;
}

function stripLegacyPlanLocalStorage(patientId: string): void {
    try {
        window.localStorage.removeItem(legacyKeyV2(patientId));
        window.localStorage.removeItem(`${V1_PREFIX}${patientId}`);
    } catch {
        /* ignore */
    }
}

export async function getPlanNextAppointmentFromBackend(patientId: string): Promise<PlanNextAppointmentV2> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) {
        return emptyPlanNextAppointment();
    }
    const dto = await practiceSystem.invoke<Record<string, unknown> | null>("get_chart_next_appointment_hint", {
        patientId: pid,
    });
    const hintJoined = dto && typeof dto === "object" ? (dto.hintJson ?? dto.hint_json) : undefined;
    const hintRaw = typeof hintJoined === "string" ? hintJoined.trim() : "";
    if (!hintRaw) {
        return emptyPlanNextAppointment();
    }
    try {
        const p = JSON.parse(hintRaw) as Partial<PlanNextAppointmentV2>;
        if (p && typeof p === "object") {
            return {
                freeText: typeof p.freeText === "string" ? p.freeText : "",
                urgency:
                    p.urgency === "bald" || p.urgency === "dringend" || p.urgency === "routine"
                        ? p.urgency
                        : "routine",
                intervalWeeks: typeof p.intervalWeeks === "string" ? p.intervalWeeks : "",
                appointmentKindHint: typeof p.appointmentKindHint === "string" ? p.appointmentKindHint : "",
                durationMin: typeof p.durationMin === "string" ? p.durationMin : "",
                preferredWeekdays: typeof p.preferredWeekdays === "string" ? p.preferredWeekdays : "",
                internalNote: typeof p.internalNote === "string" ? p.internalNote : "",
            };
        }
    } catch {
        /* ignore */
    }
    return emptyPlanNextAppointment();
}

export async function persistPlanNextAppointmentToBackend(
    patientId: string,
    plan: PlanNextAppointmentV2,
): Promise<void> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) {
        return;
    }
    const hasAny =
        plan.freeText.trim()
        || plan.intervalWeeks.trim()
        || plan.appointmentKindHint.trim()
        || plan.durationMin.trim()
        || plan.preferredWeekdays.trim()
        || plan.internalNote.trim()
        || plan.urgency !== "routine";
    const payload = hasAny ? JSON.stringify(plan) : "{}";
    await practiceSystem.invoke<void>("set_chart_next_appointment_hint", {
        patientId: pid,
        hintJson: payload,
    });
}

export type ChartNextAppointmentPendingRow = {
    patientId: string;
    hintJson: string;
};

/** Patients with a non-empty next-appointment hint (dashboard / reception). */
export async function listChartNextAppointmentHintsPending(): Promise<ChartNextAppointmentPendingRow[]> {
    return practiceSystem.invoke<ChartNextAppointmentPendingRow[]>("list_chart_next_appointment_hints_pending");
}

/** Load from DB, migrating legacy browser storage once when the backend row is empty. */
export async function loadPlanNextAppointmentWithMigration(patientId: string): Promise<PlanNextAppointmentV2> {
    const pid = typeof patientId === "string" ? patientId.trim() : "";
    if (!pid) {
        return emptyPlanNextAppointment();
    }
    const fromServer = await getPlanNextAppointmentFromBackend(pid);
    const hasServer = Boolean(
        fromServer.freeText.trim()
            || fromServer.intervalWeeks.trim()
            || fromServer.appointmentKindHint.trim()
            || fromServer.durationMin.trim()
            || fromServer.preferredWeekdays.trim()
            || fromServer.internalNote.trim()
            || fromServer.urgency !== "routine",
    );
    if (hasServer) {
        return fromServer;
    }
    const legacy = loadPlanFromLegacyLocalStorage(pid);
    if (legacy) {
        await persistPlanNextAppointmentToBackend(pid, legacy);
        stripLegacyPlanLocalStorage(pid);
        return legacy;
    }
    return emptyPlanNextAppointment();
}

export function stripLegacyPlanNextAppointmentLocalStorage(patientId: string): void {
    if (!patientId || typeof window === "undefined") return;
    stripLegacyPlanLocalStorage(patientId);
}
