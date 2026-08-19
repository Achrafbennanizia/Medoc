import { beforeEach, describe, expect, it } from "vitest";

import { openExportPreview, useExportPreviewStore } from "./export-preview-store";

describe("export-preview-store", () => {
    beforeEach(() => {
        useExportPreviewStore.setState({ open: false, payload: null });
    });

    it("openExportPreview sets pdf payload for WKWebView iframe preview", () => {
        const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
        openExportPreview({
            format: "pdf",
            title: "Prescription PDF",
            suggestedFilename: "prescription.pdf",
            binaryBody: bytes,
            hint: "Vorschau im eingebetteten Frame (Tauri WKWebView)",
        });
        const state = useExportPreviewStore.getState();
        expect(state.open).toBe(true);
        expect(state.payload?.format).toBe("pdf");
        expect(state.payload?.binaryBody).toEqual(bytes);
    });

    it("close clears open flag", () => {
        openExportPreview({
            format: "csv",
            title: "Export",
            suggestedFilename: "export.csv",
            textBody: "a,b",
        });
        useExportPreviewStore.getState().close();
        expect(useExportPreviewStore.getState().open).toBe(false);
        expect(useExportPreviewStore.getState().payload).toBeNull();
    });
});
