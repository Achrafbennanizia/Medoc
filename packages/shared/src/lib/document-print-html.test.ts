import { describe, expect, it } from "vitest";
import { suggestCertificateExportBasename } from "./document-print-html";

describe("suggestCertificateExportBasename", () => {
    it("uses an English Certificate_ prefix", () => {
        const name = suggestCertificateExportBasename({
            id: "abcdefgh-rest",
            issued_at: "2026-08-20T10:00:00.000Z",
        } as Parameters<typeof suggestCertificateExportBasename>[0]);
        expect(name).toBe("Certificate_2026-08-20_abcdefgh");
        expect(name.startsWith("Attest_")).toBe(false);
    });
});
