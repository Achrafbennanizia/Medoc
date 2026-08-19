import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { DocumentTemplatePayloadV1 } from "@/lib/document-template-schema";
import type { DocumentKind } from "@/lib/document-template-schema";
import { uint8ToBase64 } from "@/lib/save-download";

export type DocumentTemplateDto = {
    id: string;
    kind: string;
    name: string;
    payload: string;
    isDefault: boolean;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
};

/** Tauri serializes `DocumentTemplateUser` with `camelCase` JSON keys. */
type DocumentTemplateRow = {
    id: string;
    kind: string;
    name: string;
    payload: string;
    isDefault?: number | boolean;
    /** legacy snake_case if ever returned */
    is_default?: number | boolean;
    createdBy?: string | null;
    created_by?: string | null;
    createdAt?: string;
    created_at?: string;
    updatedAt?: string;
    updated_at?: string;
};

function normalizeDto(r: DocumentTemplateRow): DocumentTemplateDto {
    const rawDef = r.isDefault ?? r.is_default ?? 0;
    const isDefault = rawDef === true || rawDef === 1;
    return {
        id: r.id,
        kind: r.kind,
        name: r.name,
        payload: r.payload,
        isDefault,
        createdBy: r.createdBy ?? r.created_by ?? null,
        createdAt: r.createdAt ?? r.created_at ?? "",
        updatedAt: r.updatedAt ?? r.updated_at ?? "",
    };
}

export async function listDocumentTemplatesForKind(kind: DocumentKind): Promise<DocumentTemplateDto[]> {
    const rows = await practiceSystem.invoke<DocumentTemplateRow[]>("list_document_templates_for_kind", { kind });
    return rows.map(normalizeDto);
}

/** PDF with structured template and production line content (no raw HTML). */
export async function previewDocumentPdf(
    kind: DocumentKind,
    templateName: string,
    payload: DocumentTemplatePayloadV1,
    bodyLines: string[],
    layoutJson?: string | null,
): Promise<string> {
    return practiceSystem.invoke<string>("preview_document_pdf", {
        args: {
            kind,
            templateName,
            templatePayloadJson: JSON.stringify(payload),
            bodyLines,
            layoutJson: layoutJson ?? null,
        },
    });
}

export async function pickExportDirectory(): Promise<string | null> {
    return practiceSystem.invoke<string | null>("pick_export_directory");
}

export async function saveExportBytesToFolder(folder: string, fileName: string, bytes: Uint8Array): Promise<string> {
    return practiceSystem.invoke<string>("save_export_bytes_to_folder", {
        folder,
        file_name: fileName,
        contents_base64: uint8ToBase64(bytes),
    });
}
