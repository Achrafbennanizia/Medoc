import type { RefObject } from "react";
import { createChartAttachment, deleteChartAttachment } from "@/systems/practice-host/controllers/chart.controller";
import {
    flushCertificateFinalizeTemplate,
    flushPrescriptionFinalizeTemplate,
} from "@/lib/patient-detail-prescription-actions";
import { deriveAttachmentDisplayName, fileToBase64ForAttachment, normalizeChartDocumentKind } from "@/lib/chart-attachments";
import type { ChartSavePending } from "@/lib/patient-detail-utils";
import type { PatientChart } from "@/models/types";
import type { PatientDetailPrescriptionTabHandle } from "./patient-detail-prescription-tab";
import { useT, useTParams } from "@/lib/i18n";
import { useToastStore } from "@/views/components/ui/toast-store";

export type UsePatientDetailChartSaveArgs = {
    chartSaveConfirm: ChartSavePending | null;
    setChartSaveConfirm: (version: ChartSavePending | null) => void;
    chartSaveBusy: boolean;
    setChartSaveBusy: (version: boolean) => void;
    chart: PatientChart | null;
    patientId: string | undefined;
    sessionUserId: string | undefined;
    prescriptionTabRef: RefObject<PatientDetailPrescriptionTabHandle | null>;
    load: () => Promise<void>;
    refreshAttachments: (chartId: string) => Promise<void>;
};

export function usePatientDetailChartSave({
    chartSaveConfirm,
    setChartSaveConfirm,
    chartSaveBusy,
    setChartSaveBusy,
    chart,
    patientId,
    sessionUserId,
    prescriptionTabRef,
    load,
    refreshAttachments,
}: UsePatientDetailChartSaveArgs) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();

    const flushChartSave = async () => {
        const p = chartSaveConfirm;
        if (!p) return;
        setChartSaveBusy(true);
        try {
            switch (p.kind) {
                case "prescription_finalize_template":
                case "certificate_finalize_template": {
                    if (await prescriptionTabRef.current?.flushChartSaveConfirm(p)) break;
                    if (!patientId || !sessionUserId) break;
                    const ctx = { patientId, userId: sessionUserId, onReload: load, toast };
                    const noop = {
                        setComposerBusy: () => {},
                        clearPending: () => {},
                        refreshPrescriptionTemplates: async () => {},
                        refreshCertificateTemplates: async () => {},
                    };
                    if (p.kind === "prescription_finalize_template") {
                        await flushPrescriptionFinalizeTemplate(ctx, p, noop);
                    } else {
                        await flushCertificateFinalizeTemplate(ctx, p, noop);
                    }
                    break;
                }
                case "attachment_add": {
                    if (!chart) break;
                    const displayName = deriveAttachmentDisplayName(p.file);
                    const b64 = await fileToBase64ForAttachment(p.file);
                    await createChartAttachment({
                        chart_id: chart.id,
                        display_name: displayName,
                        mime_type: p.file.type || "application/octet-stream",
                        bytes_base64: b64,
                        document_kind: normalizeChartDocumentKind(p.documentKind),
                    });
                    toast(t("patient.detail.toast.attachment_saved"), "success");
                    await refreshAttachments(chart.id);
                    break;
                }
                case "attachment_remove": {
                    await deleteChartAttachment(p.id);
                    if (chart) await refreshAttachments(chart.id);
                    toast(t("patient.detail.toast.attachment_removed"), "info");
                    break;
                }
                default:
                    break;
            }
        } catch (e) {
            if (e instanceof Error && (e.message === "invalid-json" || e.message === "invalid-amount")) {
                /* bereits per Toast gemeldet */
            } else {
                toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
            }
        } finally {
            setChartSaveBusy(false);
            setChartSaveConfirm(null);
        }
    };

    const cancelChartSave = () => {
        if (chartSaveBusy) return;
        setChartSaveConfirm(null);
    };

    return { flushChartSave, cancelChartSave };
}
