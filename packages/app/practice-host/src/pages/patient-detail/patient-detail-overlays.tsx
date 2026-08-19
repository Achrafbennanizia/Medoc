import type { Role, Patient } from "@/models/types";
import type { ChartSavePending } from "@/lib/patient-detail-utils";
import { parseRole } from "@/lib/rbac";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { useT, useTParams } from "@/lib/i18n";
import { ConfirmDialog, Dialog } from "@/views/components/ui/dialog";
import { Select } from "@/views/components/ui/input";
import { Button } from "@/views/components/ui/button";
import {
    CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
    CHART_ATTACHMENT_DOCUMENT_KINDS,
    deriveAttachmentDisplayName,
} from "@/lib/chart-attachments";
import { ExportPickerDialog, HtmlDocumentExportPickerDialog } from "@/views/components/export-picker-dialog";
import { DischargeLeafletDialog } from "@/views/components/discharge-leaflet-dialog";
import { PracticeReadinessDialog } from "@/views/components/practice-readiness-dialog";
import { PatientChartWorkflowDialogs, type PatientChartWorkflowMode } from "@/views/components/patient-chart-workflow-dialogs";

export type PatientDetailOverlaysProps = {
    patientId: string | undefined;
    patient: Patient;
    sessionUserId: string;
    role: Role;
    canViewClinical: boolean;
    canReadDocuments: boolean;
    canReadFinance: boolean;
    canAuditRead: boolean;
    chartSaveConfirm: ChartSavePending | null;
    chartSaveBusy: boolean;
    onCloseChartSave: () => void;
    onConfirmChartSave: () => void;
    onPatchChartSaveConfirm?: (patch: Partial<Extract<ChartSavePending, { kind: "attachment_add" }>>) => void;
    chartExportPickerOpen: boolean;
    onCloseChartExport: () => void;
    dischargeLeafletOpen: boolean;
    onCloseDischargeLeaflet: () => void;
    practiceGuardKind: DocumentKind | null;
    onClosePracticeGuard: () => void;
    htmlDocExport: {
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    } | null;
    onCloseHtmlDocExport: () => void;
    chartWorkflowMode: PatientChartWorkflowMode;
    onCloseChartWorkflow: () => void;
    toast: (msg: string, variant?: "success" | "error" | "info" | "warning") => void;
};

function chartSaveConfirmUi(
    p: ChartSavePending,
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { title: string; message: string; confirmLabel: string } {
    switch (p.kind) {
        case "prescription_finalize_template":
            return {
                title: t("patient.detail.confirm.prescription_template.title"),
                message:
                    p.lines.length === 1
                        ? tp("patient.detail.confirm.prescription_template.message_one", { title: p.title })
                        : tp("patient.detail.confirm.prescription_template.message_many", {
                              title: p.title,
                              count: p.lines.length,
                          }),
                confirmLabel: t("common.save"),
            };
        case "certificate_finalize_template":
            return {
                title: t("patient.detail.confirm.certificate_template.title"),
                message: tp("patient.detail.confirm.certificate_template.message", { title: p.title }),
                confirmLabel: t("common.save"),
            };
        case "attachment_add":
            return {
                title: t("patient.detail.confirm.attachment_add.title"),
                message: tp("patient.detail.confirm.attachment_add.message", {
                    name: deriveAttachmentDisplayName(p.file),
                }),
                confirmLabel: t("common.add"),
            };
        case "attachment_remove":
            return {
                title: t("patient.detail.confirm.attachment_remove.title"),
                message: tp("patient.detail.confirm.attachment_remove.message", { name: p.name }),
                confirmLabel: t("common.remove"),
            };
        default:
            return {
                title: t("patient.detail.confirm.generic_title"),
                message: t("patient.detail.confirm.default_message"),
                confirmLabel: t("common.ok"),
            };
    }
}

export function PatientDetailOverlays(props: PatientDetailOverlaysProps) {
    const {
        patientId,
        patient,
        sessionUserId,
        role,
        canViewClinical,
        canReadDocuments,
        canReadFinance,
        canAuditRead,
        chartSaveConfirm,
        chartSaveBusy,
        onCloseChartSave,
        onConfirmChartSave,
        onPatchChartSaveConfirm,
        chartExportPickerOpen,
        onCloseChartExport,
        dischargeLeafletOpen,
        onCloseDischargeLeaflet,
        practiceGuardKind,
        onClosePracticeGuard,
        htmlDocExport,
        onCloseHtmlDocExport,
        chartWorkflowMode,
        onCloseChartWorkflow,
        toast,
    } = props;

    const t = useT();
    const tp = useTParams();
    const confirmUi = chartSaveConfirm ? chartSaveConfirmUi(chartSaveConfirm, t, tp) : null;
    const attachmentAddPending = chartSaveConfirm?.kind === "attachment_add" ? chartSaveConfirm : null;

    return (
        <>
            {attachmentAddPending ? (
                <Dialog
                    open
                    onClose={onCloseChartSave}
                    title={t("patient.detail.confirm.attachment_add.title")}
                    footer={(
                        <>
                            <Button type="button" variant="ghost" onClick={onCloseChartSave} disabled={chartSaveBusy}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="button" onClick={onConfirmChartSave} loading={chartSaveBusy}>
                                {t("common.add")}
                            </Button>
                        </>
                    )}
                >
                    <div className="col" style={{ gap: 12 }}>
                        <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)" }}>
                            {tp("patient.detail.confirm.attachment_add.message", {
                                name: deriveAttachmentDisplayName(attachmentAddPending.file),
                            })}
                        </p>
                        <Select
                            id="attachment-add-doc-kind"
                            label={t("chart.attachments.doc_type")}
                            value={attachmentAddPending.documentKind ?? CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT}
                            options={CHART_ATTACHMENT_DOCUMENT_KINDS.map((k) => ({
                                value: k.id,
                                label: t(k.labelKey),
                            }))}
                            onChange={(e) =>
                                onPatchChartSaveConfirm?.({ documentKind: e.target.value })
                            }
                        />
                    </div>
                </Dialog>
            ) : (
                <ConfirmDialog
                    open={chartSaveConfirm !== null}
                    onClose={onCloseChartSave}
                    onConfirm={onConfirmChartSave}
                    title={confirmUi?.title ?? ""}
                    message={confirmUi?.message ?? ""}
                    confirmLabel={confirmUi?.confirmLabel ?? t("common.ok")}
                    loading={chartSaveBusy}
                />
            )}
            {patientId ? (
                <ExportPickerDialog
                    open={chartExportPickerOpen}
                    onClose={onCloseChartExport}
                    patientId={patientId}
                    patient={patient}
                    canViewClinical={canViewClinical}
                    canReadDocuments={canReadDocuments}
                    canReadFinance={canReadFinance}
                    canAuditRead={canAuditRead}
                />
            ) : null}
            {patientId ? (
                <DischargeLeafletDialog
                    open={dischargeLeafletOpen}
                    onClose={onCloseDischargeLeaflet}
                    patientId={patientId}
                    patient={patient}
                />
            ) : null}
            <PracticeReadinessDialog
                open={practiceGuardKind != null}
                documentKind={practiceGuardKind ?? "chart"}
                result={checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), practiceGuardKind ?? "chart")}
                onClose={onClosePracticeGuard}
            />
            {htmlDocExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={onCloseHtmlDocExport}
                    templateKind={htmlDocExport.kind}
                    exportPreviewTitle={htmlDocExport.exportPreviewTitle}
                    suggestedBasename={htmlDocExport.suggestedBasename}
                    bundle={htmlDocExport.bundle}
                    hint={htmlDocExport.hint}
                />
            ) : null}
            {patientId ? (
                <PatientChartWorkflowDialogs
                    mode={chartWorkflowMode}
                    onClose={onCloseChartWorkflow}
                    patientId={patientId}
                    currentUserId={sessionUserId}
                    role={parseRole(role) ?? "RECEPTION"}
                    toast={toast}
                />
            ) : null}
        </>
    );
}
