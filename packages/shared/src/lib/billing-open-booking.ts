/**
 * FA-LEIST-06 — mirrors `pricing::treatment_has_billable_service_item` + patient-detail UX.
 */
import type { PaymentMethod } from "@/models/types";
import type { PatientDetailChartTab } from "@/lib/patient-detail-utils";

/** FA-LEIST-06/07 — same rule for Treatment and Examination. */
export function treatmentHasBillableServiceItem(
    service_name: string | null | undefined,
    total_cost: number | null | undefined,
): boolean {
    if ((service_name ?? "").trim().length > 0) return true;
    const g = total_cost;
    return g != null && Number.isFinite(g) && g > 0.005;
}

export const examinationHasBillableServiceItem = treatmentHasBillableServiceItem;

/** FA-LEIST-05 — physician billing release recorded on Treatment / Examination rows. */
export function isReleasedForBilling(entry: {
    released_by_physician_id?: string | null;
    released_at?: string | null;
    released_by_physician_id?: string | null;
    released_at?: string | null;
}): boolean {
    const by = entry.released_by_physician_id ?? entry.released_by_physician_id;
    const at = entry.released_at ?? entry.released_at;
    return Boolean(by) && (at ?? "").trim() !== "";
}

export type PaymentNewFormState = {
    linkKind: "" | "treatment" | "examination";
    linkId: string;
    amount: string;
    payment_method: PaymentMethod;
    description: string;
};

export type OpenPaymentTabAfterTreatmentArgs = {
    treatmentId: string;
    total_cost: number | null;
    goTab: (tab: PatientDetailChartTab) => void;
    setShowPaymentComposer: (show: boolean) => void;
    setPaymentNewForm: (form: PaymentNewFormState) => void;
};

/** Patient Chart → billing tab, form "Neue Buchung" pre-filled. */
export function openPaymentTabAfterBillableTreatment(args: OpenPaymentTabAfterTreatmentArgs): void {
    const amount =
        args.total_cost != null && Number.isFinite(args.total_cost) && args.total_cost > 0
            ? String(args.total_cost)
            : "";
    args.goTab("payment");
    args.setPaymentNewForm({
        linkKind: "treatment",
        linkId: args.treatmentId,
        amount,
        payment_method: "CASH",
        description: "",
    });
    args.setShowPaymentComposer(true);
}

export type OpenPaymentTabAfterExaminationArgs = {
    examinationId: string;
    total_cost: number | null;
    goTab: (tab: PatientDetailChartTab) => void;
    setShowPaymentComposer: (show: boolean) => void;
    setPaymentNewForm: (form: PaymentNewFormState) => void;
};

export function openPaymentTabAfterBillableExamination(args: OpenPaymentTabAfterExaminationArgs): void {
    const amount =
        args.total_cost != null && Number.isFinite(args.total_cost) && args.total_cost > 0
            ? String(args.total_cost)
            : "";
    args.goTab("payment");
    args.setPaymentNewForm({
        linkKind: "examination",
        linkId: args.examinationId,
        amount,
        payment_method: "CASH",
        description: "",
    });
    args.setShowPaymentComposer(true);
}
