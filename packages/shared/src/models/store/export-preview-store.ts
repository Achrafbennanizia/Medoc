import { create } from "zustand";
import type { ExportContext } from "@/lib/save-download";
import { pdfDocumentUid } from "@/lib/pdf-document-uid";

export type ExportFormat = "csv" | "html" | "json" | "pdf" | "xml" | "zip";

export type ExportPreviewPayload = {
    format: ExportFormat;
    title: string;
    /** Short context under the title (file type, notes). */
    hint?: string;
    suggestedFilename: string;
    textBody?: string;
    binaryBody?: Uint8Array;
    /** Audit context passed to the save command. */
    context?: ExportContext;
};

type State = {
    open: boolean;
    payload: ExportPreviewPayload | null;
    openExport: (p: ExportPreviewPayload) => void;
    close: () => void;
};

export const useExportPreviewStore = create<State>((set) => ({
    open: false,
    payload: null,
    openExport: (p) => set({ open: true, payload: p }),
    close: () => set({ open: false, payload: null }),
}));

/** Short form of a document id for file names (first block of the UUID). */
function shortUid(uid: string): string {
    return uid.split("-")[0] || uid;
}

/**
 * Every exported PDF carries its document id in the file name
 * (`Invoice_RE-2026-000001_ID-3f2a9c1e.pdf`), so a file found later can be
 * matched to `issued_document.id` / the export audit log. The full id is
 * inside the PDF (footer, metadata).
 */
export function withDocumentUidInFilename(filename: string, uid: string | null): string {
    if (!uid) return filename;
    const tag = `ID-${shortUid(uid)}`;
    if (filename.includes(tag)) return filename;
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? `${filename.slice(0, dot)}_${tag}${filename.slice(dot)}` : `${filename}_${tag}`;
}

export function openExportPreview(p: ExportPreviewPayload): void {
    const uid = p.format === "pdf" && p.binaryBody ? pdfDocumentUid(p.binaryBody) : null;
    useExportPreviewStore
        .getState()
        .openExport(uid ? { ...p, suggestedFilename: withDocumentUidInFilename(p.suggestedFilename, uid) } : p);
}
