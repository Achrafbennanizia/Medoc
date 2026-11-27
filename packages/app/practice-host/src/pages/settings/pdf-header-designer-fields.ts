/** Drag tokens and field previews for the PDF header designer (split from `pdf-header-designer.tsx`). */
import { headerTableJson, isHeaderField, type HeaderTable } from "@/lib/document-header-layout";
import type { PracticeFieldKey } from "@/lib/document-template-schema";

export const FIELD_MIME = "text/plain";

export function dragToken(kind: "field" | "cell", value: string): string {
    return `${kind}:${value}`;
}

export type HeaderKind = "name" | "address" | "contact" | "identity" | "other";

export function headerKind(id: PracticeFieldKey): HeaderKind {
    if (id === "name") return "name";
    if (id === "address") return "address";
    if (id === "phone" || id === "fax" || id === "email" || id === "web" || id === "emergency_phone") {
        return "contact";
    }
    if (id === "bsnr" || id === "zanr" || id === "kv" || id === "tax" || id === "bank" || id === "ma_ids" || id === "fr_ids") return "identity";
    return "other";
}

export function practiceText(practice: Record<string, unknown> | null, key: string): string {
    const value = practice?.[key];
    return typeof value === "string" ? value.trim() : "";
}

export function fieldPreview(id: PracticeFieldKey, practice: Record<string, unknown> | null, label: string): string {
    const text = (key: string) => practiceText(practice, key);
    switch (id) {
        case "name":
            return text("name") || label;
        case "address": {
            const lines = text("addr")
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
            return lines.length > 0 ? lines.join("\n") : label;
        }
        case "phone":
            return text("phone") ? `Tel. ${text("phone")}` : label;
        case "fax":
            return text("fax") ? `Fax ${text("fax")}` : label;
        case "email":
            return text("email") || label;
        case "web":
            return text("web").replace(/^https?:\/\//i, "") || label;
        case "emergency_phone":
            return text("emergency_phone") ? `Notdienst ${text("emergency_phone")}` : label;
        case "bsnr":
            return text("bsnr") ? `BSNR ${text("bsnr")}` : label;
        case "zanr":
            return text("zanr") ? `ZANR ${text("zanr")}` : label;
        case "kv":
            return text("kv_number") ? `KV ${text("kv_number")}` : label;
        case "tax":
            return text("tax_number") ? `Steuer-Nr. ${text("tax_number")}` : label;
        case "bank":
            return text("bank_iban") ? `IBAN ${text("bank_iban")}` : label;
        case "clinician": {
            const name = text("clinician_name");
            const title = text("professional_title");
            return [name, title].filter(Boolean).join("\n") || label;
        }
        case "hours":
            return text("opening_hours") || label;
        case "chamber":
            return text("chamber") || label;
        case "kzv":
            return text("kzv") || label;
        case "ma_ids": {
            const ids = [
                ["ICE", "ma_ice"],
                ["IF", "ma_if"],
                ["TP", "ma_tp"],
                ["RC", "ma_rc"],
                ["CNSS", "ma_cnss"],
                ["INPE", "ma_inpe"],
            ]
                .filter(([, key]) => text(key!))
                .map(([name, key]) => `${name} ${text(key!)}`);
            return ids.length ? ids.join("\n") : label;
        }
        case "fr_ids": {
            const ids = [
                ["RPPS", "fr_rpps"],
                ["SIRET", "fr_siret"],
            ]
                .filter(([, key]) => text(key!))
                .map(([name, key]) => `${name} ${text(key!)}`);
            return ids.length ? ids.join("\n") : label;
        }
        default:
            return label;
    }
}

export function sameTable(a: HeaderTable, b: HeaderTable): boolean {
    return headerTableJson(a) === headerTableJson(b);
}

export function readDrag(raw: string): { kind: "field"; id: PracticeFieldKey } | { kind: "cell"; row: number; col: number } | null {
    if (raw.startsWith("field:")) {
        const id = raw.slice("field:".length);
        return isHeaderField(id) ? { kind: "field", id } : null;
    }
    if (raw.startsWith("cell:")) {
        const [rowText, colText] = raw.slice("cell:".length).split(",");
        const row = Number(rowText);
        const col = Number(colText);
        if (Number.isInteger(row) && Number.isInteger(col)) return { kind: "cell", row, col };
    }
    return null;
}
