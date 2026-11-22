import type { Sex, Patient } from "@/models/types";

import { csvCell } from "@/lib/export-delimited";

/** Semicolon CSV cell (aligned with `migration.rs` import) + formula-injection guard. */
function escapeSemicolonField(raw: string): string {
    return csvCell(raw, ";");
}

function sexToImportLetter(g: Sex): string {
    switch (g) {
        case "MALE":
            return "M";
        case "FEMALE":
            return "F";
        default:
            return "D";
    }
}

/** Prefer ISO date prefix; keeps values compatible with `import_patients` (`YYYY-MM-DD` or `DD.MM.YYYY`). */
function dateOfBirthForCsv(isoOrDate: string): string {
    const s = isoOrDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) return s;
    return s.slice(0, 10);
}

const MIGRATION_HEADER =
    "name;date_of_birth;sex;insurance_number;phone;email;address";

/**
 * Builds a CSV string ready for `import_patients_csv` / ops migration
 * (header mandatory; semicolon delimiter).
 */
export function buildPatientsMigrationCsv(patients: readonly Patient[]): string {
    const lines: string[] = [MIGRATION_HEADER];
    for (const p of patients) {
        lines.push(
            [
                escapeSemicolonField(p.name),
                escapeSemicolonField(dateOfBirthForCsv(p.date_of_birth)),
                escapeSemicolonField(sexToImportLetter(p.sex)),
                escapeSemicolonField(p.insurance_number),
                escapeSemicolonField(p.phone ?? ""),
                escapeSemicolonField(p.email ?? ""),
                escapeSemicolonField(p.address ?? ""),
            ].join(";"),
        );
    }
    return lines.join("\r\n");
}
