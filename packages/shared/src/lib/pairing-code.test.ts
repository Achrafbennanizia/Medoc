import { describe, expect, it } from "vitest";
import { isCompletePairingCode, normalizePairingCodeInput, PAIRING_CODE_LENGTH } from "./pairing-code";

describe("pairing code", () => {
    it("is six digits", () => expect(PAIRING_CODE_LENGTH).toBe(6));
    it("keeps digits only and cuts to six", () => expect(normalizePairingCodeInput("48 29-13 77")).toBe("482913"));
    it("accepts Arabic-Indic and Persian digits", () => {
        expect(normalizePairingCodeInput("٤٨٢٩١٣")).toBe("482913");
        expect(normalizePairingCodeInput("۴۸۲۹۱۳")).toBe("482913");
    });
    it("is complete only at six digits", () => {
        expect(isCompletePairingCode("4829")).toBe(false);
        expect(isCompletePairingCode("482913")).toBe(true);
    });
});
