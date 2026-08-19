import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { ChartExportSectionsState } from "@/lib/chart-export";
import type { ChartAttachmentRowDto } from "@/lib/chart-attachments";
import {
    CreateTreatmentSchema,
    CreateExaminationSchema,
    CreateDentalFindingSchema,
    UpdateTreatmentSchema,
    UpdateExaminationSchema,
    parseOrThrow,
} from "@/lib/schemas";
import type {
    PatientChart,
    DentalFinding,
    AnamnesisForm,
    Treatment,
    Examination,
} from "@/models/types";

export async function getChart(patientId: string): Promise<PatientChart> {
    return practiceSystem.invoke<PatientChart>("get_chart", { patient_id: patientId });
}

export async function listDentalFindings(chartId: string): Promise<DentalFinding[]> {
    return practiceSystem.invoke<DentalFinding[]>("list_dental_findings", { chart_id: chartId });
}

export async function createDentalFinding(data: {
    chart_id: string;
    tooth_number: number;
    finding: string;
    diagnosis?: string | null;
    notes?: string | null;
}): Promise<DentalFinding> {
    const safe = parseOrThrow(CreateDentalFindingSchema, data);
    return practiceSystem.invoke<DentalFinding>("update_dental_finding", { data: safe });
}

export async function getAnamnesisForm(patientId: string): Promise<AnamnesisForm | null> {
    return practiceSystem.invoke<AnamnesisForm | null>("get_anamnesis_form", { patient_id: patientId });
}

export async function saveAnamnesisForm(data: {
    patient_id: string;
    answers: unknown;
    signed: boolean;
}): Promise<AnamnesisForm> {
    return practiceSystem.invoke<AnamnesisForm>("save_anamnesis_form", { data });
}

export async function exportChartPdf(patientId: string, sections?: ChartExportSectionsState): Promise<string> {
    return practiceSystem.invoke<string>("export_chart_pdf", {
        args: sections !== undefined ? { patientId, sections } : { patientId },
    });
}

/** FA-DOK-08 — discharge leaflet / aftercare (PDF, base64). */
export async function exportDischargeLeafletPdf(args: {
    patientId: string;
    additionalNotes?: string | null;
    referralNotes?: string | null;
}): Promise<string> {
    return practiceSystem.invoke<string>("export_discharge_leaflet_pdf", {
        args: {
            patientId: args.patientId,
            additionalNotes: args.additionalNotes ?? undefined,
            referralNotes: args.referralNotes ?? undefined,
        },
    });
}

export async function listTreatments(chartId: string): Promise<Treatment[]> {
    return practiceSystem.invoke<Treatment[]>("list_treatments", { chart_id: chartId });
}

export async function listExaminations(chartId: string): Promise<Examination[]> {
    return practiceSystem.invoke<Examination[]>("list_examinations", { chart_id: chartId });
}

export async function createTreatment(data: {
    chart_id: string;
    kind: string;
    description?: string | null;
    teeth?: string | null;
    material?: string | null;
    notes?: string | null;
    category?: string | null;
    service_name?: string | null;
    treatment_number?: string | null;
    session_number?: number | null;
    treatment_status?: string | null;
    total_cost?: number | null;
    appointment_required?: boolean | null;
    treatment_date?: string | null;
}): Promise<Treatment> {
    const safe = parseOrThrow(CreateTreatmentSchema, data);
    return practiceSystem.invoke<Treatment>("create_treatment", { data: safe });
}

export async function createExamination(data: {
    chart_id: string;
    chief_complaint?: string | null;
    results?: string | null;
    diagnosis?: string | null;
    examination_number?: string | null;
    category?: string | null;
    service_name?: string | null;
    total_cost?: number | null;
}): Promise<Examination> {
    const safe = parseOrThrow(CreateExaminationSchema, data);
    return practiceSystem.invoke<Examination>("create_examination", { data: safe });
}

export async function updateExamination(data: {
    id: string;
    chief_complaint?: string | null;
    results?: string | null;
    diagnosis?: string | null;
    category?: string | null;
    service_name?: string | null;
    total_cost?: number | null;
}): Promise<Examination> {
    const safe = parseOrThrow(UpdateExaminationSchema, data);
    return practiceSystem.invoke<Examination>("update_examination", { data: safe });
}

export async function deleteExamination(id: string): Promise<void> {
    return practiceSystem.invoke<void>("delete_examination", { id });
}

export async function updateTreatment(data: {
    id: string;
    kind: string;
    description?: string | null;
    teeth?: string | null;
    material?: string | null;
    notes?: string | null;
    category?: string | null;
    service_name?: string | null;
    treatment_number?: string | null;
    session_number?: number | null;
    treatment_status?: string | null;
    total_cost?: number | null;
    appointment_required?: boolean | null;
    treatment_date?: string | null;
}): Promise<Treatment> {
    const safe = parseOrThrow(UpdateTreatmentSchema, data);
    return practiceSystem.invoke<Treatment>("update_treatment", { data: safe });
}

export async function deleteTreatment(id: string): Promise<void> {
    return practiceSystem.invoke<void>("delete_treatment", { id });
}

/** FA-LEIST-05: release for billing (physician role only). */
export async function releaseTreatmentForBilling(treatmentId: string): Promise<Treatment> {
    return practiceSystem.invoke<Treatment>("release_treatment_for_billing", { treatment_id: treatmentId });
}

export async function releaseExaminationForBilling(examinationId: string): Promise<Examination> {
    return practiceSystem.invoke<Examination>("release_examination_for_billing", {
        examination_id: examinationId,
    });
}

export async function listChartAttachments(chartId: string): Promise<ChartAttachmentRowDto[]> {
    return practiceSystem.invoke<ChartAttachmentRowDto[]>("list_chart_attachments", { chart_id: chartId });
}

export async function createChartAttachment(data: {
    chart_id: string;
    display_name: string;
    mime_type: string;
    bytes_base64: string;
    document_kind?: string;
}): Promise<ChartAttachmentRowDto> {
    return practiceSystem.invoke<ChartAttachmentRowDto>("create_chart_attachment", { data });
}

export async function createChartAttachmentFromPath(data: {
    chart_id: string;
    src_path: string;
    display_name?: string | null;
    document_kind?: string | null;
}): Promise<ChartAttachmentRowDto> {
    return practiceSystem.invoke<ChartAttachmentRowDto>("create_chart_attachment_from_path", { data });
}

export async function deleteChartAttachment(id: string): Promise<void> {
    return practiceSystem.invoke<void>("delete_chart_attachment", { id });
}

export async function renameChartAttachment(id: string, displayName: string): Promise<void> {
    return practiceSystem.invoke<void>("rename_chart_attachment", { id, display_name: displayName });
}

export async function setChartAttachmentDocumentKind(id: string, documentKind: string): Promise<void> {
    return practiceSystem.invoke<void>("set_chart_attachment_document_kind", {
        id,
        document_kind: documentKind,
    });
}

export async function openChartAttachmentExternally(id: string, withApp?: string | null): Promise<void> {
    return practiceSystem.invoke<void>("open_chart_attachment_externally", {
        id,
        with_app: withApp !== undefined && withApp !== null && withApp.trim() !== "" ? withApp : null,
    });
}

export async function duplicateChartAttachment(id: string): Promise<ChartAttachmentRowDto> {
    return practiceSystem.invoke<ChartAttachmentRowDto>("duplicate_chart_attachment", { id });
}
