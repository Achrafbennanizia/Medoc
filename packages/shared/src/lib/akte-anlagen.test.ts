import { describe, expect, it } from "vitest";
import {
    AKTE_ANLAGE_DOCUMENT_KIND_DEFAULT,
    mapAkteAnlageRowFromDto,
    normalizeAkteDocumentKind,
    validateAnlageFile,
} from "./akte-anlagen";

const t = (key: string) => key;

describe("akte-anlagen domain", () => {
    it("normalizes unknown document kinds to default", () => {
        expect(normalizeAkteDocumentKind("mrt")).toBe("MRT");
        expect(normalizeAkteDocumentKind("unknown")).toBe(AKTE_ANLAGE_DOCUMENT_KIND_DEFAULT);
    });

    it("rejects oversize files", () => {
        const big = { name: "scan.pdf", type: "application/pdf", size: 60 * 1024 * 1024 } as File;
        expect(validateAnlageFile(t, big)).toBe("anlage.error.file_too_large");
    });

    it("maps backend row DTO with injected preview URL", () => {
        const row = mapAkteAnlageRowFromDto(
            {
                id: "a1",
                display_name: "X-Ray.pdf",
                mime_type: "application/pdf",
                size_bytes: 1024,
                created_at: "2026-01-01T00:00:00Z",
                abs_path: "/tmp/x.pdf",
                document_kind: "ROENTGEN",
            },
            "asset://preview",
        );
        expect(row.previewUrl).toBe("asset://preview");
        expect(row.documentKind).toBe("ROENTGEN");
        expect(row.name).toBe("X-Ray.pdf");
    });
});
