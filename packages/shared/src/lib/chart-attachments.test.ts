import { describe, expect, it } from "vitest";
import {
    CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
    mapChartAttachmentRowFromDto,
    normalizeChartDocumentKind,
    validateAttachmentFile,
} from "./chart-attachments";

const t = (key: string) => key;

describe("chart-attachments domain", () => {
    it("normalizes unknown document kinds to default", () => {
        expect(normalizeChartDocumentKind("mrt")).toBe("MRT");
        expect(normalizeChartDocumentKind("unknown")).toBe(CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT);
    });

    it("rejects oversize files", () => {
        const big = { name: "scan.pdf", type: "application/pdf", size: 60 * 1024 * 1024 } as File;
        expect(validateAttachmentFile(t, big)).toBe("attachment.error.file_too_large");
    });

    it("maps backend row DTO with injected preview URL", () => {
        const row = mapChartAttachmentRowFromDto(
            {
                id: "a1",
                display_name: "X-Ray.pdf",
                mime_type: "application/pdf",
                size_bytes: 1024,
                created_at: "2026-01-01T00:00:00Z",
                abs_path: "/tmp/x.pdf",
                document_kind: "XRAY",
            },
            "asset://preview",
        );
        expect(row.previewUrl).toBe("asset://preview");
        expect(row.documentKind).toBe("XRAY");
        expect(row.name).toBe("X-Ray.pdf");
    });
});
