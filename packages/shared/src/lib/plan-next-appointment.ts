/**
 * Physician → reception: structured hint for next appointment planning.
 * Persistence: SQLite `chart_next_appointment_hint` via `plan-next-appointment.controller.ts`.
 */

export type PlanUrgency = "routine" | "bald" | "dringend";

export interface PlanNextAppointmentV2 {
    /** Free text (core message). */
    freeText: string;
    urgency: PlanUrgency;
    /** e.g. "2", "4", "6", "12", "" when open-ended */
    intervalWeeks: string;
    /** AppointmentKind from domain, e.g. CHECKUP — empty = no preset */
    appointmentKindHint: string;
    /** Estimated duration in minutes, free-form */
    durationMin: string;
    /** Preferred weekdays, e.g. "Mon, Thu" */
    preferredWeekdays: string;
    /** Note for internal coordination */
    internalNote: string;
}

export function emptyPlanNextAppointment(): PlanNextAppointmentV2 {
    return {
        freeText: "",
        urgency: "routine",
        intervalWeeks: "",
        appointmentKindHint: "",
        durationMin: "",
        preferredWeekdays: "",
        internalNote: "",
    };
}

/** Parse stored JSON from DB / list endpoint (tolerant). */
export function parsePlanNextFromHintJson(hintJson: string): PlanNextAppointmentV2 | null {
    try {
        const p = JSON.parse(hintJson) as Partial<PlanNextAppointmentV2>;
        if (!p || typeof p !== "object") return null;
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
    } catch {
        return null;
    }
}

/** Short summary for badges / compact UI. */
export function planNextHasContent(plan: PlanNextAppointmentV2): boolean {
    return Boolean(
        plan.freeText.trim()
            || plan.intervalWeeks.trim()
            || plan.appointmentKindHint.trim()
            || plan.durationMin.trim()
            || plan.preferredWeekdays.trim()
            || plan.internalNote.trim()
            || plan.urgency !== "routine",
    );
}

export function planNextAppointmentSummary(plan: PlanNextAppointmentV2): string {
    const parts: string[] = [];
    if (plan.freeText.trim()) parts.push(plan.freeText.trim());
    if (plan.intervalWeeks.trim()) parts.push(`in ca. ${plan.intervalWeeks} Wo.`);
    if (plan.urgency === "dringend") parts.push("dringend");
    else if (plan.urgency === "bald") parts.push("zeitnah");
    return parts.join(" · ") || "";
}

/** One short line for dashboard / reception lists (no internal-only fields). */
export function planNextReceptionTeaser(plan: PlanNextAppointmentV2): string {
    const bits: string[] = [];
    if (plan.urgency === "dringend") bits.push("Dringend");
    else if (plan.urgency === "bald") bits.push("Zeitnah");
    if (plan.appointmentKindHint.trim()) bits.push(plan.appointmentKindHint.trim());
    if (plan.durationMin.trim()) bits.push(`${plan.durationMin.trim()} Min`);
    if (plan.intervalWeeks.trim()) bits.push(`~${plan.intervalWeeks} Wo.`);
    const head = bits.join(" · ");
    const ft = plan.freeText.trim();
    const line = [head, ft].filter(Boolean).join(" — ");
    if (!line) return "";
    return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

/** Compact note for Appointment anlegen (Reception). Internal note excluded. */
export function planNextAutofillNote(plan: PlanNextAppointmentV2): string {
    const parts: string[] = [];
    const sum = planNextAppointmentSummary(plan);
    if (sum) parts.push(sum);
    if (plan.preferredWeekdays.trim()) parts.push(`Wunsch: ${plan.preferredWeekdays.trim()}`);
    return parts.join(" · ").slice(0, 450);
}

export type PlanNextPracticeTaskLabels = {
    titleFallback: string;
    urgencyLabel: (urgency: PlanUrgency) => string;
    kindLabel: (kind: string) => string;
    durationLabel: (minutes: string) => string;
    intervalLabel: (weeks: string) => string;
    weekdaysLabel: (days: string) => string;
    internalLabel: (note: string) => string;
};

/**
 * Always store English structure in SQLite. UI translates EN → device locale on display
 * (`displayPracticeTaskBody` / `practiceTaskHeadline`).
 */
export const PLAN_NEXT_EN_LABELS: PlanNextPracticeTaskLabels = {
    titleFallback: "Plan next appointment",
    urgencyLabel: (urgency) =>
        urgency === "dringend" ? "Urgent" : urgency === "bald" ? "Soon" : "Routine",
    kindLabel: (kind) => kind,
    durationLabel: (minutes) => `Duration: ${minutes} min`,
    intervalLabel: (weeks) => `Interval: about ${weeks} weeks`,
    weekdaysLabel: (days) => `Preferred weekdays: ${days}`,
    internalLabel: (note) => `Internal: ${note}`,
};

/**
 * Title + body for a practice task when the physician sends “Note for reception”.
 * Returns null when the note is empty.
 */
export function buildPlanNextPracticeTask(
    plan: PlanNextAppointmentV2,
    labels: PlanNextPracticeTaskLabels = PLAN_NEXT_EN_LABELS,
): { title: string; body: string } | null {
    if (!planNextHasContent(plan)) return null;
    const free = plan.freeText.trim();
    const title = (free || labels.titleFallback).slice(0, 120);
    const lines: string[] = [];
    if (plan.urgency !== "routine") {
        lines.push(labels.urgencyLabel(plan.urgency));
    }
    if (plan.appointmentKindHint.trim()) {
        lines.push(labels.kindLabel(plan.appointmentKindHint.trim()));
    }
    if (plan.durationMin.trim()) {
        lines.push(labels.durationLabel(plan.durationMin.trim()));
    }
    if (plan.intervalWeeks.trim()) {
        lines.push(labels.intervalLabel(plan.intervalWeeks.trim()));
    }
    if (plan.preferredWeekdays.trim()) {
        lines.push(labels.weekdaysLabel(plan.preferredWeekdays.trim()));
    }
    if (free && free !== title) {
        lines.push(free);
    } else if (free && lines.length === 0) {
        /* title already carries free text; body can stay empty */
    }
    if (plan.internalNote.trim()) {
        lines.push(labels.internalLabel(plan.internalNote.trim()));
    }
    return { title, body: lines.join("\n").slice(0, 2000) };
}

/** After treatment flagged follow-up Appointment needed: merge hint into saved physician recommendation. */
export function mergeTreatmentFollowupIntoPlan(
    plan: PlanNextAppointmentV2,
    ctx: { service_name: string; notes: string },
): PlanNextAppointmentV2 {
    const line = [ctx.service_name.trim(), ctx.notes.trim()].filter(Boolean).join(" · ");
    if (!line) return plan;
    const next: PlanNextAppointmentV2 = { ...plan };
    const tag = `Folge: ${line}`.slice(0, 220);
    if (!next.freeText.trim()) {
        next.freeText = tag;
    } else {
        const clip = line.slice(0, Math.min(24, line.length));
        if (clip && !next.freeText.includes(clip)) {
            next.freeText = `${next.freeText.trim()} · ${tag}`.slice(0, 500);
        }
    }
    if (!next.appointmentKindHint.trim()) next.appointmentKindHint = "TREATMENT";
    if (next.urgency === "routine") next.urgency = "bald";
    return next;
}
