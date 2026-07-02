import { terminIstNotfallMarkiert, type TerminArtNotizen } from "@/lib/termin-domain";
import { minutesToUhrzeit } from "@/lib/termin-availability";
import { t } from "@/lib/i18n";
import type { Termin } from "@/models/types";
import type { AerztSummary } from "@/systems/practice-host/controllers/personal.controller";

export type TerminBadgeVariant = "primary" | "success" | "default" | "error" | "warning";

export const TERMIN_STATUS_BADGE: Record<string, TerminBadgeVariant> = {
    GEPLANT: "primary",
    BESTAETIGT: "success",
    DURCHGEFUEHRT: "default",
    NICHT_ERSCHIENEN: "error",
    ABGESAGT: "warning",
};

const TERMIN_ART_KEYS = [
    "ERSTBESUCH",
    "UNTERSUCHUNG",
    "KONTROLLE",
    "BEHANDLUNG",
    "NOTFALL",
    "BERATUNG",
] as const;

/** @deprecated Prefer `terminArtFilterOptions()` for localized labels. */
export const TERMIN_ART_FILTER_OPTIONS = TERMIN_ART_KEYS.map((value) => ({
    value,
    label: value,
}));

export function terminArtFilterOptions(): Array<{ value: string; label: string }> {
    return TERMIN_ART_KEYS.map((value) => ({
        value,
        label: t(`termin.art.${value}`),
    }));
}

export function terminNotfallConfirmTitle(): string {
    return t("termin.calendar.notfall_confirm_title");
}

export function terminNotfallConfirmMessage(): string {
    return t("termin.calendar.notfall_confirm_message");
}

export const TERMIN_DAY_START_MIN = 8 * 60;
export const TERMIN_DAY_END_MIN = 19 * 60;
export const TERMIN_DEFAULT_DUR_MIN = 45;
export const TERMIN_HOUR_PX = 84;
export const TERMIN_PX_PER_MIN = 1.4;

export const TERMIN_EVENT_TONE_BY_ART: Record<string, "blue" | "accent" | "orange" | "purple" | "green"> = {
    ERSTBESUCH: "blue",
    KONTROLLE: "green",
    BEHANDLUNG: "accent",
    UNTERSUCHUNG: "blue",
    BERATUNG: "purple",
};

export type TerminBlockTone = "green" | "blue" | "accent" | "orange" | "purple";

export const TERMIN_DOCTOR_TONE_CYCLE = ["green", "blue", "purple", "accent"] as const;
export type TerminDoctorTone = (typeof TERMIN_DOCTOR_TONE_CYCLE)[number];

type TerminDisplayState = "cancelled" | "done" | "edited" | "confirmed" | "planned";

const APPOINTMENT_STATE_VARIANT: Record<TerminDisplayState, TerminBadgeVariant> = {
    cancelled: "error",
    done: "success",
    edited: "warning",
    confirmed: "success",
    planned: "primary",
};

const APPOINTMENT_STATE_LABEL_KEY: Record<TerminDisplayState, string> = {
    cancelled: "termin.status.storniert",
    done: "termin.status.durchgefuehrt",
    edited: "termin.status.geaendert",
    confirmed: "termin.status.bestaetigt",
    planned: "termin.status.geplant",
};

const CALENDAR_PILL_LABEL_KEY: Record<TerminDisplayState, string> = {
    cancelled: "termin.calendar.status.abgesagt",
    done: "termin.calendar.status.erledigt",
    edited: "termin.calendar.status.geaendert",
    confirmed: "termin.calendar.status.in_behandlung",
    planned: "termin.calendar.status.geplant",
};

function resolveTerminDisplayState(termin: Termin): TerminDisplayState {
    if (termin.status === "ABGESAGT" || termin.status === "NICHT_ERSCHIENEN") {
        return "cancelled";
    }
    if (termin.status === "DURCHGEFUEHRT") {
        return "done";
    }
    const editedMs = new Date(termin.updated_at).getTime() - new Date(termin.created_at).getTime();
    const edited = editedMs > 60_000;
    if (edited && (termin.status === "GEPLANT" || termin.status === "BESTAETIGT")) {
        return "edited";
    }
    if (termin.status === "BESTAETIGT") {
        return "confirmed";
    }
    return "planned";
}

export function terminArtLabel(art: string): string {
    const key = `termin.art.${art}`;
    const label = t(key);
    return label !== key ? label : art.replace(/_/g, " ");
}

export function terminArtLabelFromTermin(termin: Termin): string {
    if (terminIstNotfallMarkiert(termin)) return t("termin.calendar.notfall_label");
    return terminArtLabel(termin.art);
}

export function appointmentStateDisplay(termin: Termin): { label: string; variant: TerminBadgeVariant } {
    const state = resolveTerminDisplayState(termin);
    return { label: t(APPOINTMENT_STATE_LABEL_KEY[state]), variant: APPOINTMENT_STATE_VARIANT[state] };
}

export function stateSoftPillClass(termin: Termin): string {
    switch (resolveTerminDisplayState(termin)) {
        case "cancelled":
            return "red";
        case "done":
            return "accent";
        case "edited":
            return "yellow";
        case "confirmed":
            return "blue";
        default:
            return "grey";
    }
}

export function terminCalendarStatusPill(termin: Termin): {
    label: string;
    tone: "active" | "planned" | "done" | "cancel" | "edit";
} {
    const state = resolveTerminDisplayState(termin);
    const toneByState: Record<TerminDisplayState, "active" | "planned" | "done" | "cancel" | "edit"> = {
        cancelled: "cancel",
        done: "done",
        edited: "edit",
        confirmed: "active",
        planned: "planned",
    };
    return { label: t(CALENDAR_PILL_LABEL_KEY[state]), tone: toneByState[state] };
}

export function terminUhrzeitToMinutes(u: string): number {
    const p = u.slice(0, 5).split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return TERMIN_DAY_START_MIN;
    return h * 60 + m;
}

export { minutesToUhrzeit, uhrzeitToMinutes } from "@/lib/termin-availability";

export function buildArztToneMap(aerzte: AerztSummary[]): Map<string, TerminDoctorTone> {
    const m = new Map<string, TerminDoctorTone>();
    aerzte.forEach((a, i) => m.set(a.id, TERMIN_DOCTOR_TONE_CYCLE[i % TERMIN_DOCTOR_TONE_CYCLE.length]!));
    return m;
}

export function blockToneForTermin(
    event: TerminArtNotizen,
    doctorTone: TerminDoctorTone,
): TerminBlockTone {
    if (terminIstNotfallMarkiert(event)) return "orange";
    const fromArt = TERMIN_EVENT_TONE_BY_ART[event.art];
    if (fromArt) return fromArt;
    return doctorTone;
}

export function doctorStripeVar(tone: TerminDoctorTone): string {
    if (tone === "green") return "var(--green)";
    if (tone === "blue") return "var(--blue)";
    if (tone === "purple") return "var(--purple)";
    return "var(--accent)";
}

export function terminCountsAsPlanned(t: Termin): boolean {
    return t.status !== "ABGESAGT" && t.status !== "NICHT_ERSCHIENEN";
}

export function computePackedUpdatesAfterMove(
    all: Termin[],
    movingId: string,
    targetDatum: string,
    desiredStartMin: number,
    slotDur: number,
    gapAfterMin: number,
): { updates: { id: string; data: Record<string, unknown> }[]; error?: string } {
    const moving = all.find((t) => t.id === movingId);
    if (!moving) return { updates: [] };

    const arztId = moving.arzt_id;
    const step = 5;
    let start = Math.round(desiredStartMin / step) * step;
    start = Math.max(TERMIN_DAY_START_MIN, Math.min(start, TERMIN_DAY_END_MIN - slotDur));

    type Bl = { id: string; start: number };
    const blocks: Bl[] = all
        .filter(
            (t) =>
                t.datum === targetDatum &&
                t.arzt_id === arztId &&
                terminCountsAsPlanned(t) &&
                t.id !== movingId,
        )
        .map((t) => ({ id: t.id, start: terminUhrzeitToMinutes(t.uhrzeit) }));

    blocks.push({ id: movingId, start });

    const gap = Math.max(0, Math.floor(Number(gapAfterMin) || 0));
    const endOf = (s: number) => s + slotDur + gap;

    let guard = 0;
    let changed = true;
    while (changed && guard++ < 80) {
        changed = false;
        blocks.sort((a, b) => a.start - b.start);
        for (let i = 0; i < blocks.length - 1; i++) {
            const endI = endOf(blocks[i]!.start);
            if (endI > blocks[i + 1]!.start) {
                let ns = endI;
                ns = Math.ceil(ns / step) * step;
                if (ns < endI) ns += step;
                blocks[i + 1]!.start = ns;
                changed = true;
            }
        }
    }

    for (const b of blocks) {
        if (b.start + slotDur > TERMIN_DAY_END_MIN) {
            return {
                updates: [],
                error: t("termin.calendar.move_no_space"),
            };
        }
    }

    const updates: { id: string; data: Record<string, unknown> }[] = [];
    for (const b of blocks) {
        const t = all.find((x) => x.id === b.id);
        if (!t) continue;
        const newU = minutesToUhrzeit(b.start);
        const uCmp = t.uhrzeit.slice(0, 5);
        const newUCmp = newU.slice(0, 5);
        if (b.id === movingId) {
            if (t.datum !== targetDatum || uCmp !== newUCmp) {
                updates.push({ id: b.id, data: { datum: targetDatum, uhrzeit: newU } });
            }
        } else if (uCmp !== newUCmp) {
            updates.push({ id: b.id, data: { uhrzeit: newU } });
        }
    }

    return { updates };
}

export function calendarMonthOffsetFromToday(d: Date): number {
    const now = new Date();
    return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

/** Termin calendar surfaces show Mon–Fri only (Sat/Sun hidden to widen working columns). */
export const TERMIN_CALENDAR_WORKING_DAYS = 5;
export const TERMIN_CALENDAR_MONTH_ROWS = 6;

export function isTerminCalendarWorkingDay(date: Date): boolean {
    const dow = date.getDay();
    return dow >= 1 && dow <= 5;
}

/** Index 0 = Monday … 4 = Friday within ISO week starting Monday. */
export function terminCalendarWorkingDayIndex(date: Date): number {
    return (date.getDay() + 6) % 7;
}
