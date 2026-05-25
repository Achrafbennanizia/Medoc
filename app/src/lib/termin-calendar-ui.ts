import { terminIstNotfallMarkiert } from "@/lib/termin-domain";
import { minutesToUhrzeit } from "@/lib/termin-availability";
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

export const TERMIN_ART_FILTER_OPTIONS = [
    { value: "ERSTBESUCH", label: "Erstbesuch" },
    { value: "UNTERSUCHUNG", label: "Untersuchung" },
    { value: "KONTROLLE", label: "Kontrolle" },
    { value: "BEHANDLUNG", label: "Behandlung" },
    { value: "NOTFALL", label: "Notfall (Priorität)" },
    { value: "BERATUNG", label: "Beratung" },
] as const;

export const TERMIN_ART_LABEL: Record<string, string> = {
    KONTROLLE: "Kontrolle",
    BEHANDLUNG: "Behandlung",
    BERATUNG: "Beratung",
    ERSTBESUCH: "Erstbesuch",
    UNTERSUCHUNG: "Untersuchung",
};

export const TERMIN_NOTFALL_CONFIRM_TITLE = "Notfall-Termin einplanen?";
export const TERMIN_NOTFALL_CONFIRM_MESSAGE =
    "Der Notfall-Slot wird direkt vor dem nächsten freien Termin eingeordnet. Der aktuell laufende Patient erhält 8 Minuten Restzeit. Alle später beginnenden Termine verschieben sich automatisch.";

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

export function terminArtLabel(art: string): string {
    return TERMIN_ART_LABEL[art] ?? art.replace(/_/g, " ");
}

export function terminArtLabelFromTermin(t: Termin): string {
    if (terminIstNotfallMarkiert(t)) return "Notfall";
    return terminArtLabel(t.art);
}

export function appointmentStateDisplay(t: Termin): { label: string; variant: TerminBadgeVariant } {
    if (t.status === "ABGESAGT" || t.status === "NICHT_ERSCHIENEN") {
        return { label: "Storniert", variant: "error" };
    }
    if (t.status === "DURCHGEFUEHRT") {
        return { label: "Durchgeführt", variant: "success" };
    }
    const editedMs = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
    const edited = editedMs > 60_000;
    if (edited && (t.status === "GEPLANT" || t.status === "BESTAETIGT")) {
        return { label: "Geändert", variant: "warning" };
    }
    if (t.status === "BESTAETIGT") {
        return { label: "Bestätigt", variant: "success" };
    }
    return { label: "Geplant", variant: "primary" };
}

export function stateSoftPillClass(t: Termin): string {
    const { label } = appointmentStateDisplay(t);
    if (label === "Storniert") return "red";
    if (label === "Durchgeführt") return "accent";
    if (label === "Geändert") return "yellow";
    if (label === "Bestätigt") return "blue";
    return "grey";
}

export function terminCalendarStatusPill(t: Termin): {
    label: string;
    tone: "active" | "planned" | "done" | "cancel" | "edit";
} {
    if (t.status === "ABGESAGT" || t.status === "NICHT_ERSCHIENEN") {
        return { label: "Abgesagt", tone: "cancel" };
    }
    if (t.status === "DURCHGEFUEHRT") {
        return { label: "Erledigt", tone: "done" };
    }
    const editedMs = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
    if (editedMs > 60_000 && (t.status === "GEPLANT" || t.status === "BESTAETIGT")) {
        return { label: "Geändert", tone: "edit" };
    }
    if (t.status === "BESTAETIGT") {
        return { label: "In Behandlung", tone: "active" };
    }
    return { label: "Geplant", tone: "planned" };
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
    termin: Pick<Termin, "art" | "notizen">,
    doctorTone: TerminDoctorTone,
): TerminBlockTone {
    if (terminIstNotfallMarkiert(termin)) return "orange";
    const fromArt = TERMIN_EVENT_TONE_BY_ART[termin.art];
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
                error: "Am Tagesende ist kein freier Platz ohne Überschneidung.",
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
