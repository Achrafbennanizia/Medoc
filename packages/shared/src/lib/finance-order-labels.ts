import type { OrderStatus } from "./enums.generated";
import { clinicalServiceLabel } from "./clinical-service-label";
import { formatDate } from "./utils";

type TFn = (key: string) => string;

const PAYMENT_METHOD_KEYS: Record<string, string> = {
    CASH: "enum.payment_method.cash",
    CARD: "enum.payment_method.card",
    BANK_TRANSFER: "enum.payment_method.bankTransfer",
    INVOICE: "enum.payment_method.invoice",
};

const PAYMENT_STATUS_KEYS: Record<string, { variant: "success" | "warning" | "default"; key: string }> = {
    PAID: { variant: "success", key: "enum.payment_status.paid" },
    PARTIALLY_PAID: { variant: "warning", key: "enum.payment_status.partiallyPaid" },
    OUTSTANDING: { variant: "warning", key: "enum.payment_status.outstanding" },
    CANCELLED: { variant: "default", key: "enum.payment_status.cancelled" },
};

const ORDER_STATUS_KEYS: Record<OrderStatus, { variant: "success" | "warning" | "default"; key: string }> = {
    OPEN: { variant: "warning", key: "page.purchase_orders.status.open" },
    IN_TRANSIT: { variant: "warning", key: "page.purchase_orders.status.inTransit" },
    DELIVERED: { variant: "success", key: "page.purchase_orders.status.delivered" },
    CANCELLED: { variant: "default", key: "page.purchase_orders.status.cancelled" },
};

/** Wire values may be UPPER_SNAKE, camelCase, or lowercase. */
function enumLookupKey(value: string): string {
    return value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toUpperCase();
}

export function paymentMethodLabel(kind: string, t: TFn): string {
    const key = PAYMENT_METHOD_KEYS[enumLookupKey(kind)];
    return key ? t(key) : kind;
}

export function paymentStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    const row = PAYMENT_STATUS_KEYS[enumLookupKey(s)];
    if (row) return { variant: row.variant, label: t(row.key) };
    return { variant: "default", label: s || "—" };
}

export function orderStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const row = ORDER_STATUS_KEYS[enumLookupKey(status) as OrderStatus];
    if (row) return { variant: row.variant, label: t(row.key) };
    return { variant: "default", label: status };
}

export function referenceKurz(
    z: { treatment_id?: string | null; examination_id?: string | null },
    t: TFn,
): string {
    if (z.treatment_id) return t("enum.reference.treatment");
    if (z.examination_id) return t("enum.reference.examination");
    return t("enum.reference.direct_payment");
}

/** Drop Pflichtenheft / NFA codes that must never appear in the UI. */
export function stripRequirementIds(text: string): string {
    return text
        .replace(/\s*\((?:FA|NFA)-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\/\d+)?(?:\+\+)?\)\s*/gi, " ")
        .replace(/\b(?:FA|NFA)-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\/\d+)?(?:\+\+)?\b/gi, " ")
        .replace(/\bWAAD(?:\s+\d+(?:\.\d+)*)?\s*[—–-]?\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+[—–-]\s*$/g, "")
        .trim();
}

const AUTO_OPEN_BILLING =
    /created automatically after service entry:\s*open billing/i;
const AUTO_INSERT_BILLING =
    /created automatically on insert:\s*open billing(?:\s*\([^)]*\))?/i;
const OPEN_BILLING_TAIL = /\s*[—–-]\s*open billing(?:\s*\([^)]*\))?\s*$/i;
const ISO_DATE_TAIL = /\s*[—–-]\s*(\d{4}-\d{2}-\d{2})\s*$/;

/** User-facing payment note: translate catalog names, hide internal billing boilerplate. */
export function displayPaymentNote(note: string, t: TFn): string {
    let s = stripRequirementIds(note);
    if (!s) return t("payment.note.auto_open_billing");
    if (AUTO_OPEN_BILLING.test(s) || AUTO_INSERT_BILLING.test(s) || /^open billing\b/i.test(s)) {
        return t("payment.note.auto_open_billing");
    }
    s = s.replace(OPEN_BILLING_TAIL, "").trim();
    const iso = s.match(ISO_DATE_TAIL);
    let head = s;
    let datePart = "";
    if (iso && iso.index != null) {
        head = s.slice(0, iso.index).trim();
        datePart = formatDate(iso[1]!);
    }
    const labeled = clinicalServiceLabel(head);
    if (datePart) return labeled ? `${labeled} — ${datePart}` : datePart;
    return labeled || t("payment.note.auto_open_billing");
}

const PRACTICE_TASK_PHRASES: Record<string, string> = {
    "Demo billing follow-up": "practice_task.demo_billing_follow_up",
};

const AUTO_BILLING_PREFIX =
    /^(?:Payment erfassen|Zahlung erfassen|Record payment|Collect payment|Enregistrer un paiement|تسجيل دفعة)\s*[:：—–-]*\s*(.*)$/iu;

export function displayPracticeTaskTitle(title: string, t: TFn): string {
    const stripped = stripRequirementIds(title);
    const canned = PRACTICE_TASK_PHRASES[stripped];
    if (canned) return t(canned);
    const m = AUTO_BILLING_PREFIX.exec(stripped);
    if (m) {
        const rest = (m[1] ?? "").trim();
        const svc = rest ? clinicalServiceLabel(rest) : "";
        return svc ? `${t("practice_task.auto_billing")}: ${svc}` : t("practice_task.auto_billing");
    }
    return clinicalServiceLabel(stripped);
}

export function vorgangText(
    z: { treatment_id?: string | null; examination_id?: string | null; description?: string | null },
    t: TFn,
): string {
    const b = referenceKurz(z, t);
    const note = (z.description ?? "").trim();
    const direct = t("enum.reference.direct_payment");
    if (note) {
        const shown = displayPaymentNote(note, t);
        return b === direct ? shown : `${b} — ${shown}`;
    }
    return b;
}

export const ORDER_STATUS_OPTIONS: readonly OrderStatus[] = ["OPEN", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

export function orderStatusOptions(t: TFn): readonly { value: OrderStatus; label: string }[] {
    return ORDER_STATUS_OPTIONS.map((value) => ({
        value,
        label: orderStatusDisplay(value, t).label,
    }));
}
