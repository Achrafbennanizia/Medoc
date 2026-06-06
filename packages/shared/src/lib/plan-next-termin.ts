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

export function emptyPlanNextTermin(): PlanNextTerminV2 {
    return {
        freeText: "",
        urgency: "routine",
        intervalWeeks: "",
        terminArtHint: "",
        durationMin: "",
        preferredWeekdays: "",
        internalNote: "",
    };
}

/** Parse stored JSON from DB / list endpoint (tolerant). */
export function parsePlanNextFromHintJson(hintJson: string): PlanNextTerminV2 | null {
    try {
        const p = JSON.parse(hintJson) as Partial<PlanNextTerminV2>;
        if (!p || typeof p !== "object") return null;
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
    } catch {
        return null;
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

/** One short line for dashboard / reception lists (no internal-only fields). */
export function planNextReceptionTeaser(plan: PlanNextTerminV2): string {
    const bits: string[] = [];
    if (plan.urgency === "dringend") bits.push("Dringend");
    else if (plan.urgency === "bald") bits.push("Zeitnah");
    if (plan.terminArtHint.trim()) bits.push(plan.terminArtHint.trim());
    if (plan.durationMin.trim()) bits.push(`${plan.durationMin.trim()} Min`);
    if (plan.intervalWeeks.trim()) bits.push(`~${plan.intervalWeeks} Wo.`);
    const head = bits.join(" · ");
    const ft = plan.freeText.trim();
    const line = [head, ft].filter(Boolean).join(" — ");
    if (!line) return "";
    return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

/** Compact note for Termin anlegen (Rezeption). Internal note excluded. */
export function planNextAutofillNote(plan: PlanNextTerminV2): string {
    const parts: string[] = [];
    const sum = planNextTerminSummary(plan);
    if (sum) parts.push(sum);
    if (plan.preferredWeekdays.trim()) parts.push(`Wunsch: ${plan.preferredWeekdays.trim()}`);
    return parts.join(" · ").slice(0, 450);
}

/** Nach Behandlung mit „Folgetermin nötig“: Hinweis in die gespeicherte Arzt-Empfehlung mergen. */
export function mergeBehandlungFollowupIntoPlan(
    plan: PlanNextTerminV2,
    ctx: { leistungsname: string; notizen: string },
): PlanNextTerminV2 {
    const line = [ctx.leistungsname.trim(), ctx.notizen.trim()].filter(Boolean).join(" · ");
    if (!line) return plan;
    const next: PlanNextTerminV2 = { ...plan };
    const tag = `Folge: ${line}`.slice(0, 220);
    if (!next.freeText.trim()) {
        next.freeText = tag;
    } else {
        const clip = line.slice(0, Math.min(24, line.length));
        if (clip && !next.freeText.includes(clip)) {
            next.freeText = `${next.freeText.trim()} · ${tag}`.slice(0, 500);
        }
    }
    if (!next.terminArtHint.trim()) next.terminArtHint = "BEHANDLUNG";
    if (next.urgency === "routine") next.urgency = "bald";
    return next;
}
