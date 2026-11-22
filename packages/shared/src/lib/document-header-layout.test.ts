import { describe, expect, it } from "vitest";
import {
    DEFAULT_PDF_HEADER_FIELDS,
    headerTableJson,
    headerTableRowCount,
    insertHeaderField,
    moveHeaderField,
    parseHeaderLayout,
    parseHeaderTable,
    placeHeaderField,
    tableFromFieldList,
} from "./document-header-layout";

describe("document header layout", () => {
    it("keeps the official letterhead when nothing is saved", () => {
        expect(parseHeaderLayout(null)).toBeNull();
        expect(parseHeaderLayout("")).toBeNull();
        expect(DEFAULT_PDF_HEADER_FIELDS[0]).toBe("name");
        expect(DEFAULT_PDF_HEADER_FIELDS).toContain("zanr");
    });

    it("reads a saved field order and drops unknown or repeated names", () => {
        expect(parseHeaderLayout('{"fields":["zanr","name","nope","name"]}')).toEqual(["zanr", "name"]);
        expect(parseHeaderLayout("not json")).toBeNull();
    });

    it("inserts a palette block and moves blocks already on the header", () => {
        expect(insertHeaderField(["name", "address"], "phone", 1)).toEqual(["name", "phone", "address"]);
        expect(insertHeaderField(["name", "phone", "address"], "phone", 0)).toEqual([
            "phone",
            "name",
            "address",
        ]);
        expect(moveHeaderField(["name", "address", "phone"], 0, 2)).toEqual(["address", "name", "phone"]);
        expect(moveHeaderField(["name", "address", "phone"], 2, 0)).toEqual(["phone", "name", "address"]);
    });

    it("keeps two columns and six to eight rows, with holes", () => {
        const packed = tableFromFieldList(["name", "address", "phone", "fax"]);
        expect(packed[0]).toEqual(["name", "address"]);
        expect(packed[1]).toEqual(["phone", "fax"]);
        expect(headerTableRowCount(packed)).toBe(6);
        const saved = parseHeaderTable('{"rows":[["phone",null],["email","fax"]]}');
        expect(saved?.[0]).toEqual(["phone", null]);
        expect(saved?.[1]).toEqual(["email", "fax"]);
        expect(headerTableJson(saved!)).toBe('{"rows":[["phone",null],["email","fax"]]}');
        const swapped = placeHeaderField(saved!, "phone", 1, 1);
        expect(swapped[0]).toEqual(["fax", null]);
        expect(swapped[1]).toEqual(["email", "phone"]);
        const full = tableFromFieldList(DEFAULT_PDF_HEADER_FIELDS);
        expect(headerTableRowCount(placeHeaderField(full, "tax", 5, 0))).toBe(7);
    });
});
