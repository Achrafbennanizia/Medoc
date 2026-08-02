/**
 * FA-AKTE-16 — heuristic for missing required/base entries (not clinical judgment).
 * Pure frontend logic; can be extended with practice rules later.
 */

import type { PatientStatus } from "@/models/types";
import { EMPTY_ANAMNESE_V1_JSON, parseAnamneseV1 } from "@/lib/anamnese";

/** Tabs mit Sprungmarken in `patient-detail.tsx` / `#hash`. */
export type AkteCompletenessTab = "anam" | "unter" | "behand";

export type AkteCompletenessGap = {
    id: string;
    label: string;
    /** Missing for fields visible only in hero (e.g. insurance number). */
    tab?: AkteCompletenessTab;
};

export type AkteCompletenessResult = {
    gaps: AkteCompletenessGap[];
};

function deepHasNonEmptyString(o: unknown): boolean {
    if (typeof o === "string") return o.trim().length > 0;
    if (o && typeof o === "object" && !Array.isArray(o)) {
        for (const v of Object.values(o as Record<string, unknown>)) {
            if (deepHasNonEmptyString(v)) return true;
        }
    }
    return false;
}

/** True when anamnesis JSON is effectively empty (structure / placeholders only). */
export function anamneseLooksEmpty(json: string): boolean {
    const t = json.trim();
    if (!t) return true;
    if (t === EMPTY_ANAMNESE_V1_JSON.trim()) return true;
    const p = parseAnamneseV1(json);
    if (!p) {
        try {
            return !deepHasNonEmptyString(JSON.parse(t));
        } catch {
            return true;
        }
    }
    const rec = { ...(p as Record<string, unknown>) };
    delete rec.version;
    return !deepHasNonEmptyString(rec);
}

export type ComputeAkteCompletenessArgs = {
    patientVersicherungsnummer: string;
    anamneseJson: string;
    zahnbefundeCount: number;
    untersuchungenCount: number;
    patientStatus: PatientStatus;
    /** Physician — clinical gaps (anamnesis, tooth, Untersuchung); without role master data only. */
    includeClinicalGaps: boolean;
};

export function computeAkteCompleteness(args: ComputeAkteCompletenessArgs): AkteCompletenessResult {
    const gaps: AkteCompletenessGap[] = [];

    if (!args.patientVersicherungsnummer.trim()) {
        gaps.push({ id: "kvnr", label: "Insurance number" });
    }

    if (args.includeClinicalGaps) {
        if (anamneseLooksEmpty(args.anamneseJson)) {
            gaps.push({ id: "anam", label: "Medical history", tab: "anam" });
        }
        if (args.zahnbefundeCount === 0) {
            gaps.push({ id: "zahn", label: "Dental findings", tab: "unter" });
        }
        const expectUntersuchung = args.patientStatus !== "NEU";
        if (expectUntersuchung && args.untersuchungenCount === 0) {
            gaps.push({ id: "unter", label: "Examination", tab: "unter" });
        }
    }

    return { gaps };
}
