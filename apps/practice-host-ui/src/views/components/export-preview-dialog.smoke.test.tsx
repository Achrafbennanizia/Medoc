/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportPreviewDialog } from "./export-preview-dialog";

vi.mock("@/lib/save-download", () => ({
    saveOrDownloadBytes: vi.fn(),
    saveOrDownloadText: vi.fn(),
}));

afterEach(() => {
    cleanup();
});

describe("ExportPreviewDialog (UX-9 / W10)", () => {
    it("renders HTML preview iframe for WKWebView-safe export path", () => {
        render(
            <ExportPreviewDialog
                payload={{
                    format: "html",
                    title: "Akte-Export",
                    suggestedFilename: "akte.html",
                    textBody: "<p>Patient Smoke</p>",
                }}
                onClose={() => {}}
            />,
        );
        expect(screen.getByTitle("HTML-Vorschau")).toBeInTheDocument();
        expect(screen.getByText(/Akte-Export/)).toBeInTheDocument();
    });
});
