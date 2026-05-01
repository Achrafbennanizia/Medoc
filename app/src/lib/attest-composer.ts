/** Attest-Erfassung in der Akte — angeglichen an Attest-Vorlagen (`kind: "ATTEST"`). */

export const ATTEST_TYP_OPTIONS = [
    { value: "Arbeitsunfähigkeitsbescheinigung", label: "Arbeitsunfähigkeitsbescheinigung" },
    { value: "Sportbefreiung", label: "Sportbefreiung" },
    { value: "Schulbefreiung", label: "Schulbefreiung" },
    { value: "Behandlungsbestätigung", label: "Behandlungsbestätigung" },
    { value: "Sonstiges", label: "Sonstiges" },
] as const;

export const KRANKHEITEN_SUGGESTIONS: string[] = [
    "grippaler Infekt",
    "Rückenschmerzen",
    "Migräne",
    "Zahnbehandlung",
    "Akute Pulpitis",
    "Parodontitis",
    "Wundheilung nach Extraktion",
    "Kieferorthopädische Behandlung",
    "Sonstiges",
];

export type AttestComposerFormFields = {
    typ: string;
    krankheiten: string;
    tageAnzahl: string;
    einschraenkung: string;
    gueltig_von: string;
    gueltig_bis: string;
};

export function emptyAttestComposerForm(today: string): AttestComposerFormFields {
    return {
        typ: ATTEST_TYP_OPTIONS[0]!.value,
        krankheiten: KRANKHEITEN_SUGGESTIONS[0] ?? "",
        tageAnzahl: "1",
        einschraenkung: "",
        gueltig_von: today,
        gueltig_bis: today,
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

/** Inklusive Kalendertage: bei n=1 ist bis gleich von. */
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
            `Ausstellung für die Zeit vom ${von} bis ${bis} (${n} Kalendertag${n === 1 ? "" : "e"}, einschließlich).`,
        );
    }
    if (k) parts.push(`Diagnose / Befund:\n${k}`);
    if (e) parts.push(`Empfohlene Tätigkeitseinschränkung:\n${e}`);
    return parts.join("\n\n");
}

export function validateAttestComposer(fields: AttestComposerFormFields): string | null {
    if (!fields.typ.trim()) return "Bitte einen Attesttyp wählen.";
    const n = Number.parseInt(fields.tageAnzahl.trim(), 10);
    if (!fields.tageAnzahl.trim() || !Number.isFinite(n) || n < 1 || n > 366) {
        return "Anzahl der Tage: bitte eine ganze Zahl zwischen 1 und 366 eingeben.";
    }
    if (!fields.krankheiten.trim()) return "Bitte Diagnose / Befund angeben.";
    if (!fields.gueltig_von.trim() || !fields.gueltig_bis.trim()) return "Bitte Gültigkeit von/bis angeben.";
    return null;
}
