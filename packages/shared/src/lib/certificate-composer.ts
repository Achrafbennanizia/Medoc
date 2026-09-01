/** Certificate capture in patient record — aligned with certificate templates (`kind: "CERTIFICATE"`). */

type TFn = (key: string) => string;

/** Serialized certificate type values (backend / stored documents — do not rename). */
export const CERTIFICATE_KIND_VALUES = [
    "SICK_LEAVE",
    "SPORTS_EXEMPTION",
    "SCHOOL_EXEMPTION",
    "TREATMENT_CONFIRMATION",
    "OTHER",
] as const;

const CERTIFICATE_KIND_LABEL_KEYS: Record<(typeof CERTIFICATE_KIND_VALUES)[number], string> = {
    SICK_LEAVE: "enum.certificate_kind.sick_leave_certificate",
    SPORTS_EXEMPTION: "enum.certificate_kind.sports_exemption",
    SCHOOL_EXEMPTION: "enum.certificate_kind.school_exemption",
    TREATMENT_CONFIRMATION: "enum.certificate_kind.treatment_confirmation",
    OTHER: "enum.certificate_kind.other",
};

export function certificateKindSelectOptions(t: TFn) {
    return CERTIFICATE_KIND_VALUES.map((value) => ({
        value,
        label: t(CERTIFICATE_KIND_LABEL_KEYS[value]),
    }));
}

/** @deprecated Use certificateKindSelectOptions(t) */
export const CERTIFICATE_KIND_OPTIONS = CERTIFICATE_KIND_VALUES.map((value) => ({
    value,
    label: value,
}));

export const ILLNESS_SUGGESTION_KEYS = [
    "template.suggestion.illness.cold",
    "template.suggestion.illness.back_pain",
    "template.suggestion.illness.migraine",
    "template.suggestion.illness.dental_treatment",
    "template.suggestion.illness.acute_pulpitis",
    "template.suggestion.illness.periodontitis",
    "template.suggestion.illness.post_extraction_healing",
    "template.suggestion.illness.orthodontic_treatment",
    "template.suggestion.illness.other",
] as const;

export function illnessSuggestionLabels(t: TFn): string[] {
    return ILLNESS_SUGGESTION_KEYS.map((k) => t(k));
}

export function defaultIllnessLabel(t: TFn): string {
    return illnessSuggestionLabels(t)[0] ?? "";
}

export type CertificateComposerFormFields = {
    kind: string;
    illnesses: string;
    dayCount: string;
    activityRestriction: string;
    valid_from: string;
    valid_until: string;
    icd10_code: string;
    first_or_follow_up: "FIRST" | "FOLLOW_UP";
    employer: string;
};

export function emptyCertificateComposerForm(today: string, t: TFn): CertificateComposerFormFields {
    return {
        kind: CERTIFICATE_KIND_VALUES[0],
        illnesses: defaultIllnessLabel(t),
        dayCount: "1",
        activityRestriction: "",
        valid_from: today,
        valid_until: today,
        icd10_code: "",
        first_or_follow_up: "FIRST",
        employer: "",
    };
}

function parsePayloadString(p: Record<string, unknown>, key: string): string {
    const v = p[key];
    return v == null ? "" : String(v);
}

export function parseCertificateTemplatePayload(payloadJson: string): {
    illnesses: string;
    dayCount: string;
    activityRestriction: string;
} {
    try {
        const p = JSON.parse(payloadJson) as Record<string, unknown>;
        const rawDays = p.day_count;
        return {
            illnesses: parsePayloadString(p, "illnesses"),
            dayCount: rawDays === undefined || rawDays === null ? "" : String(rawDays),
            activityRestriction: parsePayloadString(p, "activity_restriction"),
        };
    } catch {
        return { illnesses: "", dayCount: "", activityRestriction: "" };
    }
}

/** Inclusive calendar days: when n=1, end equals start. */
export function certificateValidUntilFromStartAndDays(validFromIso: string, dayCount: string): string {
    const from = validFromIso.slice(0, 10);
    const n = Number.parseInt(dayCount.trim(), 10);
    if (!Number.isFinite(n) || n < 1) return from;
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + (n - 1));
    return d.toISOString().slice(0, 10);
}

export function buildCertificateTemplatePayload(fields: {
    illnesses: string;
    dayCount: string;
    activityRestriction: string;
}): Record<string, unknown> {
    const n = Number.parseInt(fields.dayCount.trim(), 10);
    return {
        illnesses: fields.illnesses.trim(),
        day_count: Number.isFinite(n) ? n : fields.dayCount.trim(),
        activity_restriction: fields.activityRestriction.trim(),
    };
}

export function buildCertificateBodyText(fields: CertificateComposerFormFields): string {
    const k = fields.illnesses.trim();
    const e = fields.activityRestriction.trim();
    const n = Number.parseInt(fields.dayCount.trim(), 10);
    const from = fields.valid_from.slice(0, 10);
    const until = fields.valid_until.slice(0, 10);
    const parts: string[] = [];
    if (Number.isFinite(n) && n > 0) {
        parts.push(
            `Issued for the period from ${from} to ${until} (${n} calendar day${n === 1 ? "" : "s"}, inclusive).`,
        );
    }
    if (k) parts.push(`Diagnosis / finding:\n${k}`);
    if (e) parts.push(`Recommended activity restriction:\n${e}`);
    return parts.join("\n\n");
}

export function validateCertificateComposer(fields: CertificateComposerFormFields, t: TFn): string | null {
    if (!fields.kind.trim()) return t("page.patient_detail.certificate.validation.kind_required");
    const n = Number.parseInt(fields.dayCount.trim(), 10);
    if (!fields.dayCount.trim() || !Number.isFinite(n) || n < 1 || n > 366) {
        return t("page.patient_detail.certificate.validation.days_range");
    }
    if (!fields.illnesses.trim()) return t("page.patient_detail.certificate.validation.diagnosis_required");
    if (!fields.valid_from.trim() || !fields.valid_until.trim()) {
        return t("page.patient_detail.certificate.validation.validity_required");
    }
    return null;
}
