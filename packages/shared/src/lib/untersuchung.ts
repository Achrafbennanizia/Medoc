export interface UntersuchungV1 {
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

export const UNTERSUCHUNG_V1_EMPTY: UntersuchungV1 = {
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

function str(v: unknown): string {
    return typeof v === "string" ? v : "";
}

/**
 * Coerce arbitrary JSON (incl. partial / legacy without `version`) into a full V1 shape.
 */
export function normalizeUntersuchungV1(parsed: unknown): UntersuchungV1 | null {
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
                .filter(([k, v]) => /^\d{1,2}$/.test(k) && typeof v === "string" && v.trim())
                .map(([k, v]) => [k, (v as string).trim()]),
        ),
    };
}

export function parseUntersuchungV1(raw: string | null | undefined): UntersuchungV1 | null {
    if (!raw?.trim()) return null;
    try {
        return normalizeUntersuchungV1(JSON.parse(raw));
    } catch {
        return null;
    }
}

/** Next `U-{Jahr}-{nnn}` per Akte — same logic as `akte_repo::next_untersuchungsnummer` (Rust). */
export function previewNextUntersuchungsnummer(existing: Iterable<string | null | undefined>): string {
    const year = new Date().getFullYear();
    const prefix = `U-${year}-`;
    let max = 0;
    for (const raw of existing) {
        const n = (raw ?? "").trim();
        if (!n.startsWith(prefix)) continue;
        const rest = n.slice(prefix.length);
        const v = Number.parseInt(rest, 10);
        if (Number.isFinite(v) && v > max) max = v;
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
