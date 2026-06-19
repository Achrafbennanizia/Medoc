import type { Rolle, Patient } from "@/models/types";
import { deriveAnlageDisplayName } from "@/lib/akte-anlagen";
import { parseRole } from "@/lib/rbac";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import type { AkteSavePending } from "@/lib/patient-detail-utils";
import { useT, useTParams } from "@/lib/i18n";
import { ConfirmDialog } from "@/views/components/ui/dialog";
import { ExportPickerDialog, HtmlDocumentExportPickerDialog } from "@/views/components/export-picker-dialog";
import { DischargeMerkblattDialog } from "@/views/components/discharge-merkblatt-dialog";
import { PraxisReadinessDialog } from "@/views/components/praxis-readiness-dialog";
import { PatientAkteWorkflowDialogs, type PatientAkteWorkflowMode } from "@/views/components/patient-akte-workflow-dialogs";

export type PatientDetailOverlaysProps = {
    patientId: string | undefined;
    patient: Patient;
    sessionUserId: string;
    role: Rolle;
    canViewClinical: boolean;
    canReadDocuments: boolean;
    canReadFinanzen: boolean;
    canAuditRead: boolean;
    akteSaveConfirm: AkteSavePending | null;
    akteSaveBusy: boolean;
    onCloseAkteSave: () => void;
    onConfirmAkteSave: () => void;
    akteExportPickerOpen: boolean;
    onCloseAkteExport: () => void;
    dischargeMerkblattOpen: boolean;
    onCloseDischargeMerkblatt: () => void;
    praxisGuardKind: DocumentKind | null;
    onClosePraxisGuard: () => void;
    htmlDocExport: {
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    } | null;
    onCloseHtmlDocExport: () => void;
    akteWorkflowMode: PatientAkteWorkflowMode;
    onCloseAkteWorkflow: () => void;
    toast: (msg: string, variant?: "success" | "error" | "info" | "warning") => void;
};

function akteSaveConfirmUi(
    p: AkteSavePending,
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { title: string; message: string; confirmLabel: string } {
    switch (p.kind) {
        case "rezept_finalize_vorlage":
            return {
                title: t("patient.detail.confirm.rezept_vorlage.title"),
                message:
                    p.lines.length === 1
                        ? tp("patient.detail.confirm.rezept_vorlage.message_one", { title: p.titel })
                        : tp("patient.detail.confirm.rezept_vorlage.message_many", {
                              title: p.titel,
                              count: p.lines.length,
                          }),
                confirmLabel: t("common.save"),
            };
        case "attest_finalize_vorlage":
            return {
                title: t("patient.detail.confirm.attest_vorlage.title"),
                message: tp("patient.detail.confirm.attest_vorlage.message", { title: p.titel }),
                confirmLabel: t("common.save"),
            };
        case "anlage_add":
            return {
                title: t("patient.detail.confirm.anlage_add.title"),
                message: tp("patient.detail.confirm.anlage_add.message", {
                    name: deriveAnlageDisplayName(p.file),
                }),
                confirmLabel: t("common.add"),
            };
        case "anlage_remove":
            return {
                title: t("patient.detail.confirm.anlage_remove.title"),
                message: tp("patient.detail.confirm.anlage_remove.message", { name: p.name }),
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
        canReadFinanzen,
        canAuditRead,
        akteSaveConfirm,
        akteSaveBusy,
        onCloseAkteSave,
        onConfirmAkteSave,
        akteExportPickerOpen,
        onCloseAkteExport,
        dischargeMerkblattOpen,
        onCloseDischargeMerkblatt,
        praxisGuardKind,
        onClosePraxisGuard,
        htmlDocExport,
        onCloseHtmlDocExport,
        akteWorkflowMode,
        onCloseAkteWorkflow,
        toast,
    } = props;

    const t = useT();
    const tp = useTParams();
    const confirmUi = akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm, t, tp) : null;

    return (
        <>
            <ConfirmDialog
                open={akteSaveConfirm !== null}
                onClose={onCloseAkteSave}
                onConfirm={onConfirmAkteSave}
                title={confirmUi?.title ?? ""}
                message={confirmUi?.message ?? ""}
                confirmLabel={confirmUi?.confirmLabel ?? t("common.ok")}
                loading={akteSaveBusy}
            />
            {patientId ? (
                <ExportPickerDialog
                    open={akteExportPickerOpen}
                    onClose={onCloseAkteExport}
                    patientId={patientId}
                    patient={patient}
                    canViewClinical={canViewClinical}
                    canReadDocuments={canReadDocuments}
                    canReadFinanzen={canReadFinanzen}
                    canAuditRead={canAuditRead}
                />
            ) : null}
            {patientId ? (
                <DischargeMerkblattDialog
                    open={dischargeMerkblattOpen}
                    onClose={onCloseDischargeMerkblatt}
                    patientId={patientId}
                    patient={patient}
                />
            ) : null}
            <PraxisReadinessDialog
                open={praxisGuardKind != null}
                documentKind={praxisGuardKind ?? "akte"}
                result={checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), praxisGuardKind ?? "akte")}
                onClose={onClosePraxisGuard}
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
                <PatientAkteWorkflowDialogs
                    mode={akteWorkflowMode}
                    onClose={onCloseAkteWorkflow}
                    patientId={patientId}
                    currentUserId={sessionUserId}
                    role={parseRole(role) ?? "REZEPTION"}
                    toast={toast}
                />
            ) : null}
        </>
    );
}
