/**
 * FA-AKTE-16 — Heuristik für fehlende Pflicht-/Basis-Einträge (kein klinisches Urteil).
 * Reine Frontend-Logik; kann später mit Praxis-Regeln erweitert werden.
 */

import type { PatientStatus } from "@/models/types";
import { EMPTY_ANAMNESE_V1_JSON, parseAnamneseV1 } from "@/lib/anamnese";

/** Tabs mit Sprungmarken in `patient-detail.tsx` / `#hash`. */
export type AkteCompletenessTab = "stamm" | "anam" | "unter" | "behand";

export type AkteCompletenessGap = {
    id: string;
    label: string;
    tab: AkteCompletenessTab;
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

/** True wenn Anamnese-JSON faktisch leer (nur Struktur / Platzhalter). */
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
    /** Arzt — klinische Lücken (Anamnese, Zahn, Untersuchung); ohne Rolle nur Stammdaten. */
    includeClinicalGaps: boolean;
};

export function computeAkteCompleteness(args: ComputeAkteCompletenessArgs): AkteCompletenessResult {
    const gaps: AkteCompletenessGap[] = [];

    if (!args.patientVersicherungsnummer.trim()) {
        gaps.push({ id: "kvnr", label: "Versicherungsnummer", tab: "stamm" });
    }

    if (args.includeClinicalGaps) {
        if (anamneseLooksEmpty(args.anamneseJson)) {
            gaps.push({ id: "anam", label: "Anamnese", tab: "anam" });
        }
        if (args.zahnbefundeCount === 0) {
            gaps.push({ id: "zahn", label: "Zahnbefund", tab: "unter" });
        }
        const expectUntersuchung = args.patientStatus !== "NEU";
        if (expectUntersuchung && args.untersuchungenCount === 0) {
            gaps.push({ id: "unter", label: "Untersuchung", tab: "unter" });
        }
    }

    return { gaps };
}
