import type { Examination } from "@/models/types";

export interface ExaminationV1 {
    version: 1;
    chiefComplaint: string;
    painVas: string;
    painLocation: string;
    extraoral: {
        asymmetry: string;
        lymphNodes: string;
        tmj: string;
        muscles: string;
    };
    intraoral: {
        mucosa: string;
        tongue: string;
        gingiva: string;
        salivary: string;
    };
    psi: { s1: string; s2: string; s3: string; s4: string; s5: string; s6: string };
    bopPercent: string;
    plaqueIndex: string;
    hygieneScore: string;
    function: {
        cmd: string;
        bruxism: string;
        splint: string;
        notes: string;
    };
    imaging: {
        ordered: string;
        findings: string;
    };
    diagnosis: string;
    plan: string;
    /** Free-text summary for the whole examination. */
    generalNote: string;
    /** Per-FDI-tooth findings documented during this exam (e.g. "11" → note). */
    toothNotes: Record<string, string>;
}

export const EXAMINATION_V1_EMPTY: ExaminationV1 = {
    version: 1,
    chiefComplaint: "",
    painVas: "",
    painLocation: "",
    extraoral: { asymmetry: "", lymphNodes: "", tmj: "", muscles: "" },
    intraoral: { mucosa: "", tongue: "", gingiva: "", salivary: "" },
    psi: { s1: "", s2: "", s3: "", s4: "", s5: "", s6: "" },
    bopPercent: "",
    plaqueIndex: "",
    hygieneScore: "",
    function: { cmd: "", bruxism: "", splint: "", notes: "" },
    imaging: { ordered: "", findings: "" },
    diagnosis: "",
    plan: "",
    generalNote: "",
    toothNotes: {},
};

function isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}

function str(version: unknown): string {
    return typeof version === "string" ? version : "";
}

/**
 * Coerce arbitrary JSON (incl. partial / legacy without `version`) into a full V1 shape.
 */
export function normalizeExaminationV1(parsed: unknown): ExaminationV1 | null {
    if (!isRecord(parsed)) return null;
    const looksLike =
        parsed.version === 1 ||
        "chiefComplaint" in parsed ||
        "psi" in parsed ||
        "diagnosis" in parsed ||
        "extraoral" in parsed ||
        "intraoral" in parsed;
    if (!looksLike) return null;

    const ex = isRecord(parsed.extraoral) ? parsed.extraoral : {};
    const intr = isRecord(parsed.intraoral) ? parsed.intraoral : {};
    const psiRaw = isRecord(parsed.psi) ? parsed.psi : {};
    const fn = isRecord(parsed.function) ? parsed.function : {};
    const img = isRecord(parsed.imaging) ? parsed.imaging : {};
    const toothRaw = isRecord(parsed.toothNotes) ? parsed.toothNotes : {};

    return {
        version: 1,
        chiefComplaint: str(parsed.chiefComplaint),
        painVas: str(parsed.painVas),
        painLocation: str(parsed.painLocation),
        extraoral: {
            asymmetry: str(ex.asymmetry),
            lymphNodes: str(ex.lymphNodes),
            tmj: str(ex.tmj),
            muscles: str(ex.muscles),
        },
        intraoral: {
            mucosa: str(intr.mucosa),
            tongue: str(intr.tongue),
            gingiva: str(intr.gingiva),
            salivary: str(intr.salivary),
        },
        psi: {
            s1: str(psiRaw.s1),
            s2: str(psiRaw.s2),
            s3: str(psiRaw.s3),
            s4: str(psiRaw.s4),
            s5: str(psiRaw.s5),
            s6: str(psiRaw.s6),
        },
        bopPercent: str(parsed.bopPercent),
        plaqueIndex: str(parsed.plaqueIndex),
        hygieneScore: str(parsed.hygieneScore),
        function: {
            cmd: str(fn.cmd),
            bruxism: str(fn.bruxism),
            splint: str(fn.splint),
            notes: str(fn.notes),
        },
        imaging: {
            ordered: str(img.ordered),
            findings: str(img.findings),
        },
        diagnosis: str(parsed.diagnosis),
        plan: str(parsed.plan),
        generalNote: str(parsed.generalNote),
        toothNotes: Object.fromEntries(
            Object.entries(toothRaw)
                .filter(([k, version]) => /^\d{1,2}$/.test(k) && typeof version === "string" && version.trim())
                .map(([k, version]) => [k, (version as string).trim()]),
        ),
    };
}

export function parseExaminationV1(raw: string | null | undefined): ExaminationV1 | null {
    if (!raw?.trim()) return null;
    try {
        return normalizeExaminationV1(JSON.parse(raw));
    } catch {
        return null;
    }
}

/** True when any structured examination section has user-entered content. */
export function hasExamContent(data: ExaminationV1): boolean {
    if (
        data.generalNote.trim() ||
        data.chiefComplaint.trim() ||
        data.diagnosis.trim() ||
        data.plan.trim() ||
        data.painVas.trim() ||
        data.painLocation.trim()
    ) {
        return true;
    }
    if (Object.values(data.toothNotes).some((n) => n.trim())) return true;
    const { extraoral, intraoral, psi, function: fn, imaging } = data;
    if (
        extraoral.asymmetry.trim() ||
        extraoral.lymphNodes.trim() ||
        extraoral.tmj.trim() ||
        extraoral.muscles.trim()
    ) {
        return true;
    }
    if (
        intraoral.mucosa.trim() ||
        intraoral.tongue.trim() ||
        intraoral.gingiva.trim() ||
        intraoral.salivary.trim()
    ) {
        return true;
    }
    if (Object.values(psi).some((version) => version.trim())) return true;
    if (data.bopPercent.trim() || data.plaqueIndex.trim() || data.hygieneScore.trim()) return true;
    if (fn.cmd.trim() || fn.bruxism.trim() || fn.splint.trim() || fn.notes.trim()) return true;
    if (imaging.ordered.trim() || imaging.findings.trim()) return true;
    return false;
}

/** Resolved clinical text for list + detail views (JSON V1 + legacy columns). */
export function clinicalSummaryFromExamination(examination: Examination): {
    detail: ExaminationV1 | null;
    diagnosis: string;
    plan: string;
    generalNote: string;
} {
    const detail = parseExaminationV1(examination.results);
    const diagnosis = (detail?.diagnosis || examination.diagnosis || "").trim();
    const plan = (detail?.plan || "").trim();
    const generalNote = (detail?.generalNote || (!detail ? examination.chief_complaint : null) || "").trim();
    return { detail, diagnosis, plan, generalNote };
}

export type ExaminationToothNoteEntry = {
    examinationId: string;
    createdAt: string;
    examinationNumber: string | null;
    note: string;
};

/** Per-tooth examination notes from structured ExaminationV1 JSON (newest first). */
export function examinationToothNotesForTooth(examinations: Examination[], fdi: string): ExaminationToothNoteEntry[] {
    const out: ExaminationToothNoteEntry[] = [];
    for (const examination of examinations) {
        const parsed = parseExaminationV1(examination.results);
        const note = parsed?.toothNotes[fdi]?.trim();
        if (!note) continue;
        out.push({
            examinationId: examination.id,
            createdAt: examination.created_at,
            examinationNumber: examination.examination_number ?? null,
            note,
        });
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Next `U-{year}-{nnn}` per chart — same sequence as the SQLite `examination_number` helper in Rust. */
export function previewNextExaminationNumber(existing: Iterable<string | null | undefined>): string {
    const year = new Date().getFullYear();
    const prefix = `U-${year}-`;
    let max = 0;
    for (const raw of existing) {
        const n = (raw ?? "").trim();
        if (!n.startsWith(prefix)) continue;
        const rest = n.slice(prefix.length);
        const version = Number.parseInt(rest, 10);
        if (Number.isFinite(version) && version > max) max = version;
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
