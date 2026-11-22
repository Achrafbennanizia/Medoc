/**
 * The lines a prescription screen is about to issue: the added lines plus the draft when the
 * doctor started filling it. Every line is checked, including lines taken from a predefined
 * prescription, so an incomplete line is named ("Line 2: Please enter dosage.") instead of
 * failing later on the server, and a half-filled draft is never dropped silently.
 */
import type { PrescriptionLine } from "./medications";
import { validatePrescriptionLine } from "./validate-prescription-line";

type T = (key: string) => string;
type Tp = (key: string, params: Record<string, string | number>) => string;

export type PrescriptionQueue = { lines: PrescriptionLine[]; error: null } | { lines: null; error: string };

export function isPrescriptionLineStarted(line: PrescriptionLine): boolean {
    return [line.medication, line.active_ingredient, line.dosage, line.duration, line.instructions].some((v) => v.trim() !== "");
}

export function buildPrescriptionQueue(lines: PrescriptionLine[], draft: PrescriptionLine, t: T, tp: Tp): PrescriptionQueue {
    const queue = isPrescriptionLineStarted(draft) ? [...lines, draft] : [...lines];
    if (queue.length === 0) return { lines: null, error: t("page.prescriptions.validation.min_one_line") };
    for (let i = 0; i < queue.length; i++) {
        const problem = validatePrescriptionLine(queue[i]!, t);
        if (problem) {
            return { lines: null, error: queue.length === 1 ? problem : tp("page.prescriptions.validation.line_problem", { line: i + 1, problem }) };
        }
    }
    return { lines: queue.map((l) => ({ ...l })), error: null };
}
