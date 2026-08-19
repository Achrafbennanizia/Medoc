import { describe, expect, it } from "vitest";
import {
    emptyDocumentTemplatePayloadV1,
    parseTemplatePayloadJson,
    templatePayloadToJson,
} from "./document-template-schema";

describe("parseTemplatePayloadJson", () => {
    it("accepts leftover German field ids and writes English JSON", () => {
        const raw = JSON.stringify({
            version: 1,
            kopf: { showLogo: true, fieldsToShow: ["name", "ust_hinweis", "notfall_tel"], alignment: "center" },
            empfaenger: { visible: false, alignment: "right" },
            tableColumns: [
                { id: "pos", enabled: true },
                { id: "einzelpreis", enabled: true },
                { id: "gesamt", enabled: false },
                { id: "ust", enabled: true },
            ],
            signatur: { show: true, labelKind: "stempel" },
            fusszeile: "Thanks.",
            schriftart: "Times",
            bodyPt: 12,
            dichte: "kompakt",
            datumsformat: "iso",
        });
        const parsed = parseTemplatePayloadJson(raw);
        expect(parsed).not.toBeNull();
        expect(parsed?.header.showLogo).toBe(true);
        expect(parsed?.header.fieldsToShow).toEqual(["name", "vat_notice", "emergency_phone"]);
        expect(parsed?.recipient.visible).toBe(false);
        expect(parsed?.tableColumns.map((c) => c.id)).toEqual(["pos", "unit_price", "total", "vat"]);
        expect(parsed?.signature.labelKind).toBe("stamp");
        expect(parsed?.footer).toBe("Thanks.");
        expect(parsed?.font).toBe("Times");
        expect(parsed?.density).toBe("compact");
        expect(parsed?.dateFormat).toBe("iso");
        const roundTrip = parseTemplatePayloadJson(templatePayloadToJson(parsed!));
        expect(roundTrip?.header.fieldsToShow).toEqual(parsed?.header.fieldsToShow);
        expect(JSON.parse(templatePayloadToJson(parsed!)).kopf).toBeUndefined();
    });

    it("parses current English payload", () => {
        const empty = emptyDocumentTemplatePayloadV1();
        const parsed = parseTemplatePayloadJson(templatePayloadToJson(empty));
        expect(parsed).toEqual(empty);
    });
});
