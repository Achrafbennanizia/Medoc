import { createCertificate, deleteCertificate } from "@/systems/practice-host/controllers/certificate.controller";
import { createDocumentTemplate, listDocumentTemplates } from "@/systems/practice-host/controllers/practice.controller";
import { createPrescription, deletePrescription } from "@/systems/practice-host/controllers/prescription.controller";
import type { DocumentTemplate, DocumentTemplateKind } from "@/models/types";
import { normalizeDocumentTemplateKind } from "@/models/types";
import {
    buildCertificateBodyText,
    buildCertificateTemplatePayload,
    validateCertificateComposer,
    type CertificateComposerFormFields,
} from "@/lib/certificate-composer";
import type { PrescriptionLine } from "@/lib/medications";
import { prescriptionLinesToTemplateItems } from "@/lib/medications";
import { t, translateLocaleParams, useLocale } from "@/lib/i18n";
import { PATIENT_DETAIL_TOAST_UNDO_MS, type ChartSavePending } from "@/lib/patient-detail-utils";

function tp(key: string, params: Record<string, string | number>): string {
    return translateLocaleParams(useLocale.getState().locale, key, params);
}

function toastError(ctx: PatientDetailPrescriptionActionsCtx, e: unknown): void {
    ctx.toast(
        tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }),
        "error",
    );
}

export type PatientDetailPrescriptionToast = (
    message: string,
    variant?: "success" | "error" | "info",
    opts?: { durationMs?: number; onUndo?: () => void | Promise<void> },
) => void;

export type PatientDetailPrescriptionActionsCtx = {
    patientId: string;
    userId: string;
    onReload: () => void | Promise<void>;
    toast: PatientDetailPrescriptionToast;
};

export async function persistPatientPrescriptions(
    ctx: PatientDetailPrescriptionActionsCtx,
    queue: PrescriptionLine[],
    shared: string,
    onAfterSave?: () => void,
): Promise<void> {
    const createdIds: string[] = [];
    try {
        for (const line of queue) {
            const merged = [line.instructions, shared].filter((s) => s.trim()).join(" · ");
            const quantityN = Number.parseInt(line.quantity.trim(), 10);
            const r = await createPrescription({
                patient_id: ctx.patientId,
                physician_id: ctx.userId,
                medication: line.medication.trim(),
                active_ingredient: line.active_ingredient.trim() || null,
                dosage: line.dosage.trim(),
                duration: line.duration.trim(),
                instructions: merged.trim() || null,
                pzn: line.pzn.trim() || null,
                dosage_form: line.dosage_form.trim() || null,
                pack_size: line.pack_size.trim() || null,
                quantity: Number.isFinite(quantityN) && quantityN > 0 ? quantityN : null,
                aut_idem: line.aut_idem,
                prescription_type: line.prescription_type,
                icd10_code: line.icd10_code.trim() || null,
                prescribing_physician_id: ctx.userId,
            });
            createdIds.push(r.id);
        }
        ctx.toast(
            queue.length === 1
                ? t("patient.detail.toast.prescription_saved_one")
                : tp("patient.detail.toast.prescriptions_saved_count", { count: queue.length }),
            "success",
            {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        for (const rid of createdIds) {
                            await deletePrescription(rid);
                        }
                        await ctx.onReload();
                    } catch (e) {
                        toastError(ctx, e);
                    }
                },
            },
        );
        onAfterSave?.();
        await ctx.onReload();
    } catch (e) {
        toastError(ctx, e);
    }
}

export async function persistPatientCertificate(
    ctx: PatientDetailPrescriptionActionsCtx,
    fields: CertificateComposerFormFields,
    options?: { silent?: boolean; onAfterSave?: () => void },
): Promise<string | null> {
    const vErr = validateCertificateComposer(fields, t);
    if (vErr) {
        ctx.toast(vErr, "error");
        return null;
    }
    const body_text = buildCertificateBodyText(fields);
    try {
        const created = await createCertificate({
            patient_id: ctx.patientId,
            physician_id: ctx.userId,
            kind: fields.kind.trim(),
            body_text,
            valid_from: fields.valid_from.slice(0, 10),
            valid_until: fields.valid_until.slice(0, 10),
            icd10_code: fields.icd10_code.trim() || null,
            first_or_follow_up: fields.first_or_follow_up,
            employer:
                fields.kind.includes("SICK_LEAVE") && fields.employer.trim()
                    ? fields.employer.trim()
                    : null,
            issuing_physician_id: ctx.userId,
        });
        if (!options?.silent) {
            ctx.toast(t("patient.detail.toast.certificate_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteCertificate(created.id);
                        await ctx.onReload();
                    } catch (e) {
                        toastError(ctx, e);
                    }
                },
            });
        }
        options?.onAfterSave?.();
        await ctx.onReload();
        return created.id;
    } catch (e) {
        toastError(ctx, e);
        return null;
    }
}

export async function flushPrescriptionFinalizeTemplate(
    ctx: PatientDetailPrescriptionActionsCtx,
    p: Extract<ChartSavePending, { kind: "prescription_finalize_template" }>,
    hooks: {
        setComposerBusy: (busy: boolean) => void;
        clearPending: () => void;
        refreshPrescriptionTemplates: () => Promise<void>;
    },
): Promise<void> {
    hooks.setComposerBusy(true);
    try {
        await createDocumentTemplate({
            kind: "PRESCRIPTION",
            title: p.title,
            payload: { items: prescriptionLinesToTemplateItems(p.lines) },
        });
        ctx.toast(t("patient.detail.toast.template_saved_practice"), "success");
        await hooks.refreshPrescriptionTemplates();
        hooks.clearPending();
        await persistPatientPrescriptions(ctx, p.lines, p.shared);
    } finally {
        hooks.setComposerBusy(false);
    }
}

export async function flushCertificateFinalizeTemplate(
    ctx: PatientDetailPrescriptionActionsCtx,
    p: Extract<ChartSavePending, { kind: "certificate_finalize_template" }>,
    hooks: {
        setComposerBusy: (busy: boolean) => void;
        clearPending: () => void;
        refreshCertificateTemplates: () => Promise<void>;
    },
): Promise<void> {
    hooks.setComposerBusy(true);
    try {
        await createDocumentTemplate({
            kind: "CERTIFICATE",
            title: p.title,
            payload: buildCertificateTemplatePayload(p.fields),
        });
        await hooks.refreshCertificateTemplates();
        hooks.clearPending();
        const certificateId = await persistPatientCertificate(ctx, p.fields, { silent: true });
        if (certificateId) {
            ctx.toast(t("patient.detail.toast.template_certificate_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteCertificate(certificateId);
                        await ctx.onReload();
                    } catch (e) {
                        toastError(ctx, e);
                    }
                },
            });
        }
    } finally {
        hooks.setComposerBusy(false);
    }
}

export async function refreshDocumentTemplates(kind: DocumentTemplateKind): Promise<DocumentTemplate[]> {
    const all = await listDocumentTemplates();
    return all.filter((version) => normalizeDocumentTemplateKind(version.kind) === kind);
}
