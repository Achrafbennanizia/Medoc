/** Formatting for History entries (T5.8): field labels, values, and who/where lines. */
import type { HistoryFieldChange } from "@/systems/practice-host/controllers/history.controller";

const MAX_VALUE = 140;

/** `treating_staff_id` → "Treating staff" when no translation exists. */
export function humanizeField(field: string): string {
    const words = field.replace(/_id$/, "").replace(/_/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A stored value as text; staff ids show the person's name. Empty → null (shown as a dash). */
export function formatValue(value: unknown, label?: string): string | null {
    if (label) return label;
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value ? "✓" : "✗";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

/** Old and new text of one change. */
export function changeTexts(c: HistoryFieldChange): { old: string | null; next: string | null } {
    return { old: formatValue(c.old, c.oldLabel), next: formatValue(c.new, c.newLabel) };
}
