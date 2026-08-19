import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type {
    Absence,
    TreatmentCatalogItem,
    DocumentTemplate,
    DocumentTemplateKind,
    SupplierPharmaTemplate,
    SupplierMaster,
    PharmaConsultantMaster,
} from "@/models/types";
import { normalizeDocumentTemplateKind } from "@/models/types";

export async function listAbsences(): Promise<Absence[]> {
    return practiceSystem.invoke<Absence[]>("list_absences");
}

export async function createAbsence(data: {
    kind: string;
    comment?: string;
    from_day: string;
    to_day: string;
    from_time?: string;
    to_time?: string;
}): Promise<Absence> {
    return practiceSystem.invoke<Absence>("create_absence", { data });
}

export async function updateAbsence(
    id: string,
    data: {
        kind?: string;
        comment?: string;
        from_day?: string;
        to_day?: string;
        from_time?: string;
        to_time?: string;
    },
): Promise<Absence> {
    return practiceSystem.invoke<Absence>("update_absence", { id, data });
}

export async function deleteAbsence(id: string): Promise<void> {
    return practiceSystem.invoke("delete_absence", { id });
}

function coerceDocumentTemplate(row: DocumentTemplate): DocumentTemplate {
    const kind = normalizeDocumentTemplateKind(row.kind);
    return kind ? { ...row, kind } : row;
}

export async function listDocumentTemplates(): Promise<DocumentTemplate[]> {
    const rows = await practiceSystem.invoke<DocumentTemplate[]>("list_document_templates");
    return rows.map(coerceDocumentTemplate);
}

export async function createDocumentTemplate(data: {
    kind: DocumentTemplateKind | string;
    title: string;
    payload: Record<string, unknown>;
}): Promise<DocumentTemplate> {
    const kind = normalizeDocumentTemplateKind(data.kind) ?? data.kind;
    return practiceSystem.invoke<DocumentTemplate>("create_document_template", { data: { ...data, kind } });
}

export async function updateDocumentTemplate(
    id: string,
    data: { title?: string; payload?: Record<string, unknown> },
): Promise<DocumentTemplate> {
    return practiceSystem.invoke<DocumentTemplate>("update_document_template", { id, data });
}

export async function deleteDocumentTemplate(id: string): Promise<void> {
    return practiceSystem.invoke("delete_document_template", { id });
}

export async function listTreatmentCatalog(): Promise<TreatmentCatalogItem[]> {
    return practiceSystem.invoke<TreatmentCatalogItem[]>("list_treatment_catalog");
}

export async function createTreatmentCatalogItem(data: {
    category: string;
    name: string;
    default_cost?: number | null;
    sort_order?: number | null;
}): Promise<TreatmentCatalogItem> {
    return practiceSystem.invoke<TreatmentCatalogItem>("create_treatment_catalog_item", { data });
}

export async function updateTreatmentCatalogItem(
    id: string,
    data: {
        category: string;
        name: string;
        default_cost: number | null;
        sort_order?: number;
    },
): Promise<TreatmentCatalogItem> {
    return practiceSystem.invoke<TreatmentCatalogItem>("update_treatment_catalog_item", { id, data });
}

export async function deleteTreatmentCatalogItem(id: string): Promise<void> {
    return practiceSystem.invoke("delete_treatment_catalog_item", { id });
}

export async function listSupplierMaster(): Promise<SupplierMaster[]> {
    return practiceSystem.invoke<SupplierMaster[]>("list_supplier_master");
}

export async function createSupplierMaster(data: { name: string; sort_order?: number | null }): Promise<SupplierMaster> {
    return practiceSystem.invoke<SupplierMaster>("create_supplier_master", { data });
}

export async function deleteSupplierMaster(id: string): Promise<void> {
    return practiceSystem.invoke("delete_supplier_master", { id });
}

export async function listPharmaConsultantMaster(): Promise<PharmaConsultantMaster[]> {
    return practiceSystem.invoke<PharmaConsultantMaster[]>("list_pharma_consultant_master");
}

export async function createPharmaConsultantMaster(data: { name: string; sort_order?: number | null }): Promise<PharmaConsultantMaster> {
    return practiceSystem.invoke<PharmaConsultantMaster>("create_pharma_consultant_master", { data });
}

export async function deletePharmaConsultantMaster(id: string): Promise<void> {
    return practiceSystem.invoke("delete_pharma_consultant_master", { id });
}

export async function listSupplierPharmaTemplates(): Promise<SupplierPharmaTemplate[]> {
    return practiceSystem.invoke<SupplierPharmaTemplate[]>("list_supplier_pharma_templates");
}

export async function createSupplierPharmaTemplate(data: {
    supplier_id: string;
    pharma_consultant_id: string;
    product_id: string;
    sort_order?: number | null;
}): Promise<SupplierPharmaTemplate> {
    return practiceSystem.invoke<SupplierPharmaTemplate>("create_supplier_pharma_template", { data });
}

export async function deleteSupplierPharmaTemplate(id: string): Promise<void> {
    return practiceSystem.invoke("delete_supplier_pharma_template", { id });
}
