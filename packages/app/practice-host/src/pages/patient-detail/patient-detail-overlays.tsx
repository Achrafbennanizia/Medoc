import type { Rolle, Patient } from "@/models/types";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import type { AkteSavePending } from "@/lib/patient-detail-utils";
import { akteSaveConfirmUi } from "@/lib/patient-detail-utils";
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

export function PatientDetailOverlays(props: PatientDetailOverlaysProps) {
    const {
        patientId,
        patient,
        sessionUserId,
        role,
        canViewClinical,
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

    return (
        <>
            <ConfirmDialog
                open={akteSaveConfirm !== null}
                onClose={onCloseAkteSave}
                onConfirm={onConfirmAkteSave}
                title={akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm).title : ""}
                message={akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm).message : ""}
                confirmLabel={akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm).confirmLabel : "OK"}
                loading={akteSaveBusy}
            />
            {patientId ? (
                <ExportPickerDialog
                    open={akteExportPickerOpen}
                    onClose={onCloseAkteExport}
                    patientId={patientId}
                    patient={patient}
                    canViewClinical={canViewClinical}
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
                    role={role}
                    toast={toast}
                />
            ) : null}
        </>
    );
}
