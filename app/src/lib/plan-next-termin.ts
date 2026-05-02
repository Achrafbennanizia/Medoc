/**
 * Arzt → Rezeption: strukturierter Hinweis für die nächste Terminplanung.
 * Persistenz: SQLite `akte_next_termin_hint` via `plan-next-termin.controller.ts`.
 */

export type PlanUrgency = "routine" | "bald" | "dringend";

export interface PlanNextTerminV2 {
    /** Freitext (Kernbotschaft). */
    freeText: string;
    urgency: PlanUrgency;
    /** z. B. "2", "4", "6", "12", "" wenn offen */
    intervalWeeks: string;
    /** TerminArt aus Domain, z. B. KONTROLLE — leer = keine Vorgabe */
    terminArtHint: string;
    /** Geschätzte Dauer in Minuten, frei */
    durationMin: string;
    /** Bevorzugte Wochentage, z. B. "Mo, Do" */
    preferredWeekdays: string;
    /** Zusatz für interne Abstimmung */
    internalNote: string;
}

export const emptyPlanNextTermin = (): PlanNextTerminV2 => ({
    freeText: "",
    urgency: "routine",
    intervalWeeks: "",
    terminArtHint: "",
    durationMin: "",
    preferredWeekdays: "",
    internalNote: "",
});

/** Kurz-Zusammenfassung für Badges / kompakte UI. */
export function planNextHasContent(plan: PlanNextTerminV2): boolean {
    return Boolean(
        plan.freeText.trim()
            || plan.intervalWeeks.trim()
            || plan.terminArtHint.trim()
            || plan.durationMin.trim()
            || plan.preferredWeekdays.trim()
            || plan.internalNote.trim()
            || plan.urgency !== "routine",
    );
}

export function planNextTerminSummary(plan: PlanNextTerminV2): string {
    const parts: string[] = [];
    if (plan.freeText.trim()) parts.push(plan.freeText.trim());
    if (plan.intervalWeeks.trim()) parts.push(`in ca. ${plan.intervalWeeks} Wo.`);
    if (plan.urgency === "dringend") parts.push("dringend");
    else if (plan.urgency === "bald") parts.push("zeitnah");
    return parts.join(" · ") || "";
}
