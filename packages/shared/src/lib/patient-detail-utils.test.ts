import { describe, expect, it } from "vitest";
import {
    resolveDefaultUntersuchungKatalogItem,
} from "./patient-detail-utils";
import { EXAMINATION_CATALOG_CATEGORY } from "./behandlungs-katalog-categories";
import type { BehandlungsKatalogItem } from "@/models/types";

function item(
    id: string,
    kategorie: string,
    name: string,
    sort_order: number,
    default_kosten: number | null = null,
    aktiv = 1,
): BehandlungsKatalogItem {
    return {
        id,
        kategorie,
        name,
        default_kosten,
        sort_order,
        aktiv,
        created_at: "2026-01-01T00:00:00Z",
    };
}

describe("resolveDefaultUntersuchungKatalogItem", () => {
    it("picks lowest sort_order in Kontrolluntersuchung category", () => {
        const katalog = [
            item("b", EXAMINATION_CATALOG_CATEGORY, "Parodontalstatus", 20, 79),
            item("a", EXAMINATION_CATALOG_CATEGORY, "Recall / Kontrolle", 10, 49),
            item("c", "Chirurgie", "Extraction", 5, 120),
        ];
        const resolved = resolveDefaultUntersuchungKatalogItem(katalog);
        expect(resolved?.id).toBe("a");
        expect(resolved?.default_kosten).toBe(49);
    });

    it("ignores inactive catalog rows", () => {
        const katalog = [
            item("a", EXAMINATION_CATALOG_CATEGORY, "Recall", 10, 49, 0),
            item("b", EXAMINATION_CATALOG_CATEGORY, "Backup", 20, 39),
        ];
        expect(resolveDefaultUntersuchungKatalogItem(katalog)?.id).toBe("b");
    });

    it("returns null when no examination category exists", () => {
        const katalog = [item("c", "Chirurgie", "Extraction", 5, 120)];
        expect(resolveDefaultUntersuchungKatalogItem(katalog)).toBeNull();
    });
});
