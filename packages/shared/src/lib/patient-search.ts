/**
 * Patient matching — ONE rule for every patient search box (patients page, patient picker, new
 * appointment, command palette). Honors Settings → Search → "Patient search: insurance number".
 *
 * Matches (accent- and case-insensitive, every word must match):
 * - name
 * - insurance number (only when enabled)
 * - date of birth typed as `YYYY-MM-DD`, `DD.MM.YYYY` or `DD/MM/YYYY`
 */
import type { Patient } from "@/models/types";

export type PatientSearchOptions = { includeInsuranceNumber: boolean };

function fold(s: string): string {
    return s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();
}

function dobVariants(dob: string | null | undefined): string[] {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? "");
    if (!m) return [];
    const [, y, mo, d] = m;
    return [`${y}-${mo}-${d}`, `${d}.${mo}.${y}`, `${d}/${mo}/${y}`];
}

export function patientMatchesQuery(
    patient: Pick<Patient, "name" | "insurance_number" | "date_of_birth">,
    query: string,
    opts: PatientSearchOptions,
): boolean {
    const q = fold(query);
    if (!q) return true;
    const hay = [
        fold(patient.name),
        opts.includeInsuranceNumber ? fold(patient.insurance_number ?? "") : "",
        ...dobVariants(patient.date_of_birth),
    ].join(" ");
    return q.split(/\s+/).every((part) => hay.includes(part));
}

export function filterPatients<P extends Pick<Patient, "name" | "insurance_number" | "date_of_birth">>(
    patients: readonly P[],
    query: string,
    opts: PatientSearchOptions,
    limit?: number,
): P[] {
    const out = patients.filter((p) => patientMatchesQuery(p, query, opts));
    return limit != null ? out.slice(0, limit) : out;
}
