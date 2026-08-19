/**
 * Shared logic for payment booking: Kundenleistungen (PatientChart) and Finance → Neue Payment.
 */
import type { Treatment, Examination, Payment } from "@/models/types";
import { paymentStatusDisplay as paymentStatusDisplayI18N, paymentMethodLabel as paymentMethodLabelI18N } from "@/lib/finance-order-labels";

type TFn = (key: string) => string;

export const PAYMENT_KIND_VALUES = ["CASH", "CARD", "BANK_TRANSFER", "INVOICE"] as const;

export function paymentMethodSelectOptions(t: TFn) {
    return PAYMENT_KIND_VALUES.map((value) => ({
        value,
        label: paymentMethodLabelI18N(value, t),
    }));
}

/** @deprecated Use paymentMethodSelectOptions(t) */
export const PAYMENT_KIND_SELECT = [
    { value: "CASH", label: "Cash" },
    { value: "CARD", label: "Card" },
    { value: "BANK_TRANSFER", label: "Bank transfer" },
    { value: "INVOICE", label: "Invoice" },
] as const;

/** Status badge display for payment rows (patient Chart + Finance). */
export function paymentStatusDisplay(status: string, t: TFn) {
    return paymentStatusDisplayI18N(status, t);
}

export function paymentMethodLabel(kind: string, t: TFn): string {
    return paymentMethodLabelI18N(kind, t);
}

export function paymentCountsTowardPaid(status: string): boolean {
    return status.trim() !== "CANCELLED";
}

export const PAYMENT_EUR_EPS = 0.005;

export function roundMoney2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function sumPaymentsForTreatment(payments: Payment[], patientId: string, treatmentId: string): number {
    return payments
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.treatment_id === treatmentId
                && paymentCountsTowardPaid(z.status),
        )
        .reduce((s, z) => s + z.amount, 0);
}

export function sumPaymentsForExamination(payments: Payment[], patientId: string, examinationId: string): number {
    return payments
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.examination_id === examinationId
                && paymentCountsTowardPaid(z.status),
        )
        .reduce((s, z) => s + z.amount, 0);
}

/** Max allowed amount for new payment on this treatment (target minus already paid). */
export function maxNewPaymentTreatment(
    payments: Payment[],
    patientId: string,
    treatmentId: string,
    total_cost: number | null,
): number | null {
    if (total_cost == null || !Number.isFinite(total_cost)) return null;
    if (total_cost <= 0) return 0;
    const paid = sumPaymentsForTreatment(payments, patientId, treatmentId);
    return Math.max(0, roundMoney2(total_cost - paid));
}

export function maxNewPaymentExamination(
    payments: Payment[],
    patientId: string,
    examinationId: string,
    total_cost: number | null,
): number | null {
    if (total_cost == null || !Number.isFinite(total_cost)) return null;
    if (total_cost <= 0) return 0;
    const paid = sumPaymentsForExamination(payments, patientId, examinationId);
    return Math.max(0, roundMoney2(total_cost - paid));
}

export function maxEditPaymentExamination(
    payments: Payment[],
    patientId: string,
    examinationId: string,
    excludePaymentId: string,
    total_cost: number | null,
): number | null {
    if (total_cost == null || !Number.isFinite(total_cost)) return null;
    if (total_cost <= 0) return 0;
    const otherPaid = payments
        .filter(
            (x) =>
                x.patient_id === patientId
                && x.examination_id === examinationId
                && x.id !== excludePaymentId
                && paymentCountsTowardPaid(x.status),
        )
        .reduce((s, x) => s + x.amount, 0);
    return Math.max(0, roundMoney2(total_cost - otherPaid));
}

/** Max amount when editing: target minus all other payments on same line. */
export function maxEditPaymentTreatment(
    payments: Payment[],
    patientId: string,
    treatmentId: string,
    excludePaymentId: string,
    total_cost: number | null,
): number | null {
    if (total_cost == null || !Number.isFinite(total_cost)) return null;
    if (total_cost <= 0) return 0;
    const otherPaid = payments
        .filter(
            (x) =>
                x.patient_id === patientId
                && x.treatment_id === treatmentId
                && x.id !== excludePaymentId
                && paymentCountsTowardPaid(x.status),
        )
        .reduce((s, x) => s + x.amount, 0);
    return Math.max(0, roundMoney2(total_cost - otherPaid));
}

export function paymentHistoryForTreatment(payments: Payment[], patientId: string, treatmentId: string): Payment[] {
    return payments
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.treatment_id === treatmentId
                && paymentCountsTowardPaid(z.status),
        )
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function paymentHistoryForExamination(payments: Payment[], patientId: string, examinationId: string): Payment[] {
    return payments
        .filter(
            (z) =>
                z.patient_id === patientId
                && z.examination_id === examinationId
                && paymentCountsTowardPaid(z.status),
        )
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** One assignment (B or U line) with aggregated current state across all bookings. */
export type PaymentAssignmentSummaryRow = {
    key: string;
    kind: "treatment" | "examination";
    lineId: string;
    referenceShort: string;
    referenceLine: string;
    soll: number | null;
    gezahlt: number;
    offen: number | null;
    status: Payment["status"];
    latestAt: string;
};

function assignmentKeyTreatment(id: string): string {
    return `treatment:${id}`;
}

function assignmentKeyExamination(id: string): string {
    return `examination:${id}`;
}

/** For new payment assignment: line still open (remaining target or pending/partial bookings). */
export function assignmentStillOpenForNewPayment(
    payments: Payment[],
    patientId: string,
    treatments: Treatment[],
    examinations: Examination[],
    linkValue: string,
): boolean {
    if (!linkValue.includes(":")) return true;
    const i = linkValue.indexOf(":");
    const kind = linkValue.slice(0, i);
    const id = linkValue.slice(i + 1);
    if (kind === "treatment") {
        const bh = treatments.find((b) => b.id === id);
        const ges =
            bh?.total_cost != null && Number.isFinite(bh.total_cost) ? bh.total_cost : null;

        const rowsBh = payments.filter(
            (z) =>
                z.patient_id === patientId && z.treatment_id === id && paymentCountsTowardPaid(z.status),
        );

        if (ges != null && ges > PAYMENT_EUR_EPS) {
            const maxNew = maxNewPaymentTreatment(payments, patientId, id, ges);
            return maxNew != null && maxNew > PAYMENT_EUR_EPS;
        }

        if (rowsBh.length === 0) return true;
        return rowsBh.some((z) => z.status === "OUTSTANDING" || z.status === "PARTIALLY_PAID");
    }
    if (kind === "examination" || kind === "unter") {
        const u = examinations.find((x) => x.id === id);
        const ges =
            u?.total_cost != null && Number.isFinite(u.total_cost) ? u.total_cost : null;
        const rowsU = payments.filter(
            (z) =>
                z.patient_id === patientId && z.examination_id === id && paymentCountsTowardPaid(z.status),
        );
        if (ges != null && ges > PAYMENT_EUR_EPS) {
            const maxNew = maxNewPaymentExamination(payments, patientId, id, ges);
            return maxNew != null && maxNew > PAYMENT_EUR_EPS;
        }
        if (rowsU.length === 0) return true;
        return rowsU.some((z) => z.status === "OUTSTANDING" || z.status === "PARTIALLY_PAID");
    }
    return false;
}

/** Assignment selection only for still-open B/U lines (no closed target; without target/U only for pending bookings). */
export function buildOpenPaymentLinkSelectOptions(
    payments: Payment[],
    patientId: string,
    treatments: Treatment[],
    examinations: Examination[],
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { value: string; label: string }[] {
    const all = buildPaymentLinkSelectOptions(treatments, examinations, t, tp);
    const filtered = all.filter(
        (o) =>
            !o.value
            || assignmentStillOpenForNewPayment(payments, patientId, treatments, examinations, o.value),
    );
    if (filtered.length <= 1) {
        return [{
            value: "",
            label: t("payment.link.no_open_select"),
        }];
    }
    return filtered;
}

function deriveAggregateStatus(gezahlt: number, soll: number | null): Payment["status"] {
    const g = roundMoney2(gezahlt);
    if (soll != null && Number.isFinite(soll) && soll > PAYMENT_EUR_EPS) {
        const offen = roundMoney2(soll - g);
        if (offen <= PAYMENT_EUR_EPS) return "PAID";
        if (g <= PAYMENT_EUR_EPS) return "OUTSTANDING";
        return "PARTIALLY_PAID";
    }
    if (g > PAYMENT_EUR_EPS) return "PAID";
    return "OUTSTANDING";
}

/** Latest booking for an assignment line (for receipt from summary view). */
export function latestPaymentForAssignmentRow(
    row: Pick<PaymentAssignmentSummaryRow, "kind" | "lineId">,
    payments: Payment[],
    patientId: string,
): Payment | null {
    const filtered = payments.filter(
        (z) =>
            z.patient_id === patientId
            && paymentCountsTowardPaid(z.status)
            && (row.kind === "treatment" ? z.treatment_id === row.lineId : z.examination_id === row.lineId),
    );
    if (filtered.length === 0) return null;
    return filtered.reduce((best, z) => (String(z.created_at) > String(best.created_at) ? z : best));
}

type PaymentLabelFn = (key: string) => string;
type PaymentLabelParamsFn = (key: string, params: Record<string, string | number>) => string;

/** Exactly one row per B/U line: current state (booking sum, open, status). */
export function aggregatePaymentsByAssignment(
    payments: Payment[],
    patientId: string,
    treatments: Treatment[],
    examinations: Examination[],
    t?: PaymentLabelFn,
    tp?: PaymentLabelParamsFn,
): PaymentAssignmentSummaryRow[] {
    type Acc = {
        kind: "treatment" | "examination";
        lineId: string;
        gezahlt: number;
        latestAt: string;
    };
    const map = new Map<string, Acc>();

    for (const z of payments) {
        if (z.patient_id !== patientId || !paymentCountsTowardPaid(z.status)) continue;
        let key: string | null = null;
        let kind: "treatment" | "examination" | null = null;
        let lineId: string | null = null;
        if (z.treatment_id) {
            key = assignmentKeyTreatment(z.treatment_id);
            kind = "treatment";
            lineId = z.treatment_id;
        } else if (z.examination_id) {
            key = assignmentKeyExamination(z.examination_id);
            kind = "examination";
            lineId = z.examination_id;
        } else {
            key = `solo:${z.id}`;
            kind = "treatment";
            lineId = z.id;
        }
        const prev = map.get(key);
        const bet = z.amount;
        const at = z.created_at;
        if (!prev) {
            map.set(key, { kind: kind!, lineId: lineId!, gezahlt: bet, latestAt: at });
        } else {
            prev.gezahlt = roundMoney2(prev.gezahlt + bet);
            if (at.localeCompare(prev.latestAt) > 0) prev.latestAt = at;
        }
    }

    const rows: PaymentAssignmentSummaryRow[] = [];
    for (const [key, acc] of map) {
        if (key.startsWith("solo:")) {
            const z = payments.find((x) => x.id === acc.lineId);
            if (!z) continue;
            rows.push({
                key,
                kind: "treatment",
                lineId: acc.lineId,
                referenceShort: "—",
                referenceLine: formatPaymentReferenceLine(z, treatments, examinations, t, tp),
                soll: null,
                gezahlt: acc.gezahlt,
                offen: null,
                status: z.status as Payment["status"],
                latestAt: acc.latestAt,
            });
            continue;
        }
        if (acc.kind === "treatment") {
            const b = treatments.find((x) => x.id === acc.lineId);
            const soll =
                b?.total_cost != null && Number.isFinite(b.total_cost) ? b.total_cost : null;
            const offen =
                soll != null && soll > PAYMENT_EUR_EPS ? Math.max(0, roundMoney2(soll - acc.gezahlt)) : null;
            const bn = (b?.treatment_number ?? "").trim();
            const referenceShort = bn ? `B ${bn}` : "B";
            const pseudoZ: Payment = {
                id: acc.lineId,
                patient_id: patientId,
                treatment_id: acc.lineId,
                amount: acc.gezahlt,
                payment_method: "CASH",
                status: "PAID",
                service_item_id: null,
                description: null,
                created_at: acc.latestAt,
            };
            const referenceLine = formatPaymentReferenceLine(pseudoZ, treatments, examinations, t, tp);
            rows.push({
                key,
                kind: "treatment",
                lineId: acc.lineId,
                referenceShort,
                referenceLine,
                soll,
                gezahlt: acc.gezahlt,
                offen,
                status: deriveAggregateStatus(acc.gezahlt, soll),
                latestAt: acc.latestAt,
            });
        } else {
            const u = examinations.find((x) => x.id === acc.lineId);
            const soll =
                u?.total_cost != null && Number.isFinite(u.total_cost) ? u.total_cost : null;
            const offen =
                soll != null && soll > PAYMENT_EUR_EPS ? Math.max(0, roundMoney2(soll - acc.gezahlt)) : null;
            const un = (u?.examination_number ?? "").trim();
            const referenceShort = un ? `U ${un}` : "U";
            const pseudoZ: Payment = {
                id: acc.lineId,
                patient_id: patientId,
                examination_id: acc.lineId,
                amount: acc.gezahlt,
                payment_method: "CASH",
                status: "PAID",
                service_item_id: null,
                description: null,
                created_at: acc.latestAt,
            };
            const referenceLine = formatPaymentReferenceLine(pseudoZ, treatments, examinations, t, tp);
            rows.push({
                key,
                kind: "examination",
                lineId: acc.lineId,
                referenceShort,
                referenceLine,
                soll,
                gezahlt: acc.gezahlt,
                offen,
                status: deriveAggregateStatus(acc.gezahlt, soll),
                latestAt: acc.latestAt,
            });
        }
    }

    rows.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return rows;
}

/** Chart reference for display: B-Nr. / U-Nr. first (booking line, not free-text comment). */
export function buildPaymentLinkSelectOptions(
    treatments: Treatment[],
    examinations: Examination[],
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [{
        value: "",
        label: t("payment.link.select_placeholder"),
    }];
    for (const b of treatments) {
        const bn = (b.treatment_number ?? "").trim();
        const bnr = bn ? tp("payment.link.b_nr", { nr: bn }) : t("payment.link.b_nr_missing");
        const line = (b.service_name || b.description || b.kind || t("payment.link.treatment")).trim();
        opts.push({ value: `treatment:${b.id}`, label: line ? `${bnr} — ${line}` : bnr });
    }
    for (const u of examinations) {
        const un = (u.examination_number ?? "").trim();
        const unr = un ? tp("payment.link.u_nr", { nr: un }) : t("payment.link.u_nr_missing");
        const line = (u.diagnosis || t("payment.link.examination")).trim();
        opts.push({ value: `unter:${u.id}`, label: line ? `${unr} — ${line}` : unr });
    }
    return opts;
}

/** Short label for a payment in lists (Finance / history) — via B-no. or U-no. */
export function formatPaymentReferenceLine(
    z: Payment,
    treatments: Treatment[],
    examinations: Examination[],
    t?: PaymentLabelFn,
    tp?: PaymentLabelParamsFn,
): string {
    if (z.treatment_id) {
        const b = treatments.find((x) => x.id === z.treatment_id);
        const nr = b?.treatment_number?.trim() || "—";
        const sub = b ? (b.service_name || b.description || b.kind || "").trim() : "";
        const prefix = t && tp
            ? (nr === "—" ? t("payment.link.b_nr_missing") : tp("payment.link.b_nr", { nr }))
            : (nr === "—" ? "B-Nr. —" : `B-Nr. ${nr}`);
        return sub ? `${prefix} — ${sub}` : prefix;
    }
    if (z.examination_id) {
        const u = examinations.find((x) => x.id === z.examination_id);
        const nr = u?.examination_number?.trim() || "—";
        const sub = u?.diagnosis?.trim() || "";
        const prefix = t && tp
            ? (nr === "—" ? t("payment.link.u_nr_missing") : tp("payment.link.u_nr", { nr }))
            : (nr === "—" ? "U-Nr. —" : `U-Nr. ${nr}`);
        return sub ? `${prefix} — ${sub}` : prefix;
    }
    return t ? t("payment.link.no_bu_line") : "Ohne B/U-Zeile";
}
