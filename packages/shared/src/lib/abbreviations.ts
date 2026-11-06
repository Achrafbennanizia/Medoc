export type LabelPairMode = "full" | "short";

/**
 * Curated short forms for cramped UI (toolbars, table headers). Never use raw ellipsis truncation
 * for these concepts — use `pickLabel` + {@link ResponsiveLabel}.
 *
 * Copy lives in `packages/shared/locales/*.json` under `abbrev.<key>.{full,short,aria}`.
 */
export const LABEL_KEYS = [
    "order_number",
    "treatment_number",
    "examination_number",
    "session_number",
    "payment_method_bank_transfer",
    "payment_method_invoice",
    "payment_method_cash",
    "payment_method_card",
    "service_item",
    "patient_chart",
    "date_of_birth",
    "contact",
    "availability",
    "tax_number",
    "kv_number",
] as const;

export type LabelKey = (typeof LABEL_KEYS)[number];

type TFn = (key: string) => string;

export function pickLabel(t: TFn, key: LabelKey, mode: LabelPairMode): string {
    return t(`abbrev.${key}.${mode}`);
}

export function ariaForLabel(t: TFn, key: LabelKey): string {
    return t(`abbrev.${key}.aria`);
}
