/**
 * FA-AKTE-16 — heuristic for missing required/base entries (not clinical judgment).
 * Pure frontend logic; can be extended with practice rules later.
 */

import type { PatientStatus } from "@/models/types";
import { EMPTY_ANAMNESIS_V1_JSON, parseAnamnesisV1 } from "@/lib/anamnesis";

/** Tabs mit Sprungmarken in `patient-detail.tsx` / `#hash`. */
export type ChartCompletenessTab = "anamnesis" | "examination" | "treatment";

export type ChartCompletenessGap = {
    id: string;
    label: string;
    /** Missing for fields visible only in hero (e.g. insurance number). */
    tab?: ChartCompletenessTab;
};

export type ChartCompletenessResult = {
    gaps: ChartCompletenessGap[];
};

function deepHasNonEmptyString(o: unknown): boolean {
    if (typeof o === "string") return o.trim().length > 0;
    if (o && typeof o === "object" && !Array.isArray(o)) {
        for (const version of Object.values(o as Record<string, unknown>)) {
            if (deepHasNonEmptyString(version)) return true;
        }
    }
    return false;
}

/** True when anamnesis JSON is effectively empty (structure / placeholders only). */
export function anamnesisLooksEmpty(json: string): boolean {
    const t = json.trim();
    if (!t) return true;
    if (t === EMPTY_ANAMNESIS_V1_JSON.trim()) return true;
    const p = parseAnamnesisV1(json);
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

export type ComputeChartCompletenessArgs = {
    patientInsuranceNumber: string;
    anamnesisJson: string;
    dentalFindingsCount: number;
    examinationsCount: number;
    patientStatus: PatientStatus;
    /** Physician — clinical gaps (anamnesis, tooth, Examination); without role master data only. */
    includeClinicalGaps: boolean;
};

export function computeChartCompleteness(args: ComputeChartCompletenessArgs): ChartCompletenessResult {
    const gaps: ChartCompletenessGap[] = [];

    if (!args.patientInsuranceNumber.trim()) {
        gaps.push({ id: "kvnr", label: "Insurance number" });
    }

    if (args.includeClinicalGaps) {
        if (anamnesisLooksEmpty(args.anamnesisJson)) {
            gaps.push({ id: "anamnesis", label: "Medical history", tab: "anamnesis" });
        }
        if (args.dentalFindingsCount === 0) {
            gaps.push({ id: "zahn", label: "Dental findings", tab: "examination" });
        }
        const expectExamination = args.patientStatus !== "NEW";
        if (expectExamination && args.examinationsCount === 0) {
            gaps.push({ id: "examination", label: "Examination", tab: "examination" });
        }
    }

    return { gaps };
}
