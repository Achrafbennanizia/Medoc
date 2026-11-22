/**
 * Predefined prescriptions as a list/detail data source: the existing prescription templates
 * (`DocumentTemplate` of kind PRESCRIPTION), so the prescription screens keep offering them as before.
 */
import { parsePrescriptionTemplatePayload, type TemplatePrescriptionItem } from "@/lib/medications";
import type { DocumentTemplate } from "@/models/types";
import { createDocumentTemplate, deleteDocumentTemplate, listDocumentTemplates, updateDocumentTemplate } from "@/systems/practice-host/controllers/practice.controller";
import type { CrudAdapter } from "../master-detail/use-master-detail-crud";

export type PresetLine = Required<Pick<TemplatePrescriptionItem, "medication">> & { active_ingredient: string; dosage: string; duration: string; description: string };
export type PrescriptionPresetForm = { title: string; lines: PresetLine[] };

export const emptyPresetLine = (): PresetLine => ({ medication: "", active_ingredient: "", dosage: "", duration: "", description: "" });

export function presetLines(template: DocumentTemplate): PresetLine[] {
    return parsePrescriptionTemplatePayload(template.payload).map((i) => ({
        medication: i.medication ?? "",
        active_ingredient: i.active_ingredient ?? "",
        dosage: i.dosage ?? "",
        duration: i.duration ?? "",
        description: i.description ?? "",
    }));
}

/** Stored payload: `{ items: [...] }`, the shape the prescription screens already read. */
function payloadOf(form: PrescriptionPresetForm): Record<string, unknown> {
    const items: TemplatePrescriptionItem[] = form.lines
        .filter((l) => l.medication.trim())
        .map((l) => ({
            medication: l.medication.trim(),
            active_ingredient: l.active_ingredient.trim() || undefined,
            dosage: l.dosage.trim() || undefined,
            duration: l.duration.trim() || undefined,
            description: l.description.trim() || undefined,
        }));
    return { items };
}

export const prescriptionPresetsAdapter: CrudAdapter<DocumentTemplate, PrescriptionPresetForm> = {
    list: async () => (await listDocumentTemplates()).filter((d) => d.kind === "PRESCRIPTION").sort((a, b) => a.title.localeCompare(b.title)),
    create: (form) => createDocumentTemplate({ kind: "PRESCRIPTION", title: form.title.trim(), payload: payloadOf(form) }),
    update: (item, form) => updateDocumentTemplate(item.id, { title: form.title.trim(), payload: payloadOf(form) }),
    remove: (item) => deleteDocumentTemplate(item.id),
};
