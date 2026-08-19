import { describe, expect, it } from "vitest";
import {
    resolveDefaultExaminationCatalogItem,
} from "./patient-detail-utils";
import { EXAMINATION_CATALOG_CATEGORY } from "./treatment-catalog-categories";
import type { TreatmentCatalogItem } from "@/models/types";

function item(
    id: string,
    category: string,
    name: string,
    sort_order: number,
    default_cost: number | null = null,
    active = 1,
): TreatmentCatalogItem {
    return {
        id,
        category,
        name,
        default_cost,
        sort_order,
        active,
        created_at: "2026-01-01T00:00:00Z",
    };
}

describe("resolveDefaultExaminationCatalogItem", () => {
    it("picks lowest sort_order in Checkup category", () => {
        const catalog = [
            item("b", EXAMINATION_CATALOG_CATEGORY, "Parodontalstatus", 20, 79),
            item("a", EXAMINATION_CATALOG_CATEGORY, "Recall / Kontrolle", 10, 49),
            item("c", "Surgery", "Extraction", 5, 120),
        ];
        const resolved = resolveDefaultExaminationCatalogItem(catalog);
        expect(resolved?.id).toBe("a");
        expect(resolved?.default_cost).toBe(49);
    });

    it("ignores inactive catalog rows", () => {
        const catalog = [
            item("a", EXAMINATION_CATALOG_CATEGORY, "Recall", 10, 49, 0),
            item("b", EXAMINATION_CATALOG_CATEGORY, "Backup", 20, 39),
        ];
        expect(resolveDefaultExaminationCatalogItem(catalog)?.id).toBe("b");
    });

    it("returns null when no examination category exists", () => {
        const catalog = [item("c", "Surgery", "Extraction", 5, 120)];
        expect(resolveDefaultExaminationCatalogItem(catalog)).toBeNull();
    });
});
