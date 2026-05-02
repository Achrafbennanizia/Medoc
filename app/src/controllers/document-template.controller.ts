import { tauriInvoke } from "@/services/tauri.service";
import type { DocumentTemplatePayloadV1 } from "@/lib/document-template-schema";
import type { DocumentKind } from "@/lib/document-template-schema";
import { uint8ToBase64 } from "@/lib/save-download";

export type DokumentTemplateDto = {
    id: string;
    kind: string;
    name: string;
    payload: string;
    isDefault: boolean;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
};

/** Tauri serializes `DokumentTemplateUser` with `camelCase` JSON keys. */
type DokumentTemplateRow = {
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

function normalizeDto(r: DokumentTemplateRow): DokumentTemplateDto {
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

export async function listDokumentTemplatesForKind(kind: DocumentKind): Promise<DokumentTemplateDto[]> {
    const rows = await tauriInvoke<DokumentTemplateRow[]>("list_dokument_templates_for_kind", { kind });
    return rows.map(normalizeDto);
}

export async function createDokumentTemplate(input: {
    kind: DocumentKind;
    name: string;
    payload: DocumentTemplatePayloadV1;
    isDefault?: boolean;
}): Promise<DokumentTemplateDto> {
    const row = await tauriInvoke<DokumentTemplateRow>("create_dokument_template", {
        data: {
            kind: input.kind,
            name: input.name,
            payload: JSON.stringify(input.payload),
            isDefault: Boolean(input.isDefault),
        },
    });
    return normalizeDto(row);
}

export async function updateDokumentTemplate(input: {
    id: string;
    name: string;
    payload: DocumentTemplatePayloadV1;
    isDefault?: boolean;
}): Promise<DokumentTemplateDto> {
    const row = await tauriInvoke<DokumentTemplateRow>("update_dokument_template", {
        data: {
            id: input.id,
            name: input.name,
            payload: JSON.stringify(input.payload),
            isDefault: Boolean(input.isDefault),
        },
    });
    return normalizeDto(row);
}

export async function deleteDokumentTemplate(id: string): Promise<void> {
    await tauriInvoke<void>("delete_dokument_template", { id });
}

export async function previewTemplatePdf(kind: DocumentKind, templateName: string, payload: DocumentTemplatePayloadV1): Promise<string> {
    return tauriInvoke<string>("preview_template_pdf", {
        args: {
            kind,
            templateName,
            templatePayloadJson: JSON.stringify(payload),
        },
    });
}

/** PDF mit Produktiv-Zeilinhalt (Export & Druck — strukturierte Vorlage, kein Roh-HTML). */
export async function previewDocumentPdf(
    kind: DocumentKind,
    templateName: string,
    payload: DocumentTemplatePayloadV1,
    bodyLines: string[],
): Promise<string> {
    return tauriInvoke<string>("preview_document_pdf", {
        args: {
            kind,
            templateName,
            templatePayloadJson: JSON.stringify(payload),
            bodyLines,
        },
    });
}

export async function pickExportDirectory(): Promise<string | null> {
    return tauriInvoke<string | null>("pick_export_directory");
}

export async function saveExportBytesToFolder(folder: string, fileName: string, bytes: Uint8Array): Promise<string> {
    return tauriInvoke<string>("save_export_bytes_to_folder", {
        folder,
        file_name: fileName,
        contents_base64: uint8ToBase64(bytes),
    });
}
