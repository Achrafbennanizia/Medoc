import { create } from "zustand";

export type ExportFormat = "csv" | "json" | "pdf" | "xml" | "zip";

export type ExportPreviewPayload = {
    format: ExportFormat;
    title: string;
    /** Kurzer Kontext unter dem Titel (Dateityp, Hinweise). */
    hint?: string;
    suggestedFilename: string;
    textBody?: string;
    binaryBody?: Uint8Array;
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

export function openExportPreview(p: ExportPreviewPayload): void {
    useExportPreviewStore.getState().openExport(p);
}
