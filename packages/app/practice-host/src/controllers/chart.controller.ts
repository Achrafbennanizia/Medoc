import type { z } from "zod";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { ChartExportSectionsState } from "@/lib/chart-export";
import type { IssuedPdf } from "@/systems/practice-host/controllers/document.controller";
import type { ChartAttachmentRowDto } from "@/lib/chart-attachments";
import { documentLocale } from "@/lib/document-locale";
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

export async function createDentalFinding(
    data: z.input<typeof CreateDentalFindingSchema>,
): Promise<DentalFinding> {
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

/**
 * Chart extract PDF. `preview: true` → watermarked, unnumbered, not registered.
 * Otherwise the extract gets an AK number, its SHA-256 is stored and audited.
 */
export async function exportChartPdf(
    patientId: string,
    sections: ChartExportSectionsState | undefined,
    preview: boolean,
): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("export_chart_pdf", {
        args: {
            patientId,
            preview,
            ...(sections !== undefined ? { sections } : {}),
            // Server-written parts (headings, labels, footer) follow the same language as the UI text.
            locale: documentLocale(),
        },
    });
}

/** FA-DOK-08 — discharge leaflet / aftercare (numbered unless `preview`). */
export async function exportDischargeLeafletPdf(args: {
    patientId: string;
    additionalNotes?: string | null;
    referralNotes?: string | null;
    preview?: boolean;
}): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("export_discharge_leaflet_pdf", {
        args: {
            patientId: args.patientId,
            additionalNotes: args.additionalNotes ?? undefined,
            referralNotes: args.referralNotes ?? undefined,
            preview: args.preview ?? false,
            locale: documentLocale(),
        },
    });
}

export async function listTreatments(chartId: string): Promise<Treatment[]> {
    return practiceSystem.invoke<Treatment[]>("list_treatments", { chart_id: chartId });
}

export async function listExaminations(chartId: string): Promise<Examination[]> {
    return practiceSystem.invoke<Examination[]>("list_examinations", { chart_id: chartId });
}

export async function createTreatment(
    data: z.input<typeof CreateTreatmentSchema>,
): Promise<Treatment> {
    const safe = parseOrThrow(CreateTreatmentSchema, data);
    return practiceSystem.invoke<Treatment>("create_treatment", { data: safe });
}

export async function createExamination(
    data: z.input<typeof CreateExaminationSchema>,
): Promise<Examination> {
    const safe = parseOrThrow(CreateExaminationSchema, data);
    return practiceSystem.invoke<Examination>("create_examination", { data: safe });
}

export async function updateExamination(
    data: z.input<typeof UpdateExaminationSchema>,
): Promise<Examination> {
    const safe = parseOrThrow(UpdateExaminationSchema, data);
    return practiceSystem.invoke<Examination>("update_examination", { data: safe });
}

export async function deleteExamination(id: string): Promise<void> {
    return practiceSystem.invoke<void>("delete_examination", { id });
}

export async function updateTreatment(
    data: z.input<typeof UpdateTreatmentSchema>,
): Promise<Treatment> {
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

/** GOZ billing data of a treatment line (physician). Server validates factor rules. */
export async function setTreatmentBilling(data: {
    treatment_id: string;
    fee_schedule: "goz" | "goae" | "material" | "lab" | "other";
    goz_nr?: string | null;
    points?: number | null;
    factor?: number | null;
    factor_reason?: string | null;
    quantity?: number | null;
    analog_of?: string | null;
    agreement_ref?: string | null;
}): Promise<Treatment> {
    return practiceSystem.invoke<Treatment>("set_treatment_billing", { data });
}
