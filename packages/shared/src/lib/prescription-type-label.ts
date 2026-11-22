/** Prescription kind (`PRIVAT`, `KASSE` …) in the document language; unknown kinds show their code. */
import { docT } from "./document-translate";

export function prescriptionTypeLabel(raw: string): string {
    const code = (raw.trim() || "PRIVAT").toUpperCase();
    const key = `prescription.kind.${code}`;
    const label = docT(key);
    return label === key ? code : label;
}
