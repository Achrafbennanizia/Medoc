import { describe, expect, it } from "vitest";
import {
    emptyDocumentTemplatePayloadV1,
    parseTemplatePayloadJson,
    templatePayloadToJson,
} from "./document-template-schema";

describe("parseTemplatePayloadJson", () => {
    it("rejects leftover German wires", () => {
        const raw = JSON.stringify({
            version: 1,
            kopf: { showLogo: true, fieldsToShow: ["name"], alignment: "center" },
            empfaenger: { visible: false, alignment: "right" },
        });
        expect(parseTemplatePayloadJson(raw)).toBeNull();
    });

    it("parses current English payload", () => {
        const empty = emptyDocumentTemplatePayloadV1();
        const parsed = parseTemplatePayloadJson(templatePayloadToJson(empty));
        expect(parsed).toEqual(empty);
    });
});
