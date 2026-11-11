import { create } from "zustand";
import type { ExportContext } from "@/lib/save-download";

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

export function openExportPreview(p: ExportPreviewPayload): void {
    useExportPreviewStore.getState().openExport(p);
}
