import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Treatment, Patient, Examination, Payment, PaymentMethod } from "@/models/types";
import { createPayment, deletePayment, updatePayment } from "@/systems/practice-host/controllers/payment.controller";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { buildReceiptExportForPayment } from "@/lib/receipt-export-flow";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { PATIENT_DETAIL_TOAST_UNDO_MS } from "@/lib/patient-detail-utils";
import {
    PAYMENT_EUR_EPS,
    aggregatePaymentsByAssignment,
    buildOpenPaymentLinkSelectOptions,
    latestPaymentForAssignmentRow,
    maxEditPaymentTreatment,
    maxNewPaymentTreatment,
    maxNewPaymentExamination,
    maxEditPaymentExamination,
    roundMoney2,
    sumPaymentsForTreatment,
    type PaymentAssignmentSummaryRow,
} from "@/lib/payment-booking";
import { formatCurrency } from "@/lib/utils";
import { useT, useTParams } from "@/lib/i18n";
import { useToastStore } from "@/views/components/ui/toast-store";

export type PaymentNewFormState = {
    linkKind: "" | "treatment" | "examination";
    linkId: string;
    amount: string;
    payment_method: PaymentMethod;
    description: string;
};

export type PaymentEditFormState = {
    amount: string;
    payment_method: PaymentMethod;
    description: string;
};

export type UsePatientDetailPaymentActionsArgs = {
    patientId: string | undefined;
    patient: Patient | null;
    treatments: Treatment[];
    examinations: Examination[];
    payments: Payment[];
    paymentNewForm: PaymentNewFormState;
    setPaymentNewForm: Dispatch<SetStateAction<PaymentNewFormState>>;
    setShowPaymentComposer: (version: boolean) => void;
    paymentEdit: Payment | null;
    setPaymentEdit: (z: Payment | null) => void;
    paymentEditUnlocked: boolean;
    paymentEditForm: PaymentEditFormState;
    paymentDeleteId: string | null;
    setPaymentDeleteId: (id: string | null) => void;
    load: () => Promise<void>;
    ensurePracticeForDocument: (kind: DocumentKind) => boolean;
    setHtmlDocExport: (version: {
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    } | null) => void;
};

export function usePatientDetailPaymentActions(args: UsePatientDetailPaymentActionsArgs) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const {
        patientId,
        patient,
        treatments,
        examinations,
        payments,
        paymentNewForm,
        setPaymentNewForm,
        setShowPaymentComposer,
        paymentEdit,
        setPaymentEdit,
        paymentEditUnlocked,
        paymentEditForm,
        paymentDeleteId,
        setPaymentDeleteId,
        load,
        ensurePracticeForDocument,
        setHtmlDocExport,
    } = args;

    const paymentLinkSelectOptionsOpen = useMemo(() => {
        if (!patientId) return [{ value: "", label: "—" }];
        return buildOpenPaymentLinkSelectOptions(payments, patientId, treatments, examinations, t, tp);
    }, [patientId, payments, treatments, examinations, t, tp]);

    const paymentZuordnungSummaries = useMemo(
        () => (patientId ? aggregatePaymentsByAssignment(payments, patientId, treatments, examinations, t, tp) : []),
        [patientId, payments, treatments, examinations, t, tp],
    );

    const paymentsHistorisch = useMemo(
        () => [...payments].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        [payments],
    );

    const paymentNewMaxAmountEur = useMemo(() => {
        if (!patientId || !paymentNewForm.linkId) return null;
        if (paymentNewForm.linkKind === "treatment") {
            const selBh = treatments.find((b) => b.id === paymentNewForm.linkId);
            const gesamt =
                selBh?.total_cost != null && Number.isFinite(selBh.total_cost) ? selBh.total_cost : null;
            return maxNewPaymentTreatment(payments, patientId, paymentNewForm.linkId, gesamt);
        }
        if (paymentNewForm.linkKind === "examination") {
            const selU = examinations.find((u) => u.id === paymentNewForm.linkId);
            const gesamt =
                selU?.total_cost != null && Number.isFinite(selU.total_cost) ? selU.total_cost : null;
            return maxNewPaymentExamination(payments, patientId, paymentNewForm.linkId, gesamt);
        }
        return null;
    }, [patientId, paymentNewForm.linkKind, paymentNewForm.linkId, treatments, examinations, payments]);

    const paymentEditMaxAmountEur = (() => {
        if (!patientId || !paymentEdit) return null;
        if (paymentEdit.treatment_id) {
            const bRow = treatments.find((x) => x.id === paymentEdit.treatment_id);
            const gesamt =
                bRow?.total_cost != null && Number.isFinite(bRow.total_cost) ? bRow.total_cost : null;
            return maxEditPaymentTreatment(payments, patientId, paymentEdit.treatment_id, paymentEdit.id, gesamt);
        }
        if (paymentEdit.examination_id) {
            const uRow = examinations.find((x) => x.id === paymentEdit.examination_id);
            const gesamt =
                uRow?.total_cost != null && Number.isFinite(uRow.total_cost) ? uRow.total_cost : null;
            return maxEditPaymentExamination(payments, patientId, paymentEdit.examination_id, paymentEdit.id, gesamt);
        }
        return null;
    })();

    const runSavePaymentEdit = async () => {
        if (!paymentEdit) return;
        if (!paymentEditUnlocked) {
            toast(t("patient.detail.toast.edit_unlock_first"), "info");
            return;
        }
        const amount = Number(String(paymentEditForm.amount).replace(",", "."));
        if (!Number.isFinite(amount) || amount <= 0) {
            toast(t("patient.detail.toast.valid_amount_required"), "error");
            return;
        }
        if (paymentEdit.treatment_id && patientId && paymentEditMaxAmountEur != null && amount > paymentEditMaxAmountEur + PAYMENT_EUR_EPS) {
            toast(
                tp("patient.detail.toast.payment_max_amount", { amount: formatCurrency(paymentEditMaxAmountEur) }),
                "error",
            );
            return;
        }
        const prevRow = payments.find((z) => z.id === paymentEdit.id);
        if (!prevRow) {
            toast(t("patient.detail.toast.payment_not_loaded"), "error");
            return;
        }
        try {
            await updatePayment({
                id: paymentEdit.id,
                amount,
                payment_method: paymentEditForm.payment_method,
                service_item_id: paymentEdit.service_item_id,
                description: paymentEditForm.description.trim() || null,
            });
            toast(t("patient.detail.toast.payment_updated"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updatePayment({
                            id: prevRow.id,
                            amount: prevRow.amount,
                            payment_method: prevRow.payment_method,
                            service_item_id: prevRow.service_item_id,
                            description: prevRow.description,
                        });
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setPaymentEdit(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const submitSavePaymentNew = async () => {
        if (!patientId) return;
        if (!paymentNewForm.linkKind || !paymentNewForm.linkId.trim()) {
            toast(t("patient.detail.toast.payment_link_required"), "error");
            return;
        }
        const amount = Number(String(paymentNewForm.amount).replace(",", "."));
        if (!Number.isFinite(amount) || amount <= 0) {
            toast(t("patient.detail.toast.payment_amount_invalid"), "error");
            return;
        }
        const selBh =
            paymentNewForm.linkKind === "treatment" ? treatments.find((b) => b.id === paymentNewForm.linkId) : undefined;
        const gesamt =
            selBh?.total_cost != null && Number.isFinite(selBh.total_cost) ? selBh.total_cost : null;
        const paidSoFar =
            paymentNewForm.linkKind === "treatment" && paymentNewForm.linkId
                ? sumPaymentsForTreatment(payments, patientId, paymentNewForm.linkId)
                : 0;
        let openBefore: number | undefined;
        if (paymentNewForm.linkKind === "treatment" && paymentNewForm.linkId && gesamt != null && Number.isFinite(gesamt)) {
            openBefore = Math.max(0, roundMoney2(gesamt - paidSoFar));
        }
        if (paymentNewForm.linkKind === "treatment" && openBefore != null && amount > openBefore + PAYMENT_EUR_EPS) {
            toast(
                tp("patient.detail.toast.payment_exceeds_open", { amount: formatCurrency(openBefore) }),
                "error",
            );
            return;
        }
        try {
            await createPayment({
                patient_id: patientId,
                amount,
                payment_method: paymentNewForm.payment_method,
                description: paymentNewForm.description.trim() || undefined,
                treatment_id: paymentNewForm.linkKind === "treatment" ? paymentNewForm.linkId : undefined,
                examination_id: paymentNewForm.linkKind === "examination" ? paymentNewForm.linkId : undefined,
                amount_expected: openBefore,
            });
            toast(t("patient.detail.toast.payment_captured"), "success");
            setShowPaymentComposer(false);
            setPaymentNewForm({
                linkKind: "",
                linkId: "",
                amount: "",
                payment_method: "CASH",
                description: "",
            });
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeletePaymentRow = async () => {
        if (!paymentDeleteId) return;
        try {
            await deletePayment(paymentDeleteId);
            toast(t("patient.detail.toast.payment_deleted"));
            setPaymentDeleteId(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handlePrintReceipt = async (z: Payment) => {
        if (!ensurePracticeForDocument("receipt") || !patient) return;
        try {
            setHtmlDocExport(await buildReceiptExportForPayment(z));
        } catch (e) {
            toast(tp("patient.detail.toast.receipt_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handlePrintReceiptFromSummeRow = (row: PaymentAssignmentSummaryRow) => {
        if (!patientId) return;
        const z = latestPaymentForAssignmentRow(row, payments, patientId);
        if (!z) {
            toast(t("patient.detail.toast.no_printable_booking"), "info");
            return;
        }
        void handlePrintReceipt(z);
    };

    return {
        paymentLinkSelectOptionsOpen,
        paymentZuordnungSummaries,
        paymentsHistorisch,
        paymentNewMaxAmountEur,
        paymentEditMaxAmountEur,
        runSavePaymentEdit,
        submitSavePaymentNew,
        handleDeletePaymentRow,
        handlePrintReceipt,
        handlePrintReceiptFromSummeRow,
    };
}
