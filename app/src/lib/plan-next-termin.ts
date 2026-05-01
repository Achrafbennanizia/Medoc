/**
 * Arzt → Rezeption: strukturierter Hinweis für die nächste Terminplanung.
 * Persistiert in localStorage (v2 JSON); liest Legacy v1 Plain-Text nach.
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

const V2_PREFIX = "medoc.akte.plan.v2.";
const V1_PREFIX = "medoc.akte.tipp.v1.";

export const emptyPlanNextTermin = (): PlanNextTerminV2 => ({
    freeText: "",
    urgency: "routine",
    intervalWeeks: "",
    terminArtHint: "",
    durationMin: "",
    preferredWeekdays: "",
    internalNote: "",
});

function keyV2(patientId: string): string {
    return `${V2_PREFIX}${patientId}`;
}

/** Art. 17 UI-cache: remove alongside backend erasure / patient delete. */
export function clearPlanNextTerminStorageForPatient(patientId: string): void {
    if (!patientId) return;
    try {
        window.localStorage.removeItem(keyV2(patientId));
        window.localStorage.removeItem(`${V1_PREFIX}${patientId}`);
    } catch {
        /* ignore */
    }
}

export function loadPlanNextTermin(patientId: string): PlanNextTerminV2 {
    if (!patientId) return emptyPlanNextTermin();
    try {
        const raw = window.localStorage.getItem(keyV2(patientId));
        if (raw) {
            const p = JSON.parse(raw) as Partial<PlanNextTerminV2>;
            if (p && typeof p === "object") {
                return {
                    freeText: typeof p.freeText === "string" ? p.freeText : "",
                    urgency:
                        p.urgency === "bald" || p.urgency === "dringend" || p.urgency === "routine"
                            ? p.urgency
                            : "routine",
                    intervalWeeks: typeof p.intervalWeeks === "string" ? p.intervalWeeks : "",
                    terminArtHint: typeof p.terminArtHint === "string" ? p.terminArtHint : "",
                    durationMin: typeof p.durationMin === "string" ? p.durationMin : "",
                    preferredWeekdays: typeof p.preferredWeekdays === "string" ? p.preferredWeekdays : "",
                    internalNote: typeof p.internalNote === "string" ? p.internalNote : "",
                };
            }
        }
        const legacy = window.localStorage.getItem(`${V1_PREFIX}${patientId}`);
        if (legacy?.trim()) {
            return { ...emptyPlanNextTermin(), freeText: legacy };
        }
    } catch {
        /* ignore */
    }
    return emptyPlanNextTermin();
}

export function savePlanNextTermin(patientId: string, plan: PlanNextTerminV2): void {
    if (!patientId) return;
    try {
        const hasAny =
            plan.freeText.trim() ||
            plan.intervalWeeks.trim() ||
            plan.terminArtHint.trim() ||
            plan.durationMin.trim() ||
            plan.preferredWeekdays.trim() ||
            plan.internalNote.trim() ||
            plan.urgency !== "routine";
        if (!hasAny) {
            window.localStorage.removeItem(keyV2(patientId));
            window.localStorage.removeItem(`${V1_PREFIX}${patientId}`);
            return;
        }
        window.localStorage.setItem(keyV2(patientId), JSON.stringify(plan));
        if (plan.freeText.trim()) {
            window.localStorage.setItem(`${V1_PREFIX}${patientId}`, plan.freeText.trim());
        } else {
            window.localStorage.removeItem(`${V1_PREFIX}${patientId}`);
        }
    } catch {
        /* quota */
    }
}

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
