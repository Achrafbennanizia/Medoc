/** Certificate capture in patient record — aligned with attest templates (`kind: "ATTEST"`). */

type TFn = (key: string) => string;

/** Serialized attest type values (backend / stored documents — do not rename). */
export const ATTEST_TYP_VALUES = [
    "Arbeitsunfähigkeitsbescheinigung",
    "Sportbefreiung",
    "Schulbefreiung",
    "Behandlungsbestätigung",
    "Sonstiges",
] as const;

const ATTEST_TYP_LABEL_KEYS: Record<(typeof ATTEST_TYP_VALUES)[number], string> = {
    Arbeitsunfähigkeitsbescheinigung: "enum.attest_typ.arbeitsunfaehigkeitsbescheinigung",
    Sportbefreiung: "enum.attest_typ.sportbefreiung",
    Schulbefreiung: "enum.attest_typ.schulbefreiung",
    Behandlungsbestätigung: "enum.attest_typ.behandlungsbestaetigung",
    Sonstiges: "enum.attest_typ.sonstiges",
};

export function attestTypSelectOptions(t: TFn) {
    return ATTEST_TYP_VALUES.map((value) => ({
        value,
        label: t(ATTEST_TYP_LABEL_KEYS[value]),
    }));
}

/** @deprecated Use attestTypSelectOptions(t) */
export const ATTEST_TYP_OPTIONS = ATTEST_TYP_VALUES.map((value) => ({
    value,
    label: value,
}));

export const ILLNESS_SUGGESTION_KEYS = [
    "vorlage.suggestion.illness.cold",
    "vorlage.suggestion.illness.back_pain",
    "vorlage.suggestion.illness.migraine",
    "vorlage.suggestion.illness.dental_treatment",
    "vorlage.suggestion.illness.acute_pulpitis",
    "vorlage.suggestion.illness.periodontitis",
    "vorlage.suggestion.illness.post_extraction_healing",
    "vorlage.suggestion.illness.orthodontic_treatment",
    "vorlage.suggestion.illness.other",
] as const;

export function illnessSuggestionLabels(t: TFn): string[] {
    return ILLNESS_SUGGESTION_KEYS.map((k) => t(k));
}

export function defaultIllnessLabel(t: TFn): string {
    return illnessSuggestionLabels(t)[0] ?? "";
}

/** @deprecated Use illnessSuggestionLabels(t) */
export const KRANKHEITEN_SUGGESTIONS: string[] = [...ILLNESS_SUGGESTION_KEYS];

export type AttestComposerFormFields = {
    typ: string;
    krankheiten: string;
    tageAnzahl: string;
    einschraenkung: string;
    gueltig_von: string;
    gueltig_bis: string;
    icd10_code: string;
    erst_oder_folge: "ERST" | "FOLGE";
    arbeitgeber: string;
};

export function emptyAttestComposerForm(today: string, t: TFn): AttestComposerFormFields {
    return {
        typ: ATTEST_TYP_VALUES[0],
        krankheiten: defaultIllnessLabel(t),
        tageAnzahl: "1",
        einschraenkung: "",
        gueltig_von: today,
        gueltig_bis: today,
        icd10_code: "",
        erst_oder_folge: "ERST",
        arbeitgeber: "",
    };
}

export function parseAttestVorlagePayload(payloadJson: string): {
    krankheiten: string;
    tageAnzahl: string;
    einschraenkung: string;
} {
    try {
        const p = JSON.parse(payloadJson) as Record<string, unknown>;
        const rawTage = p.tage_anzahl;
        return {
            krankheiten: String(p.krankheiten ?? ""),
            tageAnzahl: rawTage === undefined || rawTage === null ? "" : String(rawTage),
            einschraenkung: String(p.einschraenkung ?? ""),
        };
    } catch {
        return { krankheiten: "", tageAnzahl: "", einschraenkung: "" };
    }
}

/** Inclusive calendar days: when n=1, end equals start. */
export function attestGueltigBisFromVonAndTage(gueltigVonIso: string, tageAnzahl: string): string {
    const von = gueltigVonIso.slice(0, 10);
    const n = Number.parseInt(tageAnzahl.trim(), 10);
    if (!Number.isFinite(n) || n < 1) return von;
    const d = new Date(`${von}T12:00:00`);
    d.setDate(d.getDate() + (n - 1));
    return d.toISOString().slice(0, 10);
}

export function buildAttestInhalt(fields: AttestComposerFormFields): string {
    const k = fields.krankheiten.trim();
    const e = fields.einschraenkung.trim();
    const n = Number.parseInt(fields.tageAnzahl.trim(), 10);
    const von = fields.gueltig_von.slice(0, 10);
    const bis = fields.gueltig_bis.slice(0, 10);
    const parts: string[] = [];
    if (Number.isFinite(n) && n > 0) {
        parts.push(
            `Issued for the period from ${von} to ${bis} (${n} calendar day${n === 1 ? "" : "s"}, inclusive).`,
        );
    }
    if (k) parts.push(`Diagnosis / finding:\n${k}`);
    if (e) parts.push(`Recommended activity restriction:\n${e}`);
    return parts.join("\n\n");
}

export function validateAttestComposer(fields: AttestComposerFormFields, t: TFn): string | null {
    if (!fields.typ.trim()) return t("page.patient_detail.attest.validation.typ_required");
    const n = Number.parseInt(fields.tageAnzahl.trim(), 10);
    if (!fields.tageAnzahl.trim() || !Number.isFinite(n) || n < 1 || n > 366) {
        return t("page.patient_detail.attest.validation.days_range");
    }
    if (!fields.krankheiten.trim()) return t("page.patient_detail.attest.validation.diagnosis_required");
    if (!fields.gueltig_von.trim() || !fields.gueltig_bis.trim()) {
        return t("page.patient_detail.attest.validation.validity_required");
    }
    return null;
}
